import { NextResponse } from "next/server";
import { admin, isSupabaseConfigured, RFQ_TABLE, MANUFACTURER_TABLE } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deployment smoke check: confirms the running instance can actually reach the
 * tables it writes to. Returns counts only — never row contents.
 */
export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      {
        ok: false,
        supabase: "not-configured",
        detail:
          "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Submissions cannot be stored in production without them.",
      },
      { status: 503 },
    );
  }

  const client = admin();
  const checks: Record<string, string | number> = {};
  let ok = true;

  for (const table of [RFQ_TABLE, MANUFACTURER_TABLE]) {
    const { count, error } = await client
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      ok = false;
      checks[table] = `error: ${error.message}`;
    } else {
      checks[table] = count ?? 0;
    }
  }

  return NextResponse.json(
    { ok, supabase: "configured", tables: checks },
    { status: ok ? 200 : 503 },
  );
}
