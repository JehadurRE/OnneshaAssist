import type {
  BrandingSettings,
  CertificatePartnerLogo,
  CertificateSignatory,
  CertificateThemePreset,
} from "./types";

export interface CertificateThemePalette {
  id: CertificateThemePreset;
  name: string;
  tagline: string;
  isDark: boolean;
  bgPrimary: string;
  bgSecondary: string;
  borderOuter: string;
  borderInner: string;
  accentColor: string;
  mapColor: string;
  nodeColor: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  cardBg: string;
  cardBorder: string;
  dockBg: string;
  dockBorder: string;
}

export const CERTIFICATE_THEME_PRESETS: Record<CertificateThemePreset, CertificateThemePalette> = {
  emerald_gold: {
    id: "emerald_gold",
    name: "Sovereign Emerald & Gold",
    tagline: "Classic parchment ivory with institutional forest emerald & antique gold filigree",
    isDark: false,
    bgPrimary: "#fffdf7",
    bgSecondary: "#eefaf4",
    borderOuter: "#064e3b",
    borderInner: "#d97706",
    accentColor: "#047857",
    mapColor: "#059669",
    nodeColor: "#d97706",
    textPrimary: "#0f172a",
    textSecondary: "#334155",
    textMuted: "#64748b",
    pillBg: "#fef3c7",
    pillBorder: "#f59e0b",
    pillText: "#92400e",
    cardBg: "rgba(255, 255, 255, 0.88)",
    cardBorder: "#cbd5e1",
    dockBg: "rgba(248, 250, 252, 0.92)",
    dockBorder: "#cbd5e1",
  },
  dhaka_ai_navy: {
    id: "dhaka_ai_navy",
    name: "Dhaka Midnight AI",
    tagline: "Modern architectural midnight navy with luminous gold borders & cyan neural pathways",
    isDark: true,
    bgPrimary: "#081124",
    bgSecondary: "#0e2240",
    borderOuter: "#eab308",
    borderInner: "#38bdf8",
    accentColor: "#fbbf24",
    mapColor: "#38bdf8",
    nodeColor: "#34d399",
    textPrimary: "#f8fafc",
    textSecondary: "#cbd5e1",
    textMuted: "#94a3b8",
    pillBg: "rgba(234, 179, 8, 0.14)",
    pillBorder: "#eab308",
    pillText: "#fde047",
    cardBg: "rgba(15, 29, 58, 0.82)",
    cardBorder: "rgba(56, 189, 248, 0.35)",
    dockBg: "rgba(9, 19, 40, 0.88)",
    dockBorder: "rgba(234, 179, 8, 0.35)",
  },
  bangla_heritage: {
    id: "bangla_heritage",
    name: "Bengal Heritage Crimson",
    tagline: "Hand-pressed heritage cream accented in Bengal crimson, emerald & brushed brass",
    isDark: false,
    bgPrimary: "#fdfbf5",
    bgSecondary: "#fdf2ea",
    borderOuter: "#7f1d1d",
    borderInner: "#065f46",
    accentColor: "#991b1b",
    mapColor: "#065f46",
    nodeColor: "#b91c1c",
    textPrimary: "#1c1917",
    textSecondary: "#44403c",
    textMuted: "#78716c",
    pillBg: "#fef2f2",
    pillBorder: "#dc2626",
    pillText: "#991b1b",
    cardBg: "rgba(255, 252, 247, 0.90)",
    cardBorder: "#e7e5e4",
    dockBg: "rgba(250, 245, 240, 0.92)",
    dockBorder: "#d6d3d1",
  },
  sovereign_slate: {
    id: "sovereign_slate",
    name: "Executive Swiss Platinum",
    tagline: "Architectural crisp white gallery stock with obsidian framing & cobalt AI nodes",
    isDark: false,
    bgPrimary: "#ffffff",
    bgSecondary: "#eef2f9",
    borderOuter: "#0f172a",
    borderInner: "#2563eb",
    accentColor: "#1d4ed8",
    mapColor: "#1e40af",
    nodeColor: "#0284c7",
    textPrimary: "#0f172a",
    textSecondary: "#334155",
    textMuted: "#64748b",
    pillBg: "#eff6ff",
    pillBorder: "#3b82f6",
    pillText: "#1e3a8a",
    cardBg: "rgba(248, 250, 252, 0.92)",
    cardBorder: "#cbd5e1",
    dockBg: "rgba(241, 245, 249, 0.94)",
    dockBorder: "#cbd5e1",
  },
  custom: {
    id: "custom",
    name: "Custom Studio Palette",
    tagline: "Fully bespoke gradient colors, borders, AI watermark & custom background image",
    isDark: false,
    bgPrimary: "#fffdf8",
    bgSecondary: "#f0fdf4",
    borderOuter: "#065f46",
    borderInner: "#d97706",
    accentColor: "#047857",
    mapColor: "#059669",
    nodeColor: "#d97706",
    textPrimary: "#0f172a",
    textSecondary: "#334155",
    textMuted: "#64748b",
    pillBg: "#fef3c7",
    pillBorder: "#d97706",
    pillText: "#92400e",
    cardBg: "rgba(255, 255, 255, 0.88)",
    cardBorder: "#cbd5e1",
    dockBg: "rgba(248, 250, 252, 0.90)",
    dockBorder: "#cbd5e1",
  },
};

export const DEFAULT_CERTIFICATE_SIGNATORIES: CertificateSignatory[] = [
  {
    id: "sig-examiner",
    name: "{{instructor}}",
    title: "Examining Authority • সনদ প্রত্যয়নকারী",
    signatureText: "",
    signatureImageUrl: "",
    signatureStyle: "script",
  },
  {
    id: "sig-controller",
    name: "Controller of Examinations",
    title: "Onnesha Central Assessment Board",
    signatureText: "Controller of Examinations",
    signatureImageUrl: "",
    signatureStyle: "formal",
  },
];

export const DEFAULT_BRANDING_SETTINGS: BrandingSettings = {
  showPartnerLogo: false,
  partnerName: "",
  partnerLogoUrl: "",
  institutionTitle: "Onnesha Assessment Arena",
  leftLogoUrl: "",
  leftLogoLabel: "",
  rightLogoUrl: "",
  rightLogoLabel: "",
  partnerLogos: [],
  certThemePreset: "emerald_gold",
  certShowBangladeshAiMap: true,
  certMapOpacity: 0.14,
  certBgPrimaryColor: "#fffdf8",
  certBgSecondaryColor: "#eefaf4",
  certAccentColor: "#047857",
  certBorderColor: "#064e3b",
  certCustomBgUrl: "",
  certCustomBgOpacity: 0.22,
  certBadgeTitle: "CERTIFICATE OF MERIT & EXCELLENCE",
  certAuthoritySubtitle:
    "National Training, Merit Evaluation & Cryptographic Examination Authority",
  certSignatories: DEFAULT_CERTIFICATE_SIGNATORIES.map((s) => ({ ...s })),
  defaultEnforceFullscreen: false,
  defaultBlockCopyPaste: true,
  defaultMaxProctorViolations: 3,
};

function sanitizePartnerLogos(raw: CertificatePartnerLogo[] | undefined): CertificatePartnerLogo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 6)
    .map((item, idx) => ({
      id: (item?.id || `partner-${idx + 1}`).trim(),
      name: (item?.name || "").trim(),
      logoUrl: (item?.logoUrl || "").trim(),
    }))
    .filter((item) => item.name.length > 0 || item.logoUrl.length > 0);
}

function sanitizeSignatories(
  raw: CertificateSignatory[] | undefined,
  fallback: CertificateSignatory[],
): CertificateSignatory[] {
  if (!Array.isArray(raw)) {
    return fallback.map((s) => ({ ...s }));
  }
  const cleaned = raw.slice(0, 4).map((sig, idx) => ({
    id: (sig?.id || `sig-${idx + 1}`).trim(),
    name: (sig?.name || "").trim() || `Signatory ${idx + 1}`,
    title: (sig?.title || "").trim() || "Authorized Official",
    signatureText: (sig?.signatureText || "").trim(),
    signatureImageUrl: (sig?.signatureImageUrl || "").trim(),
    signatureStyle:
      sig?.signatureStyle === "formal" || sig?.signatureStyle === "mono"
        ? sig.signatureStyle
        : ("script" as const),
  }));
  return cleaned.length > 0 ? cleaned : fallback.map((s) => ({ ...s }));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizeHexColor(value: string | undefined, fallback: string): string {
  const trimmed = (value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

/**
 * Merges partial branding settings onto an existing baseline while enforcing
 * safe bounds for themes, Bangladesh AI watermark opacity, logos, and signatories.
 */
export function mergeBrandingSettings(
  incoming?: Partial<BrandingSettings> | null,
  current?: Partial<BrandingSettings> | null,
): BrandingSettings {
  const base: BrandingSettings = {
    ...DEFAULT_BRANDING_SETTINGS,
    ...(current ?? {}),
  };
  const next = incoming ?? {};
  const presetCandidate = next.certThemePreset ?? base.certThemePreset ?? "emerald_gold";
  const certThemePreset: CertificateThemePreset =
    presetCandidate in CERTIFICATE_THEME_PRESETS ? presetCandidate : "emerald_gold";

  const fallbackSignatories =
    Array.isArray(base.certSignatories) && base.certSignatories.length > 0
      ? base.certSignatories
      : DEFAULT_CERTIFICATE_SIGNATORIES;

  return {
    showPartnerLogo:
      next.showPartnerLogo !== undefined ? !!next.showPartnerLogo : !!base.showPartnerLogo,
    partnerName: (next.partnerName ?? base.partnerName ?? "").trim(),
    partnerLogoUrl: (next.partnerLogoUrl ?? base.partnerLogoUrl ?? "").trim(),
    institutionTitle:
      (next.institutionTitle ?? base.institutionTitle ?? "").trim() ||
      DEFAULT_BRANDING_SETTINGS.institutionTitle,
    leftLogoUrl: (next.leftLogoUrl ?? base.leftLogoUrl ?? "").trim(),
    leftLogoLabel: (next.leftLogoLabel ?? base.leftLogoLabel ?? "").trim(),
    rightLogoUrl: (next.rightLogoUrl ?? base.rightLogoUrl ?? "").trim(),
    rightLogoLabel: (next.rightLogoLabel ?? base.rightLogoLabel ?? "").trim(),
    partnerLogos: sanitizePartnerLogos(
      next.partnerLogos !== undefined ? next.partnerLogos : base.partnerLogos,
    ),
    certThemePreset,
    certShowBangladeshAiMap:
      next.certShowBangladeshAiMap !== undefined
        ? !!next.certShowBangladeshAiMap
        : (base.certShowBangladeshAiMap ?? true),
    certMapOpacity: clampNumber(
      next.certMapOpacity ?? base.certMapOpacity,
      0.04,
      0.45,
      DEFAULT_BRANDING_SETTINGS.certMapOpacity ?? 0.14,
    ),
    certBgPrimaryColor: sanitizeHexColor(
      next.certBgPrimaryColor ?? base.certBgPrimaryColor,
      DEFAULT_BRANDING_SETTINGS.certBgPrimaryColor ?? "#fffdf8",
    ),
    certBgSecondaryColor: sanitizeHexColor(
      next.certBgSecondaryColor ?? base.certBgSecondaryColor,
      DEFAULT_BRANDING_SETTINGS.certBgSecondaryColor ?? "#eefaf4",
    ),
    certAccentColor: sanitizeHexColor(
      next.certAccentColor ?? base.certAccentColor,
      DEFAULT_BRANDING_SETTINGS.certAccentColor ?? "#047857",
    ),
    certBorderColor: sanitizeHexColor(
      next.certBorderColor ?? base.certBorderColor,
      DEFAULT_BRANDING_SETTINGS.certBorderColor ?? "#064e3b",
    ),
    certCustomBgUrl: (next.certCustomBgUrl ?? base.certCustomBgUrl ?? "").trim(),
    certCustomBgOpacity: clampNumber(
      next.certCustomBgOpacity ?? base.certCustomBgOpacity,
      0.05,
      0.85,
      DEFAULT_BRANDING_SETTINGS.certCustomBgOpacity ?? 0.22,
    ),
    certBadgeTitle:
      (next.certBadgeTitle ?? base.certBadgeTitle ?? "").trim() ||
      DEFAULT_BRANDING_SETTINGS.certBadgeTitle,
    certAuthoritySubtitle:
      (next.certAuthoritySubtitle ?? base.certAuthoritySubtitle ?? "").trim() ||
      DEFAULT_BRANDING_SETTINGS.certAuthoritySubtitle,
    certSignatories: sanitizeSignatories(
      next.certSignatories !== undefined ? next.certSignatories : base.certSignatories,
      fallbackSignatories,
    ),
    defaultEnforceFullscreen:
      next.defaultEnforceFullscreen ?? base.defaultEnforceFullscreen ?? false,
    defaultBlockCopyPaste: next.defaultBlockCopyPaste ?? base.defaultBlockCopyPaste ?? true,
    defaultMaxProctorViolations: clampNumber(
      next.defaultMaxProctorViolations ?? base.defaultMaxProctorViolations,
      1,
      10,
      3,
    ),
    updatedAt: next.updatedAt ?? base.updatedAt,
  };
}

/**
 * Returns relative luminance in [0..1] for a 6-digit hex color so custom themes
 * can choose legible ink contrast automatically.
 */
export function isDarkHexColor(hex: string): boolean {
  const match = /^#([0-9a-fA-F]{6})$/.exec((hex || "").trim());
  if (!match || !match[1]) return false;
  const intVal = parseInt(match[1], 16);
  const r = (intVal >> 16) & 255;
  const g = (intVal >> 8) & 255;
  const b = intVal & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

/**
 * Resolves effective visual palette for a BrandingSettings instance, applying
 * user overrides when `certThemePreset === "custom"`.
 */
export function resolveCertificateTheme(branding?: BrandingSettings): CertificateThemePalette {
  const presetKey = branding?.certThemePreset || "emerald_gold";
  const base = CERTIFICATE_THEME_PRESETS[presetKey] || CERTIFICATE_THEME_PRESETS.emerald_gold;
  if (presetKey !== "custom") {
    return base;
  }

  const bgPrimary = sanitizeHexColor(branding?.certBgPrimaryColor, base.bgPrimary);
  const bgSecondary = sanitizeHexColor(branding?.certBgSecondaryColor, base.bgSecondary);
  const borderOuter = sanitizeHexColor(branding?.certBorderColor, base.borderOuter);
  const accentColor = sanitizeHexColor(branding?.certAccentColor, base.accentColor);
  const isDark = isDarkHexColor(bgPrimary);

  return {
    ...base,
    isDark,
    bgPrimary,
    bgSecondary,
    borderOuter,
    borderInner: accentColor,
    accentColor,
    mapColor: accentColor,
    nodeColor: isDark ? "#38bdf8" : borderOuter,
    textPrimary: isDark ? "#f8fafc" : "#0f172a",
    textSecondary: isDark ? "#cbd5e1" : "#334155",
    textMuted: isDark ? "#94a3b8" : "#64748b",
    pillBg: isDark ? "rgba(255, 255, 255, 0.08)" : "#fef3c7",
    pillBorder: accentColor,
    pillText: isDark ? "#fde047" : borderOuter,
    cardBg: isDark ? "rgba(15, 23, 42, 0.78)" : "rgba(255, 255, 255, 0.88)",
    cardBorder: isDark ? "rgba(255, 255, 255, 0.22)" : "#cbd5e1",
    dockBg: isDark ? "rgba(15, 23, 42, 0.86)" : "rgba(248, 250, 252, 0.92)",
    dockBorder: isDark ? "rgba(255, 255, 255, 0.24)" : "#cbd5e1",
  };
}
