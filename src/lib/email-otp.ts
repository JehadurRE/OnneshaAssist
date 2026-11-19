/**
 * Portal email OTP delivery via Resend HTTP API (no SMTP package).
 * Env: RESEND_API_KEY, PORTAL_OTP_FROM_EMAIL (e.g. Onnesha Arena <otp@onnesha.courses>)
 */

export function resolvePortalOtpFromEmail(): string {
  if (typeof process === "undefined" || !process.env) {
    return "Onnesha Arena <onboarding@resend.dev>";
  }
  const raw = process.env["PORTAL_OTP_FROM_EMAIL"]?.trim();
  return raw && raw.includes("@") ? raw : "Onnesha Arena <onboarding@resend.dev>";
}

export function resolveResendApiKey(): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const key = process.env["RESEND_API_KEY"]?.trim();
  return key && key.length > 10 ? key : undefined;
}

export async function sendPortalOtpEmail(params: {
  to: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = resolveResendApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Email OTP is not configured. Admin must set RESEND_API_KEY (and optional PORTAL_OTP_FROM_EMAIL) on the server.",
    };
  }
  const to = params.to.trim().toLowerCase();
  if (!to.includes("@")) return { ok: false, error: "Invalid email address." };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resolvePortalOtpFromEmail(),
        to: [to],
        subject: `${params.code} — Onnesha Arena portal login`,
        text: `Your Onnesha Student Portal verification code is ${params.code}.\n\nValid for 5 minutes. Do not share this code.\n\n— Onnesha Arena`,
      }),
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { message?: string };
        if (body?.message) detail = body.message;
      } catch {
        // ignore
      }
      return { ok: false, error: `Email provider error: ${detail}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to reach email OTP provider." };
  }
}

export function normalizePortalEmail(raw: string): string {
  return (raw || "").trim().toLowerCase();
}

export function isValidPortalEmail(raw: string): boolean {
  const e = normalizePortalEmail(raw);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
