import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PinInput } from "@/components/common/PinInput";
import { PlayerLobby } from "@/components/game/PlayerLobby";
import { PlayerKeypad } from "@/components/game/PlayerKeypad";
import { PlayerFeedback } from "@/components/game/PlayerFeedback";
import { CertificateView } from "@/components/common/CertificateView";
import { Confetti } from "@/components/common/Confetti";
import { gameEngine, JoinSessionParams, JoinSessionResult } from "@/lib/game-engine";
import { audioEngine } from "@/lib/audio-engine";
import { proctorEngine, ProctorIncident } from "@/lib/proctor-engine";
import { db, formatDeterministicCertNumber } from "@/lib/db";
import { CertificateData, GameSession, Participant } from "@/lib/types";
import {
  AlertTriangle,
  Award,
  Flame,
  Lock,
  MapPin,
  Maximize2,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";

interface PlaySearch {
  pin?: string;
}

export const Route = createFileRoute("/play")({
  validateSearch: (search: Record<string, unknown>): PlaySearch => {
    return {
      pin: typeof search.pin === "string" ? search.pin : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Candidate Examination Terminal · Onnesha Arena" },
      { name: "description", content: "Join live regional examination session with 6-digit PIN and verified candidate identity." },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { lang, t } = useLanguage();
  const search = Route.useSearch();
  const [pin, setPin] = useState(search.pin || "");
  const [session, setSession] = useState<GameSession | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timeRemainingSec, setTimeRemainingSec] = useState(20);
  const [showCertificate, setShowCertificate] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Proctor Anti-Cheat & Offline Resilience State
  const [incidents, setIncidents] = useState<ProctorIncident[]>([]);
  const [latestWarning, setLatestWarning] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  const isExamSuspended = !!participant?.isSuspended;
  const maxViolations = session?.settings?.maxProctorViolations || 3;
  const currentViolations = participant?.proctorFlags ?? incidents.length;

  // Sync game session state & offline outbox from delta polling
  useEffect(() => {
    setOfflineQueueCount(gameEngine.getOfflineOutbox().length);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const unsubscribe = gameEngine.subscribe((event) => {
      if (event.type === "OFFLINE_QUEUE_CHANGED") {
        setOfflineQueueCount(event.count);
        setIsOnline(event.isOnline);
      }
      if (session && event.type === "SESSION_UPDATED" && event.session.pin === session.pin) {
        setSession({ ...event.session });
        if (participant) {
          const updatedP = event.session.participants[participant.id];
          if (updatedP) {
            setParticipant({ ...updatedP });
          }
        }
      }
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, [session, participant]);

  // Load session if PIN in URL search
  useEffect(() => {
    if (search.pin && search.pin.length === 6) {
      handleCheckPin(search.pin);
    }
  }, [search.pin]);

  // Proctoring Engine Lifecycle — transmits incidents directly to Server & Host Projector
  useEffect(() => {
    if (participant && session && session.phase === "question" && !participant.isSuspended) {
      setIsFullscreen(proctorEngine.isInFullscreen());
      proctorEngine.start(
        participant.id,
        participant.nickname,
        (incident) => {
          setIncidents((prev) => [...prev, incident]);
          gameEngine
            .reportProctorIncident(session.pin, participant.id, incident.type)
            .then((res) => {
              if (res?.success) {
                setParticipant((curr) =>
                  curr
                    ? {
                        ...curr,
                        proctorFlags: res.proctorFlags,
                        isSuspended: res.isSuspended,
                      }
                    : curr
                );
              }
            })
            .catch(() => {});

          const reasonLabel =
            incident.type === "copy_attempt"
              ? "Copy/Paste or Screenshot blocked"
              : incident.type === "devtools_attempt"
                ? "Inspector / DevTools blocked"
                : incident.type === "fullscreen_exit"
                  ? "Fullscreen lock exited"
                  : "Tab switch / screen switch detected";

          setLatestWarning(
            `⚠️ Proctor Strike Logged: ${reasonLabel} — Reported to Invigilator`
          );
          setTimeout(() => setLatestWarning(null), 4000);
        },
        {
          enforceFullscreen: !!session.settings.enforceFullscreen,
          blockCopyPaste: session.settings.blockCopyPaste ?? true,
          onFullscreenChange: (full) => setIsFullscreen(full),
        }
      );
    } else {
      proctorEngine.stop();
    }

    return () => proctorEngine.stop();
  }, [
    participant?.id,
    participant?.isSuspended,
    session?.phase,
    session?.settings?.enforceFullscreen,
    session?.settings?.blockCopyPaste,
  ]);

  // Timer countdown per question synchronized to server questionEndTime
  useEffect(() => {
    if (!session || session.phase !== "question" || !session.currentQuestion) return;

    const currentQId = session.currentQuestion.id;
    const alreadySubmitted = participant?.answers?.[currentQId];
    if (alreadySubmitted) {
      setSelectedOptionIds(alreadySubmitted.selectedOptionIds || []);
      setHasAnswered(true);
    } else {
      setSelectedOptionIds([]);
      setHasAnswered(false);
    }

    const computeRemaining = () => {
      if (session.questionEndTime && session.questionEndTime > Date.now()) {
        return Math.max(0, Math.ceil((session.questionEndTime - Date.now()) / 1000));
      }
      return session.currentQuestion?.timeLimitSec || 20;
    };

    setTimeRemainingSec(computeRemaining());

    const interval = setInterval(() => {
      setTimeRemainingSec((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.currentQuestionIndex, session?.phase]);

  const handleCheckPin = async (pinToCheck: string) => {
    setErrorMsg("");
    const storedPid = gameEngine.getStoredParticipantId(pinToCheck);
    const existing = await gameEngine.getSessionAsync(pinToCheck, "player", storedPid);
    if (!existing) {
      setErrorMsg(
        `No active exam room found for PIN: ${pinToCheck}. Please verify with your invigilator.`
      );
      return;
    }
    setSession(existing);
    setPin(pinToCheck);

    // Auto-restore seat if candidate refreshed browser tab mid-exam
    if (storedPid && existing.participants[storedPid]) {
      setParticipant(existing.participants[storedPid]);
    }
  };

  const handleJoinVerified = async (params: JoinSessionParams): Promise<JoinSessionResult> => {
    const res = await gameEngine.joinSessionVerified(params);
    if (res.success && res.participant) {
      setParticipant(res.participant);
      const updated = gameEngine.getSession(params.pin);
      if (updated) setSession(updated);
    }
    return res;
  };

  const handleSubmitAnswer = (optIds: string[], written?: string) => {
    if (!session || !participant || !session.currentQuestion || hasAnswered || isExamSuspended)
      return;

    setSelectedOptionIds(optIds);
    setHasAnswered(true);

    gameEngine.submitAnswer(
      session.pin,
      participant.id,
      session.currentQuestion.id,
      optIds,
      written
    );

    try {
      audioEngine.playTick();
    } catch {}
  };

  const totalParticipantsCount = session
    ? session.participantCount || Object.keys(session.participants).length || 1
    : 1;

  // Deterministic certificate number matching Dashboard & Verification Portal
  const certNumber =
    participant && session
      ? formatDeterministicCertNumber(session.pin, participant.rollNumber, participant.rank)
      : "";

  const certificateData: CertificateData | null =
    participant && session
      ? {
          id: `cert-${certNumber.toLowerCase()}`,
          certificateNumber: certNumber,
          studentName: participant.nickname,
          studentRoll: participant.rollNumber || "2026-101",
          regionName: participant.regionName || "Dhaka Range",
          quizTitle: session.quizTitleBn || session.quizTitleEn,
          scorePct: Math.min(
            100,
            Math.round((participant.score / Math.max(1, session.totalQuestions * 1000)) * 100)
          ),
          marksObtained: participant.score,
          score: participant.score,
          totalMarks: session.totalQuestions * 1000,
          totalPoints: session.totalQuestions * 1000,
          rank: participant.rank,
          totalParticipants: totalParticipantsCount,
          accuracyPercent: Math.min(
            100,
            Math.round((participant.score / Math.max(1, session.totalQuestions * 1000)) * 100)
          ),
          issueDate: new Date().toISOString().slice(0, 10),
          organizationName: "Onnesha Assessment & Examination Arena",
          institutionName: db.getBranding().institutionTitle || "Onnesha Assessment Arena",
          instructorName: "Chief Assessment Officer",
          verificationUrl:
            typeof window !== "undefined"
              ? `${window.location.origin}/verify/${certNumber}`
              : `https://onnesha.app/verify/${certNumber}`,
          verified: true,
        }
      : null;

  useEffect(() => {
    if (session?.phase === "podium" && certificateData) {
      db.issueCertificate(certificateData);
    }
  }, [session?.phase]);

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      {/* Offline / Network Drop Resilience Banner */}
      {(!isOnline || offlineQueueCount > 0) && (
        <div className="bg-amber-500/15 border-b border-amber-500/40 px-4 py-2 text-center text-xs font-bold text-amber-600 dark:text-amber-300 flex items-center justify-center gap-2">
          <WifiOff className="h-3.5 w-3.5 shrink-0 animate-pulse" />
          <span>
            {!isOnline
              ? lang === "bn"
                ? `ইন্টারনেট সংযোগ বিচ্ছিন্ন! আপনার উত্তর ফোনে টাইমস্ট্যাম্পসহ সংরক্ষিত হচ্ছে (${offlineQueueCount}টি কিউতে) — নেটওয়ার্ক ফিরলেই স্বয়ংক্রিয়ভাবে সার্ভারে যুক্ত হবে।`
                : `Mobile Network Offline — Your answers are timestamped & queued locally (${offlineQueueCount} pending) and will auto-sync immediately upon reconnection.`
              : `Syncing ${offlineQueueCount} queued answer(s) to examination server...`}
          </span>
        </div>
      )}

      {/* Real-time Anti-Cheat Security Notification */}
      {latestWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl border-2 border-amber-500 bg-amber-500 text-black px-4 py-2 text-xs font-black shadow-2xl">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{latestWarning}</span>
        </div>
      )}

      {/* Fullscreen Exam Lock Shield Modal (when enforceFullscreen is enabled on session) */}
      {session &&
        participant &&
        session.phase === "question" &&
        !isExamSuspended &&
        session.settings.enforceFullscreen &&
        !isFullscreen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
            <div className="max-w-md w-full rounded-3xl border-2 border-primary bg-card p-6 sm:p-8 text-center space-y-4 shadow-2xl">
              <Maximize2 className="h-12 w-12 text-primary mx-auto" />
              <h2 className="font-display text-xl font-bold text-foreground">
                {lang === "bn" ? "ফুলস্ক্রিন পরীক্ষা লক সক্রিয়" : "Fullscreen Exam Lock Required"}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "bn"
                  ? "এই পরীক্ষায় স্ক্রিন পরিবর্তন রোধে ফুলস্ক্রিন মোড বাধ্যতামূলক। প্রশ্নের উত্তর দিতে নিচের বাটনে ট্যাপ করে ফুলস্ক্রিনে ফিরুন।"
                  : "The Examination Controller requires Fullscreen Lock for this assessment to prevent screen-switching. Tap below to resume your question."}
              </p>
              <button
                type="button"
                onClick={() => proctorEngine.requestExamFullscreen()}
                className="w-full rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90 transition"
              >
                {lang === "bn" ? "ফুলস্ক্রিন মোডে প্রবেশ করুন" : "Enter Fullscreen Exam Mode"}
              </button>
            </div>
          </div>
        )}

      {/* Suspended Exam Modal — Only Host Invigilator can pardon/unsuspend */}
      {isExamSuspended && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="max-w-md w-full rounded-3xl border-2 border-destructive bg-card p-6 sm:p-8 text-center space-y-4 shadow-2xl">
            <ShieldAlert className="h-14 w-14 text-destructive mx-auto" />
            <h2 className="font-display text-xl font-bold text-foreground">
              Examination Seat Suspended by Proctor
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Multiple tab-switching or window-defocus violations ({participant?.proctorFlags || incidents.length} logged) have triggered an automatic seat lock.
            </p>
            <div className="rounded-2xl border border-border bg-muted/30 p-3 font-mono text-xs space-y-1">
              <div>
                Candidate: <strong className="text-foreground">{participant?.nickname}</strong> (Roll:{" "}
                {participant?.rollNumber || "N/A"})
              </div>
              {participant?.regionName && (
                <div className="text-primary font-bold">Region: {participant.regionName}</div>
              )}
            </div>
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-semibold text-amber-600 dark:text-amber-400">
              Awaiting Host Invigilator clearance. Only the Examination Controller can unlock your seat from the Host Projector.
            </div>
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col items-center justify-center px-3 sm:px-4 py-4 sm:py-8">
        {/* STEP 1: Enter PIN */}
        {!session && (
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-tactical text-center animate-in fade-in">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">{t("join_pin")}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "bn"
                ? "হোস্টের প্রদানকৃত ৬ ডিজিটের পিন কোড প্রবেশ করান"
                : "Enter the 6-digit PIN code provided by your examination invigilator"}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (pin.length === 6) handleCheckPin(pin);
              }}
              className="mt-6 space-y-4"
            >
              <PinInput
                value={pin}
                onChange={(p) => setPin(p)}
                onComplete={(p) => handleCheckPin(p)}
              />

              {errorMsg && (
                <div className="flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-bold text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={pin.length < 6}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-base font-extrabold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-40"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{t("play_button")}</span>
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: Candidate Identity & Region Verification Terminal */}
        {session && !participant && (
          <PlayerLobby
            pin={session.pin}
            onJoinVerified={handleJoinVerified}
            requireRoll={session.settings.requireRollNumber}
            allowedRegionId={session.settings.allowedRegionId}
            allowedRegionName={session.settings.allowedRegionName}
          />
        )}

        {/* STEP 3: Waiting in Lobby (Verified Seat Locked) */}
        {session && participant && session.phase === "lobby" && (
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-tactical text-center animate-in zoom-in-95 space-y-5">
            <div className="flex flex-col items-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-md ring-4 ring-primary/20"
                style={{ backgroundColor: participant.avatarBg }}
              >
                {participant.avatarEmoji}
              </div>
              <h2 className="mt-3 font-display text-xl font-extrabold text-foreground">
                {participant.nickname}
              </h2>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                {participant.rollNumber && (
                  <span className="rounded-full border border-border bg-muted px-3 py-0.5 font-mono text-xs font-bold text-foreground">
                    Roll: {participant.rollNumber}
                  </span>
                )}
                {participant.regionName && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary">
                    <MapPin className="h-3 w-3" />
                    <span>{participant.regionName}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-2">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>
                {lang === "bn"
                  ? "আপনার আসনটি লক করা হয়েছে — অন্য কেউ আপনার নামে প্রবেশ করতে পারবে না।"
                  : "Seat Cryptographically Locked — Protected against impersonation"}
              </span>
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/80 p-4 space-y-1">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-primary">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{t("waiting_host")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {session.quizTitleBn || session.quizTitleEn}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Users className="h-4 w-4 text-primary" />
              <span>
                {totalParticipantsCount} {t("players_connected")}
              </span>
            </div>
          </div>
        )}

        {/* STEP 4: Countdown Before Exam Starts */}
        {session && participant && session.phase === "countdown" && (
          <div className="text-center animate-in zoom-in-95 space-y-4">
            <div className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
              {t("get_ready")}
            </div>
            <div className="font-mono text-6xl sm:text-7xl font-black text-primary animate-pulse">
              3 · 2 · 1
            </div>
          </div>
        )}

        {/* STEP 5: Active Question Mode (Mobile-Ergonomic Keypad) */}
        {session && participant && session.phase === "question" && session.currentQuestion && (
          <div className="w-full max-w-2xl flex flex-col items-center space-y-3 sm:space-y-5 animate-in fade-in">
            {/* Compact Top Player HUD */}
            <div className="w-full flex items-center justify-between rounded-2xl border border-border bg-card py-2.5 px-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="font-display text-xs font-extrabold text-primary">
                  Q{session.currentQuestionIndex + 1}/{session.totalQuestions}
                </span>
                {participant.regionName && (
                  <span className="hidden sm:inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {participant.regionName}
                  </span>
                )}
              </div>

              {/* Countdown badge */}
              <div className="flex items-center gap-1 font-mono text-sm font-black text-foreground">
                <span className={timeRemainingSec <= 5 ? "text-destructive animate-pulse" : ""}>
                  ⏱ {timeRemainingSec}s
                </span>
              </div>

              <div className="flex items-center gap-2">
                {session.settings.isFormalAssessment && (
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold border ${
                      currentViolations > 0
                        ? "border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}
                    title="Anti-Cheat Screen Lock Monitor"
                  >
                    🛡️ {currentViolations}/{maxViolations}
                  </span>
                )}
                {participant.streak >= 2 && (
                  <span className="inline-flex items-center gap-0.5 font-mono text-xs font-bold text-amber-500">
                    <Flame className="h-3.5 w-3.5 fill-amber-500" />
                    <span>{participant.streak}x</span>
                  </span>
                )}
                <span className="font-mono text-xs font-bold text-foreground">
                  {participant.score} {t("pts")}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    isFullscreen
                      ? proctorEngine.exitExamFullscreen()
                      : proctorEngine.requestExamFullscreen()
                  }
                  className="rounded-lg border border-border bg-muted/50 p-1 text-muted-foreground hover:text-foreground"
                  title="Toggle Fullscreen Lock"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Question Text */}
            <div className="w-full rounded-2xl border border-border/80 bg-card/90 p-3.5 sm:p-5 text-center shadow-sm">
              <h2 className="font-display text-base sm:text-xl font-bold text-foreground leading-snug">
                {lang === "bn" ? session.currentQuestion.textBn : session.currentQuestion.textEn}
              </h2>
            </div>

            {/* Keypad Buttons */}
            <PlayerKeypad
              question={session.currentQuestion}
              hasAnswered={hasAnswered}
              selectedOptionIds={selectedOptionIds}
              onSubmitAnswer={handleSubmitAnswer}
              timeRemainingSec={timeRemainingSec}
            />

            {hasAnswered && (
              <div className="rounded-xl bg-primary/10 border border-primary/30 px-4 py-2 text-xs font-bold text-primary">
                ✓ {t("submitted")} — Awaiting question timer completion
              </div>
            )}
          </div>
        )}

        {/* STEP 6: Chart / Leaderboard Phase */}
        {session &&
          participant &&
          (session.phase === "chart" || session.phase === "leaderboard") &&
          session.currentQuestion && (
            <PlayerFeedback
              answer={participant.answers[session.currentQuestion.id]}
              question={session.currentQuestion}
              currentRank={participant.rank}
              totalScore={participant.score}
            />
          )}

        {/* STEP 7: Podium & Final Results */}
        {session && participant && session.phase === "podium" && (
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-tactical text-center animate-in zoom-in-95 space-y-5">
            <Confetti active={participant.rank <= 3} />

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 shadow-sm">
              <Trophy className="h-8 w-8" />
            </div>

            <div>
              <h2 className="font-display text-2xl font-black text-foreground">
                {t("podium_title")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {session.quizTitleBn || session.quizTitleEn}
              </p>
              {participant.regionName && (
                <span className="mt-2 inline-block rounded-full bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary">
                  {participant.regionName} · Roll: {participant.rollNumber}
                </span>
              )}
            </div>

            {/* Rank Card */}
            <div className="rounded-2xl border border-border bg-background p-4 shadow-sm space-y-2">
              <div className="font-mono text-4xl font-black text-primary">
                #{participant.rank}
              </div>
              <p className="text-xs text-muted-foreground">
                Final Merit Rank among {totalParticipantsCount} candidates
              </p>
              <div className="font-mono text-lg font-bold text-foreground">
                {participant.score.toLocaleString()} {t("pts")}
              </div>
            </div>

            {/* Certificate Button */}
            <button
              onClick={() => setShowCertificate(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-md transition hover:bg-primary/90"
            >
              <Award className="h-4 w-4" />
              <span>{t("download_cert")}</span>
            </button>

            <button
              onClick={() => {
                setSession(null);
                setParticipant(null);
                setPin("");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-xs font-bold text-foreground hover:bg-accent transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t("play_again")}</span>
            </button>
          </div>
        )}

        {/* Certificate Modal */}
        {showCertificate && certificateData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in">
            <div className="relative my-8 w-full max-w-3xl">
              <button
                onClick={() => setShowCertificate(false)}
                className="absolute -top-12 right-0 rounded-full bg-white/20 px-4 py-1.5 text-xs font-bold text-white hover:bg-white/30"
              >
                ✕ Close
              </button>
              <CertificateView certificate={certificateData} />
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
