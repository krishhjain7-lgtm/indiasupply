import { NextResponse } from "next/server";
import { manufacturerSchema, fieldErrors } from "@/lib/validation";
import { insertRow, MANUFACTURER_TABLE } from "@/lib/db";
import { notifySubmission } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as Record<string, unknown>).fax === "string" &&
    (payload as Record<string, unknown>).fax !== ""
  ) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const parsed = manufacturerSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Some details need fixing.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const d = parsed.data;
  const row = {
    name: d.name,
    company: d.company,
    email: d.email,
    phone: d.phone,
    city: d.city,
    product_categories: d.productCategories,
    website: d.website ?? null,
    export_experience: d.exportExperience,
    status: "new",
  };

  try {
    const { storage } = await insertRow(MANUFACTURER_TABLE, row);
    if (storage === "local-dev-file") {
      console.warn(
        "[manufacturer] stored in the local development file — Supabase is not configured.",
      );
    }
  } catch (err) {
    console.error("[manufacturer] failed to store application", err, row);
    return NextResponse.json(
      {
        error:
          "We couldn't submit your application right now. Please try again, or email us at hello@norvian.ai.",
      },
      { status: 503 },
    );
  }

  await notifySubmission(`New manufacturer application — ${d.company}`, [
    ["Company", d.company],
    ["Contact", d.name],
    ["Email", d.email],
    ["Phone", d.phone],
    ["City", d.city],
    ["Categories", d.productCategories],
    ["Export experience", d.exportExperience],
    ["Website", d.website],
  ]);

  return NextResponse.json({ ok: true }, { status: 201 });
}
