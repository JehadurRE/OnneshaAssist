import type {
  BrandingSettings,
  CertificateDesignProfile,
  CertificateKind,
  CertificatePartnerLogo,
  CertificateScoreDisplayMode,
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

export const ONNESHA_MAIN_LOGO_URL = "/assets/onnesha-mark.png";
export const ANSAR_VDP_LOGO_URL = "/assets/ansar.svg";
export const CCAI_LOGO_URL = "/assets/ccai.png";

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

export const DEFAULT_COURSE_CERTIFICATE_SIGNATORIES: CertificateSignatory[] = [
  {
    id: "sig-ccai-md",
    name: "Brigadier General Tamjidul Haque Chowdhury",
    title: "Managing Director • Cloud Connect AI Limited",
    signatureText: "Tamjidul Haque Chowdhury",
    signatureImageUrl: "/assets/sig-tamjidul-haque-chowdhury.png",
    signatureStyle: "script",
    signatureScale: 0.74,
  },
  {
    id: "sig-ansar-director",
    name: "Md Mainul Islam",
    title: "Director (Project-Training) • Bangladesh Ansar & VDP Headquarters",
    signatureText: "Md Mainul Islam",
    signatureImageUrl: "/assets/sig-md-mainul-islam.png",
    signatureStyle: "script",
    signatureScale: 1.48,
  },
  {
    id: "sig-lead-instructor",
    name: "Md. Jehad",
    title:
      "Lead Training Instructor | Certified Google AI Professional · ITEE FE (Level 2) Passer | Cloud Connect AI Limited",
    signatureText: "Md. Jehad",
    signatureImageUrl: "/assets/sig-md-jehad.svg",
    signatureStyle: "script",
    signatureScale: 0.88,
  },
];

const DEFAULT_QUIZ_CERTIFICATE_PROFILE: CertificateDesignProfile = {
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
  certScoreDisplayMode: "full_scores",
  certSignatories: DEFAULT_CERTIFICATE_SIGNATORIES.map((s) => ({ ...s })),
};

const DEFAULT_COURSE_CERTIFICATE_PROFILE: CertificateDesignProfile = {
  certThemePreset: "bangla_heritage",
  certShowBangladeshAiMap: true,
  certMapOpacity: 0.14,
  certBgPrimaryColor: "#fdfbf5",
  certBgSecondaryColor: "#fdf2ea",
  certAccentColor: "#991b1b",
  certBorderColor: "#7f1d1d",
  certCustomBgUrl: "",
  certCustomBgOpacity: 0.22,
  certBadgeTitle: "CERTIFICATE OF COURSE COMPLETION",
  certAuthoritySubtitle:
    "Final Examination Authority — Full Course Credential & Practical Assessment Board",
  certScoreDisplayMode: "merit_only",
  certSignatories: DEFAULT_COURSE_CERTIFICATE_SIGNATORIES.map((s) => ({ ...s })),
};

export const DEFAULT_BRANDING_SETTINGS: BrandingSettings = {
  showPartnerLogo: false,
  partnerName: "",
  partnerLogoUrl: "",
  institutionTitle: "Onnesha Assessment Arena",
  leftLogoUrl: ONNESHA_MAIN_LOGO_URL,
  leftLogoLabel: "",
  rightLogoUrl: ANSAR_VDP_LOGO_URL,
  rightLogoLabel: "Bangladesh Ansar & VDP",
  rightSecondaryLogoUrl: CCAI_LOGO_URL,
  rightSecondaryLogoLabel: "Cloud Connect AI Limited",
  partnerLogos: [],
  certThemePreset: DEFAULT_QUIZ_CERTIFICATE_PROFILE.certThemePreset,
  certShowBangladeshAiMap: DEFAULT_QUIZ_CERTIFICATE_PROFILE.certShowBangladeshAiMap,
  certMapOpacity: DEFAULT_QUIZ_CERTIFICATE_PROFILE.certMapOpacity,
  certBgPrimaryColor: DEFAULT_QUIZ_CERTIFICATE_PROFILE.certBgPrimaryColor,
  certBgSecondaryColor: DEFAULT_QUIZ_CERTIFICATE_PROFILE.certBgSecondaryColor,
  certAccentColor: DEFAULT_QUIZ_CERTIFICATE_PROFILE.certAccentColor,
  certBorderColor: DEFAULT_QUIZ_CERTIFICATE_PROFILE.certBorderColor,
  certCustomBgUrl: DEFAULT_QUIZ_CERTIFICATE_PROFILE.certCustomBgUrl,
  certCustomBgOpacity: DEFAULT_QUIZ_CERTIFICATE_PROFILE.certCustomBgOpacity,
  certBadgeTitle: DEFAULT_QUIZ_CERTIFICATE_PROFILE.certBadgeTitle,
  certAuthoritySubtitle: DEFAULT_QUIZ_CERTIFICATE_PROFILE.certAuthoritySubtitle,
  certScoreDisplayMode: DEFAULT_QUIZ_CERTIFICATE_PROFILE.certScoreDisplayMode,
  certSignatories: DEFAULT_CERTIFICATE_SIGNATORIES.map((s) => ({ ...s })),
  quizCertificate: { ...DEFAULT_QUIZ_CERTIFICATE_PROFILE },
  courseCertificate: { ...DEFAULT_COURSE_CERTIFICATE_PROFILE },
  defaultEnforceFullscreen: false,
  defaultBlockCopyPaste: true,
  defaultMaxProctorViolations: 3,
  defaultPassThresholdPct: 50,
  portalAuthMode: "password",
  portalAuthChannel: "email",
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
    ...(sig?.signatureScale !== undefined
      ? { signatureScale: clampNumber(sig.signatureScale, 0.5, 1.8, 1) }
      : {}),
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

function sanitizeThemePreset(
  value: CertificateThemePreset | undefined,
  fallback: CertificateThemePreset,
): CertificateThemePreset {
  if (value && value in CERTIFICATE_THEME_PRESETS) return value;
  return fallback;
}

function sanitizeScoreDisplayMode(
  value: CertificateScoreDisplayMode | undefined,
  fallback: CertificateScoreDisplayMode,
): CertificateScoreDisplayMode {
  if (
    value === "merit_only" ||
    value === "pure_percentage" ||
    value === "percentage_only" ||
    value === "full_scores" ||
    value === "none"
  ) {
    return value;
  }
  return fallback;
}

/**
 * Sanitizes one certificate design profile against a fallback baseline.
 */
export function mergeCertificateDesignProfile(
  incoming?: Partial<CertificateDesignProfile> | null,
  current?: Partial<CertificateDesignProfile> | null,
  fallback: CertificateDesignProfile = DEFAULT_QUIZ_CERTIFICATE_PROFILE,
): CertificateDesignProfile {
  const base: CertificateDesignProfile = { ...fallback, ...(current ?? {}) };
  const next = incoming ?? {};
  const fallbackSignatories =
    Array.isArray(base.certSignatories) && base.certSignatories.length > 0
      ? base.certSignatories
      : fallback.certSignatories || DEFAULT_CERTIFICATE_SIGNATORIES;

  const authoritySubtitle =
    (next.certAuthoritySubtitle ?? base.certAuthoritySubtitle ?? "").trim() ||
    fallback.certAuthoritySubtitle ||
    DEFAULT_QUIZ_CERTIFICATE_PROFILE.certAuthoritySubtitle ||
    "";

  return {
    certThemePreset: sanitizeThemePreset(
      next.certThemePreset ?? base.certThemePreset,
      fallback.certThemePreset || "emerald_gold",
    ),
    certShowBangladeshAiMap:
      next.certShowBangladeshAiMap !== undefined
        ? !!next.certShowBangladeshAiMap
        : (base.certShowBangladeshAiMap ?? fallback.certShowBangladeshAiMap ?? true),
    certMapOpacity: clampNumber(
      next.certMapOpacity ?? base.certMapOpacity,
      0.04,
      0.45,
      fallback.certMapOpacity ?? 0.14,
    ),
    certBgPrimaryColor: sanitizeHexColor(
      next.certBgPrimaryColor ?? base.certBgPrimaryColor,
      fallback.certBgPrimaryColor ?? "#fffdf8",
    ),
    certBgSecondaryColor: sanitizeHexColor(
      next.certBgSecondaryColor ?? base.certBgSecondaryColor,
      fallback.certBgSecondaryColor ?? "#eefaf4",
    ),
    certAccentColor: sanitizeHexColor(
      next.certAccentColor ?? base.certAccentColor,
      fallback.certAccentColor ?? "#047857",
    ),
    certBorderColor: sanitizeHexColor(
      next.certBorderColor ?? base.certBorderColor,
      fallback.certBorderColor ?? "#064e3b",
    ),
    certCustomBgUrl: (next.certCustomBgUrl ?? base.certCustomBgUrl ?? "").trim(),
    certCustomBgOpacity: clampNumber(
      next.certCustomBgOpacity ?? base.certCustomBgOpacity,
      0.05,
      0.85,
      fallback.certCustomBgOpacity ?? 0.22,
    ),
    certBadgeTitle:
      (next.certBadgeTitle ?? base.certBadgeTitle ?? "").trim() ||
      fallback.certBadgeTitle ||
      "CERTIFICATE OF MERIT & EXCELLENCE",
    certAuthoritySubtitle: authoritySubtitle,
    certScoreDisplayMode: sanitizeScoreDisplayMode(
      next.certScoreDisplayMode ?? base.certScoreDisplayMode,
      fallback.certScoreDisplayMode || "full_scores",
    ),
    certSignatories: sanitizeSignatories(
      next.certSignatories !== undefined ? next.certSignatories : base.certSignatories,
      fallbackSignatories,
    ),
  };
}

function legacyProfileFromBranding(
  branding: Partial<BrandingSettings> | null | undefined,
): Partial<CertificateDesignProfile> {
  if (!branding) return {};
  const out: Partial<CertificateDesignProfile> = {};
  if (branding.certThemePreset !== undefined) out.certThemePreset = branding.certThemePreset;
  if (branding.certShowBangladeshAiMap !== undefined) {
    out.certShowBangladeshAiMap = branding.certShowBangladeshAiMap;
  }
  if (branding.certMapOpacity !== undefined) out.certMapOpacity = branding.certMapOpacity;
  if (branding.certBgPrimaryColor !== undefined) {
    out.certBgPrimaryColor = branding.certBgPrimaryColor;
  }
  if (branding.certBgSecondaryColor !== undefined) {
    out.certBgSecondaryColor = branding.certBgSecondaryColor;
  }
  if (branding.certAccentColor !== undefined) out.certAccentColor = branding.certAccentColor;
  if (branding.certBorderColor !== undefined) out.certBorderColor = branding.certBorderColor;
  if (branding.certCustomBgUrl !== undefined) out.certCustomBgUrl = branding.certCustomBgUrl;
  if (branding.certCustomBgOpacity !== undefined) {
    out.certCustomBgOpacity = branding.certCustomBgOpacity;
  }
  if (branding.certBadgeTitle !== undefined) out.certBadgeTitle = branding.certBadgeTitle;
  if (branding.certAuthoritySubtitle !== undefined) {
    out.certAuthoritySubtitle = branding.certAuthoritySubtitle;
  }
  if (branding.certScoreDisplayMode !== undefined) {
    out.certScoreDisplayMode = branding.certScoreDisplayMode;
  }
  if (branding.certSignatories !== undefined) out.certSignatories = branding.certSignatories;
  return out;
}

function applyProfileToBrandingTopLevel(
  branding: BrandingSettings,
  profile: CertificateDesignProfile,
): BrandingSettings {
  return {
    ...branding,
    certThemePreset: profile.certThemePreset,
    certShowBangladeshAiMap: profile.certShowBangladeshAiMap,
    certMapOpacity: profile.certMapOpacity,
    certBgPrimaryColor: profile.certBgPrimaryColor,
    certBgSecondaryColor: profile.certBgSecondaryColor,
    certAccentColor: profile.certAccentColor,
    certBorderColor: profile.certBorderColor,
    certCustomBgUrl: profile.certCustomBgUrl,
    certCustomBgOpacity: profile.certCustomBgOpacity,
    certBadgeTitle: profile.certBadgeTitle,
    certAuthoritySubtitle: profile.certAuthoritySubtitle,
    certScoreDisplayMode: profile.certScoreDisplayMode,
    certSignatories: profile.certSignatories?.map((s) => ({ ...s })),
  };
}

/**
 * Resolves the design profile for a certificate kind.
 * Quiz uses `quizCertificate`, falling back to legacy top-level cert* fields.
 * Course uses `courseCertificate` with course-specific defaults.
 */
export function getCertificateDesignProfile(
  branding: BrandingSettings | undefined,
  kind: CertificateKind,
): CertificateDesignProfile {
  if (kind === "course_completion") {
    return mergeCertificateDesignProfile(
      branding?.courseCertificate,
      undefined,
      DEFAULT_COURSE_CERTIFICATE_PROFILE,
    );
  }
  // quiz_session (and any unknown): prefer quizCertificate, else legacy top-level
  const hasQuizProfile =
    branding?.quizCertificate && Object.keys(branding.quizCertificate).length > 0;
  if (hasQuizProfile) {
    return mergeCertificateDesignProfile(
      branding?.quizCertificate,
      legacyProfileFromBranding(branding),
      DEFAULT_QUIZ_CERTIFICATE_PROFILE,
    );
  }
  return mergeCertificateDesignProfile(
    legacyProfileFromBranding(branding),
    undefined,
    DEFAULT_QUIZ_CERTIFICATE_PROFILE,
  );
}

/**
 * Overlays the matching certificate design profile onto branding top-level cert*
 * fields so resolveCertificateTheme / PDF renderers see the right palette.
 */
export function brandingWithCertificateProfile(
  branding: BrandingSettings,
  kind: CertificateKind,
): BrandingSettings {
  const profile = getCertificateDesignProfile(branding, kind);
  return applyProfileToBrandingTopLevel(branding, profile);
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

  const quizCertificate = mergeCertificateDesignProfile(
    next.quizCertificate !== undefined
      ? next.quizCertificate
      : // When only legacy fields are patched, fold them into the quiz profile
        next.certThemePreset !== undefined ||
          next.certBadgeTitle !== undefined ||
          next.certSignatories !== undefined ||
          next.certShowBangladeshAiMap !== undefined ||
          next.certMapOpacity !== undefined ||
          next.certBgPrimaryColor !== undefined ||
          next.certBgSecondaryColor !== undefined ||
          next.certAccentColor !== undefined ||
          next.certBorderColor !== undefined ||
          next.certCustomBgUrl !== undefined ||
          next.certCustomBgOpacity !== undefined ||
          next.certAuthoritySubtitle !== undefined ||
          next.certScoreDisplayMode !== undefined
        ? legacyProfileFromBranding(next)
        : undefined,
    base.quizCertificate ?? legacyProfileFromBranding(base),
    DEFAULT_QUIZ_CERTIFICATE_PROFILE,
  );

  const courseCertificate = mergeCertificateDesignProfile(
    next.courseCertificate,
    base.courseCertificate,
    DEFAULT_COURSE_CERTIFICATE_PROFILE,
  );

  // Keep legacy top-level in sync with the quiz profile (quiz is the default surface).
  const legacyFromQuiz = applyProfileToBrandingTopLevel(
    {
      ...base,
      showPartnerLogo:
        next.showPartnerLogo !== undefined ? !!next.showPartnerLogo : !!base.showPartnerLogo,
      partnerName: (next.partnerName ?? base.partnerName ?? "").trim(),
      partnerLogoUrl: (next.partnerLogoUrl ?? base.partnerLogoUrl ?? "").trim(),
    },
    quizCertificate,
  );

  return {
    showPartnerLogo: legacyFromQuiz.showPartnerLogo,
    partnerName: legacyFromQuiz.partnerName,
    partnerLogoUrl: legacyFromQuiz.partnerLogoUrl,
    institutionTitle:
      (next.institutionTitle ?? base.institutionTitle ?? "").trim() ||
      DEFAULT_BRANDING_SETTINGS.institutionTitle,
    leftLogoUrl: (next.leftLogoUrl ?? base.leftLogoUrl ?? "").trim(),
    leftLogoLabel: (next.leftLogoLabel ?? base.leftLogoLabel ?? "").trim(),
    rightLogoUrl: (next.rightLogoUrl ?? base.rightLogoUrl ?? "").trim(),
    rightLogoLabel: (next.rightLogoLabel ?? base.rightLogoLabel ?? "").trim(),
    rightSecondaryLogoUrl: (next.rightSecondaryLogoUrl ?? base.rightSecondaryLogoUrl ?? "").trim(),
    rightSecondaryLogoLabel: (
      next.rightSecondaryLogoLabel ??
      base.rightSecondaryLogoLabel ??
      ""
    ).trim(),
    partnerLogos: sanitizePartnerLogos(
      next.partnerLogos !== undefined ? next.partnerLogos : base.partnerLogos,
    ),
    certThemePreset: quizCertificate.certThemePreset ?? certThemePreset,
    certShowBangladeshAiMap: quizCertificate.certShowBangladeshAiMap,
    certMapOpacity: quizCertificate.certMapOpacity,
    certBgPrimaryColor: quizCertificate.certBgPrimaryColor,
    certBgSecondaryColor: quizCertificate.certBgSecondaryColor,
    certAccentColor: quizCertificate.certAccentColor,
    certBorderColor: quizCertificate.certBorderColor,
    certCustomBgUrl: quizCertificate.certCustomBgUrl,
    certCustomBgOpacity: quizCertificate.certCustomBgOpacity,
    certBadgeTitle: quizCertificate.certBadgeTitle,
    certAuthoritySubtitle: quizCertificate.certAuthoritySubtitle,
    certScoreDisplayMode: quizCertificate.certScoreDisplayMode,
    certSignatories: sanitizeSignatories(
      quizCertificate.certSignatories !== undefined
        ? quizCertificate.certSignatories
        : next.certSignatories !== undefined
          ? next.certSignatories
          : base.certSignatories,
      fallbackSignatories,
    ),
    quizCertificate,
    courseCertificate,
    defaultEnforceFullscreen:
      next.defaultEnforceFullscreen ?? base.defaultEnforceFullscreen ?? false,
    defaultBlockCopyPaste: next.defaultBlockCopyPaste ?? base.defaultBlockCopyPaste ?? true,
    defaultMaxProctorViolations: clampNumber(
      next.defaultMaxProctorViolations ?? base.defaultMaxProctorViolations,
      1,
      10,
      3,
    ),
    defaultPassThresholdPct: clampNumber(
      next.defaultPassThresholdPct ?? base.defaultPassThresholdPct,
      0,
      100,
      50,
    ),
    portalAuthMode:
      (next.portalAuthMode ?? base.portalAuthMode) === "otp_only"
        ? "otp_only"
        : (next.portalAuthMode ?? base.portalAuthMode) === "password_or_otp"
          ? "password_or_otp"
          : "password",
    portalAuthChannel:
      (next.portalAuthChannel ?? base.portalAuthChannel) === "mobile" ? "mobile" : "email",
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
 * When `kind` is provided, the matching quiz/course design profile is overlaid first.
 */
export function resolveCertificateTheme(
  branding?: BrandingSettings,
  kind?: CertificateKind,
): CertificateThemePalette {
  const effective =
    branding && kind ? brandingWithCertificateProfile(branding, kind) : branding;
  const presetKey = effective?.certThemePreset || "emerald_gold";
  const base = CERTIFICATE_THEME_PRESETS[presetKey] || CERTIFICATE_THEME_PRESETS.emerald_gold;
  if (presetKey !== "custom") {
    return base;
  }

  const bgPrimary = sanitizeHexColor(effective?.certBgPrimaryColor, base.bgPrimary);
  const bgSecondary = sanitizeHexColor(effective?.certBgSecondaryColor, base.bgSecondary);
  const borderOuter = sanitizeHexColor(effective?.certBorderColor, base.borderOuter);
  const accentColor = sanitizeHexColor(effective?.certAccentColor, base.accentColor);
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
