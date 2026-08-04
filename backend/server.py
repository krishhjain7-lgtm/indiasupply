"""Norvian.ai — B2B Export Platform MVP.

Single-file FastAPI backend covering: Emergent Google Auth, Buyer/Exporter/Admin roles,
RFQs, exporter catalogues, quotations, orders, milestones, documents,
AI-assisted RFQ improvement (Claude Sonnet 4.5 via Emergent LLM key),
Resend transactional email, Emergent managed Object Storage for files,
demo seeding for YC review.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form, Depends, Header, Query
from fastapi.responses import Response as FastResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
import os, uuid, logging, json, httpx, requests, asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
EMERGENT_EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Norvian")
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
APP_NAME = os.environ.get("APP_NAME", "norvian")
OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "krishhjain7@gmail.com").lower()
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"

# Browsers reject Access-Control-Allow-Origin: "*" on credentialed requests, so a wildcard here
# means session cookies silently stop working in production. Refuse to boot instead of half-working.
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
if not CORS_ORIGINS or "*" in CORS_ORIGINS:
    raise RuntimeError(
        "CORS_ORIGINS must be set to an explicit comma-separated origin list "
        "(e.g. CORS_ORIGINS=https://app.norvian.ai). A wildcard is invalid with "
        "allow_credentials=True and breaks cookie authentication."
    )

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("norvian")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await startup()
    yield

app = FastAPI(title="Norvian API", lifespan=lifespan)
api = APIRouter(prefix="/api")

# ---------- Storage ----------
storage_key: Optional[str] = None

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        r.raise_for_status()
        storage_key = r.json()["storage_key"]
        return storage_key
    except Exception as e:
        logger.error(f"storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage unavailable")
    r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    r.raise_for_status()
    return r.json()

def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage unavailable")
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")

# ---------- Auth ----------
async def get_current_user(request: Request) -> Optional[dict]:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1]
    if not token:
        return None
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        return None
    exp = sess.get("expires_at")
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp < datetime.now(timezone.utc):
        return None
    return await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})

async def require_user(request: Request) -> dict:
    u = await get_current_user(request)
    if not u:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return u

async def require_admin(request: Request) -> dict:
    u = await require_user(request)
    if u.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return u

# ---------- Tenancy & serialisation ----------
# Buyer quotations carry the internal cost build-up on the same document the buyer receives,
# so stripping is structural rather than per-endpoint: every non-admin response goes through
# public_quotation(). A new endpoint cannot leak margin by forgetting to pop() the fields.
INTERNAL_FIELDS = ("internal_costs", "internal_notes")

# Draft quotations are internal. A buyer only sees one once it has been published to them.
BUYER_VISIBLE_QUOTATION_STATUSES = ("published", "sent", "accepted")

def public_quotation(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k not in INTERNAL_FIELDS}

def company_scope(user: dict) -> Optional[str]:
    """A user's tenant key, or None when they have no company yet.

    None must never be used as a query value: anonymous public RFQs are stored with
    buyer_company_id None, so {"buyer_company_id": None} would match other people's records.
    Callers treat None as "sees nothing".
    """
    return user.get("company_id") or None

async def buyer_rfq_ids(user: dict) -> List[str]:
    cid = company_scope(user)
    if not cid:
        return []
    cur = db.rfqs.find({"buyer_company_id": cid}, {"_id": 0, "rfq_id": 1})
    return [r["rfq_id"] async for r in cur]

async def exporter_invited_rfq_ids(user: dict) -> List[str]:
    cid = company_scope(user)
    if not cid:
        return []
    cur = db.exporter_invitations.find({"exporter_company_id": cid}, {"_id": 0, "rfq_id": 1})
    return [i["rfq_id"] async for i in cur]

# An invited exporter sees the requirement but never the buyer's identity — that is what
# keeps the transaction on the platform.
EXPORTER_HIDDEN_RFQ_FIELDS = ("contact_name", "contact_email", "contact_company", "contact_country",
                              "buyer_user_id", "buyer_company_id")

def exporter_rfq(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k not in EXPORTER_HIDDEN_RFQ_FIELDS}

async def scope_buyer_quotations(user: dict, docs: List[dict]) -> List[dict]:
    """The only place that decides what a caller may see of buyer_quotations."""
    if user.get("role") == "admin":
        return docs
    if user.get("role") != "buyer":
        return []
    allowed = set(await buyer_rfq_ids(user))
    return [
        public_quotation(d) for d in docs
        if d.get("rfq_id") in allowed and d.get("status") in BUYER_VISIBLE_QUOTATION_STATUSES
    ]

# ---------- Email ----------
async def send_email(to: str, subject: str, html: str, reply_to: Optional[str] = None):
    if not EMERGENT_EMAIL_KEY:
        logger.warning("no email key; skipping send")
        return {"status": "skipped"}
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to:
        payload["contact_email"] = reply_to
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{EMAIL_BASE_URL}/api/v1/email/send", headers={"X-Email-Key": EMERGENT_EMAIL_KEY}, json=payload)
            r.raise_for_status()
        return {"status": "sent"}
    except Exception as e:
        logger.error(f"email failed: {e}")
        return {"status": "failed"}

# ---------- Session models ----------
class SessionAuthReq(BaseModel):
    session_id: str

@api.post("/auth/session")
async def create_session(body: SessionAuthReq, response: Response):
    """Exchange Emergent session_id for backend session cookie."""
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data", headers={"X-Session-ID": body.session_id})
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"OAuth exchange failed: {e}")
    email = data["email"].lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        role = existing.get("role") or ("admin" if email == OWNER_EMAIL else "buyer")
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": data.get("name"), "picture": data.get("picture"), "role": role}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        role = "admin" if email == OWNER_EMAIL else "buyer"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": data.get("name"), "picture": data.get("picture"),
            "role": role, "onboarded": False, "company_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie("session_token", session_token, httponly=True, secure=True, samesite="none", max_age=7*24*3600, path="/")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user, "session_token": session_token}

@api.get("/auth/me")
async def auth_me(user: dict = Depends(require_user)):
    return user

@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

# ---------- Onboarding ----------
class BuyerOnboardingReq(BaseModel):
    full_name: str
    work_email: EmailStr
    company_name: str
    company_website: Optional[str] = None
    country: str
    whatsapp: Optional[str] = None
    buyer_type: str

@api.post("/onboarding/buyer")
async def onboard_buyer(body: BuyerOnboardingReq, user: dict = Depends(require_user)):
    company_id = f"co_{uuid.uuid4().hex[:10]}"
    await db.companies.insert_one({
        "company_id": company_id, "kind": "buyer",
        "name": body.company_name, "website": body.company_website,
        "country": body.country, "whatsapp": body.whatsapp,
        "buyer_type": body.buyer_type,
        "verification_status": "email_verified",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "owner_user_id": user["user_id"],
    })
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {
        "role": "buyer" if user.get("role") != "admin" else "admin",
        "company_id": company_id, "full_name": body.full_name, "work_email": body.work_email,
        "onboarded": True,
    }})
    await send_email(body.work_email, "Welcome to Norvian",
        f"<p>Hi {body.full_name},</p><p>Your Norvian buyer account is ready. Submit your first sourcing requirement anytime.</p><p>— Norvian</p>")
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})

class ExporterOnboardingReq(BaseModel):
    contact_name: str
    company_name: str
    work_email: EmailStr
    whatsapp: str
    city: str
    state: str
    main_category: str
    company_type: str
    website: Optional[str] = None
    short_description: str
    min_order_value: Optional[str] = None

@api.post("/onboarding/exporter")
async def onboard_exporter(body: ExporterOnboardingReq, user: dict = Depends(require_user)):
    company_id = f"co_{uuid.uuid4().hex[:10]}"
    await db.companies.insert_one({
        "company_id": company_id, "kind": "exporter",
        "name": body.company_name, "website": body.website,
        "city": body.city, "state": body.state,
        "main_category": body.main_category, "company_type": body.company_type,
        "short_description": body.short_description,
        "min_order_value": body.min_order_value, "whatsapp": body.whatsapp,
        "verification_level": "basic",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "owner_user_id": user["user_id"],
    })
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {
        "role": "exporter" if user.get("role") != "admin" else "admin",
        "company_id": company_id, "full_name": body.contact_name, "work_email": body.work_email,
        "onboarded": True,
    }})
    # Claim invitations addressed to this exporter by email before they had an account.
    await db.exporter_invitations.update_many(
        {"exporter_company_id": None,
         "invited_email": {"$in": [body.work_email.lower(), (user.get("email") or "").lower()]}},
        {"$set": {"exporter_company_id": company_id}},
    )
    await send_email(body.work_email, "Norvian — Application Received",
        f"<p>Hi {body.contact_name},</p><p>Thanks for applying. Your profile has been received. We will contact you when we have a relevant buyer requirement.</p><p>— Norvian</p>")
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})

# Public exporter registration (no auth) — creates a lightweight lead
class PublicExporterLead(ExporterOnboardingReq):
    pass

@api.post("/public/exporter-lead")
async def public_exporter_lead(body: PublicExporterLead):
    lead_id = f"lead_{uuid.uuid4().hex[:10]}"
    await db.exporter_leads.insert_one({
        "lead_id": lead_id, **body.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await send_email(body.work_email, "Norvian — Application Received",
        f"<p>Hi {body.contact_name},</p><p>Your profile has been received. We will contact you when we have a relevant buyer requirement.</p><p>— Norvian</p>")
    return {"lead_id": lead_id}

# ---------- RFQ ----------
class RFQCreate(BaseModel):
    product_category: str
    product_name: str
    short_description: str
    kind: str  # catalogue | private_label | custom
    quantity: str
    target_order_value: Optional[str] = None
    target_unit_price: Optional[str] = None
    references: Optional[List[str]] = []
    sample_required: bool = False
    desired_sample_date: Optional[str] = None
    desired_production_date: Optional[str] = None
    destination_country: str
    destination_city: Optional[str] = None
    payment_structure: Optional[str] = None
    current_sourcing: Optional[str] = None
    main_concern: Optional[str] = None
    category_fields: Optional[Dict[str, Any]] = {}
    # public submissions may include contact info
    contact_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_company: Optional[str] = None
    contact_country: Optional[str] = None

def next_rfq_number():
    return f"NRV-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:5].upper()}"

# ---------- RFQ status vocabulary ----------
# The single definition of the status vocabulary and the legal moves between states. Served to
# the dashboard at /api/meta/rfq-statuses so the UI cannot drift from what the API will accept.
RFQ_STATUS_FLOW: Dict[str, List[str]] = {
    "submitted":                ["needs_clarification", "under_review", "rejected"],
    "needs_clarification":      ["under_review", "rejected"],
    "under_review":             ["needs_clarification", "sent_for_quotation", "rejected"],
    "sent_for_quotation":       ["quotations_received", "needs_clarification", "rejected"],
    "quotations_received":      ["buyer_quotation_prepared", "sent_for_quotation", "rejected"],
    "buyer_quotation_prepared": ["sample_requested", "awaiting_deposit", "quotations_received", "rejected"],
    "sample_requested":         ["sample_in_progress", "rejected"],
    "sample_in_progress":       ["sample_approved", "sample_requested", "rejected"],
    "sample_approved":          ["awaiting_deposit", "rejected"],
    "awaiting_deposit":         ["in_production", "disputed", "closed"],
    "in_production":            ["quality_inspection", "disputed"],
    "quality_inspection":       ["ready_to_ship", "in_production", "disputed"],
    "ready_to_ship":            ["shipped", "disputed"],
    "shipped":                  ["delivered", "disputed"],
    "delivered":                ["closed", "disputed"],
    "disputed":                 ["under_review", "closed"],
    "closed":                   [],
    "rejected":                 [],
}
RFQ_STATUSES = tuple(RFQ_STATUS_FLOW)

@api.get("/meta/rfq-statuses")
async def rfq_status_meta(user: dict = Depends(require_user)):
    return {"statuses": list(RFQ_STATUSES), "transitions": RFQ_STATUS_FLOW}

@api.post("/rfqs")
async def create_rfq(body: RFQCreate, request: Request):
    user = await get_current_user(request)
    rfq_id = f"rfq_{uuid.uuid4().hex[:10]}"
    rfq_number = next_rfq_number()
    doc = {
        "rfq_id": rfq_id, "rfq_number": rfq_number,
        "buyer_user_id": user["user_id"] if user else None,
        "buyer_company_id": user.get("company_id") if user else None,
        **body.model_dump(),
        "status": "submitted",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.rfqs.insert_one(doc)
    # Attach uploaded references to the RFQ so invited exporters can read them (files are
    # uploaded before the RFQ exists, so the link can only be made here).
    if user and body.references:
        await db.files.update_many(
            {"file_id": {"$in": list(body.references)}, "user_id": user["user_id"]},
            {"$set": {"rfq_id": rfq_id}},
        )
    # Notify admin owner
    await send_email(OWNER_EMAIL, f"New RFQ {rfq_number}",
        f"<p>New RFQ received.</p><ul><li>Product: {body.product_name}</li><li>Category: {body.product_category}</li><li>Qty: {body.quantity}</li><li>Destination: {body.destination_country}</li></ul>")
    # Confirmation to buyer if email known
    to = (user or {}).get("work_email") or (user or {}).get("email") or body.contact_email
    if to:
        await send_email(to, f"RFQ received — {rfq_number}",
            f"<p>Your requirement has been submitted.</p><p>Reference: <strong>{rfq_number}</strong></p><p>We will review and follow up shortly.</p>")
    return {"rfq_id": rfq_id, "rfq_number": rfq_number}

@api.get("/rfqs")
async def list_rfqs(request: Request, user: dict = Depends(require_user)):
    q: Dict[str, Any] = {}
    if user.get("role") == "buyer":
        cid = company_scope(user)
        if not cid:
            return []
        q["buyer_company_id"] = cid
    elif user.get("role") == "exporter":
        # Only RFQs where this exporter has been invited
        ids = await exporter_invited_rfq_ids(user)
        if not ids:
            return []
        q["rfq_id"] = {"$in": ids}
    # admin sees all
    items = await db.rfqs.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    if user.get("role") == "exporter":
        items = [exporter_rfq(r) for r in items]
    return items

@api.get("/rfqs/{rfq_id}")
async def get_rfq(rfq_id: str, user: dict = Depends(require_user)):
    rfq = await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "Not found")
    if user.get("role") == "buyer":
        cid = company_scope(user)
        if not cid or rfq.get("buyer_company_id") != cid:
            raise HTTPException(403, "Forbidden")
    if user.get("role") == "exporter":
        cid = company_scope(user)
        inv = await db.exporter_invitations.find_one({"rfq_id": rfq_id, "exporter_company_id": cid}) if cid else None
        if not inv:
            raise HTTPException(403, "Forbidden")
        if inv.get("status") == "invited":
            await db.exporter_invitations.update_one(
                {"invitation_id": inv["invitation_id"]},
                {"$set": {"status": "viewed", "viewed_at": datetime.now(timezone.utc).isoformat()}})
        rfq = exporter_rfq(rfq)
    return rfq

@api.patch("/rfqs/{rfq_id}/status")
async def update_rfq_status(rfq_id: str, body: dict, user: dict = Depends(require_admin)):
    new = body.get("status")
    if new not in RFQ_STATUS_FLOW:
        raise HTTPException(422, f"Unknown status '{new}'")
    rfq = await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0, "status": 1})
    if not rfq:
        raise HTTPException(404, "Not found")
    current = rfq.get("status") or "submitted"
    if new != current and new not in RFQ_STATUS_FLOW.get(current, []):
        raise HTTPException(422, f"Illegal transition {current} -> {new}")
    await db.rfqs.update_one({"rfq_id": rfq_id}, {"$set": {"status": new}})
    await db.activity_logs.insert_one({"kind": "rfq_status", "rfq_id": rfq_id, "by": user["user_id"], "from": current, "to": new, "at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True, "status": new}

# ---------- AI-assist RFQ ----------
class AIAssistReq(BaseModel):
    raw_text: str
    category: Optional[str] = "jewellery"

@api.post("/rfqs/ai-assist")
async def ai_assist(body: AIAssistReq):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "AI unavailable — EMERGENT_LLM_KEY missing")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(503, f"AI library missing: {e}")
    system = ("You are a sourcing analyst helping structure a buyer's product requirement. "
              "Return STRICT JSON only, matching this schema: "
              '{"summary":"...","provided":{"product_name":"","quantity":"","materials":"","dimensions":"","destination":"","other":""},'
              '"missing_fields":[""],"suggested_questions":[""],"structured_draft":{"product_category":"jewellery","product_name":"","short_description":"","quantity":"","destination_country":""}}. '
              "Never invent facts. Use empty strings for unknowns.")
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"rfq-{uuid.uuid4().hex[:8]}", system_message=system).with_model("anthropic", "claude-sonnet-4-5-20250929")
    reply_text = ""
    try:
        from emergentintegrations.llm.chat import TextDelta, StreamDone
        async for ev in chat.stream_message(UserMessage(text=f"Category: {body.category}\n\nBuyer text:\n{body.raw_text}\n\nReturn JSON only.")):
            if isinstance(ev, TextDelta):
                reply_text += ev.content
            elif isinstance(ev, StreamDone):
                break
    except Exception as e:
        raise HTTPException(500, f"AI failed: {e}")
    reply_text = reply_text.strip()
    if reply_text.startswith("```"):
        reply_text = reply_text.strip("`")
        reply_text = reply_text.split("\n", 1)[-1] if "\n" in reply_text else reply_text
        if reply_text.endswith("```"):
            reply_text = reply_text[:-3]
    try:
        parsed = json.loads(reply_text)
    except Exception:
        # Best-effort — return raw text plus label
        parsed = {"summary": reply_text, "provided": {}, "missing_fields": [], "suggested_questions": [], "structured_draft": {}}
    parsed["_label"] = "AI-assisted draft — review before submitting"
    return parsed

# ---------- Catalogue ----------
class CatalogueProduct(BaseModel):
    product_name: str
    category: str
    material: Optional[str] = None
    description: Optional[str] = None
    moq: Optional[str] = None
    lead_time: Optional[str] = None
    customization: Optional[str] = None
    image_url: Optional[str] = None
    indicative_price: Optional[str] = None
    demo: bool = False

@api.get("/catalogue")
async def list_catalogue(demo_only: bool = False):
    q = {"published": True}
    if demo_only:
        q["demo"] = True
    items = await db.catalogue_products.find(q, {"_id": 0}).to_list(500)
    return items

@api.post("/catalogue")
async def create_catalogue_product(body: CatalogueProduct, user: dict = Depends(require_admin)):
    pid = f"prod_{uuid.uuid4().hex[:10]}"
    doc = {"product_id": pid, **body.model_dump(), "published": True, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.catalogue_products.insert_one(doc)
    doc.pop("_id", None)
    return doc

# ---------- Exporter Invitations & Quotations ----------
INVITATION_STATUSES = ("invited", "viewed", "quoted", "declined")

class InviteReq(BaseModel):
    rfq_id: str
    # Either an exporter already on the platform, or an email address for one that is not.
    exporter_company_id: Optional[str] = None
    email: Optional[EmailStr] = None
    company_name: Optional[str] = None

async def invitation_email(rfq: dict, to: str, company_name: Optional[str] = None):
    """The exporter is told what is being asked for — never who is asking."""
    await send_email(
        to,
        f"Norvian — requirement {rfq.get('rfq_number')} ({rfq.get('product_category')})",
        f"<p>Hello{(' ' + company_name) if company_name else ''},</p>"
        f"<p>You have been invited to quote on a buyer requirement.</p>"
        f"<ul><li>Reference: <strong>{rfq.get('rfq_number')}</strong></li>"
        f"<li>Product: {rfq.get('product_name')}</li>"
        f"<li>Quantity: {rfq.get('quantity')}</li>"
        f"<li>Destination: {rfq.get('destination_country')}</li></ul>"
        f"<p>Sign in to Norvian to see the full specification and submit a quotation.</p>"
        f"<p>— Norvian</p>",
    )

@api.post("/admin/invitations")
async def invite(body: InviteReq, user: dict = Depends(require_admin)):
    if not body.exporter_company_id and not body.email:
        raise HTTPException(422, "Provide an exporter company or an email address")
    rfq = await db.rfqs.find_one({"rfq_id": body.rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "Not found")

    company = None
    if body.exporter_company_id:
        company = await db.companies.find_one({"company_id": body.exporter_company_id}, {"_id": 0})
        if not company:
            raise HTTPException(404, "Not found")
        existing = await db.exporter_invitations.find_one(
            {"rfq_id": body.rfq_id, "exporter_company_id": body.exporter_company_id}, {"_id": 0})
        if existing:
            return existing

    invited_email = body.email or (company or {}).get("work_email")
    if not invited_email and company:
        owner = await db.users.find_one({"user_id": company.get("owner_user_id")}, {"_id": 0})
        invited_email = (owner or {}).get("work_email") or (owner or {}).get("email")

    inv_id = f"inv_{uuid.uuid4().hex[:10]}"
    doc = {
        "invitation_id": inv_id, "rfq_id": body.rfq_id,
        "exporter_company_id": body.exporter_company_id,
        "invited_email": (invited_email or "").lower() or None,
        "company_name": body.company_name or (company or {}).get("name"),
        "status": "invited", "invited_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.exporter_invitations.insert_one(doc)
    doc.pop("_id", None)
    if invited_email:
        await invitation_email(rfq, invited_email, doc["company_name"])
    await db.activity_logs.insert_one({"kind": "exporter_invited", "rfq_id": body.rfq_id,
                                       "invitation_id": inv_id, "by": user["user_id"],
                                       "at": datetime.now(timezone.utc).isoformat()})
    return doc

@api.get("/admin/invitations")
async def admin_list_invitations(rfq_id: str, user: dict = Depends(require_admin)):
    return await db.exporter_invitations.find({"rfq_id": rfq_id}, {"_id": 0}).sort("created_at", 1).to_list(200)

@api.get("/invitations")
async def list_invitations(user: dict = Depends(require_user)):
    """An exporter's own invitations, each with the requirement attached and the buyer scrubbed."""
    if user.get("role") != "exporter":
        raise HTTPException(403, "Exporters only")
    cid = company_scope(user)
    if not cid:
        return []
    invs = await db.exporter_invitations.find({"exporter_company_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(200)
    out = []
    for inv in invs:
        rfq = await db.rfqs.find_one({"rfq_id": inv["rfq_id"]}, {"_id": 0})
        out.append({**inv, "rfq": exporter_rfq(rfq) if rfq else None})
    return out

@api.post("/invitations/{invitation_id}/decline")
async def decline_invitation(invitation_id: str, user: dict = Depends(require_user)):
    cid = company_scope(user)
    inv = await db.exporter_invitations.find_one(
        {"invitation_id": invitation_id, "exporter_company_id": cid}, {"_id": 0}) if cid else None
    if not inv:
        raise HTTPException(404, "Not found")
    await db.exporter_invitations.update_one({"invitation_id": invitation_id}, {"$set": {
        "status": "declined", "declined_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True, "status": "declined"}

@api.get("/admin/companies")
async def list_companies(kind: Optional[str] = None, user: dict = Depends(require_admin)):
    q = {"kind": kind} if kind else {}
    return await db.companies.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.get("/admin/users")
async def list_users(user: dict = Depends(require_admin)):
    return await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

class QuotationCreate(BaseModel):
    rfq_id: str
    unit_price: float
    currency: str = "USD"
    quantity: str
    moq: Optional[str] = None
    sample_price: Optional[float] = None
    dev_cost: Optional[float] = None
    lead_time: Optional[str] = None
    payment_terms: Optional[str] = None
    validity: Optional[str] = None
    incoterm: Optional[str] = None
    packaging: Optional[str] = None
    testing_included: Optional[str] = None
    exclusions: Optional[str] = None
    notes: Optional[str] = None

@api.post("/quotations")
async def submit_quotation(body: QuotationCreate, user: dict = Depends(require_user)):
    if user.get("role") not in ("exporter", "admin"):
        raise HTTPException(403, "Forbidden")
    if user.get("role") == "exporter":
        # An exporter may only quote an RFQ it was invited to. 404 rather than 403 so a guessed
        # RFQ id is not confirmed to exist.
        cid = company_scope(user)
        inv = await db.exporter_invitations.find_one(
            {"rfq_id": body.rfq_id, "exporter_company_id": cid}) if cid else None
        if not inv:
            raise HTTPException(404, "Not found")
    qid = f"quo_{uuid.uuid4().hex[:10]}"
    doc = {"quotation_id": qid, "exporter_company_id": user.get("company_id"), **body.model_dump(), "status": "submitted", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.exporter_quotations.insert_one(doc)
    doc.pop("_id", None)
    if user.get("role") == "exporter":
        await db.exporter_invitations.update_one(
            {"rfq_id": body.rfq_id, "exporter_company_id": company_scope(user)},
            {"$set": {"status": "quoted", "quoted_at": datetime.now(timezone.utc).isoformat()}})
    return doc

@api.get("/quotations")
async def list_quotations(rfq_id: Optional[str] = None, user: dict = Depends(require_user)):
    """Raw exporter quotations. Admin sees all; an exporter sees only its own.

    Buyers have no branch here by design — they read published quotations from
    /api/buyer-quotations, which is the single path carrying buyer isolation.
    """
    if user.get("role") == "buyer":
        raise HTTPException(403, "Buyers read published quotations from /api/buyer-quotations")
    q: Dict[str, Any] = {}
    if rfq_id:
        q["rfq_id"] = rfq_id
    if user.get("role") == "exporter":
        cid = company_scope(user)
        if not cid:
            return []
        q["exporter_company_id"] = cid
    docs = await db.exporter_quotations.find(q, {"_id": 0}).to_list(500)
    return docs if user.get("role") == "admin" else [public_quotation(d) for d in docs]

class BuyerQuotationCreate(BaseModel):
    rfq_id: str
    total_price: float
    currency: str = "USD"
    quantity: str
    lead_time: str
    payment_schedule: List[Dict[str, Any]]
    inclusions: Optional[str] = None
    exclusions: Optional[str] = None
    expiry: Optional[str] = None
    specification: Optional[str] = None
    sample_price: Optional[float] = None
    # Admin-only internal fields (never returned to buyer)
    internal_costs: Optional[Dict[str, float]] = None
    internal_notes: Optional[str] = None

@api.post("/admin/buyer-quotations")
async def create_buyer_quotation(body: BuyerQuotationCreate, user: dict = Depends(require_admin)):
    bqid = f"bqo_{uuid.uuid4().hex[:10]}"
    doc = {"buyer_quotation_id": bqid, **body.model_dump(), "status": "draft", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.buyer_quotations.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.patch("/admin/buyer-quotations/{bqid}")
async def update_buyer_quotation(bqid: str, body: dict, user: dict = Depends(require_admin)):
    body.pop("_id", None); body.pop("buyer_quotation_id", None)
    await db.buyer_quotations.update_one({"buyer_quotation_id": bqid}, {"$set": body})
    return await db.buyer_quotations.find_one({"buyer_quotation_id": bqid}, {"_id": 0})

@api.get("/buyer-quotations")
async def list_buyer_quotations(rfq_id: Optional[str] = None, user: dict = Depends(require_user)):
    q: Dict[str, Any] = {}
    if rfq_id:
        q["rfq_id"] = rfq_id
    docs = await db.buyer_quotations.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return await scope_buyer_quotations(user, docs)

# Admin-created exporter quotations (for comparison mock-ups when the exporter is not on the platform yet)
class AdminQuotationCreate(QuotationCreate):
    exporter_company_id: str
    exporter_name: Optional[str] = None

@api.post("/admin/quotations")
async def admin_create_quotation(body: AdminQuotationCreate, user: dict = Depends(require_admin)):
    qid = f"quo_{uuid.uuid4().hex[:10]}"
    doc = {"quotation_id": qid, **body.model_dump(), "status": "submitted", "created_by_admin": True, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.exporter_quotations.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/admin/quotations")
async def admin_list_quotations(rfq_id: str, user: dict = Depends(require_admin)):
    return await db.exporter_quotations.find({"rfq_id": rfq_id}, {"_id": 0}).sort("created_at", 1).to_list(200)

# ---------- Orders & Milestones ----------
# Order states. cleared_to_ship replaces a hand-set "ready to ship": an order reaches it only
# by passing pre-shipment verification, and production_hold / shipment_blocked have no path to
# shipping at all.
ORDER_STATUS_FLOW: Dict[str, List[str]] = {
    "awaiting_deposit":   ["in_production", "disputed", "closed"],
    "in_production":      ["quality_inspection", "production_hold", "disputed"],
    "production_hold":    ["in_production", "disputed", "closed"],
    "quality_inspection": ["cleared_to_ship", "shipment_blocked", "production_hold", "in_production", "disputed"],
    "shipment_blocked":   ["quality_inspection", "production_hold", "disputed"],
    "cleared_to_ship":    ["shipped", "disputed"],
    "shipped":            ["delivered", "disputed"],
    "delivered":          ["closed", "disputed"],
    "disputed":           ["in_production", "closed"],
    "closed":             [],
}
ORDER_STATUSES = tuple(ORDER_STATUS_FLOW)
ORDER_COMPLETION_STATES = ("delivered", "closed")

@api.get("/meta/order-statuses")
async def order_status_meta(user: dict = Depends(require_user)):
    return {"statuses": list(ORDER_STATUSES), "transitions": ORDER_STATUS_FLOW,
            "completion": list(ORDER_COMPLETION_STATES)}

class OrderMilestone(BaseModel):
    label: str
    percent: float
    trigger: str
    status: str = "not_due"
    amount: Optional[float] = None
    due_date: Optional[str] = None

class OrderCreate(BaseModel):
    rfq_id: str
    exporter_company_id: str
    total_price: float
    currency: str = "USD"
    milestones: List[OrderMilestone]

@api.post("/admin/orders")
async def create_order(body: OrderCreate, user: dict = Depends(require_admin)):
    oid = f"ord_{uuid.uuid4().hex[:10]}"
    doc = {"order_id": oid, **body.model_dump(), "status": "awaiting_deposit", "assurance_eligible": False, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/orders")
async def list_orders(user: dict = Depends(require_user)):
    q: Dict[str, Any] = {}
    if user.get("role") == "buyer":
        q["rfq_id"] = {"$in": await buyer_rfq_ids(user)}
    elif user.get("role") == "exporter":
        cid = company_scope(user)
        if not cid:
            return []
        q["exporter_company_id"] = cid
    return await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(require_user)):
    doc = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404)
    if user.get("role") == "buyer":
        cid = company_scope(user)
        rfq = await db.rfqs.find_one({"rfq_id": doc.get("rfq_id")}, {"_id": 0, "buyer_company_id": 1})
        if not cid or not rfq or rfq.get("buyer_company_id") != cid:
            raise HTTPException(403)
    elif user.get("role") == "exporter" and doc.get("exporter_company_id") != company_scope(user):
        raise HTTPException(403)
    return doc

class MilestoneUpdate(BaseModel):
    milestones: List[OrderMilestone]

@api.patch("/admin/orders/{order_id}")
async def update_order(order_id: str, body: dict, user: dict = Depends(require_admin)):
    body.pop("_id", None); body.pop("order_id", None); body.pop("created_at", None)
    order = await order_or_404(order_id)
    new_status = body.get("status")
    if new_status is not None:
        if new_status not in ORDER_STATUS_FLOW:
            raise HTTPException(422, f"Unknown order status '{new_status}'")
        current = order.get("status") or "awaiting_deposit"
        if new_status != current and new_status not in ORDER_STATUS_FLOW.get(current, []):
            # production_hold and shipment_blocked have no route to shipping: an order on hold
            # cannot be advanced past verification by hand.
            raise HTTPException(422, f"Illegal transition {current} -> {new_status}")
    await db.orders.update_one({"order_id": order_id}, {"$set": body})
    await db.activity_logs.insert_one({"kind": "order_update", "order_id": order_id, "by": user["user_id"], "fields": list(body.keys()), "at": datetime.now(timezone.utc).isoformat()})
    if new_status in ORDER_COMPLETION_STATES:
        await write_production_run(await order_or_404(order_id), user["user_id"])
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})

@api.patch("/admin/orders/{order_id}/milestones")
async def replace_milestones(order_id: str, body: MilestoneUpdate, user: dict = Depends(require_admin)):
    ms = [m.model_dump() for m in body.milestones]
    await db.orders.update_one({"order_id": order_id}, {"$set": {"milestones": ms}})
    await db.activity_logs.insert_one({"kind": "milestones_updated", "order_id": order_id, "by": user["user_id"], "count": len(ms), "at": datetime.now(timezone.utc).isoformat()})
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


# ---------- Production specification ----------
# The specification is the contract production is judged against. It is frozen when the buyer
# accepts a quotation, and never edited afterwards: a change is a new version that the buyer
# has to approve, so an inspection result always refers to something both sides signed off.

class SpecRow(BaseModel):
    name: str
    target: str = ""
    tolerance: str = ""
    critical: bool = False

class SpecificationCreate(BaseModel):
    rfq_id: str
    rows: Optional[List[SpecRow]] = None      # defaults to the RFQ's category fields
    sample_reference: Optional[str] = None    # file_id of the approved sample

def spec_rows_from_rfq(rfq: dict) -> List[dict]:
    """Seed rows from the RFQ's category-specific answers — the same vocabulary the buyer
    filled in, so nothing is renamed between requirement and verification."""
    fields = rfq.get("category_fields") or {}
    return [{"name": k, "target": str(v), "tolerance": "", "critical": False}
            for k, v in fields.items() if str(v or "").strip()]

def next_spec_version(previous: Optional[dict]) -> str:
    if not previous:
        return "1.0"
    major, _, minor = (previous.get("version") or "1.0").partition(".")
    return f"{major}.{int(minor or 0) + 1}"

async def latest_locked_spec(rfq_id: str) -> Optional[dict]:
    return await db.specifications.find_one(
        {"rfq_id": rfq_id, "status": "locked"}, {"_id": 0}, sort=[("created_at", -1)])

async def spec_visible_to(user: dict, spec: dict) -> bool:
    if user.get("role") == "admin":
        return True
    cid = company_scope(user)
    if not cid:
        return False
    if user.get("role") == "buyer":
        rfq = await db.rfqs.find_one({"rfq_id": spec["rfq_id"]}, {"_id": 0, "buyer_company_id": 1})
        return bool(rfq and rfq.get("buyer_company_id") == cid)
    if user.get("role") == "exporter":
        return bool(await db.exporter_invitations.find_one(
            {"rfq_id": spec["rfq_id"], "exporter_company_id": cid}))
    return False

@api.post("/admin/specifications")
async def propose_specification(body: SpecificationCreate, user: dict = Depends(require_admin)):
    """Draft the next version. It is not binding until the buyer approves it."""
    rfq = await db.rfqs.find_one({"rfq_id": body.rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "Not found")
    pending = await db.specifications.find_one(
        {"rfq_id": body.rfq_id, "status": "proposed"}, {"_id": 0})
    if pending:
        raise HTTPException(409, f"Specification {pending['version']} is already awaiting buyer approval")
    previous = await latest_locked_spec(body.rfq_id)
    rows = [r.model_dump() for r in body.rows] if body.rows else (
        previous.get("rows") if previous else spec_rows_from_rfq(rfq))
    if not rows:
        raise HTTPException(422, "A specification needs at least one row")
    doc = {
        "specification_id": f"spec_{uuid.uuid4().hex[:10]}",
        "rfq_id": body.rfq_id, "order_id": None,
        "version": next_spec_version(previous),
        "rows": rows,
        "sample_reference": body.sample_reference or (previous or {}).get("sample_reference"),
        "status": "proposed", "supersedes": (previous or {}).get("specification_id"),
        "locked_at": None, "locked_by": None,
        "created_by": user["user_id"], "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.specifications.insert_one(doc)
    doc.pop("_id", None)
    return doc

class SpecificationUpdate(BaseModel):
    rows: Optional[List[SpecRow]] = None
    sample_reference: Optional[str] = None

@api.patch("/admin/specifications/{specification_id}")
async def update_specification(specification_id: str, body: SpecificationUpdate,
                               user: dict = Depends(require_admin)):
    """Editable only while proposed. A locked specification is never modified in place — that
    is the whole point of locking it — so changing one means proposing the next version."""
    spec = await db.specifications.find_one({"specification_id": specification_id}, {"_id": 0})
    if not spec:
        raise HTTPException(404, "Not found")
    if spec["status"] != "proposed":
        raise HTTPException(409, f"Specification {spec['version']} is {spec['status']} and cannot be edited; "
                                 f"propose a new version instead")
    patch: Dict[str, Any] = {}
    if body.rows is not None:
        if not body.rows:
            raise HTTPException(422, "A specification needs at least one row")
        patch["rows"] = [r.model_dump() for r in body.rows]
    if body.sample_reference is not None:
        patch["sample_reference"] = body.sample_reference
    if patch:
        await db.specifications.update_one({"specification_id": specification_id}, {"$set": patch})
    return await db.specifications.find_one({"specification_id": specification_id}, {"_id": 0})

@api.post("/specifications/{specification_id}/approve")
async def approve_specification(specification_id: str, user: dict = Depends(require_user)):
    """Buyer approval is what locks a specification. Admin may counter-sign for an offline buyer."""
    spec = await db.specifications.find_one({"specification_id": specification_id}, {"_id": 0})
    if not spec or not await spec_visible_to(user, spec) or user.get("role") == "exporter":
        raise HTTPException(404, "Not found")
    if spec["status"] != "proposed":
        raise HTTPException(409, f"Specification is {spec['status']}, not awaiting approval")
    now = datetime.now(timezone.utc).isoformat()
    if spec.get("supersedes"):
        await db.specifications.update_one({"specification_id": spec["supersedes"]},
                                           {"$set": {"status": "superseded", "superseded_by": specification_id}})
    await db.specifications.update_one({"specification_id": specification_id}, {"$set": {
        "status": "locked", "locked_at": now,
        "locked_by": company_scope(user) or user["user_id"],
    }})
    await db.activity_logs.insert_one({"kind": "specification_locked", "rfq_id": spec["rfq_id"],
                                       "specification_id": specification_id, "version": spec["version"],
                                       "by": user["user_id"], "at": now})
    return await db.specifications.find_one({"specification_id": specification_id}, {"_id": 0})

@api.get("/specifications")
async def list_specifications(rfq_id: Optional[str] = None, order_id: Optional[str] = None,
                              user: dict = Depends(require_user)):
    if order_id and not rfq_id:
        order = await db.orders.find_one({"order_id": order_id}, {"_id": 0, "rfq_id": 1})
        if not order:
            raise HTTPException(404, "Not found")
        rfq_id = order["rfq_id"]
    if not rfq_id:
        raise HTTPException(422, "rfq_id or order_id is required")
    docs = await db.specifications.find({"rfq_id": rfq_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    if not docs:
        return []
    if not await spec_visible_to(user, docs[0]):
        raise HTTPException(404, "Not found")
    # A proposed version is an internal draft until the buyer has seen it in the approval step.
    return docs

# ---------- Buyer acceptance ----------
@api.post("/buyer-quotations/{bqid}/accept")
async def accept_buyer_quotation(bqid: str, user: dict = Depends(require_user)):
    """Acceptance is the moment the requirement stops moving: it locks the specification."""
    bq = await db.buyer_quotations.find_one({"buyer_quotation_id": bqid}, {"_id": 0})
    if not bq:
        raise HTTPException(404, "Not found")
    visible = await scope_buyer_quotations(user, [bq])
    if not visible:
        raise HTTPException(404, "Not found")
    if bq.get("status") == "accepted":
        return public_quotation(bq)
    await db.buyer_quotations.update_one({"buyer_quotation_id": bqid}, {"$set": {
        "status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat(),
        "accepted_by": user["user_id"]}})
    spec = await db.specifications.find_one({"rfq_id": bq["rfq_id"], "status": "proposed"}, {"_id": 0})
    if spec:
        await approve_specification(spec["specification_id"], user)
    updated = await db.buyer_quotations.find_one({"buyer_quotation_id": bqid}, {"_id": 0})
    return public_quotation(updated)

# ---------- Inspections ----------
INSPECTION_TYPES = ("first_article", "mid_run", "pre_shipment")

class Measurement(BaseModel):
    name: str
    target: str = ""
    result: str = ""
    status: str = "pass"   # pass | fail

class InspectionCreate(BaseModel):
    order_id: str
    type: str
    inspector: str
    measurements: List[Measurement]
    notes: Optional[str] = None
    evidence: Optional[List[str]] = []

class CorrectiveAction(BaseModel):
    text: str
    owner: str

async def order_or_404(order_id: str) -> dict:
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Not found")
    return order

async def set_order_state(order_id: str, status: str, by: str, **extra):
    await db.orders.update_one({"order_id": order_id}, {"$set": {"status": status, **extra}})
    await db.activity_logs.insert_one({"kind": "order_status", "order_id": order_id,
                                       "to": status, "by": by,
                                       "at": datetime.now(timezone.utc).isoformat()})

@api.post("/admin/inspections")
async def create_inspection(body: InspectionCreate, user: dict = Depends(require_admin)):
    if body.type not in INSPECTION_TYPES:
        raise HTTPException(422, f"Unknown inspection type '{body.type}'")
    order = await order_or_404(body.order_id)
    spec = await latest_locked_spec(order["rfq_id"])
    if not spec:
        raise HTTPException(409, "No locked specification — nothing to verify against")

    previous = await db.inspections.find({"order_id": body.order_id, "type": body.type}, {"_id": 0}) \
        .sort("round", -1).to_list(50)
    round_no = (previous[0]["round"] + 1) if previous else 1
    if previous and previous[0]["outcome"] == "fail" and not previous[0].get("corrective_action"):
        raise HTTPException(409, "Record a corrective action on the failed inspection before re-inspecting")

    critical_by_name = {r["name"]: bool(r.get("critical")) for r in spec["rows"]}
    measurements = []
    for m in body.measurements:
        d = m.model_dump()
        if d["status"] not in ("pass", "fail"):
            raise HTTPException(422, "Measurement status must be pass or fail")
        d["critical"] = critical_by_name.get(d["name"], False)
        measurements.append(d)
    critical_failures = [m for m in measurements if m["critical"] and m["status"] == "fail"]
    outcome = "fail" if any(m["status"] == "fail" for m in measurements) else "pass"

    doc = {
        "inspection_id": f"insp_{uuid.uuid4().hex[:10]}",
        "order_id": body.order_id, "rfq_id": order["rfq_id"],
        "specification_id": spec["specification_id"], "spec_version": spec["version"],
        "type": body.type, "round": round_no,
        "inspector": body.inspector, "inspected_at": datetime.now(timezone.utc).isoformat(),
        "measurements": measurements, "notes": body.notes, "evidence": body.evidence or [],
        "corrective_action": None, "outcome": outcome,
        "critical_failures": len(critical_failures),
        "created_by": user["user_id"], "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.inspections.insert_one(doc)
    doc.pop("_id", None)

    # A failed critical measurement stops the line. Anything else is recorded but not blocking.
    if critical_failures:
        if body.type == "pre_shipment":
            await set_order_state(body.order_id, "shipment_blocked", user["user_id"],
                                  hold={"inspection_id": doc["inspection_id"], "since": doc["inspected_at"]})
        else:
            await set_order_state(body.order_id, "production_hold", user["user_id"],
                                  hold={"inspection_id": doc["inspection_id"], "since": doc["inspected_at"]})
    elif body.type == "pre_shipment":
        await set_order_state(body.order_id, "cleared_to_ship", user["user_id"], hold=None)
    elif order.get("hold") and round_no > 1:
        # A passing re-inspection clears the hold and records that the non-conformance was
        # corrected during production rather than shipped.
        await set_order_state(body.order_id, "in_production", user["user_id"], hold=None)
        await db.inspections.update_one({"inspection_id": doc["inspection_id"]},
                                        {"$set": {"cleared_hold": True}})
        doc["cleared_hold"] = True
    return doc

@api.post("/admin/inspections/{inspection_id}/corrective-action")
async def record_corrective_action(inspection_id: str, body: CorrectiveAction,
                                   user: dict = Depends(require_admin)):
    insp = await db.inspections.find_one({"inspection_id": inspection_id}, {"_id": 0})
    if not insp:
        raise HTTPException(404, "Not found")
    if insp["outcome"] != "fail":
        raise HTTPException(409, "Corrective actions are recorded against a failed inspection")
    action = {"text": body.text, "owner": body.owner,
              "recorded_at": datetime.now(timezone.utc).isoformat()}
    await db.inspections.update_one({"inspection_id": inspection_id},
                                    {"$set": {"corrective_action": action}})
    return await db.inspections.find_one({"inspection_id": inspection_id}, {"_id": 0})

@api.get("/inspections")
async def list_inspections(order_id: str, user: dict = Depends(require_user)):
    order = await order_or_404(order_id)
    if user.get("role") == "buyer":
        cid = company_scope(user)
        rfq = await db.rfqs.find_one({"rfq_id": order["rfq_id"]}, {"_id": 0, "buyer_company_id": 1})
        if not cid or not rfq or rfq.get("buyer_company_id") != cid:
            raise HTTPException(404, "Not found")
    elif user.get("role") == "exporter" and order.get("exporter_company_id") != company_scope(user):
        raise HTTPException(404, "Not found")
    return await db.inspections.find({"order_id": order_id}, {"_id": 0}).sort("inspected_at", 1).to_list(200)

# ---------- Factory performance ----------
# Every number here is derived from production runs and the inspections behind them. Nothing on
# an exporter profile is typed in by hand.

def _measurement_rows(inspections: List[dict], first_pass_only: bool = True):
    for insp in inspections:
        if first_pass_only and insp.get("round", 1) != 1:
            continue
        for m in insp.get("measurements", []):
            yield m

def conformance_from_inspections(inspections: List[dict]) -> Optional[float]:
    rows = list(_measurement_rows(inspections))
    if not rows:
        return None
    passed = sum(1 for m in rows if m.get("status") == "pass")
    return round(passed / len(rows) * 100, 1)

async def write_production_run(order: dict, by: str) -> Optional[dict]:
    """Called once when an order completes. Idempotent."""
    if await db.production_runs.find_one({"order_id": order["order_id"]}):
        return None
    inspections = await db.inspections.find({"order_id": order["order_id"]}, {"_id": 0}).to_list(200)
    completed_at = datetime.now(timezone.utc)
    created_at = order.get("created_at")
    try:
        lead_time_days = (completed_at - datetime.fromisoformat(created_at)).days if created_at else None
    except ValueError:
        lead_time_days = None
    due_dates = [m.get("due_date") for m in (order.get("milestones") or []) if m.get("due_date")]
    on_time = None
    if due_dates:
        try:
            on_time = completed_at.date().isoformat() <= max(due_dates)
        except (TypeError, ValueError):
            on_time = None
    run = {
        "run_id": f"run_{uuid.uuid4().hex[:10]}",
        "order_id": order["order_id"],
        "exporter_company_id": order.get("exporter_company_id"),
        "rfq_id": order.get("rfq_id"),
        "conformance_pct": conformance_from_inspections(inspections),
        "on_time": on_time,
        "corrective_actions": sum(1 for i in inspections if i.get("corrective_action")),
        "lead_time_days": lead_time_days,
        "inspections": len(inspections),
        "completed_at": completed_at.isoformat(),
        "recorded_by": by,
    }
    await db.production_runs.insert_one(run)
    run.pop("_id", None)
    return run

async def performance_profile(exporter_company_id: str) -> dict:
    runs = await db.production_runs.find({"exporter_company_id": exporter_company_id}, {"_id": 0}).to_list(500)
    scored = [r for r in runs if r.get("conformance_pct") is not None]
    timed = [r for r in runs if r.get("on_time") is not None]
    lead = [r["lead_time_days"] for r in runs if r.get("lead_time_days") is not None]

    order_ids = [r["order_id"] for r in runs]
    inspections = await db.inspections.find({"order_id": {"$in": order_ids}}, {"_id": 0}).to_list(1000) if order_ids else []
    by_attribute: Dict[str, Dict[str, int]] = {}
    for m in _measurement_rows(inspections):
        bucket = by_attribute.setdefault(m.get("name", "unknown"), {"passed": 0, "total": 0})
        bucket["total"] += 1
        bucket["passed"] += 1 if m.get("status") == "pass" else 0

    return {
        "exporter_company_id": exporter_company_id,
        "runs": len(runs),
        "conformance_pct": round(sum(r["conformance_pct"] for r in scored) / len(scored), 1) if scored else 0.0,
        "on_time_pct": round(sum(1 for r in timed if r["on_time"]) / len(timed) * 100, 1) if timed else 0.0,
        "corrective_actions": sum(r.get("corrective_actions", 0) for r in runs),
        "avg_lead_time_days": round(sum(lead) / len(lead)) if lead else None,
        "attributes": [
            {"name": name, "conformance_pct": round(v["passed"] / v["total"] * 100, 1), "measured": v["total"]}
            for name, v in sorted(by_attribute.items())
        ],
        "basis": "Performance metrics are generated from verified production runs.",
    }

@api.get("/admin/exporter-performance")
async def list_exporter_performance(user: dict = Depends(require_admin)):
    ids = await db.production_runs.distinct("exporter_company_id")
    profiles = [await performance_profile(cid) for cid in ids if cid]
    return sorted(profiles, key=lambda p: (-p["conformance_pct"], -p["runs"]))

@api.get("/admin/exporter-performance/{exporter_company_id}")
async def get_exporter_performance(exporter_company_id: str, user: dict = Depends(require_admin)):
    return await performance_profile(exporter_company_id)

# ---------- Files ----------
async def can_read_file(user: dict, rec: dict) -> bool:
    """Fail closed: a file with no recorded owner is readable only by its uploader and admin."""
    if user.get("role") == "admin":
        return True
    if rec.get("user_id") == user.get("user_id"):
        return True
    cid = company_scope(user)
    if not cid:
        return False
    if rec.get("owner_company_id") and rec["owner_company_id"] == cid:
        return True
    rfq_id = rec.get("rfq_id")
    if not rfq_id:
        return False
    if user.get("role") == "buyer":
        rfq = await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0, "buyer_company_id": 1})
        return bool(rfq and rfq.get("buyer_company_id") == cid)
    if user.get("role") == "exporter":
        return bool(await db.exporter_invitations.find_one({"rfq_id": rfq_id, "exporter_company_id": cid}))
    return False

@api.post("/files/upload")
async def upload_file(file: UploadFile = File(...), rfq_id: Optional[str] = Form(None),
                      user: dict = Depends(require_user)):
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
    path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = await run_in_threadpool(put_object, path, data, file.content_type or "application/octet-stream")
    file_id = f"file_{uuid.uuid4().hex[:10]}"
    await db.files.insert_one({
        "file_id": file_id, "storage_path": result["path"],
        "original_filename": file.filename, "content_type": file.content_type,
        "size": result.get("size", len(data)), "user_id": user["user_id"],
        "owner_company_id": company_scope(user), "rfq_id": rfq_id,
        "is_deleted": False, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"file_id": file_id, "path": result["path"], "filename": file.filename}

@api.get("/files/{file_id}")
async def download_file(file_id: str, user: dict = Depends(require_user)):
    rec = await db.files.find_one({"file_id": file_id, "is_deleted": False}, {"_id": 0})
    # 404 on both "missing" and "not yours" — a 403 would confirm the file id exists.
    if not rec or not await can_read_file(user, rec):
        raise HTTPException(404, "Not found")
    data, ct = await run_in_threadpool(get_object, rec["storage_path"])
    return FastResponse(content=data, media_type=rec.get("content_type") or ct)

# ---------- Admin overview ----------
@api.get("/admin/overview")
async def admin_overview(user: dict = Depends(require_admin)):
    return {
        "buyers": await db.companies.count_documents({"kind": "buyer"}),
        "exporters": await db.companies.count_documents({"kind": "exporter"}),
        "rfqs": await db.rfqs.count_documents({}),
        "quotations": await db.exporter_quotations.count_documents({}),
        "orders": await db.orders.count_documents({}),
    }

# ---------- Public demo/sample workflow ----------
@api.get("/demo/sample-order")
async def demo_sample_order():
    return await db.demo_sample.find_one({"kind": "yc_demo_order"}, {"_id": 0}) or {}

# ---------- Startup: seed demo + storage ----------
async def startup():
    try:
        await run_in_threadpool(init_storage)
    except Exception:
        pass
    # Ensure owner user exists as admin
    existing = await db.users.find_one({"email": OWNER_EMAIL}, {"_id": 0})
    if not existing:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}", "email": OWNER_EMAIL,
            "name": "Krish Jain", "role": "admin", "onboarded": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    else:
        await db.users.update_one({"email": OWNER_EMAIL}, {"$set": {"role": "admin", "onboarded": True}})
    # Seed catalogue if empty
    if await db.catalogue_products.count_documents({}) == 0:
        seed = [
            {"product_name": "Sterling Silver Bezel Ring — Green Onyx", "category": "Rings", "material": "925 Sterling Silver, Green Onyx", "customization": "Stone, size, engraving", "moq": "50 pcs", "lead_time": "25–35 days", "image_url": "https://images.unsplash.com/photo-1656010280162-772358d9f4ed?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "indicative_price": "Subject to specification"},
            {"product_name": "Vermeil Chain Necklace — Handcrafted", "category": "Necklaces", "material": "Silver + 18k Gold Vermeil", "customization": "Length, clasp, plating microns", "moq": "100 pcs", "lead_time": "28–40 days", "image_url": "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=800", "indicative_price": "Subject to specification"},
            {"product_name": "Silver Stud Earrings — Lab-grown Sapphire", "category": "Earrings", "material": "925 Silver, Lab Sapphire", "customization": "Stone colour, backing", "moq": "80 pairs", "lead_time": "20–30 days", "image_url": "https://images.unsplash.com/photo-1583937443566-6fe1a1c6e400?w=800", "indicative_price": "Subject to specification"},
            {"product_name": "Gemstone Cocktail Ring — Emerald Cut", "category": "Rings", "material": "925 Silver, Natural Peridot", "customization": "Stone type, band finish", "moq": "40 pcs", "lead_time": "30–45 days", "image_url": "https://images.unsplash.com/photo-1609619742069-f5e18afeef17?w=800", "indicative_price": "Subject to specification"},
        ]
        for s in seed:
            await db.catalogue_products.insert_one({"product_id": f"prod_{uuid.uuid4().hex[:10]}", **s, "published": True, "created_at": datetime.now(timezone.utc).isoformat()})
    # Seed demo sample order
    if await db.demo_sample.count_documents({"kind": "yc_demo_order"}) == 0:
        await db.demo_sample.insert_one({
            "kind": "yc_demo_order", "demo": True,
            "rfq_number": "NRV-DEMO-A1B2C",
            "buyer": {"company": "Aria & Co. (Demo)", "country": "United States", "buyer_type": "Brand"},
            "requirement": {
                "product_name": "Sterling Silver Ring w/ Green Stone (Demo)",
                "quantity": "500 pcs", "destination": "New York, USA",
                "raw_text": "I need 500 sterling-silver rings similar to the attached image, with green stones and custom packaging.",
                "reference_image": "https://images.unsplash.com/photo-1656010280162-772358d9f4ed?w=800",
            },
            "structured": {
                "category": "Rings", "base_metal": "925 Silver", "stone_type": "Green Onyx",
                "natural_or_lab": "Lab-grown acceptable", "plating": "Rhodium", "packaging": "Branded box + pouch",
            },
            "quotations": [
                {"exporter": "Jaipur Silver Works (Demo)", "unit_price": 6.80, "currency": "USD", "lead_time": "30 days", "moq": "300", "sample_price": 45, "payment_terms": "30/70"},
                {"exporter": "Rajwada Exports (Demo)", "unit_price": 7.20, "currency": "USD", "lead_time": "25 days", "moq": "500", "sample_price": 55, "payment_terms": "50/50"},
            ],
            "selected_exporter": "Jaipur Silver Works (Demo)",
            "sample": {"status": "Approved", "photos": ["https://images.unsplash.com/photo-1583937443566-6fe1a1c6e400?w=600"]},
            "production_milestones": [
                {"label": "Raw materials procured", "status": "done"},
                {"label": "Casting complete", "status": "done"},
                {"label": "Setting & polishing", "status": "in_progress"},
                {"label": "QC pending", "status": "not_due"},
            ],
            "inspection": {"status": "Scheduled", "date": "Day 28", "report": "Pre-shipment AQL 2.5"},
            "payment_schedule": [
                {"label": "30% deposit", "amount": 1020, "status": "paid"},
                {"label": "70% before shipment", "amount": 2380, "status": "due"},
            ],
            "shipment": {"status": "Ready for pickup", "incoterm": "FOB Delhi"},
        })

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"], allow_headers=["*"],
)
