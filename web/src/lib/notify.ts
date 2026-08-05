const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();
const NOTIFY_TO = process.env.NOTIFY_EMAIL_TO?.trim();
const NOTIFY_FROM =
  process.env.NOTIFY_EMAIL_FROM?.trim() || "Norvian <onboarding@resend.dev>";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
}

/**
 * Best-effort notification. A submission is already durably stored by the time
 * this runs, so an email outage must never turn into a failed request for the
 * buyer — every path here swallows its error and logs instead.
 */
export async function notifySubmission(
  subject: string,
  rows: Array<[string, string | undefined | null]>,
): Promise<void> {
  if (!RESEND_API_KEY || !NOTIFY_TO) return;

  const body = rows
    .filter(([, v]) => v)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#666a73;font-size:13px;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:14px;color:#0a0b0d">${escapeHtml(String(value))}</td></tr>`,
    )
    .join("");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: NOTIFY_FROM,
        to: [NOTIFY_TO],
        subject,
        html: `<div style="font-family:ui-sans-serif,system-ui,sans-serif"><h2 style="font-size:16px;margin:0 0 14px">${escapeHtml(subject)}</h2><table style="border-collapse:collapse">${body}</table></div>`,
      }),
    });
    if (!res.ok) {
      console.error("[notify] resend responded", res.status, await res.text());
    }
  } catch (err) {
    console.error("[notify] failed to send", err);
  }
}
