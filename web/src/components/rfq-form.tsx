"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileUp,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";
import { CATEGORIES, rfqSchema, fieldErrors } from "@/lib/validation";

type Values = Record<string, string>;

const EMPTY: Values = {
  productName: "",
  description: "",
  category: "",
  referenceFileUrl: "",
  quantity: "",
  targetPrice: "",
  materialsSpecifications: "",
  deliveryDate: "",
  destinationCountry: "",
  destinationCity: "",
  name: "",
  company: "",
  email: "",
  phone: "",
  website: "",
};

const STEPS = [
  { n: 1, label: "Product" },
  { n: 2, label: "Requirements" },
  { n: 3, label: "Contact" },
];

const STEP_FIELDS: Record<number, string[]> = {
  1: ["productName", "description", "category", "referenceFileUrl"],
  2: [
    "quantity",
    "targetPrice",
    "materialsSpecifications",
    "deliveryDate",
    "destinationCountry",
    "destinationCity",
  ],
  3: ["name", "company", "email", "phone", "website"],
};

function errorsForStep(step: number, values: Values) {
  const parsed = rfqSchema.safeParse(values);
  if (parsed.success) return {};
  const all = fieldErrors(parsed.error);
  const out: Record<string, string> = {};
  for (const field of STEP_FIELDS[step]) if (all[field]) out[field] = all[field];
  return out;
}

export default function RfqForm({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = (key: string) => (value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      setValues((v) => ({ ...v, referenceFileUrl: data.url }));
      setFileName(file.name);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "We couldn't attach that file.",
      );
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function clearFile() {
    setValues((v) => ({ ...v, referenceFileUrl: "" }));
    setFileName(null);
    setUploadError(null);
  }

  function next() {
    const stepErrors = errorsForStep(step, values);
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setStep((s) => s + 1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const stepErrors = errorsForStep(3, values);
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, fax: "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fields) {
          setErrors(data.fields);
          const firstBadStep = [1, 2, 3].find((s) =>
            STEP_FIELDS[s].some((f) => data.fields[f]),
          );
          if (firstBadStep) setStep(firstBadStep);
        }
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setReference(data.reference);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (reference) {
    return (
      <div className="px-6 py-12 text-center sm:px-10 sm:py-14">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-pass/10">
          <Check size={26} className="text-pass" strokeWidth={2.4} />
        </div>
        <h2
          id="rfq-title"
          className="mt-6 text-2xl font-semibold tracking-[-0.03em]"
        >
          Request received.
        </h2>
        <p className="mx-auto mt-3 max-w-[380px] text-[0.9375rem] leading-relaxed text-muted">
          Norvian will review your requirement and contact you with the next
          steps.
        </p>

        <div className="mx-auto mt-7 w-full max-w-[300px] rounded-xl border border-line bg-mist px-5 py-4">
          <div className="eyebrow">Reference</div>
          <div className="mt-1.5 font-mono text-lg font-medium tracking-tight">
            {reference}
          </div>
        </div>

        <p className="mt-5 text-[0.8125rem] text-muted">
          A copy has been sent to our sourcing team. Keep this reference for
          your records.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="btn btn-primary mt-7 w-full sm:w-auto"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="border-b border-line px-6 pt-6 pb-5 sm:px-8">
        <h2
          id="rfq-title"
          className="text-xl font-semibold tracking-[-0.025em] sm:text-[1.375rem]"
        >
          Start a sourcing request
        </h2>
        <p className="mt-1.5 text-[0.875rem] text-muted">
          Tell us what you need made. No account required.
        </p>

        <ol className="mt-5 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <li key={s.n} className="flex flex-1 items-center gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[0.6875rem] font-medium transition-colors ${
                    step > s.n
                      ? "border-ink bg-ink text-white"
                      : step === s.n
                        ? "border-ink text-ink"
                        : "border-line text-muted"
                  }`}
                >
                  {step > s.n ? <Check size={12} strokeWidth={3} /> : s.n}
                </span>
                <span
                  className={`hidden truncate text-[0.8125rem] sm:block ${
                    step >= s.n ? "text-ink" : "text-muted"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  className={`h-px flex-1 transition-colors ${
                    step > s.n ? "bg-ink" : "bg-line"
                  }`}
                />
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="px-6 py-6 sm:px-8">
        {step === 1 && (
          <div className="animate-fade-up space-y-4">
            <p className="text-[0.9375rem] font-medium">
              What are you looking to source?
            </p>

            <Field
              label="Product name"
              error={errors.productName}
              id="productName"
            >
              <input
                id="productName"
                className="input"
                placeholder="e.g. Sterling silver amethyst rings"
                value={values.productName}
                aria-invalid={!!errors.productName}
                onChange={(e) => set("productName")(e.target.value)}
              />
            </Field>

            <Field
              label="Product description"
              error={errors.description}
              id="description"
            >
              <textarea
                id="description"
                className="input"
                rows={4}
                placeholder="Describe the product, its use, and anything a manufacturer would need to understand it."
                value={values.description}
                aria-invalid={!!errors.description}
                onChange={(e) => set("description")(e.target.value)}
              />
            </Field>

            <Field label="Category" error={errors.category} id="category">
              <select
                id="category"
                className="input"
                value={values.category}
                aria-invalid={!!errors.category}
                onChange={(e) => set("category")(e.target.value)}
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <div>
              <span className="field-label">
                Reference image or file{" "}
                <span className="field-optional">— optional</span>
              </span>
              <input
                ref={fileInput}
                type="file"
                className="sr-only"
                accept="image/png,image/jpeg,image/webp,image/gif,image/heic,application/pdf"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {fileName ? (
                <div className="flex items-center gap-2 rounded-lg border border-line bg-mist px-3 py-2.5">
                  <Paperclip size={15} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-[0.875rem]">
                    {fileName}
                  </span>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-line hover:text-ink"
                    aria-label="Remove file"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInput.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line px-3 py-4 text-[0.875rem] text-muted transition-colors hover:border-ink/25 hover:bg-mist disabled:opacity-60"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={15} className="animate-spin-loader" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <FileUp size={15} />
                      Attach a design, sketch, photo or spec sheet
                    </>
                  )}
                </button>
              )}
              {uploadError && <span className="field-error">{uploadError}</span>}
              <span className="mt-1.5 block text-[0.75rem] text-muted">
                PNG, JPG, WEBP or PDF. Up to 10 MB.
              </span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-up space-y-4">
            <p className="text-[0.9375rem] font-medium">
              Quantities and requirements
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Quantity" error={errors.quantity} id="quantity">
                <input
                  id="quantity"
                  className="input"
                  placeholder="e.g. 500 pieces"
                  value={values.quantity}
                  aria-invalid={!!errors.quantity}
                  onChange={(e) => set("quantity")(e.target.value)}
                />
              </Field>

              <Field
                label="Target price"
                optional
                error={errors.targetPrice}
                id="targetPrice"
              >
                <input
                  id="targetPrice"
                  className="input"
                  placeholder="e.g. $12 per piece"
                  value={values.targetPrice}
                  onChange={(e) => set("targetPrice")(e.target.value)}
                />
              </Field>
            </div>

            <Field
              label="Materials and specifications"
              error={errors.materialsSpecifications}
              id="materialsSpecifications"
            >
              <textarea
                id="materialsSpecifications"
                className="input"
                rows={4}
                placeholder="Materials, dimensions, tolerances, finish, packaging, certifications — anything that defines an acceptable unit."
                value={values.materialsSpecifications}
                aria-invalid={!!errors.materialsSpecifications}
                onChange={(e) => set("materialsSpecifications")(e.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Required delivery date"
                optional
                error={errors.deliveryDate}
                id="deliveryDate"
              >
                <input
                  id="deliveryDate"
                  type="date"
                  className="input"
                  value={values.deliveryDate}
                  aria-invalid={!!errors.deliveryDate}
                  onChange={(e) => set("deliveryDate")(e.target.value)}
                />
              </Field>

              <Field
                label="Destination country"
                error={errors.destinationCountry}
                id="destinationCountry"
              >
                <input
                  id="destinationCountry"
                  className="input"
                  placeholder="e.g. United States"
                  autoComplete="country-name"
                  value={values.destinationCountry}
                  aria-invalid={!!errors.destinationCountry}
                  onChange={(e) => set("destinationCountry")(e.target.value)}
                />
              </Field>
            </div>

            <Field
              label="Destination city"
              optional
              error={errors.destinationCity}
              id="destinationCity"
            >
              <input
                id="destinationCity"
                className="input"
                placeholder="e.g. Los Angeles"
                autoComplete="address-level2"
                value={values.destinationCity}
                onChange={(e) => set("destinationCity")(e.target.value)}
              />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-up space-y-4">
            <p className="text-[0.9375rem] font-medium">How we reach you</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={errors.name} id="name">
                <input
                  id="name"
                  className="input"
                  autoComplete="name"
                  value={values.name}
                  aria-invalid={!!errors.name}
                  onChange={(e) => set("name")(e.target.value)}
                />
              </Field>

              <Field label="Company" error={errors.company} id="company">
                <input
                  id="company"
                  className="input"
                  autoComplete="organization"
                  value={values.company}
                  aria-invalid={!!errors.company}
                  onChange={(e) => set("company")(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Work email" error={errors.email} id="email">
              <input
                id="email"
                type="email"
                className="input"
                autoComplete="email"
                placeholder="you@company.com"
                value={values.email}
                aria-invalid={!!errors.email}
                onChange={(e) => set("email")(e.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Phone / WhatsApp"
                optional
                error={errors.phone}
                id="phone"
              >
                <input
                  id="phone"
                  type="tel"
                  className="input"
                  autoComplete="tel"
                  placeholder="+1 555 000 0000"
                  value={values.phone}
                  onChange={(e) => set("phone")(e.target.value)}
                />
              </Field>

              <Field
                label="Website"
                optional
                error={errors.website}
                id="website"
              >
                <input
                  id="website"
                  className="input"
                  autoComplete="url"
                  placeholder="company.com"
                  value={values.website}
                  onChange={(e) => set("website")(e.target.value)}
                />
              </Field>
            </div>

            {/* honeypot */}
            <input
              type="text"
              name="fax"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute h-0 w-0 opacity-0"
              onChange={() => {}}
            />

            <p className="text-[0.75rem] leading-relaxed text-muted">
              Your requirement is shared only with manufacturers Norvian
              approaches on your behalf.
            </p>
          </div>
        )}

        {formError && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-fail/25 bg-fail/6 px-3.5 py-3 text-[0.8125rem] text-fail"
          >
            {formError}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line bg-mist/60 px-6 py-4 sm:px-8">
        {step > 1 ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setErrors({});
              setStep((s) => s - 1);
            }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
        ) : (
          <span className="text-[0.75rem] text-muted">Step 1 of 3</span>
        )}

        {step < 3 ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={next}
            disabled={uploading}
          >
            Continue
            <ArrowRight size={15} />
          </button>
        ) : (
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="animate-spin-loader" />
                Submitting…
              </>
            ) : (
              "Submit Sourcing Request"
            )}
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  id,
  error,
  optional,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
        {optional && <span className="field-optional"> — optional</span>}
      </label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
