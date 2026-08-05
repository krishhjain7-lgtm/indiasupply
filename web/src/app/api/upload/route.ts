import { NextResponse } from "next/server";
import { uploadReference } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "application/pdf",
];

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Malformed upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is over 10 MB. Please attach a smaller reference." },
      { status: 413 },
    );
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Please attach an image or a PDF." },
      { status: 415 },
    );
  }

  try {
    const { url } = await uploadReference(file);
    return NextResponse.json({ url }, { status: 201 });
  } catch (err) {
    console.error("[upload] failed", err);
    return NextResponse.json(
      {
        error:
          "We couldn't attach that file. You can submit without it and email it to us later.",
      },
      { status: 503 },
    );
  }
}
