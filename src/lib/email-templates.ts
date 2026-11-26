/**
 * Branded, email-client-safe (Gmail / Outlook / Apple Mail / mobile) transactional
 * HTML + plain-text email templates for Onnesha Arena.
 *
 * All templates share a cohesive institutional shell with inline table-based layout,
 * hidden inbox preheaders, automatic HTML escaping, and accessible high-contrast UI.
 */

import type { BrandingSettings } from "./types";

export type EmailTemplateId =
  | "student_credentials"
  | "course_certificate"
  | "quiz_certificate"
  | "portal_otp"
  | "password_reset_otp"
  | "password_changed";

export interface EmailBrandContext {
  institutionTitle?: string | undefined;
  coBrandSubtitle?: string | undefined;
  origin?: string | undefined;
  logoUrl?: string | undefined;
  portalUrl?: string | undefined;
}

export interface RenderedEmailTemplate {
  subject: string;
  text: string;
  html: string;
}

type ShellTone = "emerald" | "heritage" | "cobalt" | "amber";

interface TonePalette {
  headerBg: string;
  headerBgFallback: string;
  topStripe: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  ctaBg: string;
  ctaShadow: string;
  accentText: string;
}

const TONE_PALETTES: Record<ShellTone, TonePalette> = {
  emerald: {
    headerBg: "linear-gradient(135deg,#042f2e 0%,#065f46 58%,#0f766e 100%)",
    headerBgFallback: "#065f46",
    topStripe: "linear-gradient(90deg,#d97706 0%,#f59e0b 45%,#10b981 100%)",
    pillBg: "rgba(255,255,255,0.14)",
    pillBorder: "rgba(255,255,255,0.28)",
    pillText: "#ecfdf5",
    ctaBg: "#0f766e",
    ctaShadow: "0 4px 14px rgba(15,118,110,0.28)",
    accentText: "#0f766e",
  },
  heritage: {
    headerBg: "linear-gradient(135deg,#052e22 0%,#064e3b 52%,#14532d 100%)",
    headerBgFallback: "#064e3b",
    topStripe: "linear-gradient(90deg,#b45309 0%,#f59e0b 50%,#b45309 100%)",
    pillBg: "rgba(251,191,36,0.18)",
    pillBorder: "rgba(251,191,36,0.45)",
    pillText: "#fef3c7",
    ctaBg: "#065f46",
    ctaShadow: "0 4px 14px rgba(6,95,70,0.3)",
    accentText: "#065f46",
  },
  cobalt: {
    headerBg: "linear-gradient(135deg,#081124 0%,#172554 55%,#1d4ed8 100%)",
    headerBgFallback: "#172554",
    topStripe: "linear-gradient(90deg,#eab308 0%,#38bdf8 55%,#2563eb 100%)",
    pillBg: "rgba(56,189,248,0.16)",
    pillBorder: "rgba(56,189,248,0.4)",
    pillText: "#e0f2fe",
    ctaBg: "#1d4ed8",
    ctaShadow: "0 4px 14px rgba(29,78,216,0.28)",
    accentText: "#1d4ed8",
  },
  amber: {
    headerBg: "linear-gradient(135deg,#1e293b 0%,#334155 58%,#78350f 100%)",
    headerBgFallback: "#1e293b",
    topStripe: "linear-gradient(90deg,#f59e0b 0%,#d97706 50%,#fbbf24 100%)",
    pillBg: "rgba(251,191,36,0.18)",
    pillBorder: "rgba(251,191,36,0.42)",
    pillText: "#fef3c7",
    ctaBg: "#b45309",
    ctaShadow: "0 4px 14px rgba(180,83,9,0.28)",
    accentText: "#b45309",
  },
};

export function escapeEmailHtml(raw: string): string {
  return (raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(url: string | undefined, fallback = "https://arena.onnesha.courses"): string {
  const trimmed = (url || "").trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return fallback;
}

function resolveEmailLogoUrl(
  logoUrl: string | undefined,
  origin: string,
): string | undefined {
  const raw = (logoUrl || "").trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${origin.replace(/\/+$/, "")}${raw}`;
  return undefined;
}

export function buildEmailBrandContext(
  branding?: Partial<BrandingSettings> | null,
  origin = "https://arena.onnesha.courses",
): EmailBrandContext {
  const cleanOrigin = (origin || "https://arena.onnesha.courses").replace(/\/+$/, "");
  const partnerBits = [
    branding?.rightLogoLabel?.trim(),
    branding?.rightSecondaryLogoLabel?.trim(),
  ].filter(Boolean);
  return {
    institutionTitle: branding?.institutionTitle?.trim() || "Onnesha Assessment Arena",
    coBrandSubtitle: partnerBits.length > 0 ? partnerBits.join(" · ") : undefined,
    origin: cleanOrigin,
    logoUrl: resolveEmailLogoUrl(branding?.leftLogoUrl || "/assets/onnesha-mark.png", cleanOrigin),
    portalUrl: `${cleanOrigin}/portal`,
  };
}

function formatSpacedOtp(code: string): string {
  const clean = (code || "").trim();
  if (clean.length === 6) {
    return `${clean.slice(0, 3)}&nbsp;&nbsp;${clean.slice(3)}`;
  }
  return escapeEmailHtml(clean);
}

function renderBrandedEmailShell(params: {
  tone: ShellTone;
  categoryLabel: string;
  headline: string;
  subheadline?: string | undefined;
  preheader: string;
  bodyHtml: string;
  footerNote?: string | undefined;
  brand?: EmailBrandContext | undefined;
}): string {
  const palette = TONE_PALETTES[params.tone];
  const origin = (params.brand?.origin || "https://arena.onnesha.courses").replace(/\/+$/, "");
  const portalUrl = safeHref(params.brand?.portalUrl || `${origin}/portal`, `${origin}/portal`);
  const institution = params.brand?.institutionTitle?.trim() || "Onnesha Assessment Arena";
  const coBrand = params.brand?.coBrandSubtitle?.trim();
  const logoUrl = params.brand?.logoUrl;
  const year = new Date().getFullYear();

  const logoMarkup = logoUrl
    ? `<img src="${escapeEmailHtml(logoUrl)}" alt="${escapeEmailHtml(institution)}" width="38" height="38" style="display:block;width:38px;height:38px;border-radius:10px;background:#ffffff;padding:3px;border:1px solid rgba(255,255,255,0.28);object-fit:contain;" />`
    : `<div style="width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.3);text-align:center;line-height:38px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:800;color:#ffffff;">O</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeEmailHtml(params.headline)}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef3f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
  <!-- Hidden Inbox Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#eef3f1;">
    ${escapeEmailHtml(params.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#eef3f1;padding:28px 14px 36px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #d7e2dd;box-shadow:0 12px 32px rgba(15,23,42,0.07);">
          <!-- Top Sovereign Accent Hairline -->
          <tr>
            <td style="height:4px;background-color:${palette.ctaBg};background:${palette.topStripe};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Institutional Hero Header -->
          <tr>
            <td style="background-color:${palette.headerBgFallback};background:${palette.headerBg};padding:26px 28px 24px;color:#ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align:middle;" width="48">
                    ${logoMarkup}
                  </td>
                  <td style="vertical-align:middle;padding-left:12px;">
                    <div style="font-size:15px;font-weight:800;letter-spacing:-0.01em;color:#ffffff;line-height:1.25;">
                      ${escapeEmailHtml(institution)}
                    </div>
                    ${
                      coBrand
                        ? `<div style="font-size:11px;color:rgba(255,255,255,0.78);margin-top:2px;line-height:1.3;">${escapeEmailHtml(coBrand)}</div>`
                        : ""
                    }
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:${palette.pillBg};border:1px solid ${palette.pillBorder};font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${palette.pillText};white-space:nowrap;">
                      ${escapeEmailHtml(params.categoryLabel)}
                    </span>
                  </td>
                </tr>
              </table>

              <div style="margin-top:20px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;line-height:1.25;color:#ffffff;letter-spacing:-0.01em;">
                ${escapeEmailHtml(params.headline)}
              </div>
              ${
                params.subheadline
                  ? `<div style="margin-top:6px;font-size:13.5px;line-height:1.5;color:rgba(255,255,255,0.86);">${escapeEmailHtml(params.subheadline)}</div>`
                  : ""
              }
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:28px 28px 24px;background-color:#ffffff;">
              ${params.bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8faf9;border-top:1px solid #e2ebe7;padding:18px 28px 22px;">
              ${
                params.footerNote
                  ? `<p style="margin:0 0 10px;font-size:12px;line-height:1.55;color:#475569;">${escapeEmailHtml(params.footerNote)}</p>`
                  : ""
              }
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="font-size:11.5px;color:#64748b;line-height:1.5;">
                    <strong style="color:#334155;">${escapeEmailHtml(institution)}</strong><br />
                    Student Portal: <a href="${escapeEmailHtml(portalUrl)}" style="color:${palette.accentText};text-decoration:none;font-weight:600;">${escapeEmailHtml(portalUrl)}</a>
                  </td>
                  <td align="right" style="font-size:11px;color:#94a3b8;vertical-align:bottom;white-space:nowrap;">
                    &copy; ${year} Onnesha Arena
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderPrimaryButton(params: {
  href: string;
  label: string;
  tone: ShellTone;
}): string {
  const palette = TONE_PALETTES[params.tone];
  const url = safeHref(params.href);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 8px;">
  <tr>
    <td align="center" style="border-radius:12px;background-color:${palette.ctaBg};box-shadow:${palette.ctaShadow};">
      <a href="${escapeEmailHtml(url)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;letter-spacing:0.01em;">
        ${escapeEmailHtml(params.label)}
      </a>
    </td>
  </tr>
</table>`;
}

// ============================================================================
// 1. STUDENT PORTAL CREDENTIALS (ADMIN DISPATCH / ONBOARDING)
// ============================================================================

export function buildStudentCredentialsEmail(params: {
  studentName: string;
  rollNumber: string;
  email: string;
  username?: string | undefined;
  temporaryPassword: string;
  regionName?: string | undefined;
  batch?: string | undefined;
  courseTitle?: string | undefined;
  portalUrl: string;
  mustChangePassword?: boolean | undefined;
  brand?: EmailBrandContext | undefined;
}): RenderedEmailTemplate {
  const cleanPortalUrl = safeHref(params.portalUrl);
  const directLoginUrl = `${cleanPortalUrl}${cleanPortalUrl.includes("?") ? "&" : "?"}id=${encodeURIComponent(
    params.rollNumber || params.email,
  )}`;
  const institution = params.brand?.institutionTitle?.trim() || "Onnesha Assessment Arena";
  const loginIds = [params.rollNumber, params.username, params.email].filter(
    (v, i, arr) => Boolean(v && v.trim()) && arr.indexOf(v) === i,
  ) as string[];

  const subject = `Your Student Portal Login Credentials — ${params.rollNumber} · ${institution}`;

  const text = [
    `Hi ${params.studentName},`,
    "",
    `Your Student Learning Portal account on ${institution} is ready.`,
    params.courseTitle ? `Course: ${params.courseTitle}` : "",
    params.regionName ? `Training Centre: ${params.regionName}` : "",
    "",
    "--- SIGN-IN CREDENTIALS ---",
    `Portal Link: ${directLoginUrl}`,
    `Roll / Login ID: ${params.rollNumber}`,
    params.username ? `Username: ${params.username}` : "",
    `Email: ${params.email}`,
    `Temporary Password: ${params.temporaryPassword}`,
    "---------------------------",
    "",
    params.mustChangePassword !== false
      ? "Security tip: Please change this temporary password to your own personal password right after your first sign-in."
      : "You can change or reset your password anytime directly from the Student Portal.",
    "",
    "Inside your portal you can access study notes, class recordings, your Course AI Tutor, final exams, practical submissions, and verified certificates.",
    "",
    `— ${institution}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const metaChips = [params.regionName, params.batch, params.courseTitle]
    .filter(Boolean)
    .map(
      (item) =>
        `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:999px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:11.5px;font-weight:600;color:#334155;">${escapeEmailHtml(
          item!,
        )}</span>`,
    )
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#0f172a;">
      Hi <strong>${escapeEmailHtml(params.studentName)}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#334155;">
      Your <strong>Student Learning Portal</strong> credentials are ready. Sign in anytime using your Roll ID${
        params.username ? ", Username," : ""
      } or registered email with the password below — no waiting for one-time codes on every visit.
    </p>
    ${metaChips ? `<div style="margin:0 0 18px;">${metaChips}</div>` : ""}

    <!-- Credentials Vault Card -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fbfa;border:1px solid #cce3da;border-left:4px solid #0f766e;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:18px 20px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e;margin-bottom:12px;">
            Your Portal Sign-In Details
          </div>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:13px;">
            <tr>
              <td style="padding:6px 0;color:#64748b;width:140px;vertical-align:top;">Roll / Student ID</td>
              <td style="padding:6px 0;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-weight:800;color:#0f172a;font-size:13.5px;">
                ${escapeEmailHtml(params.rollNumber)}
              </td>
            </tr>
            ${
              params.username
                ? `<tr>
              <td style="padding:6px 0;color:#64748b;border-top:1px solid #e6f0ec;vertical-align:top;">Username</td>
              <td style="padding:6px 0;border-top:1px solid #e6f0ec;font-family:'SFMono-Regular',Consolas,monospace;font-weight:700;color:#0f172a;">
                ${escapeEmailHtml(params.username)}
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding:6px 0;color:#64748b;border-top:1px solid #e6f0ec;vertical-align:top;">Registered Email</td>
              <td style="padding:6px 0;border-top:1px solid #e6f0ec;font-weight:600;color:#0f172a;word-break:break-all;">
                ${escapeEmailHtml(params.email)}
              </td>
            </tr>
            <tr>
              <td style="padding:12px 0 4px;color:#64748b;border-top:1px solid #e6f0ec;vertical-align:middle;">
                ${params.mustChangePassword !== false ? "Temporary Password" : "Portal Password"}
              </td>
              <td style="padding:12px 0 4px;border-top:1px solid #e6f0ec;">
                <span style="display:inline-block;padding:8px 14px;border-radius:10px;background:#ecfdf5;border:1.5px solid #10b981;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:17px;font-weight:800;letter-spacing:0.08em;color:#064e3b;">
                  ${escapeEmailHtml(params.temporaryPassword)}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${renderPrimaryButton({
      href: directLoginUrl,
      label: "Sign In to Student Portal →",
      tone: "emerald",
    })}

    <p style="margin:6px 0 18px;font-size:12px;color:#64748b;line-height:1.5;">
      You can sign in with any of: <strong style="color:#334155;">${escapeEmailHtml(loginIds.join(" · "))}</strong>
    </p>

    <!-- What's inside strip -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px;">
      <tr>
        <td style="padding:14px 16px;font-size:12.5px;color:#334155;line-height:1.6;">
          <div style="font-weight:800;color:#0f172a;margin-bottom:6px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">
            Inside Your Workspace
          </div>
          &bull; Session-organized lecture notes &amp; class recordings<br />
          &bull; Dedicated bilingual <strong>Course AI Tutor</strong><br />
          &bull; Final Exam results, practical capstone &amp; verified PDF certificate
        </td>
      </tr>
    </table>

    <!-- Security Note -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
      <tr>
        <td style="padding:12px 16px;font-size:12px;line-height:1.55;color:#92400e;">
          <strong>Security tip:</strong> After signing in, open <strong>Change Password</strong> in your portal sidebar to choose a personal password only you know. If you ever forget it, use <strong>Forgot Password</strong> on the login screen.
        </td>
      </tr>
    </table>
  `;

  const html = renderBrandedEmailShell({
    tone: "emerald",
    categoryLabel: "Portal Access",
    headline: "Welcome to Your Student Workspace",
    subheadline: "Your personal login credentials are ready — keep this email handy.",
    preheader: `Sign-in credentials for ${params.studentName} (${params.rollNumber}) on ${institution}.`,
    bodyHtml,
    footerNote:
      "Please do not share your password with anyone. Instructors and administrators will never ask for your password.",
    brand: { ...params.brand, portalUrl: cleanPortalUrl },
  });

  return { subject, text, html };
}

// ============================================================================
// 2. COURSE COMPLETION CERTIFICATE EMAIL
// ============================================================================

export function buildCourseCertificateEmail(params: {
  studentName: string;
  courseTitle: string;
  courseCode: string;
  certificateNumber: string;
  combinedScorePct?: number | undefined;
  studentRoll?: string | undefined;
  regionName?: string | undefined;
  issueDate?: string | undefined;
  verifyUrl: string;
  portalUrl: string;
  /** Optional badge title from course design profile (used in subject & plaque). */
  badgeTitle?: string | undefined;
  brand?: EmailBrandContext | undefined;
}): RenderedEmailTemplate {
  const badge = (params.badgeTitle || "").trim() || "CERTIFICATE OF COURSE COMPLETION";
  const institution = params.brand?.institutionTitle?.trim() || "Onnesha Assessment Arena";
  const score =
    typeof params.combinedScorePct === "number"
      ? ` Combined score: ${params.combinedScorePct}%.`
      : "";
  const subject = `${badge} — ${params.courseCode || params.courseTitle}`;

  const text = [
    `Hi ${params.studentName},`,
    "",
    `Congratulations! Your official course completion certificate for ${params.courseTitle}${
      params.courseCode ? ` (${params.courseCode})` : ""
    } has been issued and cryptographically sealed.`,
    "",
    `Certificate Number: ${params.certificateNumber}`,
    params.studentRoll ? `Student Roll: ${params.studentRoll}` : "",
    params.regionName ? `Training Centre: ${params.regionName}` : "",
    typeof params.combinedScorePct === "number"
      ? `Combined Assessment Score: ${params.combinedScorePct}%`
      : "",
    params.issueDate ? `Issue Date: ${params.issueDate}` : "",
    "",
    `View, Download PDF & Verify: ${params.verifyUrl}`,
    `Student Portal: ${params.portalUrl}`,
    "",
    `— ${institution}`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  const verifyUrl = safeHref(params.verifyUrl);
  const portalUrl = safeHref(params.portalUrl);

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#0f172a;">
      Congratulations, <strong>${escapeEmailHtml(params.studentName)}</strong>!
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#334155;">
      Your official <strong>course completion credential</strong> has been issued, signed on the cryptographic verification ledger, and is ready to download as a print-ready PDF or share publicly.${
        score ? "" : ""
      }
    </p>

    <!-- Miniature Sovereign Heritage Certificate Plaque -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffdf7;border:2px solid #064e3b;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:4px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #d97706;border-radius:12px;background:#fffdf7;">
            <tr>
              <td style="padding:22px 22px 20px;text-align:center;">
                <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:#fef3c7;border:1px solid #f59e0b;font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#92400e;">
                  ${escapeEmailHtml(badge)}
                </div>

                <div style="margin-top:14px;font-size:11.5px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;">
                  Awarded To
                </div>
                <div style="margin-top:4px;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:700;color:#0f172a;line-height:1.25;">
                  ${escapeEmailHtml(params.studentName)}
                </div>
                ${
                  params.studentRoll || params.regionName
                    ? `<div style="margin-top:4px;font-size:12px;color:#475569;font-weight:600;">
                        ${escapeEmailHtml(
                          [params.studentRoll ? `Roll: ${params.studentRoll}` : "", params.regionName]
                            .filter(Boolean)
                            .join(" · "),
                        )}
                      </div>`
                    : ""
                }

                <div style="margin:14px auto;width:56px;height:2px;background:#d97706;border-radius:2px;"></div>

                <div style="font-size:14.5px;font-weight:800;color:#064e3b;line-height:1.4;">
                  ${escapeEmailHtml(params.courseTitle)}
                </div>
                ${
                  params.courseCode
                    ? `<div style="margin-top:5px;">
                        <span style="display:inline-block;padding:3px 9px;border-radius:6px;background:#ecfdf5;border:1px solid #a7f3d0;font-family:'SFMono-Regular',Consolas,monospace;font-size:11px;font-weight:800;color:#065f46;">
                          ${escapeEmailHtml(params.courseCode)}
                        </span>
                      </div>`
                    : ""
                }

                <!-- Credential Meta Grid -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;border-top:1px solid #e7e2d3;padding-top:14px;">
                  <tr>
                    <td style="text-align:left;padding:6px 4px;vertical-align:top;">
                      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;">Certificate ID</div>
                      <div style="margin-top:3px;font-family:'SFMono-Regular',Consolas,monospace;font-size:13px;font-weight:800;color:#0f172a;">
                        ${escapeEmailHtml(params.certificateNumber)}
                      </div>
                    </td>
                    ${
                      typeof params.combinedScorePct === "number"
                        ? `<td style="text-align:center;padding:6px 4px;vertical-align:top;">
                            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;">Combined Score</div>
                            <div style="margin-top:3px;font-family:'SFMono-Regular',Consolas,monospace;font-size:15px;font-weight:900;color:#047857;">
                              ${params.combinedScorePct}%
                            </div>
                          </td>`
                        : ""
                    }
                    ${
                      params.issueDate
                        ? `<td style="text-align:right;padding:6px 4px;vertical-align:top;">
                            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;">Issued</div>
                            <div style="margin-top:3px;font-family:'SFMono-Regular',Consolas,monospace;font-size:12.5px;font-weight:700;color:#334155;">
                              ${escapeEmailHtml(params.issueDate)}
                            </div>
                          </td>`
                        : ""
                    }
                  </tr>
                </table>

                <div style="margin-top:12px;padding:7px 12px;border-radius:8px;background:#f0fdf4;border:1px solid #bbf7d0;font-size:11px;font-weight:700;color:#166534;">
                  &#10003;&nbsp; Ed25519 Cryptographically Signed &amp; Publicly Verifiable
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="text-align:center;">
      ${renderPrimaryButton({
        href: verifyUrl,
        label: "Open & Download Certificate PDF →",
        tone: "heritage",
      })}
    </div>

    <p style="margin:12px 0 0;text-align:center;font-size:12.5px;color:#64748b;line-height:1.6;">
      Share your public verification link with employers or LinkedIn:<br />
      <a href="${escapeEmailHtml(verifyUrl)}" style="color:#065f46;font-family:'SFMono-Regular',Consolas,monospace;font-size:11.5px;word-break:break-all;">${escapeEmailHtml(
        verifyUrl,
      )}</a>
    </p>
  `;

  const html = renderBrandedEmailShell({
    tone: "heritage",
    categoryLabel: "Official Credential",
    headline: "Your Course Certificate Is Ready",
    subheadline: `${params.courseTitle}${params.courseCode ? ` · ${params.courseCode}` : ""}`,
    preheader: `Congratulations ${params.studentName}! Certificate ${params.certificateNumber} is ready to view and download.`,
    bodyHtml,
    footerNote:
      "This certificate can be independently verified anytime using its QR code or public verification link above.",
    brand: { ...params.brand, portalUrl },
  });

  return { subject, text, html };
}

// ============================================================================
// 3. QUIZ MERIT CERTIFICATE EMAIL
// ============================================================================

export function buildQuizCertificateEmail(params: {
  studentName: string;
  quizTitle: string;
  certificateNumber: string;
  scorePct?: number | undefined;
  rank?: number | undefined;
  totalParticipants?: number | undefined;
  studentRoll?: string | undefined;
  issueDate?: string | undefined;
  verifyUrl: string;
  portalUrl: string;
  badgeTitle?: string | undefined;
  brand?: EmailBrandContext | undefined;
}): RenderedEmailTemplate {
  const badge = (params.badgeTitle || "").trim() || "CERTIFICATE OF MERIT";
  const institution = params.brand?.institutionTitle?.trim() || "Onnesha Assessment Arena";
  const scoreLine =
    typeof params.scorePct === "number" ? ` Score: ${params.scorePct}%.` : "";
  const rankLine =
    typeof params.rank === "number" && typeof params.totalParticipants === "number"
      ? ` Merit Rank: #${params.rank} of ${params.totalParticipants}.`
      : "";
  const subject = `${badge} — ${params.quizTitle}`;

  const text = [
    `Hi ${params.studentName},`,
    "",
    `Well done! Your merit certificate for "${params.quizTitle}" is ready.`,
    `Certificate Number: ${params.certificateNumber}.${scoreLine}${rankLine}`,
    "",
    `View & Verify: ${params.verifyUrl}`,
    `Student Portal: ${params.portalUrl}`,
    "",
    `— ${institution}`,
  ].join("\n");

  const verifyUrl = safeHref(params.verifyUrl);
  const portalUrl = safeHref(params.portalUrl);

  const hasScore = typeof params.scorePct === "number";
  const hasRank =
    typeof params.rank === "number" && typeof params.totalParticipants === "number";

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#0f172a;">
      Well done, <strong>${escapeEmailHtml(params.studentName)}</strong>!
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#334155;">
      You passed <strong>“${escapeEmailHtml(params.quizTitle)}”</strong> and earned a verifiable merit certificate.
    </p>

    <!-- Merit Plaque -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1.5px solid #bfdbfe;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:20px 22px;">
          <div style="font-size:10.5px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#1d4ed8;">
            ${escapeEmailHtml(badge)}
          </div>
          <div style="margin-top:6px;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3;">
            ${escapeEmailHtml(params.quizTitle)}
          </div>
          ${
            params.studentRoll
              ? `<div style="margin-top:4px;font-size:12px;color:#64748b;font-family:'SFMono-Regular',Consolas,monospace;">Roll: ${escapeEmailHtml(
                  params.studentRoll,
                )}</div>`
              : ""
          }

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:16px;">
            <tr>
              <td style="background:#ffffff;border:1px solid #dbeafe;border-radius:10px;padding:12px 14px;vertical-align:top;">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;">Certificate ID</div>
                <div style="margin-top:4px;font-family:'SFMono-Regular',Consolas,monospace;font-size:13px;font-weight:800;color:#0f172a;">
                  ${escapeEmailHtml(params.certificateNumber)}
                </div>
              </td>
              ${
                hasScore
                  ? `<td width="10"></td>
              <td style="background:#ffffff;border:1px solid #dbeafe;border-radius:10px;padding:12px 14px;vertical-align:top;text-align:center;">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;">Accuracy</div>
                <div style="margin-top:4px;font-family:'SFMono-Regular',Consolas,monospace;font-size:16px;font-weight:900;color:#047857;">
                  ${params.scorePct}%
                </div>
              </td>`
                  : ""
              }
              ${
                hasRank
                  ? `<td width="10"></td>
              <td style="background:#ffffff;border:1px solid #dbeafe;border-radius:10px;padding:12px 14px;vertical-align:top;text-align:center;">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:700;">Merit Rank</div>
                <div style="margin-top:4px;font-family:'SFMono-Regular',Consolas,monospace;font-size:16px;font-weight:900;color:#1d4ed8;">
                  #${params.rank}<span style="font-size:11px;font-weight:700;color:#64748b;">/${params.totalParticipants}</span>
                </div>
              </td>`
                  : ""
              }
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="text-align:center;">
      ${renderPrimaryButton({
        href: verifyUrl,
        label: "Open & Verify Merit Certificate →",
        tone: "cobalt",
      })}
    </div>

    <p style="margin:10px 0 0;text-align:center;font-size:12px;color:#64748b;">
      Verification link: <a href="${escapeEmailHtml(verifyUrl)}" style="color:#1d4ed8;word-break:break-all;">${escapeEmailHtml(
        verifyUrl,
      )}</a>
    </p>
  `;

  const html = renderBrandedEmailShell({
    tone: "cobalt",
    categoryLabel: "Merit Award",
    headline: "Quiz Merit Certificate Issued",
    subheadline: params.quizTitle,
    preheader: `Merit certificate ${params.certificateNumber} for "${params.quizTitle}" is ready.`,
    bodyHtml,
    footerNote: "Keep this email for your records or download a PDF copy anytime from the verification link.",
    brand: { ...params.brand, portalUrl },
  });

  return { subject, text, html };
}

// ============================================================================
// 4. PORTAL ONE-TIME SIGN-IN CODE (OTP)
// ============================================================================

export function buildPortalOtpEmail(params: {
  code: string;
  studentName?: string | undefined;
  expiresMinutes?: number | undefined;
  brand?: EmailBrandContext | undefined;
}): RenderedEmailTemplate {
  const mins = params.expiresMinutes ?? 5;
  const institution = params.brand?.institutionTitle?.trim() || "Onnesha Assessment Arena";
  const subject = `${params.code} — Student Portal Verification Code`;
  const greeting = params.studentName ? `Hi ${params.studentName},` : "Hi there,";

  const text = [
    greeting,
    "",
    `Your ${institution} Student Portal verification code is: ${params.code}`,
    "",
    `This code expires in ${mins} minutes. Do not share it with anyone.`,
    "",
    `— ${institution}`,
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#0f172a;">
      ${
        params.studentName
          ? `Hi <strong>${escapeEmailHtml(params.studentName)}</strong>,`
          : "Hi there,"
      }
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#334155;">
      Enter the 6-digit verification code below to continue signing in to your Student Learning Portal.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0fdf9;border:1.5px solid #99f6e4;border-radius:16px;">
      <tr>
        <td style="padding:24px 18px;text-align:center;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#0f766e;margin-bottom:10px;">
            One-Time Verification Code
          </div>
          <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;font-weight:900;letter-spacing:0.18em;color:#042f2e;line-height:1.2;">
            ${formatSpacedOtp(params.code)}
          </div>
          <div style="margin-top:12px;">
            <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:#ffffff;border:1px solid #99f6e4;font-size:11.5px;font-weight:700;color:#0f766e;">
              Expires in ${mins} minutes · Single use
            </span>
          </div>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
      <tr>
        <td style="padding:12px 16px;font-size:12px;line-height:1.55;color:#475569;">
          <strong>Never share this code.</strong> Onnesha staff will never call or message you asking for a verification code.
        </td>
      </tr>
    </table>
  `;

  const html = renderBrandedEmailShell({
    tone: "emerald",
    categoryLabel: "Security Code",
    headline: "Your Portal Sign-In Code",
    subheadline: `Valid for the next ${mins} minutes.`,
    preheader: `Your verification code is ${params.code}. Valid for ${mins} minutes.`,
    bodyHtml,
    footerNote: "If you did not request this sign-in code, you can safely ignore this email.",
    brand: params.brand,
  });

  return { subject, text, html };
}

// ============================================================================
// 5. PASSWORD RESET VERIFICATION CODE
// ============================================================================

export function buildPasswordResetOtpEmail(params: {
  studentName: string;
  rollNumber?: string | undefined;
  code: string;
  expiresMinutes?: number | undefined;
  portalUrl?: string | undefined;
  brand?: EmailBrandContext | undefined;
}): RenderedEmailTemplate {
  const mins = params.expiresMinutes ?? 10;
  const institution = params.brand?.institutionTitle?.trim() || "Onnesha Assessment Arena";
  const subject = `${params.code} — Reset Your Student Portal Password`;

  const text = [
    `Hi ${params.studentName},`,
    "",
    `We received a request to reset the Student Portal password for your account${
      params.rollNumber ? ` (${params.rollNumber})` : ""
    }.`,
    "",
    `Your password reset code is: ${params.code}`,
    `Valid for ${mins} minutes.`,
    "",
    "Enter this code on the Student Portal screen along with your new password.",
    "",
    "If you did not request a password reset, you can safely ignore this email — your existing password will stay unchanged.",
    "",
    `— ${institution}`,
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#0f172a;">
      Hi <strong>${escapeEmailHtml(params.studentName)}</strong>${
        params.rollNumber
          ? ` <span style="display:inline-block;margin-left:4px;padding:2px 8px;border-radius:6px;background:#f1f5f9;font-family:'SFMono-Regular',Consolas,monospace;font-size:12px;font-weight:700;color:#334155;">${escapeEmailHtml(
              params.rollNumber,
            )}</span>`
          : ""
      },
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#334155;">
      Use the 6-digit security code below to verify your identity and set a new password for your Student Learning Portal account.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:16px;">
      <tr>
        <td style="padding:24px 18px;text-align:center;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#b45309;margin-bottom:10px;">
            Password Reset Code
          </div>
          <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;font-weight:900;letter-spacing:0.18em;color:#78350f;line-height:1.2;">
            ${formatSpacedOtp(params.code)}
          </div>
          <div style="margin-top:12px;">
            <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:#ffffff;border:1px solid #fcd34d;font-size:11.5px;font-weight:700;color:#92400e;">
              Valid for ${mins} minutes · Single use
            </span>
          </div>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
      <tr>
        <td style="padding:13px 16px;font-size:12.5px;line-height:1.6;color:#475569;">
          <strong>Didn’t request a reset?</strong> You don’t need to take any action — your current password remains secure and unchanged.
        </td>
      </tr>
    </table>
  `;

  const html = renderBrandedEmailShell({
    tone: "amber",
    categoryLabel: "Password Reset",
    headline: "Reset Your Portal Password",
    subheadline: "Enter this one-time code to choose a fresh password.",
    preheader: `Your password reset code is ${params.code}. Valid for ${mins} minutes.`,
    bodyHtml,
    footerNote: "For your protection, this reset code expires automatically and can only be used once.",
    brand: { ...params.brand, ...(params.portalUrl ? { portalUrl: params.portalUrl } : {}) },
  });

  return { subject, text, html };
}

// ============================================================================
// 6. PASSWORD UPDATED CONFIRMATION
// ============================================================================

export function buildPasswordChangedEmail(params: {
  studentName: string;
  rollNumber: string;
  email: string;
  changedAtIso?: string | undefined;
  portalUrl: string;
  brand?: EmailBrandContext | undefined;
}): RenderedEmailTemplate {
  const institution = params.brand?.institutionTitle?.trim() || "Onnesha Assessment Arena";
  const when = params.changedAtIso
    ? new Date(params.changedAtIso).toUTCString()
    : new Date().toUTCString();
  const subject = `Your Student Portal password was updated — ${params.rollNumber}`;

  const text = [
    `Hi ${params.studentName},`,
    "",
    `Your ${institution} Student Portal password for ${params.rollNumber} (${params.email}) was successfully updated.`,
    `Time: ${when}`,
    "",
    `Open Portal: ${params.portalUrl}`,
    "",
    "If you did not make this change, contact your training administrator immediately.",
    "",
    `— ${institution}`,
  ].join("\n");

  const portalUrl = safeHref(params.portalUrl);

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#0f172a;">
      Hi <strong>${escapeEmailHtml(params.studentName)}</strong>,
    </p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#334155;">
      This is a quick security confirmation that your <strong>Student Learning Portal</strong> password was successfully updated.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;">
      <tr>
        <td style="padding:16px 20px;font-size:13px;color:#14532d;line-height:1.65;">
          <div><strong>Account:</strong> <span style="font-family:'SFMono-Regular',Consolas,monospace;">${escapeEmailHtml(
            params.rollNumber,
          )}</span> · ${escapeEmailHtml(params.email)}</div>
          <div><strong>Updated:</strong> ${escapeEmailHtml(when)}</div>
        </td>
      </tr>
    </table>

    ${renderPrimaryButton({
      href: portalUrl,
      label: "Open Student Portal →",
      tone: "emerald",
    })}

    <p style="margin:12px 0 0;font-size:12px;line-height:1.55;color:#64748b;">
      If you did not authorize this password change, please reset your password immediately or contact your course administrator.
    </p>
  `;

  const html = renderBrandedEmailShell({
    tone: "emerald",
    categoryLabel: "Security Notice",
    headline: "Your Password Has Been Updated",
    subheadline: "Your Student Portal account is protected with your new password.",
    preheader: `Security notice: your Student Portal password for ${params.rollNumber} was updated.`,
    bodyHtml,
    footerNote: "You can sign in anytime using your Roll ID or email and your new password.",
    brand: { ...params.brand, portalUrl },
  });

  return { subject, text, html };
}

// ============================================================================
// SAMPLE RENDERER (FOR ADMIN EMAIL TEMPLATES STUDIO PREVIEW & TEST SEND)
// ============================================================================

export const EMAIL_TEMPLATE_CATALOG: Array<{
  id: EmailTemplateId;
  label: string;
  category: string;
  description: string;
}> = [
  {
    id: "student_credentials",
    label: "Portal Login Credentials",
    category: "Onboarding",
    description: "Sent from Admin Roster with Roll ID, email, temporary password, and direct sign-in link.",
  },
  {
    id: "course_certificate",
    label: "Course Completion Certificate",
    category: "Credentials",
    description: "Heritage diploma plaque email with combined score, Ed25519 seal, and PDF download button.",
  },
  {
    id: "quiz_certificate",
    label: "Quiz Merit Certificate",
    category: "Credentials",
    description: "Merit award email showing quiz accuracy, leaderboard rank, and verification link.",
  },
  {
    id: "password_reset_otp",
    label: "Password Reset Code",
    category: "Recovery",
    description: "10-minute 6-digit verification code sent when a student uses Forgot Password.",
  },
  {
    id: "portal_otp",
    label: "One-Time Sign-In OTP",
    category: "Auth",
    description: "5-minute 6-digit login code used when OTP sign-in mode is enabled.",
  },
  {
    id: "password_changed",
    label: "Password Updated Alert",
    category: "Security",
    description: "Confirmation notice sent when a student updates their portal password.",
  },
];

export function buildSampleEmailTemplate(
  templateId: EmailTemplateId,
  brand?: EmailBrandContext | undefined,
): RenderedEmailTemplate {
  const origin = (brand?.origin || "https://arena.onnesha.courses").replace(/\/+$/, "");
  const portalUrl = brand?.portalUrl || `${origin}/portal`;
  const today = new Date().toISOString().slice(0, 10);

  switch (templateId) {
    case "student_credentials":
      return buildStudentCredentialsEmail({
        studentName: "Md. Sifatul Islam Bhuiya",
        rollNumber: "GZP-01",
        username: "sifat.gzp01",
        email: "sifat.islam888@gmail.com",
        temporaryPassword: "ONN-7K4M-9P2R",
        regionName: "Gazipur Training Centre",
        batch: "Ansar VDP Digital Marketing Batch -04",
        courseTitle: "Applied AI & Autonomous Workflows for Digital Marketing Freelancers",
        portalUrl,
        mustChangePassword: true,
        brand,
      });
    case "course_certificate":
      return buildCourseCertificateEmail({
        studentName: "Md. Sifatul Islam Bhuiya",
        studentRoll: "GZP-01",
        regionName: "Gazipur Training Centre",
        courseTitle: "Applied AI & Autonomous Workflows for Digital Marketing Freelancers",
        courseCode: "SANJIBON-AI-DM-04",
        certificateNumber: "ONN-COURSE-GZP01-2026",
        combinedScorePct: 92,
        issueDate: today,
        verifyUrl: `${origin}/verify/ONN-COURSE-GZP01-2026`,
        portalUrl,
        badgeTitle: "CERTIFICATE OF COURSE COMPLETION",
        brand,
      });
    case "quiz_certificate":
      return buildQuizCertificateEmail({
        studentName: "Md. Sifatul Islam Bhuiya",
        studentRoll: "GZP-01",
        quizTitle: "Final Assessment — Applied AI & Autonomous Marketing",
        certificateNumber: "ONN-QUIZ-GZP01-2026",
        scorePct: 95,
        rank: 2,
        totalParticipants: 228,
        issueDate: today,
        verifyUrl: `${origin}/verify/ONN-QUIZ-GZP01-2026`,
        portalUrl,
        badgeTitle: "CERTIFICATE OF MERIT & EXCELLENCE",
        brand,
      });
    case "password_reset_otp":
      return buildPasswordResetOtpEmail({
        studentName: "Md. Sifatul Islam Bhuiya",
        rollNumber: "GZP-01",
        code: "482917",
        expiresMinutes: 10,
        portalUrl,
        brand,
      });
    case "portal_otp":
      return buildPortalOtpEmail({
        studentName: "Md. Sifatul Islam Bhuiya",
        code: "739204",
        expiresMinutes: 5,
        brand,
      });
    case "password_changed":
      return buildPasswordChangedEmail({
        studentName: "Md. Sifatul Islam Bhuiya",
        rollNumber: "GZP-01",
        email: "sifat.islam888@gmail.com",
        changedAtIso: new Date().toISOString(),
        portalUrl,
        brand,
      });
  }
}
