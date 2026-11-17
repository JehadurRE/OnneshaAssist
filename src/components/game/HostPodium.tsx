import React, { useEffect, useState } from "react";
import { GameSession, CertificateData } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";
import { Confetti } from "@/components/common/Confetti";
import { CertificateView } from "@/components/common/CertificateView";
import { db, formatDeterministicCertNumber } from "@/lib/db";
import { serverVerifyCertificate } from "@/lib/server-session";
import {
  compareParticipantsByMerit,
  computeParticipantAccuracyPct,
  computeTotalQuizMarks,
  isPassingScore,
  resolveOrgName,
  resolvePassThresholdPct,
} from "@/lib/scoring";
import { downloadMeritGazettePdf } from "@/lib/pdf-generator";
import {
  Award,
  FileSpreadsheet,
  FileDown,
  Lock,
  RotateCcw,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { audioEngine } from "@/lib/audio-engine";

interface HostPodiumProps {
  session: GameSession;
  onPlayAgain: () => void;
}

export const HostPodium: React.FC<HostPodiumProps> = ({ session, onPlayAgain }) => {
  const { lang, t } = useLanguage();
  const [selectedCert, setSelectedCert] = useState<CertificateData | null>(null);

  const allParticipants = Object.values(session.participants);
  const humanParticipants = allParticipants.filter((p) => !p.isBot);
  const sorted = (humanParticipants.length > 0 ? humanParticipants : allParticipants).sort(
    compareParticipantsByMerit,
  );
  const p1 = sorted[0];
  const p2 = sorted[1];
  const p3 = sorted[2];

  const branding = db.getBranding();
  const matchedQuiz = db.getQuizBySlug(session.quizId);
  const matchedCourse = matchedQuiz?.courseId
    ? db.getCourses().find((c) => c.id === matchedQuiz.courseId)
    : undefined;
  const passThresholdPct = resolvePassThresholdPct({
    sessionThreshold: session.settings?.passThresholdPct,
    courseThreshold: matchedCourse?.passThresholdPct,
    brandingDefaultThreshold: branding.defaultPassThresholdPct,
  });
  const quizQuestions = session.completedQuestions?.length
    ? session.completedQuestions
    : matchedQuiz?.questions || [];
  const totalMarks = computeTotalQuizMarks(quizQuestions, session.totalQuestions);

  const getPlayerEval = (player: typeof p1) => {
    if (!player) return { accuracyPct: 0, passed: false };
    const ansList = Object.values(player.answers || {});
    const correctCount = ansList.filter((a) => a.isCorrect).length;
    const accuracyPct = computeParticipantAccuracyPct({
      answers: ansList,
      correctCount,
      totalQuestions: session.totalQuestions,
      score: player.score,
      totalMarks,
    });
    return {
      accuracyPct,
      passed: isPassingScore(accuracyPct, passThresholdPct),
    };
  };

  useEffect(() => {
    audioEngine.playFanfare();
  }, []);

  const handleGenerateCertificate = async (player: typeof p1, rank: number) => {
    if (!player) return;
    const { accuracyPct, passed } = getPlayerEval(player);
    if (!passed) return;
    const certOriginPin = session.settings?.retakeOriginPin || session.pin;
    const certNo = formatDeterministicCertNumber(certOriginPin, player.rollNumber, rank);
    const existingSealed = db.getCertificateById(certNo);
    if (existingSealed) {
      setSelectedCert(existingSealed);
      return;
    }
    try {
      const verifiedRes = await serverVerifyCertificate({
        data: {
          certId: certNo,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (verifiedRes.success && verifiedRes.certificate) {
        db.issueCertificate(verifiedRes.certificate, { syncToServer: false });
        setSelectedCert(verifiedRes.certificate);
        return;
      }
    } catch {
      // ignore certificate verification network fallback
    }
    const cert: CertificateData = {
      id: `cert-${certNo.toLowerCase()}`,
      certificateNumber: certNo,
      studentName: player.nickname,
      studentRoll: player.rollNumber || `2026-${100 + rank}`,
      regionName: player.regionName || "Dhaka Range",
      quizTitle: session.quizTitleBn || session.quizTitleEn,
      scorePct: accuracyPct,
      accuracyPercent: accuracyPct,
      marksObtained: player.score,
      score: player.score,
      totalMarks,
      totalPoints: totalMarks,
      rank,
      totalParticipants: sorted.length,
      issueDate: new Date().toISOString().slice(0, 10),
      organizationName: resolveOrgName(branding),
      institutionName: branding.institutionTitle || "Onnesha Assessment Arena",
      instructorName: "Chief Assessment Officer",
      verificationUrl:
        typeof window !== "undefined"
          ? `${window.location.origin}/verify/${certNo}`
          : `/verify/${certNo}`,
      verified: true,
    };
    setSelectedCert(cert);
  };

  const handleExportCsv = () => {
    const headers = [
      "Rank",
      "Name",
      "Roll Number",
      "Score",
      "Accuracy %",
      `Status (>=${passThresholdPct}%)`,
    ];
    const escapeCell = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = sorted.map((p, idx) => {
      const { accuracyPct, passed } = getPlayerEval(p);
      return [
        idx + 1,
        p.nickname,
        p.rollNumber || "N/A",
        p.score,
        `${accuracyPct}%`,
        passed ? "PASSED" : "FAILED",
      ];
    });
    const csvBody = [
      headers.map(escapeCell).join(","),
      ...rows.map((r) => r.map(escapeCell).join(",")),
    ].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvBody], { type: "text/csv;charset=utf-8;" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", objectUrl);
    link.setAttribute("download", `Merit_List_${session.pin}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in-95">
      <Confetti active={true} />

      {/* Main Ceremony Box */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-12 text-center shadow-glow">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 shadow-sm mb-4">
          <Trophy className="h-9 w-9" />
        </div>

        <h1 className="font-display text-3xl sm:text-5xl font-black text-foreground">
          {lang === "bn" ? "বিজয়ীদের সংবর্ধনা ও পডিয়াম" : "Grand Podium & Awards"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {session.quizTitleBn || session.quizTitleEn} · {sorted.length} {t("players_connected")}
        </p>

        {/* 3D-Style Podium Stand */}
        <div className="mt-12 flex items-end justify-center gap-2 sm:gap-6 px-2 min-h-[300px]">
          {/* 2nd Place (Silver) */}
          {p2 && (
            <div className="flex flex-1 max-w-[170px] flex-col items-center animate-in slide-in-from-bottom-8 duration-700">
              <div
                className="mb-2 flex h-16 w-16 items-center justify-center rounded-full text-3xl shadow-lg ring-4 ring-slate-400"
                style={{ backgroundColor: p2.avatarBg }}
              >
                {p2.avatarEmoji}
              </div>
              <div className="font-display font-bold text-sm sm:text-base text-foreground truncate max-w-full">
                {p2.nickname}
              </div>
              <div className="font-mono text-xs font-black text-muted-foreground tabular-nums">
                {p2.score.toLocaleString()} pts
              </div>
              <div className="mt-3 flex h-36 w-full flex-col items-center justify-center rounded-t-3xl bg-gradient-to-t from-slate-400/30 to-slate-300/60 dark:from-slate-700/60 dark:to-slate-600/80 border-t-2 border-slate-300 shadow-md">
                <span className="font-display text-3xl font-black text-foreground">2</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Silver
                </span>
                {getPlayerEval(p2).passed ? (
                  <button
                    onClick={() => handleGenerateCertificate(p2, 2)}
                    className="mt-2 text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <Award className="h-3 w-3" />
                    <span>Certificate</span>
                  </button>
                ) : (
                  <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-destructive">
                    <Lock className="h-3 w-3" />
                    <span>Below {passThresholdPct}%</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 1st Place (Gold Champion) */}
          {p1 && (
            <div className="flex flex-1 max-w-[200px] flex-col items-center animate-in slide-in-from-bottom-12 duration-1000 scale-105 z-10">
              <div className="relative mb-2">
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
                  👑
                </span>
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full text-4xl shadow-xl ring-4 ring-amber-400"
                  style={{ backgroundColor: p1.avatarBg }}
                >
                  {p1.avatarEmoji}
                </div>
              </div>
              <div className="font-display font-extrabold text-base sm:text-lg text-foreground truncate max-w-full">
                {p1.nickname}
              </div>
              <div className="font-mono text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">
                {p1.score.toLocaleString()} pts
              </div>
              <div className="mt-3 flex h-48 w-full flex-col items-center justify-center rounded-t-3xl bg-gradient-to-t from-amber-500/40 via-amber-400/60 to-yellow-300/80 border-t-2 border-amber-300 shadow-xl">
                <span className="font-display text-4xl font-black text-amber-950">1</span>
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-950">
                  CHAMPION
                </span>
                {getPlayerEval(p1).passed ? (
                  <button
                    onClick={() => handleGenerateCertificate(p1, 1)}
                    className="mt-3 rounded-xl bg-amber-950 px-3 py-1 text-[11px] font-bold text-amber-200 shadow hover:bg-amber-900 flex items-center gap-1"
                  >
                    <Award className="h-3.5 w-3.5" />
                    <span>Get Certificate</span>
                  </button>
                ) : (
                  <span className="mt-3 rounded-xl bg-amber-950/80 px-2.5 py-1 text-[10px] font-bold text-amber-200 flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    <span>Below {passThresholdPct}%</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 3rd Place (Bronze) */}
          {p3 && (
            <div className="flex flex-1 max-w-[170px] flex-col items-center animate-in slide-in-from-bottom-6 duration-500">
              <div
                className="mb-2 flex h-16 w-16 items-center justify-center rounded-full text-3xl shadow-lg ring-4 ring-amber-700"
                style={{ backgroundColor: p3.avatarBg }}
              >
                {p3.avatarEmoji}
              </div>
              <div className="font-display font-bold text-sm sm:text-base text-foreground truncate max-w-full">
                {p3.nickname}
              </div>
              <div className="font-mono text-xs font-black text-muted-foreground tabular-nums">
                {p3.score.toLocaleString()} pts
              </div>
              <div className="mt-3 flex h-28 w-full flex-col items-center justify-center rounded-t-3xl bg-gradient-to-t from-amber-700/30 to-amber-600/50 border-t-2 border-amber-600 shadow-md">
                <span className="font-display text-3xl font-black text-foreground">3</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Bronze
                </span>
                {getPlayerEval(p3).passed ? (
                  <button
                    onClick={() => handleGenerateCertificate(p3, 3)}
                    className="mt-2 text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <Award className="h-3 w-3" />
                    <span>Certificate</span>
                  </button>
                ) : (
                  <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-destructive">
                    <Lock className="h-3 w-3" />
                    <span>Below {passThresholdPct}%</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-border/60 pt-6">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 rounded-2xl border border-border bg-background px-5 py-3 text-xs font-bold text-foreground shadow-sm hover:bg-accent transition-all"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            <span>{lang === "bn" ? "মেধা তালিকা (CSV) ডাউনলোড" : "Export Merit CSV"}</span>
          </button>

          <button
            onClick={() => {
              const participants = sorted.map((p, idx) => {
                const ansList = Object.values(p.answers || {});
                const correctCount = ansList.filter((a) => a.isCorrect).length;
                const incorrectCount = ansList.filter(
                  (a) =>
                    !a.isCorrect &&
                    ((a.selectedOptionIds && a.selectedOptionIds.length > 0) || !!a.writtenAnswer),
                ).length;
                const evalRes = getPlayerEval(p);
                return {
                  id: p.id,
                  nickname: p.nickname,
                  rollNumber: p.rollNumber || `2026-${100 + idx + 1}`,
                  regionId: p.regionId,
                  regionName: p.regionName,
                  finalScore: p.score,
                  rank: idx + 1,
                  correctCount,
                  incorrectCount,
                  unansweredCount: Math.max(0, session.totalQuestions - ansList.length),
                  accuracyPct: evalRes.accuracyPct,
                  passed: evalRes.passed,
                };
              });
              downloadMeritGazettePdf({
                quizTitle: session.quizTitleBn || session.quizTitleEn,
                regionLabel: session.settings.allowedRegionName || "All Divisions",
                participants,
                branding,
                passThresholdPct,
              }).catch(() => {});
            }}
            className="flex items-center gap-2 rounded-2xl border border-border bg-background px-5 py-3 text-xs font-bold text-foreground shadow-sm hover:bg-accent transition-all"
          >
            <FileDown className="h-4 w-4 text-primary" />
            <span>
              {lang === "bn" ? "অফিসিয়াল মেধা তালিকা (PDF)" : "Download Merit Gazette PDF"}
            </span>
          </button>

          <button
            onClick={onPlayAgain}
            className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-xs font-extrabold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
          >
            <RotateCcw className="h-4 w-4" />
            <span>{t("play_again")}</span>
          </button>
        </div>
      </div>

      {/* Certificate Modal Viewer */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md p-2 sm:p-6 animate-in fade-in">
          <div className="mx-auto my-2 sm:my-6 w-full max-w-4xl">
            <div className="mb-3 flex justify-end">
              <button
                onClick={() => setSelectedCert(null)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-xs font-bold text-white hover:bg-white/30"
              >
                <X className="h-4 w-4" />
                <span>Close</span>
              </button>
            </div>
            <CertificateView certificate={selectedCert} />
          </div>
        </div>
      )}
    </div>
  );
};
