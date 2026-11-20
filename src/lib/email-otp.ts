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
  /** Optional badge title from course design profile (used in subject). */
  badgeTitle?: string | undefined;
}): { subject: string; text: string; html: string } {
  const score =
    typeof params.combinedScorePct === "number"
      ? ` Combined score: ${params.combinedScorePct}%.`
      : "";
  const badge = (params.badgeTitle || "").trim();
  const subject = badge
    ? `${badge} — ${params.courseCode || "Course"}`
    : `Course completion certificate — ${params.courseCode}`;
  const text = [
    `Hi ${params.studentName},`,
    "",
    `Your course completion certificate for ${params.courseTitle} (${params.courseCode}) is ready.`,
    `Certificate number: ${params.certificateNumber}.${score}`,
    "",
    `Open / verify: ${params.verifyUrl}`,
    `Portal: ${params.portalUrl}`,
    "",
    "— Onnesha Arena",
  ].join("\n");
  const html = `<div style="font-family:Georgia,'Times New Roman',serif;line-height:1.55;color:#0f172a;max-width:560px">
  <p style="font-size:15px">Hi <strong>${escapeHtml(params.studentName)}</strong>,</p>
  <p style="font-size:15px">Your <strong>course completion certificate</strong> for
    ${escapeHtml(params.courseTitle)}
    (<code style="font-family:ui-monospace,monospace">${escapeHtml(params.courseCode)}</code>) is ready.</p>
  <p style="font-size:14px">Certificate number: <strong>${escapeHtml(params.certificateNumber)}</strong>${
    typeof params.combinedScorePct === "number"
      ? `<br/>Combined score: <strong>${params.combinedScorePct}%</strong>`
      : ""
  }</p>
  <p>
    <a href="${escapeHtml(params.verifyUrl)}" style="display:inline-block;padding:12px 18px;background:#0f766e;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-family:system-ui,sans-serif">
      Open certificate
    </a>
  </p>
  <p style="font-size:13px;color:#64748b;font-family:system-ui,sans-serif">
    Portal: <a href="${escapeHtml(params.portalUrl)}" style="color:#0f766e">${escapeHtml(params.portalUrl)}</a>
  </p>
  <p style="font-size:12px;color:#94a3b8;font-family:system-ui,sans-serif">— Onnesha Arena</p>
</div>`;
  return { subject, text, html };
}

export function buildQuizCertificateEmail(params: {
  studentName: string;
  quizTitle: string;
  certificateNumber: string;
  scorePct?: number | undefined;
  rank?: number | undefined;
  totalParticipants?: number | undefined;
  verifyUrl: string;
  portalUrl: string;
  badgeTitle?: string | undefined;
}): { subject: string; text: string; html: string } {
  const badge = (params.badgeTitle || "").trim() || "Quiz merit certificate";
  const scoreLine =
    typeof params.scorePct === "number" ? ` Score: ${params.scorePct}%.` : "";
  const rankLine =
    typeof params.rank === "number" && typeof params.totalParticipants === "number"
      ? ` Rank: ${params.rank} of ${params.totalParticipants}.`
      : "";
  const subject = `${badge} — ${params.quizTitle}`;
  const text = [
    `Hi ${params.studentName},`,
    "",
    `Your quiz certificate for "${params.quizTitle}" is ready.`,
    `Certificate number: ${params.certificateNumber}.${scoreLine}${rankLine}`,
    "",
    `Open / verify: ${params.verifyUrl}`,
    `Portal: ${params.portalUrl}`,
    "",
    "— Onnesha Arena",
  ].join("\n");
  const html = `<div style="font-family:Georgia,'Times New Roman',serif;line-height:1.55;color:#0f172a;max-width:560px">
  <p style="font-size:15px">Hi <strong>${escapeHtml(params.studentName)}</strong>,</p>
  <p style="font-size:15px">Your <strong>quiz certificate</strong> for
    “${escapeHtml(params.quizTitle)}” is ready.</p>
  <p style="font-size:14px">Certificate number: <strong>${escapeHtml(params.certificateNumber)}</strong>${
    typeof params.scorePct === "number"
      ? `<br/>Score: <strong>${params.scorePct}%</strong>`
      : ""
  }${
    typeof params.rank === "number" && typeof params.totalParticipants === "number"
      ? `<br/>Rank: <strong>${params.rank}</strong> of ${params.totalParticipants}`
      : ""
  }</p>
  <p>
    <a href="${escapeHtml(params.verifyUrl)}" style="display:inline-block;padding:12px 18px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-family:system-ui,sans-serif">
      Open certificate
    </a>
  </p>
  <p style="font-size:13px;color:#64748b;font-family:system-ui,sans-serif">
    Portal: <a href="${escapeHtml(params.portalUrl)}" style="color:#1d4ed8">${escapeHtml(params.portalUrl)}</a>
  </p>
  <p style="font-size:12px;color:#94a3b8;font-family:system-ui,sans-serif">— Onnesha Arena</p>
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
