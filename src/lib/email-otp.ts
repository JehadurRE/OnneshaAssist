/**
 * Transactional email: Resend first, Brevo fallback (credentials, reset OTP, login OTP & certificates).
 *
 * Env:
 *   RESEND_API_KEY
 *   BREVO_API_KEY  (or SENDINBLUE_API_KEY)
 *   PORTAL_OTP_FROM_EMAIL  e.g. Onnesha Arena <otp@onnesha.courses>
 */

import {
  buildCourseCertificateEmail,
  buildEmailBrandContext,
  buildPasswordChangedEmail,
  buildPasswordResetOtpEmail,
  buildPortalOtpEmail,
  buildQuizCertificateEmail,
  buildSampleEmailTemplate,
  buildStudentCredentialsEmail,
  EMAIL_TEMPLATE_CATALOG,
  type EmailBrandContext,
  type EmailTemplateId,
  type RenderedEmailTemplate,
} from "./email-templates";

export {
  buildCourseCertificateEmail,
  buildEmailBrandContext,
  buildPasswordChangedEmail,
  buildPasswordResetOtpEmail,
  buildPortalOtpEmail,
  buildQuizCertificateEmail,
  buildSampleEmailTemplate,
  buildStudentCredentialsEmail,
  EMAIL_TEMPLATE_CATALOG,
  type EmailBrandContext,
  type EmailTemplateId,
  type RenderedEmailTemplate,
};

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
  studentName?: string | undefined;
  brand?: EmailBrandContext | undefined;
}): Promise<
  | { ok: true; provider: PortalEmailProvider }
  | { ok: false; error: string }
> {
  const rendered = buildPortalOtpEmail({
    code: params.code,
    studentName: params.studentName,
    brand: params.brand,
  });
  return sendTransactionalEmail({
    to: params.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
}

export async function sendPasswordResetOtpEmail(params: {
  to: string;
  studentName: string;
  rollNumber?: string | undefined;
  code: string;
  portalUrl?: string | undefined;
  brand?: EmailBrandContext | undefined;
}): Promise<
  | { ok: true; provider: PortalEmailProvider }
  | { ok: false; error: string }
> {
  const rendered = buildPasswordResetOtpEmail({
    studentName: params.studentName,
    rollNumber: params.rollNumber,
    code: params.code,
    portalUrl: params.portalUrl,
    brand: params.brand,
  });
  return sendTransactionalEmail({
    to: params.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
}

export async function sendStudentCredentialsEmail(params: {
  to: string;
  studentName: string;
  rollNumber: string;
  username?: string | undefined;
  temporaryPassword: string;
  regionName?: string | undefined;
  batch?: string | undefined;
  courseTitle?: string | undefined;
  portalUrl: string;
  mustChangePassword?: boolean | undefined;
  brand?: EmailBrandContext | undefined;
}): Promise<
  | { ok: true; provider: PortalEmailProvider }
  | { ok: false; error: string }
> {
  const rendered = buildStudentCredentialsEmail({
    studentName: params.studentName,
    rollNumber: params.rollNumber,
    email: params.to,
    username: params.username,
    temporaryPassword: params.temporaryPassword,
    regionName: params.regionName,
    batch: params.batch,
    courseTitle: params.courseTitle,
    portalUrl: params.portalUrl,
    mustChangePassword: params.mustChangePassword,
    brand: params.brand,
  });
  return sendTransactionalEmail({
    to: params.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
}

export function normalizePortalEmail(raw: string): string {
  return (raw || "").trim().toLowerCase();
}

export function isValidPortalEmail(raw: string): boolean {
  const e = normalizePortalEmail(raw);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
