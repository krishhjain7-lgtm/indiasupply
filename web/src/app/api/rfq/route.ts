import { NextResponse } from "next/server";
import { rfqSchema, fieldErrors } from "@/lib/validation";
import { insertRow, referenceNumber, RFQ_TABLE } from "@/lib/db";
import { notifySubmission } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Malformed request." },
      { status: 400 },
    );
  }

  // Honeypot: real buyers never see or fill this field.
  if (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as Record<string, unknown>).fax === "string" &&
    (payload as Record<string, unknown>).fax !== ""
  ) {
    return NextResponse.json({ reference: referenceNumber() }, { status: 200 });
  }

  const parsed = rfqSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Some details need fixing.", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const d = parsed.data;
  const reference = referenceNumber();
  const destination = [d.destinationCity, d.destinationCountry]
    .filter(Boolean)
    .join(", ");

  const row = {
    reference_number: reference,
    name: d.name,
    company: d.company,
    email: d.email,
    phone: d.phone ?? null,
    website: d.website ?? null,
    category: d.category,
    product_name: d.productName,
    description: d.description,
    quantity: d.quantity,
    target_price: d.targetPrice ?? null,
    materials_specifications: d.materialsSpecifications,
    delivery_date: d.deliveryDate ?? null,
    destination,
    reference_file_url: d.referenceFileUrl ?? null,
    status: "new",
  };

  try {
    const { storage } = await insertRow(RFQ_TABLE, row);
    if (storage === "local-dev-file") {
      console.warn(
        `[rfq] ${reference} stored in the local development file — Supabase is not configured.`,
      );
    }
  } catch (err) {
    console.error("[rfq] failed to store submission", err, row);
    return NextResponse.json(
      {
        error:
          "We couldn't submit your request right now. Please try again, or email us at hello@norvian.ai.",
      },
      { status: 503 },
    );
  }

  await notifySubmission(`New sourcing request ${reference} — ${d.company}`, [
    ["Reference", reference],
    ["Product", d.productName],
    ["Category", d.category],
    ["Quantity", d.quantity],
    ["Target price", d.targetPrice],
    ["Specifications", d.materialsSpecifications],
    ["Delivery date", d.deliveryDate],
    ["Destination", destination],
    ["Contact", d.name],
    ["Company", d.company],
    ["Email", d.email],
    ["Phone", d.phone],
    ["Website", d.website],
    ["Reference file", d.referenceFileUrl],
    ["Description", d.description],
  ]);

  return NextResponse.json({ reference }, { status: 201 });
}
