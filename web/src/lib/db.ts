import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const RFQ_TABLE = "sourcing_requests";
export const MANUFACTURER_TABLE = "manufacturer_applications";
export const UPLOAD_BUCKET =
  process.env.SUPABASE_UPLOAD_BUCKET || "rfq-references";

// `SUPABASE_URL` is read at runtime. `NEXT_PUBLIC_SUPABASE_URL` is accepted as
// a fallback because Supabase's own Vercel integration sets that name — but it
// is inlined at build time, so a value added after a build only takes effect on
// the next deploy. Prefer SUPABASE_URL.
const SUPABASE_URL =
  process.env.SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

let cached: SupabaseClient | null = null;

/**
 * Server-only client. It uses the service-role key, so every write bypasses RLS
 * and the tables can stay locked down to nothing but this key. Never import
 * this module from a client component.
 */
export function admin(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  cached ??= createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** NRV-XXXXXX — ambiguous characters (I, O, 0, 1) removed so it survives being read aloud. */
export function referenceNumber(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return `NRV-${out}`;
}

/* --------------------------------------------------------------------------
 * Local development fallback
 *
 * Without Supabase credentials the whole submission flow would be untestable
 * locally, so in development only we append rows to .data/*.jsonl instead. In
 * production a missing configuration is a hard failure — silently writing a
 * lead to a container filesystem that gets thrown away is worse than an error.
 * ----------------------------------------------------------------------- */

const DEV_DIR = path.join(process.cwd(), ".data");
const devFallbackAllowed = process.env.NODE_ENV !== "production";

async function appendDevRow(table: string, row: Record<string, unknown>) {
  await fs.mkdir(DEV_DIR, { recursive: true });
  await fs.appendFile(
    path.join(DEV_DIR, `${table}.jsonl`),
    JSON.stringify(row) + "\n",
    "utf8",
  );
}

export type InsertResult = { storage: "supabase" | "local-dev-file" };

export async function insertRow(
  table: string,
  row: Record<string, unknown>,
): Promise<InsertResult> {
  if (!isSupabaseConfigured) {
    if (!devFallbackAllowed) {
      throw new Error(
        `Cannot persist ${table}: Supabase environment variables are missing in production.`,
      );
    }
    await appendDevRow(table, { id: crypto.randomUUID(), ...row });
    return { storage: "local-dev-file" };
  }

  const { error } = await admin().from(table).insert(row);
  if (error) {
    throw new Error(`Supabase insert into ${table} failed: ${error.message}`);
  }
  return { storage: "supabase" };
}

export async function uploadReference(
  file: File,
): Promise<{ url: string; storage: "supabase" | "local-dev-file" }> {
  const ext = (file.name.split(".").pop() || "bin")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
  const key = `${new Date().toISOString().slice(0, 10)}/${randomBytes(12).toString("hex")}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (!isSupabaseConfigured) {
    if (!devFallbackAllowed) {
      throw new Error(
        "Cannot store the reference file: Supabase environment variables are missing in production.",
      );
    }
    const dest = path.join(DEV_DIR, "uploads", key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, bytes);
    return {
      url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/dev-upload/${key}`,
      storage: "local-dev-file",
    };
  }

  const client = admin();
  const { error } = await client.storage
    .from(UPLOAD_BUCKET)
    .upload(key, bytes, { contentType: file.type || "application/octet-stream" });
  if (error) {
    throw new Error(`Reference upload failed: ${error.message}`);
  }

  // A long-lived signed URL keeps the bucket private while still giving the
  // stored row a link that can be opened straight from the Supabase table view.
  const { data: signed } = await client.storage
    .from(UPLOAD_BUCKET)
    .createSignedUrl(key, 60 * 60 * 24 * 365);

  return {
    url:
      signed?.signedUrl ??
      client.storage.from(UPLOAD_BUCKET).getPublicUrl(key).data.publicUrl,
    storage: "supabase",
  };
}
