import { z } from "zod";

export const CATEGORIES = [
  "Jewellery & Gemstones",
  "Textiles & Apparel",
  "Home & Handicrafts",
  "Other",
] as const;

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/**
 * Buyers paste addresses, ranges and free-form units into these fields, so the
 * only thing worth enforcing is presence and a sane length. Over-validating a
 * quantity ("5,000 pcs / 10k units per month") loses real leads.
 */
export const rfqSchema = z.object({
  productName: trimmed(200).min(2, "Please enter the product name."),
  description: trimmed(4000).min(
    10,
    "Please describe the product in a little more detail.",
  ),
  category: z.enum(CATEGORIES, { message: "Please choose a category." }),
  referenceFileUrl: z
    .string()
    .trim()
    .url()
    .max(1000)
    .optional()
    .or(z.literal("").transform(() => undefined)),

  quantity: trimmed(200).min(1, "Please enter an approximate quantity."),
  targetPrice: optionalText(200),
  materialsSpecifications: trimmed(4000).min(
    3,
    "Please list the key materials or specifications.",
  ),
  deliveryDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please use a valid date.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  destinationCountry: trimmed(120).min(2, "Please enter a destination country."),
  destinationCity: optionalText(120),

  name: trimmed(150).min(2, "Please enter your full name."),
  company: trimmed(200).min(1, "Please enter your company name."),
  email: trimmed(200).email("Please enter a valid work email address."),
  phone: optionalText(60),
  website: optionalText(300),
});

export type RfqInput = z.infer<typeof rfqSchema>;

export const manufacturerSchema = z.object({
  name: trimmed(150).min(2, "Please enter your full name."),
  company: trimmed(200).min(1, "Please enter your company name."),
  email: trimmed(200).email("Please enter a valid email address."),
  phone: trimmed(60).min(5, "Please enter a contact number."),
  city: trimmed(120).min(2, "Please enter your city."),
  productCategories: trimmed(500).min(
    2,
    "Please list what you manufacture.",
  ),
  website: optionalText(300),
  exportExperience: trimmed(200).min(1, "Please select your export experience."),
});

export type ManufacturerInput = z.infer<typeof manufacturerSchema>;

export const EXPORT_EXPERIENCE = [
  "No export experience yet",
  "Under 1 year",
  "1–3 years",
  "3–10 years",
  "10+ years",
] as const;

/** Flattens a ZodError into { fieldName: firstMessage } for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
