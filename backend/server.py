"""Norvian.ai — B2B Export Platform MVP.

Single-file FastAPI backend covering: Emergent Google Auth, Buyer/Exporter/Admin roles,
RFQs, exporter catalogues, quotations, orders, milestones, documents,
AI-assisted RFQ improvement (Claude Sonnet 4.5 via Emergent LLM key),
Resend transactional email, Emergent managed Object Storage for files,
demo seeding for YC review.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Depends, Header, Query
from fastapi.responses import Response as FastResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from pathlib import Path
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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("norvian")

app = FastAPI(title="Norvian API")
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

@api.post("/auth/set-role")
async def set_role(body: dict, user: dict = Depends(require_user)):
    role = body.get("role")
    if role not in ("buyer", "exporter"):
        raise HTTPException(400, "invalid role")
    # Do not downgrade admin
    if user.get("role") == "admin":
        return user
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"role": role}})
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})

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
        q["buyer_company_id"] = user.get("company_id")
    elif user.get("role") == "exporter":
        # Only RFQs where exporter has been invited
        inv = db.exporter_invitations.find({"exporter_company_id": user.get("company_id")}, {"_id": 0, "rfq_id": 1})
        ids = [i["rfq_id"] async for i in inv]
        if not ids:
            return []
        q["rfq_id"] = {"$in": ids}
    # admin sees all
    items = await db.rfqs.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    # scrub buyer contact info for exporters
    if user.get("role") == "exporter":
        for r in items:
            for k in ("contact_name", "contact_email", "buyer_user_id", "buyer_company_id"):
                r.pop(k, None)
    return items

@api.get("/rfqs/{rfq_id}")
async def get_rfq(rfq_id: str, user: dict = Depends(require_user)):
    rfq = await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "Not found")
    if user.get("role") == "buyer" and rfq.get("buyer_company_id") != user.get("company_id"):
        raise HTTPException(403, "Forbidden")
    if user.get("role") == "exporter":
        inv = await db.exporter_invitations.find_one({"rfq_id": rfq_id, "exporter_company_id": user.get("company_id")})
        if not inv:
            raise HTTPException(403, "Forbidden")
        for k in ("contact_name", "contact_email", "buyer_user_id", "buyer_company_id"):
            rfq.pop(k, None)
    return rfq

@api.patch("/rfqs/{rfq_id}/status")
async def update_rfq_status(rfq_id: str, body: dict, user: dict = Depends(require_admin)):
    await db.rfqs.update_one({"rfq_id": rfq_id}, {"$set": {"status": body.get("status")}})
    await db.activity_logs.insert_one({"kind": "rfq_status", "rfq_id": rfq_id, "by": user["user_id"], "to": body.get("status"), "at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True}

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
    return doc

# ---------- Exporter Invitations & Quotations ----------
class InviteReq(BaseModel):
    rfq_id: str
    exporter_company_id: str

@api.post("/admin/invitations")
async def invite(body: InviteReq, user: dict = Depends(require_admin)):
    inv_id = f"inv_{uuid.uuid4().hex[:10]}"
    await db.exporter_invitations.insert_one({"invitation_id": inv_id, "rfq_id": body.rfq_id, "exporter_company_id": body.exporter_company_id, "status": "invited", "created_at": datetime.now(timezone.utc).isoformat()})
    return {"invitation_id": inv_id}

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
    qid = f"quo_{uuid.uuid4().hex[:10]}"
    doc = {"quotation_id": qid, "exporter_company_id": user.get("company_id"), **body.model_dump(), "status": "submitted", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.exporter_quotations.insert_one(doc)
    return doc

@api.get("/quotations")
async def list_quotations(rfq_id: Optional[str] = None, user: dict = Depends(require_user)):
    q = {}
    if rfq_id:
        q["rfq_id"] = rfq_id
    if user.get("role") == "exporter":
        q["exporter_company_id"] = user.get("company_id")
    elif user.get("role") == "buyer":
        # Buyers see only admin-approved buyer_quotations, not raw exporter quotes
        return await db.buyer_quotations.find({"rfq_id": rfq_id} if rfq_id else {}, {"_id": 0}).to_list(500)
    return await db.exporter_quotations.find(q, {"_id": 0}).to_list(500)

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

@api.post("/admin/buyer-quotations")
async def create_buyer_quotation(body: BuyerQuotationCreate, user: dict = Depends(require_admin)):
    bqid = f"bqo_{uuid.uuid4().hex[:10]}"
    doc = {"buyer_quotation_id": bqid, **body.model_dump(), "status": "draft", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.buyer_quotations.insert_one(doc)
    return doc

# ---------- Orders & Milestones ----------
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
    return doc

@api.get("/orders")
async def list_orders(user: dict = Depends(require_user)):
    q: Dict[str, Any] = {}
    if user.get("role") == "buyer":
        rfqs = db.rfqs.find({"buyer_company_id": user.get("company_id")}, {"_id": 0, "rfq_id": 1})
        ids = [r["rfq_id"] async for r in rfqs]
        q["rfq_id"] = {"$in": ids}
    elif user.get("role") == "exporter":
        q["exporter_company_id"] = user.get("company_id")
    return await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

# ---------- Files ----------
@api.post("/files/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(require_user)):
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
    path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "application/octet-stream")
    file_id = f"file_{uuid.uuid4().hex[:10]}"
    await db.files.insert_one({
        "file_id": file_id, "storage_path": result["path"],
        "original_filename": file.filename, "content_type": file.content_type,
        "size": result.get("size", len(data)), "user_id": user["user_id"],
        "is_deleted": False, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"file_id": file_id, "path": result["path"], "filename": file.filename}

@api.get("/files/{file_id}")
async def download_file(file_id: str, request: Request, auth: Optional[str] = Query(None)):
    # Fallback token via query for <img src>
    if auth and "session_token" not in request.cookies:
        sess = await db.user_sessions.find_one({"session_token": auth})
        if not sess:
            raise HTTPException(401)
    else:
        u = await get_current_user(request)
        if not u:
            raise HTTPException(401)
    rec = await db.files.find_one({"file_id": file_id, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Not found")
    data, ct = get_object(rec["storage_path"])
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
@app.on_event("startup")
async def startup():
    try:
        init_storage()
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
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"], allow_headers=["*"],
)
