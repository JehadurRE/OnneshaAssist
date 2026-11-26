import React, { useEffect, useRef, useState } from "react";
import {
  ANSAR_VDP_LOGO_URL,
  brandingWithCertificateProfile,
  CCAI_LOGO_URL,
  CERTIFICATE_THEME_PRESETS,
  DEFAULT_BRANDING_SETTINGS,
  DEFAULT_CERTIFICATE_SIGNATORIES,
  DEFAULT_COURSE_CERTIFICATE_SIGNATORIES,
  getCertificateDesignProfile,
  ONNESHA_MAIN_LOGO_URL,
} from "@/lib/branding";
import { downloadCertificatePdf, populateCertificateCanvas } from "@/lib/pdf-generator";
import { SANJIBON_COURSE } from "@/lib/sanjibon-seed-data";
import type {
  BrandingSettings,
  CertificateData,
  CertificateDesignProfile,
  CertificateKind,
  CertificatePartnerLogo,
  CertificateScoreDisplayMode,
  CertificateSignatory,
  CertificateThemePreset,
  Course,
} from "@/lib/types";
import {
  Award,
  Download,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  Map as MapIcon,
  Palette,
  PenTool,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

export type DesignerCertProfile = "quiz" | "course";
export type DesignerStudioTab = "theme" | "logos" | "signatories";

interface CertificateDesignerStudioProps {
  branding: BrandingSettings;
  onChange: (next: BrandingSettings) => void;
  onSave: () => void;
  designProfile?: DesignerCertProfile | undefined;
  onDesignProfileChange?: ((next: DesignerCertProfile) => void) | undefined;
  studioTab?: DesignerStudioTab | undefined;
  onStudioTabChange?: ((next: DesignerStudioTab) => void) | undefined;
  previewCourse?: Course | undefined;
}

function profileToKind(profile: DesignerCertProfile): CertificateKind {
  return profile === "course" ? "course_completion" : "quiz_session";
}

const PREVIEW_SAMPLE_QUIZ: CertificateData = {
  id: "preview-sample-cert",
  certificateNumber: "ONN-OMR8-OLL001",
  studentName: "Nusrat Jahan Chowdhury",
  studentRoll: "2026-8841",
  regionName: "Dhaka Range",
  quizTitle: "Bangladesh National AI & Engineering Olympiad — Session Quiz",
  kind: "quiz_session",
  organizationName: "Onnesha Assessment Arena",
  instructorName: "Prof. Dr. Tanvir Ahmed",
  score: 96,
  totalPoints: 100,
  scorePct: 96,
  marksObtained: 96,
  totalMarks: 100,
  accuracyPercent: 98,
  rank: 1,
  totalParticipants: 420,
  issueDate: "2026-11-13",
  verificationUrl: "https://arena.onnesha.courses/verify/ONN-OMR8-OLL001",
  verified: true,
  ledgerIndex: 12,
  cryptoSignature: "ed25519-preview-verified",
  payloadHash: "9f4b2c71a8e43120d11c9e8b",
  rekorStatus: "anchored",
  rekorLogIndex: 3850588166,
  otsStatus: "pending_bitcoin",
};

const PREVIEW_SAMPLE_COURSE: CertificateData = {
  ...PREVIEW_SAMPLE_QUIZ,
  id: "preview-sample-course-cert",
  certificateNumber: "ONN-COURSE-AIDM04-OLL001",
  kind: "course_completion",
  courseId: SANJIBON_COURSE.id,
  courseCode: SANJIBON_COURSE.code,
  courseTitle: SANJIBON_COURSE.titleEn,
  quizTitle: SANJIBON_COURSE.titleEn,
  combinedScorePct: 92,
  quizAccuracyPct: 94,
  practicalScorePct: 90,
  verificationUrl: "https://arena.onnesha.courses/verify/ONN-COURSE-AIDM04-OLL001",
};

async function readImageFileAsDataUrl(
  file: File,
  maxDim: number,
  preferLossless: boolean,
): Promise<string> {
  if (file.type === "image/svg+xml" && file.size <= 90_000) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read SVG file."));
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const rawUrl = String(reader.result || "");
      if (!rawUrl) {
        reject(new Error("Empty file"));
        return;
      }
      if (file.size <= 75_000 && preferLossless) {
        resolve(rawUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const iw = Math.max(1, img.naturalWidth || img.width);
        const ih = Math.max(1, img.naturalHeight || img.height);
        const scale = Math.min(1, maxDim / Math.max(iw, ih));
        const w = Math.max(1, Math.round(iw * scale));
        const h = Math.max(1, Math.round(ih * scale));
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) {
          resolve(rawUrl);
          return;
        }
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const mime = preferLossless ? "image/png" : "image/jpeg";
        resolve(c.toDataURL(mime, preferLossless ? undefined : 0.86));
      };
      img.onerror = () => reject(new Error("Unsupported image format."));
      img.src = rawUrl;
    };
    reader.onerror = () => reject(new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });
}

function ImageFieldInput({
  label,
  value,
  placeholder,
  maxDim = 540,
  preferLossless = true,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  maxDim?: number;
  preferLossless?: boolean;
  hint?: string;
  onChange: (nextVal: string) => void;
}) {
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsDataUrl(file, maxDim, preferLossless);
      onChange(dataUrl);
    } catch {
      // Ignore malformed image drops cleanly
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-bold uppercase text-muted-foreground">{label}</label>
        <div className="flex items-center gap-1.5">
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-lg border border-border bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground hover:text-destructive transition cursor-pointer"
            >
              Reset
            </button>
          )}
          <label className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20 transition cursor-pointer">
            <Upload className="h-3 w-3" />
            <span>Upload</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFile}
              className="hidden"
            />
          </label>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value.startsWith("data:") ? "[Uploaded Embedded Image Ready]" : value}
          onChange={(e) => {
            if (!e.target.value.startsWith("[Uploaded Embedded")) {
              onChange(e.target.value);
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-mono"
        />
        {value && (
          <img
            src={value}
            alt={label}
            className="h-9 w-9 shrink-0 rounded-lg border border-border bg-white object-contain p-0.5"
          />
        )}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const CertificateDesignerStudio: React.FC<CertificateDesignerStudioProps> = ({
  branding,
  onChange,
  onSave,
  designProfile: controlledProfile,
  onDesignProfileChange,
  studioTab: controlledStudioTab,
  onStudioTabChange,
  previewCourse,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [localStudioTab, setLocalStudioTab] = useState<DesignerStudioTab>("theme");
  const [localDesignProfile, setLocalDesignProfile] = useState<DesignerCertProfile>("course");
  const [isDownloadingSample, setIsDownloadingSample] = useState(false);

  const designProfile = controlledProfile ?? localDesignProfile;
  const studioTab = controlledStudioTab ?? localStudioTab;

  const setDesignProfile = (next: DesignerCertProfile) => {
    setLocalDesignProfile(next);
    onDesignProfileChange?.(next);
  };

  const setStudioTab = (next: DesignerStudioTab) => {
    setLocalStudioTab(next);
    onStudioTabChange?.(next);
  };

  const certKind = profileToKind(designProfile);
  const activeProfile = getCertificateDesignProfile(branding, certKind);
  const coursePreviewData: CertificateData = previewCourse
    ? {
        ...PREVIEW_SAMPLE_COURSE,
        courseId: previewCourse.id,
        courseCode: previewCourse.code,
        courseTitle: previewCourse.titleEn,
        quizTitle: previewCourse.titleEn,
      }
    : PREVIEW_SAMPLE_COURSE;
  const previewSample = designProfile === "course" ? coursePreviewData : PREVIEW_SAMPLE_QUIZ;

  /** Patch the selected design profile only; preserve the other. Quiz also syncs legacy top-level. */
  const patchActiveProfile = (patch: Partial<CertificateDesignProfile>) => {
    const nextProfile: CertificateDesignProfile = { ...activeProfile, ...patch };
    if (designProfile === "course") {
      onChange({
        ...branding,
        courseCertificate: nextProfile,
      });
      return;
    }
    onChange({
      ...branding,
      quizCertificate: nextProfile,
      certThemePreset: nextProfile.certThemePreset,
      certShowBangladeshAiMap: nextProfile.certShowBangladeshAiMap,
      certMapOpacity: nextProfile.certMapOpacity,
      certBgPrimaryColor: nextProfile.certBgPrimaryColor,
      certBgSecondaryColor: nextProfile.certBgSecondaryColor,
      certAccentColor: nextProfile.certAccentColor,
      certBorderColor: nextProfile.certBorderColor,
      certCustomBgUrl: nextProfile.certCustomBgUrl,
      certCustomBgOpacity: nextProfile.certCustomBgOpacity,
      certBadgeTitle: nextProfile.certBadgeTitle,
      certAuthoritySubtitle: nextProfile.certAuthoritySubtitle,
      certScoreDisplayMode: nextProfile.certScoreDisplayMode,
      certSignatories: nextProfile.certSignatories,
    });
  };

  const defaultProfileSignatories =
    designProfile === "course"
      ? DEFAULT_COURSE_CERTIFICATE_SIGNATORIES
      : DEFAULT_CERTIFICATE_SIGNATORIES;

  const signatories: CertificateSignatory[] =
    Array.isArray(activeProfile.certSignatories) && activeProfile.certSignatories.length > 0
      ? activeProfile.certSignatories
      : defaultProfileSignatories;

  const partnerLogos: CertificatePartnerLogo[] = Array.isArray(branding.partnerLogos)
    ? branding.partnerLogos
    : [];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (previewCanvasRef.current) {
        const sample = designProfile === "course" ? coursePreviewData : PREVIEW_SAMPLE_QUIZ;
        const previewCert: CertificateData = {
          ...sample,
          organizationName:
            branding.institutionTitle ||
            sample.organizationName ||
            "Onnesha Assessment Arena",
        };
        const overlay = brandingWithCertificateProfile(branding, profileToKind(designProfile));
        populateCertificateCanvas(previewCanvasRef.current, previewCert, overlay);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [branding, designProfile, previewCourse]);

  const handleSetSignatoryCount = (count: number) => {
    const target = Math.max(1, Math.min(4, count));
    const current = [...signatories];
    if (current.length > target) {
      patchActiveProfile({ certSignatories: current.slice(0, target) });
      return;
    }
    const presetTemplates: CertificateSignatory[] = [
      ...defaultProfileSignatories,
      {
        id: "sig-director",
        name: "Director of AI Research",
        title: "Academic Council & Curriculum Board",
        signatureText: "Director, AI Research",
        signatureImageUrl: "",
        signatureStyle: "script",
      },
      {
        id: "sig-patron",
        name: "Chief Patron / Dean",
        title: "Partner Institution Seal",
        signatureText: "Chief Patron",
        signatureImageUrl: "",
        signatureStyle: "formal",
      },
    ];
    while (current.length < target) {
      const idx = current.length;
      const tpl = presetTemplates[idx] || {
        id: `sig-${Date.now()}-${idx}`,
        name: `Authorized Signatory ${idx + 1}`,
        title: "Examination Committee",
        signatureText: `Signatory ${idx + 1}`,
        signatureImageUrl: "",
        signatureStyle: "script" as const,
      };
      current.push({ ...tpl, id: `sig-${Date.now()}-${idx}` });
    }
    patchActiveProfile({ certSignatories: current });
  };

  const handleUpdateSignatory = (index: number, patch: Partial<CertificateSignatory>) => {
    const updated = signatories.map((sig, i) => (i === index ? { ...sig, ...patch } : sig));
    patchActiveProfile({ certSignatories: updated });
  };

  const handleAddPartnerLogo = () => {
    if (partnerLogos.length >= 4) return;
    const next: CertificatePartnerLogo = {
      id: `partner-${Date.now()}`,
      name: `Partner Organization ${partnerLogos.length + 1}`,
      logoUrl: "",
    };
    onChange({ ...branding, partnerLogos: [...partnerLogos, next] });
  };

  const handleUpdatePartnerLogo = (index: number, patch: Partial<CertificatePartnerLogo>) => {
    const updated = partnerLogos.map((p, i) => (i === index ? { ...p, ...patch } : p));
    onChange({ ...branding, partnerLogos: updated });
  };

  const handleRemovePartnerLogo = (index: number) => {
    onChange({ ...branding, partnerLogos: partnerLogos.filter((_, i) => i !== index) });
  };

  const handleDownloadSamplePdf = async () => {
    if (isDownloadingSample) return;
    setIsDownloadingSample(true);
    try {
      await downloadCertificatePdf(
        {
          ...previewSample,
          organizationName:
            branding.institutionTitle ||
            previewSample.organizationName ||
            "Onnesha Assessment Arena",
        },
        branding,
      );
    } finally {
      setIsDownloadingSample(false);
    }
  };

  const activePreset = (activeProfile.certThemePreset || "emerald_gold") as CertificateThemePreset;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="font-display text-lg font-black text-foreground flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            <span>Certificate Designer Studio &amp; Co-Branding</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Two independent designs: quiz-session certificates and course-completion / final-exam
            credentials. Themes, map, badge title, and signatories are per profile; logos stay
            shared.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onChange({
                ...DEFAULT_BRANDING_SETTINGS,
                defaultPassThresholdPct: branding.defaultPassThresholdPct,
                defaultEnforceFullscreen: branding.defaultEnforceFullscreen,
                defaultBlockCopyPaste: branding.defaultBlockCopyPaste,
                defaultMaxProctorViolations: branding.defaultMaxProctorViolations,
                portalAuthChannel: branding.portalAuthChannel,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-accent transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Design</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadSamplePdf}
            disabled={isDownloadingSample}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-accent transition cursor-pointer disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5 text-emerald-500" />
            <span>{isDownloadingSample ? "Exporting PDF..." : "Test Sample PDF"}</span>
          </button>
          <button
            type="button"
            onClick={onSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 transition cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Certificate Design</span>
          </button>
        </div>
      </div>

      {/* Dual profile switcher */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-background p-1.5 max-w-xl">
          <button
            type="button"
            onClick={() => setDesignProfile("quiz")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs font-extrabold transition cursor-pointer ${
              designProfile === "quiz"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            <span>Quiz certificate</span>
          </button>
          <button
            type="button"
            onClick={() => setDesignProfile("course")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs font-extrabold transition cursor-pointer ${
              designProfile === "course"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            <span>Course completion</span>
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground max-w-2xl">
          {designProfile === "course" ? (
            <>
              Editing the <strong className="text-foreground">course completion</strong> look —
              used after Final Exam + practical.
            </>
          ) : (
            <>
              Editing the <strong className="text-foreground">quiz certificate</strong> look —
              used for single quiz sessions.
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Controls Column */}
        <div className="xl:col-span-6 space-y-4">
          {/* Sub-Navigation Pills */}
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-background p-1.5">
            <button
              type="button"
              onClick={() => setStudioTab("theme")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-extrabold transition cursor-pointer ${
                studioTab === "theme"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Palette className="h-3.5 w-3.5" />
              <span>Theme &amp; BD AI Map</span>
            </button>
            <button
              type="button"
              onClick={() => setStudioTab("logos")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-extrabold transition cursor-pointer ${
                studioTab === "logos"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span>Logos &amp; Partners</span>
            </button>
            <button
              type="button"
              onClick={() => setStudioTab("signatories")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-extrabold transition cursor-pointer ${
                studioTab === "signatories"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <PenTool className="h-3.5 w-3.5" />
              <span>Signatories ({signatories.length})</span>
            </button>
          </div>

          {/* PANEL A: BACKGROUND THEMES & BANGLADESH AI MAP */}
          {studioTab === "theme" && (
            <div className="space-y-4 rounded-2xl border border-border bg-background p-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Select Certificate Background &amp; Edition</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(Object.keys(CERTIFICATE_THEME_PRESETS) as CertificateThemePreset[]).map(
                    (key) => {
                      const preset = CERTIFICATE_THEME_PRESETS[key];
                      const selected = activePreset === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => patchActiveProfile({ certThemePreset: key })}
                          className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                            selected
                              ? "border-primary bg-primary/10 ring-1 ring-primary"
                              : "border-border bg-card hover:bg-accent/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-foreground">
                              {preset.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-white/40"
                                style={{ backgroundColor: preset.bgPrimary }}
                              />
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-white/40"
                                style={{ backgroundColor: preset.borderOuter }}
                              />
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-white/40"
                                style={{ backgroundColor: preset.accentColor }}
                              />
                            </div>
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">
                            {preset.tagline}
                          </p>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Bangladesh Modern AI Map Watermark Controls */}
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 space-y-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <MapIcon className="h-4 w-4 text-emerald-500 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        Modern Bangladesh Silhouette + AI Neural Map
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        8 divisional AI nodes connected across Bangladesh vector contour
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={activeProfile.certShowBangladeshAiMap ?? true}
                    onChange={(e) =>
                      patchActiveProfile({ certShowBangladeshAiMap: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-border text-primary"
                  />
                </label>

                {(activeProfile.certShowBangladeshAiMap ?? true) && (
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap">
                      Map Intensity ({Math.round((activeProfile.certMapOpacity ?? 0.14) * 100)}%)
                    </span>
                    <input
                      type="range"
                      min={0.05}
                      max={0.4}
                      step={0.01}
                      value={activeProfile.certMapOpacity ?? 0.14}
                      onChange={(e) =>
                        patchActiveProfile({
                          certMapOpacity: parseFloat(e.target.value) || 0.14,
                        })
                      }
                      className="w-full accent-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Custom Colors & Optional Custom Background Image */}
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span>Custom Colors &amp; Background Image</span>
                  </span>
                  {activePreset !== "custom" && (
                    <button
                      type="button"
                      onClick={() => patchActiveProfile({ certThemePreset: "custom" })}
                      className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      Switch to Custom Palette
                    </button>
                  )}
                </div>

                {activePreset === "custom" && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      {
                        label: "BG Start",
                        key: "certBgPrimaryColor" as const,
                        fallback: "#fffdf8",
                      },
                      {
                        label: "BG End",
                        key: "certBgSecondaryColor" as const,
                        fallback: "#eefaf4",
                      },
                      {
                        label: "Outer Border",
                        key: "certBorderColor" as const,
                        fallback: "#064e3b",
                      },
                      {
                        label: "Accent / Gold",
                        key: "certAccentColor" as const,
                        fallback: "#047857",
                      },
                    ].map((c) => (
                      <label
                        key={c.key}
                        className="flex flex-col gap-1 rounded-xl border border-border bg-background p-2 text-[10px] font-bold text-muted-foreground"
                      >
                        <span>{c.label}</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={activeProfile[c.key] || c.fallback}
                            onChange={(e) => patchActiveProfile({ [c.key]: e.target.value })}
                            className="h-6 w-8 rounded border-0 bg-transparent cursor-pointer"
                          />
                          <span className="font-mono text-[10px] text-foreground">
                            {activeProfile[c.key] || c.fallback}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <ImageFieldInput
                  label="Optional Background Image Texture / Wallpaper"
                  value={activeProfile.certCustomBgUrl || ""}
                  placeholder="https://example.com/guilloche-bg.png or Upload"
                  maxDim={1400}
                  preferLossless={false}
                  hint="Tip: Upload an image directly to guarantee CORS-free PDF downloads."
                  onChange={(val) => patchActiveProfile({ certCustomBgUrl: val })}
                />

                {activeProfile.certCustomBgUrl && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap">
                      BG Overlay ({Math.round((activeProfile.certCustomBgOpacity ?? 0.22) * 100)}%)
                    </span>
                    <input
                      type="range"
                      min={0.05}
                      max={0.85}
                      step={0.02}
                      value={activeProfile.certCustomBgOpacity ?? 0.22}
                      onChange={(e) =>
                        patchActiveProfile({
                          certCustomBgOpacity: parseFloat(e.target.value) || 0.22,
                        })
                      }
                      className="w-full accent-primary"
                    />
                  </div>
                )}
              </div>

              {/* Typography / Headlines */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                    Institution Display Name
                  </label>
                  <input
                    type="text"
                    value={branding.institutionTitle || ""}
                    onChange={(e) => onChange({ ...branding, institutionTitle: e.target.value })}
                    placeholder="Onnesha Assessment Arena"
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">Shared across both profiles</p>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                    Certificate Title Banner
                  </label>
                  <input
                    type="text"
                    value={activeProfile.certBadgeTitle || ""}
                    onChange={(e) => patchActiveProfile({ certBadgeTitle: e.target.value })}
                    placeholder={
                      designProfile === "course"
                        ? "CERTIFICATE OF COURSE COMPLETION"
                        : "CERTIFICATE OF MERIT & EXCELLENCE"
                    }
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                    Authority Subtitle Line
                  </label>
                  <input
                    type="text"
                    value={activeProfile.certAuthoritySubtitle || ""}
                    onChange={(e) =>
                      patchActiveProfile({ certAuthoritySubtitle: e.target.value })
                    }
                    placeholder={
                      designProfile === "course"
                        ? "Final Examination Authority — Full Course Credential"
                        : "National Training, Merit Evaluation & Cryptographic Examination Authority"
                    }
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {/* Score & Merit Display Mode (Coursera / Executive) */}
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-primary">
                    Score &amp; Merit Display Mode (Coursera / Executive)
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Choose whether to display only the Merit distinction tier, a percentage summary,
                    full numeric marks, or a clean Coursera-style credential with no scores.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      {
                        id: "merit_only",
                        label: "Merit Standing Only",
                        desc: "Coursera-style distinction tier — hides raw marks & percentages",
                      },
                      {
                        id: "percentage_only",
                        label: "Merit + Percentage Only",
                        desc: "Shows distinction tier & overall grade % without raw breakdown",
                      },
                      {
                        id: "full_scores",
                        label: "Full Marks & Breakdown",
                        desc: "Shows all 3 numeric score cards (marks, quiz, practical/rank)",
                      },
                      {
                        id: "none",
                        label: "Hide All Scores",
                        desc: "Pure executive completion credential with zero score display",
                      },
                    ] as Array<{
                      id: CertificateScoreDisplayMode;
                      label: string;
                      desc: string;
                    }>
                  ).map((opt) => {
                    const activeMode =
                      activeProfile.certScoreDisplayMode ||
                      (designProfile === "course" ? "merit_only" : "full_scores");
                    const isSelected = activeMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => patchActiveProfile({ certScoreDisplayMode: opt.id })}
                        className={`rounded-xl border p-2.5 text-left transition cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/10 ring-1 ring-primary"
                            : "border-border bg-background hover:bg-accent/50"
                        }`}
                      >
                        <div className="text-xs font-extrabold text-foreground">{opt.label}</div>
                        <p className="mt-0.5 text-[10px] text-muted-foreground leading-snug">
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* PANEL B: LEFT / RIGHT LOGOS & PARTNER STRIP */}
          {studioTab === "logos" && (
            <div className="space-y-4 rounded-2xl border border-border bg-background p-4">
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
                <div className="text-[11px] font-black uppercase tracking-wider text-primary">
                  Top-Left &amp; Top-Right Certificate Logos
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <ImageFieldInput
                      label="Left Side Logo"
                      value={branding.leftLogoUrl || ONNESHA_MAIN_LOGO_URL}
                      placeholder={`Default: ${ONNESHA_MAIN_LOGO_URL}`}
                      hint="Uses the updated Onnesha main logo by default."
                      onChange={(val) =>
                        onChange({
                          ...branding,
                          leftLogoUrl: val.trim() ? val : ONNESHA_MAIN_LOGO_URL,
                        })
                      }
                    />
                    <input
                      type="text"
                      value={branding.leftLogoLabel || ""}
                      onChange={(e) => onChange({ ...branding, leftLogoLabel: e.target.value })}
                      placeholder="Optional caption under left logo"
                      className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-[11px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <ImageFieldInput
                      label="Right Side Logo #1 (Ansar & VDP)"
                      value={branding.rightLogoUrl || ""}
                      placeholder={`Default: ${ANSAR_VDP_LOGO_URL}`}
                      hint="Shown on top-right header (leave both right logos empty for Official Seal)."
                      onChange={(val) => onChange({ ...branding, rightLogoUrl: val })}
                    />
                    <input
                      type="text"
                      value={branding.rightLogoLabel || ""}
                      onChange={(e) => onChange({ ...branding, rightLogoLabel: e.target.value })}
                      placeholder="Bangladesh Ansar & VDP"
                      className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-[11px]"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <ImageFieldInput
                      label="Right Side Co-Logo #2 (Cloud Connect AI)"
                      value={branding.rightSecondaryLogoUrl || ""}
                      placeholder={`Default: ${CCAI_LOGO_URL}`}
                      hint="Paired side-by-side alongside Right Side Logo #1 in the top-right header."
                      onChange={(val) => onChange({ ...branding, rightSecondaryLogoUrl: val })}
                    />
                    <input
                      type="text"
                      value={branding.rightSecondaryLogoLabel || ""}
                      onChange={(e) =>
                        onChange({ ...branding, rightSecondaryLogoLabel: e.target.value })
                      }
                      placeholder="Cloud Connect AI Limited"
                      className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Primary Co-Branding Partner */}
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={branding.showPartnerLogo}
                    onChange={(e) => onChange({ ...branding, showPartnerLogo: e.target.checked })}
                  />
                  <span>Enable Primary Joint Partner (Navbar + Certificate Partner Bar)</span>
                </label>

                {branding.showPartnerLogo && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                        Primary Partner Name
                      </label>
                      <input
                        type="text"
                        value={branding.partnerName}
                        onChange={(e) => onChange({ ...branding, partnerName: e.target.value })}
                        placeholder="e.g. ICT Division / University Partner"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                    <ImageFieldInput
                      label="Primary Partner Logo"
                      value={branding.partnerLogoUrl}
                      placeholder="https://example.com/partner.png"
                      onChange={(val) => onChange({ ...branding, partnerLogoUrl: val })}
                    />
                  </div>
                )}
              </div>

              {/* Additional Certificate Partner Images */}
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-wider text-foreground">
                      Additional Certificate Partner Strip ({partnerLogos.length}/4)
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Displayed inside the dedicated &ldquo;IN PARTNERSHIP WITH&rdquo; bar below the
                      header.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddPartnerLogo}
                    disabled={partnerLogos.length >= 4}
                    className="inline-flex items-center gap-1 rounded-xl border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition cursor-pointer disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Partner</span>
                  </button>
                </div>

                {partnerLogos.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">
                    No extra partner logos added yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {partnerLogos.map((p, idx) => (
                      <div
                        key={p.id}
                        className="rounded-xl border border-border bg-background p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-bold text-muted-foreground">
                            PARTNER #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemovePartnerLogo(idx)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive hover:underline cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Remove</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) => handleUpdatePartnerLogo(idx, { name: e.target.value })}
                            placeholder="Partner Organization Name"
                            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold"
                          />
                          <ImageFieldInput
                            label="Partner Image"
                            value={p.logoUrl}
                            placeholder="Logo URL or Upload"
                            onChange={(val) => handleUpdatePartnerLogo(idx, { logoUrl: val })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PANEL C: SIGNATORIES & SIGNATURE STUDIO */}
          {studioTab === "signatories" && (
            <div className="space-y-4 rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-primary">
                    Number of Certificate Signatories
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    All signatories align evenly across the certificate with zero QR overlap.
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => handleSetSignatoryCount(count)}
                      className={`h-8 w-8 rounded-xl border text-xs font-black transition cursor-pointer ${
                        signatories.length === count
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-accent"
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {signatories.map((sig, idx) => (
                  <div
                    key={sig.id}
                    className="rounded-xl border border-border bg-card p-3.5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-foreground">
                        Signatory Slot #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {sig.name.trim() !== "{{instructor}}" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateSignatory(idx, {
                                name: "{{instructor}}",
                                signatureText: "",
                              })
                            }
                            className="rounded-lg border border-border bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground hover:text-primary transition cursor-pointer"
                          >
                            Use Exam Instructor Name
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                          Signatory Name{" "}
                          <span className="font-mono lowercase text-primary/80">
                            (or {"{{instructor}}"})
                          </span>
                        </label>
                        <input
                          type="text"
                          value={sig.name}
                          onChange={(e) => handleUpdateSignatory(idx, { name: e.target.value })}
                          placeholder="Prof. Tariqul Islam"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                          Role / Designation Title
                        </label>
                        <input
                          type="text"
                          value={sig.title}
                          onChange={(e) => handleUpdateSignatory(idx, { title: e.target.value })}
                          placeholder="Controller of Examinations"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                          Calligraphic Signature Text (if no image)
                        </label>
                        <input
                          type="text"
                          value={sig.signatureText || ""}
                          onChange={(e) =>
                            handleUpdateSignatory(idx, { signatureText: e.target.value })
                          }
                          placeholder="Defaults to Signatory Name"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs italic"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                          Signature Typography Style
                        </label>
                        <select
                          value={sig.signatureStyle || "script"}
                          onChange={(e) =>
                            handleUpdateSignatory(idx, {
                              signatureStyle: e.target.value as "script" | "formal" | "mono",
                            })
                          }
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
                        >
                          <option value="script">Italic Calligraphic Script</option>
                          <option value="formal">Formal Executive Serif</option>
                          <option value="mono">Digital Authority Monospace</option>
                        </select>
                      </div>
                    </div>

                    <ImageFieldInput
                      label="Custom Signature Graphic (Transparent PNG Recommended)"
                      value={sig.signatureImageUrl || ""}
                      placeholder="Signature PNG URL or Upload handwritten scan"
                      maxDim={420}
                      onChange={(val) => handleUpdateSignatory(idx, { signatureImageUrl: val })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Live High-Resolution Canvas Preview */}
        <div className="xl:col-span-6 space-y-3 lg:sticky lg:top-20">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Live A4 Preview —{" "}
              {designProfile === "course" ? "Course completion" : "Quiz certificate"} (2400 × 1700)
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              LIVE SYNC
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border-2 border-border bg-slate-950/10 shadow-xl">
            <canvas
              ref={previewCanvasRef}
              width={2400}
              height={1700}
              className="block w-full h-auto aspect-[2400/1700]"
            />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Preview uses the selected profile only. Click{" "}
            <strong className="text-foreground">Save Certificate Design</strong> to publish both
            quiz and course designs to{" "}
            <code className="font-mono text-foreground">/verify/:certId</code>, portals, and PDFs.
          </p>
        </div>
      </div>
    </div>
  );
};
