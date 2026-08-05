"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  EXPORT_EXPERIENCE,
  fieldErrors,
  manufacturerSchema,
} from "@/lib/validation";

type Values = Record<string, string>;

const EMPTY: Values = {
  name: "",
  company: "",
  email: "",
  phone: "",
  city: "",
  productCategories: "",
  website: "",
  exportExperience: "",
};

export default function ManufacturerForm({ onClose }: { onClose: () => void }) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (key: string) => (value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = manufacturerSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/manufacturers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, fax: "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setDone(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="px-6 py-12 text-center sm:px-10 sm:py-14">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-pass/10">
          <Check size={26} className="text-pass" strokeWidth={2.4} />
        </div>
        <h2
          id="mfr-title"
          className="mt-6 text-2xl font-semibold tracking-[-0.03em]"
        >
          Application received.
        </h2>
        <p className="mx-auto mt-3 max-w-[400px] text-[0.9375rem] leading-relaxed text-muted">
          Norvian reviews every manufacturer before adding them to the network.
          We&rsquo;ll be in touch about capability and capacity.
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
          id="mfr-title"
          className="text-xl font-semibold tracking-[-0.025em] sm:text-[1.375rem]"
        >
          Join the manufacturer network
        </h2>
        <p className="mt-1.5 text-[0.875rem] text-muted">
          For Indian manufacturers producing for export buyers.
        </p>
      </div>

      <div className="space-y-4 px-6 py-6 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" id="m-name" error={errors.name}>
            <input
              id="m-name"
              className="input"
              autoComplete="name"
              value={values.name}
              aria-invalid={!!errors.name}
              onChange={(e) => set("name")(e.target.value)}
            />
          </Field>
          <Field label="Company" id="m-company" error={errors.company}>
            <input
              id="m-company"
              className="input"
              autoComplete="organization"
              value={values.company}
              aria-invalid={!!errors.company}
              onChange={(e) => set("company")(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" id="m-email" error={errors.email}>
            <input
              id="m-email"
              type="email"
              className="input"
              autoComplete="email"
              value={values.email}
              aria-invalid={!!errors.email}
              onChange={(e) => set("email")(e.target.value)}
            />
          </Field>
          <Field label="Phone" id="m-phone" error={errors.phone}>
            <input
              id="m-phone"
              type="tel"
              className="input"
              autoComplete="tel"
              placeholder="+91 00000 00000"
              value={values.phone}
              aria-invalid={!!errors.phone}
              onChange={(e) => set("phone")(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" id="m-city" error={errors.city}>
            <input
              id="m-city"
              className="input"
              placeholder="e.g. Jaipur"
              autoComplete="address-level2"
              value={values.city}
              aria-invalid={!!errors.city}
              onChange={(e) => set("city")(e.target.value)}
            />
          </Field>
          <Field
            label="Export experience"
            id="m-exp"
            error={errors.exportExperience}
          >
            <select
              id="m-exp"
              className="input"
              value={values.exportExperience}
              aria-invalid={!!errors.exportExperience}
              onChange={(e) => set("exportExperience")(e.target.value)}
            >
              <option value="">Select</option>
              {EXPORT_EXPERIENCE.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Product categories"
          id="m-cats"
          error={errors.productCategories}
        >
          <textarea
            id="m-cats"
            className="input"
            rows={3}
            placeholder="What you manufacture — e.g. sterling silver jewellery, gemstone setting, casting."
            value={values.productCategories}
            aria-invalid={!!errors.productCategories}
            onChange={(e) => set("productCategories")(e.target.value)}
          />
        </Field>

        <Field label="Website" id="m-website" optional error={errors.website}>
          <input
            id="m-website"
            className="input"
            autoComplete="url"
            placeholder="company.com"
            value={values.website}
            onChange={(e) => set("website")(e.target.value)}
          />
        </Field>

        <input
          type="text"
          name="fax"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute h-0 w-0 opacity-0"
          onChange={() => {}}
        />

        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-fail/25 bg-fail/6 px-3.5 py-3 text-[0.8125rem] text-fail"
          >
            {formError}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-line bg-mist/60 px-6 py-4 sm:px-8">
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
            "Submit Application"
          )}
        </button>
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
