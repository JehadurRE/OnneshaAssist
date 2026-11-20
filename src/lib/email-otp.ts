/**
 * Transactional email: Resend first, Brevo fallback (OTP + certificates).
 *
 * Env:
 *   RESEND_API_KEY
 *   BREVO_API_KEY  (or SENDINBLUE_API_KEY)
 *   PORTAL_OTP_FROM_EMAIL  e.g. Onnesha Arena <otp@onnesha.courses>
 */

export type PortalEmailProvider = "resend" | "brevo";

export function resolvePortalOtpFromEmail(): string {
  if (typeof process === "undefined" || !process.env) {
    return "Onnesha Arena <onboarding@resend.dev>";
  }
  const raw = process.env["PORTAL_OTP_FROM_EMAIL"]?.trim();
  return raw && raw.includes("@") ? raw : "Onnesha Arena <onboarding@resend.dev>";
}

function parseFromAddress(from: string): { email: string; name?: string } {
  const angle = from.match(/^(.*?)<([^>]+)>$/);
  if (angle) {
    const name = (angle[1] || "").trim().replace(/^"|"$/g, "");
    const email = (angle[2] || "").trim().toLowerCase();
    return name ? { email, name } : { email };
  }
  return { email: from.trim().toLowerCase() };
}

export function resolveResendApiKey(): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const key = process.env["RESEND_API_KEY"]?.trim();
  return key && key.length > 10 ? key : undefined;
}

export function resolveBrevoApiKey(): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const key =
    process.env["BREVO_API_KEY"]?.trim() ||
    process.env["SENDINBLUE_API_KEY"]?.trim();
  return key && key.length > 10 ? key : undefined;
}

export function isPortalEmailConfigured(): boolean {
  return !!(resolveResendApiKey() || resolveBrevoApiKey());
}

function isResendQuotaError(status: number, detail: string): boolean {
  if (status === 429) return true;
  const d = detail.toLowerCase();
  return (
    d.includes("daily_quota") ||
    d.includes("monthly_quota") ||
    d.includes("quota_exceeded") ||
    d.includes("rate limit") ||
    d.includes("too many")
  );
}

async function sendViaResend(params: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string | undefined;
  apiKey: string;
}): Promise<{ ok: true; provider: "resend" } | { ok: false; error: string; retryable: boolean }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        ...(params.html ? { html: params.html } : {}),
      }),
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { message?: string; name?: string };
        if (body?.message) detail = body.message;
        else if (body?.name) detail = body.name;
      } catch {
        // ignore
      }
      return {
        ok: false,
        error: `Resend: ${detail}`,
        retryable: isResendQuotaError(res.status, detail) || res.status >= 500,
      };
    }
    return { ok: true, provider: "resend" };
  } catch {
    return { ok: false, error: "Resend unreachable.", retryable: true };
  }
}

async function sendViaBrevo(params: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string | undefined;
  apiKey: string;
}): Promise<{ ok: true; provider: "brevo" } | { ok: false; error: string }> {
  const sender = parseFromAddress(params.from);
  if (!sender.email.includes("@") || sender.email.endsWith("@resend.dev")) {
    const envSender =
      typeof process !== "undefined" ? process.env["BREVO_OTP_FROM_EMAIL"]?.trim() : undefined;
    if (envSender?.includes("@")) {
      Object.assign(sender, parseFromAddress(envSender));
    }
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": params.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: sender.name
          ? { name: sender.name, email: sender.email }
          : { email: sender.email },
        to: [{ email: params.to }],
        subject: params.subject,
        textContent: params.text,
        ...(params.html ? { htmlContent: params.html } : {}),
      }),
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { message?: string; code?: string };
        if (body?.message) detail = body.message;
        else if (body?.code) detail = body.code;
      } catch {
        // ignore
      }
      return { ok: false, error: `Brevo: ${detail}` };
    }
    return { ok: true, provider: "brevo" };
  } catch {
    return { ok: false, error: "Brevo unreachable." };
  }
}

/** Generic transactional send: Resend → Brevo fallback. */
export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string | undefined;
}): Promise<
  | { ok: true; provider: PortalEmailProvider }
  | { ok: false; error: string }
> {
  const to = params.to.trim().toLowerCase();
  if (!to.includes("@")) return { ok: false, error: "Invalid email address." };

  const resendKey = resolveResendApiKey();
  const brevoKey = resolveBrevoApiKey();
  if (!resendKey && !brevoKey) {
    return {
      ok: false,
      error:
        "Email is not configured. Set RESEND_API_KEY and/or BREVO_API_KEY (and PORTAL_OTP_FROM_EMAIL) on the server.",
    };
  }

  const from = resolvePortalOtpFromEmail();
  const errors: string[] = [];

  if (resendKey) {
    const primary = await sendViaResend({
      to,
      from,
      subject: params.subject,
      text: params.text,
      html: params.html,
      apiKey: resendKey,
    });
    if (primary.ok) return primary;
    errors.push(primary.error);
    if (!primary.retryable || !brevoKey) {
      if (!brevoKey) return { ok: false, error: primary.error };
    }
  }

  if (brevoKey) {
    const fallback = await sendViaBrevo({
      to,
      from,
      subject: params.subject,
      text: params.text,
      html: params.html,
      apiKey: brevoKey,
    });
    if (fallback.ok) return fallback;
    errors.push(fallback.error);
  }

  return {
    ok: false,
    error: errors.filter(Boolean).join(" → ") || "Email providers failed.",
  };
}

export async function sendPortalOtpEmail(params: {
  to: string;
  code: string;
}): Promise<
  | { ok: true; provider: PortalEmailProvider }
  | { ok: false; error: string }
> {
  return sendTransactionalEmail({
    to: params.to,
    subject: `${params.code} — Onnesha Arena portal login`,
    text: `Your Onnesha Student Portal verification code is ${params.code}.\n\nValid for 5 minutes. Do not share this code.\n\n— Onnesha Arena`,
  });
}

export function buildCourseCertificateEmail(params: {
  studentName: string;
  courseTitle: string;
  courseCode: string;
  certificateNumber: string;
  combinedScorePct?: number | undefined;
  verifyUrl: string;
  portalUrl: string;
}): { subject: string; text: string; html: string } {
  const score =
    typeof params.combinedScorePct === "number"
      ? ` Combined score: ${params.combinedScorePct}%.`
      : "";
  const subject = `Course completion certificate — ${params.courseCode}`;
  const text = [
    `Congratulations ${params.studentName}!`,
    "",
    `Your course completion certificate for ${params.courseTitle} (${params.courseCode}) has been issued.`,
    `Certificate number: ${params.certificateNumber}.${score}`,
    "",
    `Verify online: ${params.verifyUrl}`,
    `Student portal: ${params.portalUrl}`,
    "",
    "— Onnesha Arena",
  ].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
  <p>Congratulations <strong>${escapeHtml(params.studentName)}</strong>!</p>
  <p>Your <strong>course completion certificate</strong> for
    <em>${escapeHtml(params.courseTitle)}</em>
    (<code>${escapeHtml(params.courseCode)}</code>) has been issued.</p>
  <p>Certificate number: <strong>${escapeHtml(params.certificateNumber)}</strong>${
    typeof params.combinedScorePct === "number"
      ? `<br/>Combined score: <strong>${params.combinedScorePct}%</strong>`
      : ""
  }</p>
  <p>
    <a href="${escapeHtml(params.verifyUrl)}" style="display:inline-block;padding:10px 16px;background:#059669;color:#fff;border-radius:10px;text-decoration:none;font-weight:700">
      Verify certificate
    </a>
  </p>
  <p style="font-size:13px;color:#64748b">
    Portal: <a href="${escapeHtml(params.portalUrl)}">${escapeHtml(params.portalUrl)}</a>
  </p>
  <p style="font-size:12px;color:#94a3b8">— Onnesha Arena</p>
</div>`;
  return { subject, text, html };
}

function escapeHtml(raw: string): string {
  return (raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function normalizePortalEmail(raw: string): string {
  return (raw || "").trim().toLowerCase();
}

export function isValidPortalEmail(raw: string): boolean {
  const e = normalizePortalEmail(raw);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
