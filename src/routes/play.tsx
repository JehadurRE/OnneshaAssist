import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { serverGetActiveRooms } from "@/lib/server-session";
import { READY_MADE_PACKS } from "@/lib/mock-data";
import { CertificateData, Course, GameSession, Participant, Question, Quiz } from "@/lib/types";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  Lock,
  MapPin,
  Maximize2,
  Play,
  Radio,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  WifiOff,
  XCircle,
} from "lucide-react";

interface PlaySearch {
  pin?: string;
  practice?: string;
}

interface ActiveRoomSummary {
  pin: string;
  quizId: string;
  quizTitleEn: string;
  quizTitleBn: string;
  phase: string;
  participantCount: number;
  totalQuestions: number;
  allowedRegionName: string;
}

export const Route = createFileRoute("/play")({
  validateSearch: (search: Record<string, unknown>): PlaySearch => {
    return {
      pin: typeof search.pin === "string" ? search.pin : undefined,
      practice: typeof search.practice === "string" ? search.practice : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Candidate Examination & Self-Practice Terminal · Onnesha Arena" },
      {
        name: "description",
        content:
          "Join a live regional examination room with a 6-digit PIN or launch a timed self-practice mock test.",
      },
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
  const [showAnswerScript, setShowAnswerScript] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Student Self-Practice & Live Room Discovery State
  const [isSelfPractice, setIsSelfPractice] = useState(false);
  const [isStartingPractice, setIsStartingPractice] = useState(false);
  const [activeRooms, setActiveRooms] = useState<ActiveRoomSummary[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>(READY_MADE_PACKS);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");

  // Proctor Anti-Cheat & Offline Resilience State
  const [incidents, setIncidents] = useState<ProctorIncident[]>([]);
  const [latestWarning, setLatestWarning] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fullscreenDismissed, setFullscreenDismissed] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  const isExamSuspended = !!participant?.isSuspended;
  const maxViolations = session?.settings?.maxProctorViolations || 3;
  const currentViolations = participant?.proctorFlags ?? incidents.length;

  // Load courses, quizzes, and active live rooms when in the Student Hub (!session)
  useEffect(() => {
    setCourses(db.getCourses());
    setQuizzes(db.getQuizzes());

    const unsubDb = db.subscribe(() => {
      setCourses(db.getCourses());
      setQuizzes(db.getQuizzes());
    });

    let active = true;
    const fetchRooms = () => {
      serverGetActiveRooms()
        .then((res) => {
          if (active && res?.success) {
            setActiveRooms(res.rooms || []);
          }
        })
        .catch(() => {});
    };
    fetchRooms();
    const roomTimer = setInterval(fetchRooms, 4000);

    return () => {
      active = false;
      clearInterval(roomTimer);
      unsubDb();
    };
  }, []);

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
        setSession((prev) => ({
          ...event.session,
          isSelfPractice: prev?.isSelfPractice || event.session.isSelfPractice,
        }));
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

  // Load session if PIN or ?practice=slug in URL search
  useEffect(() => {
    if (search.pin && search.pin.length === 6) {
      handleCheckPin(search.pin);
    } else if (search.practice) {
      const targetQuiz =
        db.getQuizBySlug(search.practice) ||
        db.getQuizzes().find((q) => q.id === search.practice || q.slug === search.practice) ||
        READY_MADE_PACKS.find((q) => q.id === search.practice || q.slug === search.practice);
      if (targetQuiz) {
        handleStartSelfPractice(targetQuiz);
      }
    }
  }, [search.pin, search.practice]);

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
          // In self-practice mode, automatically show the feedback screen when time runs out
          if (isSelfPractice || session.isSelfPractice) {
            setTimeout(() => {
              gameEngine.showChart(session.pin);
            }, 300);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.currentQuestionIndex, session?.phase, isSelfPractice]);

  const handleCheckPin = async (pinToCheck: string) => {
    setErrorMsg("");
    setIsSelfPractice(false);
    const storedPid = gameEngine.getStoredParticipantId(pinToCheck);
    const existing = await gameEngine.getSessionAsync(pinToCheck, "player", storedPid);
    if (!existing) {
      setErrorMsg(
        `No active exam room found for PIN: ${pinToCheck}. Check the Live Rooms below or launch a Self-Practice Exam.`
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

  // Start a Self-Paced Student Mock Exam without needing a second Host browser tab
  const handleStartSelfPractice = async (quiz: Quiz) => {
    setErrorMsg("");
    setIsStartingPractice(true);
    try {
      const created = await gameEngine.createSessionAsync(quiz, true);
      created.isSelfPractice = true;
      setIsSelfPractice(true);
      setSession({ ...created, isSelfPractice: true });
      setPin(created.pin);
      // Add 5 simulated peer cadets so the student gets live comparative ranking (#1 of 6)
      gameEngine.addBotPlayers(created.pin, 5);
    } finally {
      setIsStartingPractice(false);
    }
  };

  const handleJoinVerified = async (params: JoinSessionParams): Promise<JoinSessionResult> => {
    const res = await gameEngine.joinSessionVerified(params);
    if (res.success && res.participant) {
      setParticipant(res.participant);
      const updated = gameEngine.getSession(params.pin);
      if (updated) {
        setSession({ ...updated, isSelfPractice });
      }
      // If this is a Self-Practice session, automatically start the countdown right after joining!
      if (isSelfPractice || session?.isSelfPractice) {
        setTimeout(() => {
          gameEngine.startGame(params.pin);
        }, 400);
      }
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

    // In Self-Practice mode, show immediate feedback & rationale 650ms after submitting!
    if (isSelfPractice || session.isSelfPractice) {
      setTimeout(() => {
        gameEngine.showChart(session.pin);
      }, 650);
    }
  };

  const handleSelfPracticeNextQuestion = () => {
    if (!session) return;
    const nextIdx = session.currentQuestionIndex + 1;
    if (nextIdx >= session.totalQuestions) {
      gameEngine.endGame(session.pin);
    } else {
      gameEngine.nextQuestion(session.pin, nextIdx);
    }
  };

  const totalParticipantsCount = session
    ? session.participantCount || Object.keys(session.participants).length || 1
    : 1;

  // Compute accurate post-exam statistics for the student
  const studentStats = useMemo(() => {
    if (!participant || !session) {
      return { correctCount: 0, wrongCount: 0, unattemptedCount: 0, accuracyPct: 0 };
    }
    const ansList = Object.values(participant.answers || {});
    const correctCount = ansList.filter((a) => a.isCorrect).length;
    const wrongCount = ansList.filter(
      (a) =>
        !a.isCorrect &&
        ((a.selectedOptionIds && a.selectedOptionIds.length > 0) || !!a.writtenAnswer)
    ).length;
    const unattemptedCount = Math.max(0, session.totalQuestions - (correctCount + wrongCount));
    const accuracyPct =
      session.totalQuestions > 0 ? Math.round((correctCount / session.totalQuestions) * 100) : 0;
    return { correctCount, wrongCount, unattemptedCount, accuracyPct };
  }, [participant, session]);

  // Resolve full questions for post-exam Answer Script review
  const reviewQuestions: Question[] = useMemo(() => {
    if (!session) return [];
    if (session.completedQuestions && session.completedQuestions.length > 0) {
      return session.completedQuestions;
    }
    const matchedQuiz =
      db.getQuizzes().find((q) => q.id === session.quizId || q.slug === session.quizId) ||
      READY_MADE_PACKS.find((q) => q.id === session.quizId || q.slug === session.quizId);
    return matchedQuiz?.questions || [];
  }, [session]);

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
          scorePct: studentStats.accuracyPct,
          marksObtained: participant.score,
          score: participant.score,
          totalMarks: session.totalQuestions * 1000,
          totalPoints: session.totalQuestions * 1000,
          rank: participant.rank,
          totalParticipants: totalParticipantsCount,
          accuracyPercent: studentStats.accuracyPct,
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

  const questionTimeLimit = session?.currentQuestion?.timeLimitSec || 20;
  const timerProgressPct = Math.max(
    0,
    Math.min(100, Math.round((timeRemainingSec / questionTimeLimit) * 100))
  );

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

      {/* Fullscreen Exam Lock Shield Modal (only if browser supports Fullscreen API and not dismissed) */}
      {session &&
        participant &&
        session.phase === "question" &&
        !isExamSuspended &&
        session.settings.enforceFullscreen &&
        proctorEngine.isFullscreenSupported() &&
        !isFullscreen &&
        !fullscreenDismissed && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
            <div className="max-w-md w-full rounded-3xl border-2 border-primary bg-card p-6 sm:p-8 text-center space-y-4 shadow-2xl">
              <Maximize2 className="h-12 w-12 text-primary mx-auto" />
              <h2 className="font-display text-xl font-bold text-foreground">
                {lang === "bn" ? "ফুলস্ক্রিন পরীক্ষা লক সক্রিয়" : "Fullscreen Exam Lock Required"}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "bn"
                  ? "এই পরীক্ষায় স্ক্রিন পরিবর্তন রোধে ফুলস্ক্রিন মোড বাধ্যতামূলক। প্রশ্নের উত্তর দিতে নিচের বাটনে ট্যাপ করে ফুলস্ক্রিনে প্রবেশ করুন।"
                  : "The Examination Controller requires Fullscreen Lock for this assessment to prevent screen-switching. Tap below to resume your question."}
              </p>
              <button
                type="button"
                onClick={async () => {
                  const ok = await proctorEngine.requestExamFullscreen();
                  if (!ok) {
                    // Fallback if mobile browser blocks requestFullscreen
                    setFullscreenDismissed(true);
                  }
                }}
                className="w-full rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-glow hover:bg-primary/90 transition"
              >
                {lang === "bn" ? "ফুলস্ক্রিন মোডে প্রবেশ করুন" : "Enter Fullscreen Exam Mode"}
              </button>
              <button
                type="button"
                onClick={() => setFullscreenDismissed(true)}
                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground underline"
              >
                {lang === "bn"
                  ? "ডিভাইসে ফুলস্ক্রিন সাপোর্ট না করলে সাধারণ ভিউতে চালিয়ে যান"
                  : "Continue in standard mobile view if fullscreen is unsupported"}
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

      <main className="flex flex-1 flex-col items-center justify-center px-3 sm:px-6 py-6 sm:py-10">
        {/* ================================================================ */}
        {/* STEP 1: STUDENT EXAM HUB (JOIN LIVE PIN OR START SELF-PRACTICE)  */}
        {/* ================================================================ */}
        {!session && (
          <div className="w-full max-w-5xl space-y-8 animate-in fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: 6-Digit Live PIN Entry + Active Live Rooms */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-tactical text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h1 className="font-display text-2xl font-extrabold text-foreground">
                    {t("join_pin")}
                  </h1>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lang === "bn"
                      ? "ইন্সট্রাক্টরের প্রদানকৃত ৬ ডিজিটের লাইভ পিন কোড প্রবেশ করান"
                      : "Enter the 6-digit PIN code provided by your examination invigilator"}
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (pin.length === 6) handleCheckPin(pin);
                    }}
                    className="mt-5 space-y-4"
                  >
                    <PinInput
                      value={pin}
                      onChange={(p) => setPin(p)}
                      onComplete={(p) => handleCheckPin(p)}
                    />

                    {errorMsg && (
                      <div className="flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-bold text-destructive text-left">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={pin.length < 6}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-40"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>{t("play_button")}</span>
                    </button>
                  </form>
                </div>

                {/* Live Active Examination Rooms Discovery (1-Click Join) */}
                {activeRooms.length > 0 && (
                  <div className="rounded-3xl border border-emerald-500/40 bg-emerald-500/5 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        <Radio className="h-4 w-4 animate-pulse text-emerald-500" />
                        <span>
                          {lang === "bn"
                            ? `চলমান লাইভ পরীক্ষা রুম (${activeRooms.length})`
                            : `Active Live Exam Rooms (${activeRooms.length})`}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] font-bold text-muted-foreground">
                        1-Click Join
                      </span>
                    </div>

                    <div className="space-y-2">
                      {activeRooms.map((room) => (
                        <button
                          key={room.pin}
                          type="button"
                          onClick={() => handleCheckPin(room.pin)}
                          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-3.5 text-left hover:border-primary transition shadow-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-display text-xs sm:text-sm font-bold text-foreground truncate">
                              {lang === "bn" ? room.quizTitleBn : room.quizTitleEn}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                              <span className="font-bold text-primary">PIN: {room.pin}</span>
                              <span>·</span>
                              <span>{room.participantCount} joined</span>
                              <span>·</span>
                              <span>{room.allowedRegionName}</span>
                            </div>
                          </div>
                          <span className="shrink-0 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                            {lang === "bn" ? "প্রবেশ করুন →" : "Join →"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Student Self-Practice / Solo Mock Exam Selector */}
              <div className="lg:col-span-7 rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-tactical space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-0.5 text-[11px] font-bold text-primary mb-1">
                      <Sparkles className="h-3 w-3" />
                      <span>
                        {lang === "bn" ? "সেলফ-প্র্যাকটিস মক টেস্ট" : "Student Self-Practice Mode"}
                      </span>
                    </div>
                    <h2 className="font-display text-lg sm:text-xl font-extrabold text-foreground">
                      {lang === "bn"
                        ? "কোর্স ও ক্রমানুসারে কুইজ অনুশীলন করুন (Quiz 1 → Quiz 2...)"
                        : "Practice Course Quizzes Anytime (Solo Timed Exam)"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {lang === "bn"
                        ? "হোস্ট ছাড়াই যেকোনো কোর্সের কুইজ সিলেক্ট করে সরাসরি নিজের ফোনে বা কম্পিউটারে পরীক্ষা দিন ও ব্যাখ্যাসহ উত্তরপত্র দেখুন।"
                        : "No host PIN required — select any Course Quiz below to take a full timed mock test with instant rationale and certificate."}
                    </p>
                  </div>
                </div>

                {/* Course Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCourseId("all")}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      selectedCourseId === "all"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {lang === "bn" ? "সকল কোর্স" : "All Courses"} ({quizzes.length})
                  </button>
                  {courses.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCourseId(c.id)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                        selectedCourseId === c.id
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="font-mono mr-1">{c.code}:</span>
                      <span>{lang === "bn" ? c.titleBn : c.titleEn}</span>
                    </button>
                  ))}
                </div>

                {/* Sequential Quiz List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {quizzes
                    .filter((q) => selectedCourseId === "all" || q.courseId === selectedCourseId)
                    .sort((a, b) => (a.quizNumber || 99) - (b.quizNumber || 99))
                    .map((quiz) => (
                      <div
                        key={quiz.id}
                        className="flex flex-col justify-between rounded-2xl border border-border bg-background p-4 hover:border-primary/50 transition space-y-3"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded-lg bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-black text-primary uppercase">
                              {quiz.quizNumber ? `Quiz #${quiz.quizNumber}` : "Model Test"}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-muted-foreground">
                              {quiz.questions.length} Qs · -0.25
                            </span>
                          </div>
                          {quiz.courseTitle && (
                            <div className="mt-1.5 text-[10px] font-bold text-primary truncate">
                              {quiz.courseTitle}
                            </div>
                          )}
                          <h3 className="mt-0.5 font-display text-sm font-bold text-foreground leading-snug">
                            {lang === "bn" ? quiz.titleBn : quiz.titleEn}
                          </h3>
                          {quiz.instructorName && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Faculty: {quiz.instructorName}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={isStartingPractice}
                          onClick={() => handleStartSelfPractice(quiz)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary/10 border border-primary/30 py-2 text-xs font-extrabold text-primary hover:bg-primary hover:text-primary-foreground transition disabled:opacity-50"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>
                            {lang === "bn" ? "অনুশীলন শুরু করুন" : "Start Practice Exam"}
                          </span>
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Candidate Identity & Region Verification Terminal */}
        {session && !participant && (
          <div className="w-full max-w-xl space-y-3">
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => {
                  setSession(null);
                  setIsSelfPractice(false);
                }}
                className="text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                ← {lang === "bn" ? "অন্য পরীক্ষা নির্বাচন করুন" : "Back to Exam Selection"}
              </button>
              {(isSelfPractice || session.isSelfPractice) && (
                <span className="rounded-full bg-primary/15 px-3 py-0.5 font-mono text-[11px] font-bold text-primary">
                  Self-Practice Mode · {session.quizTitleBn || session.quizTitleEn}
                </span>
              )}
            </div>

            <PlayerLobby
              pin={session.pin}
              onJoinVerified={handleJoinVerified}
              requireRoll={session.settings.requireRollNumber}
              allowedRegionId={session.settings.allowedRegionId}
              allowedRegionName={session.settings.allowedRegionName}
            />
          </div>
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

            <div className="rounded-2xl border border-border/80 bg-background/80 p-4 space-y-2">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-primary">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {isSelfPractice || session.isSelfPractice
                    ? lang === "bn"
                      ? "আপনার সেলফ-প্র্যাকটিস প্রশ্নপত্র প্রস্তুত!"
                      : "Your Self-Practice Exam Paper is Ready!"
                    : t("waiting_host")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {session.quizTitleBn || session.quizTitleEn}
              </p>

              {(isSelfPractice || session.isSelfPractice) && (
                <button
                  type="button"
                  onClick={() => gameEngine.startGame(session.pin)}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>{lang === "bn" ? "এখনই পরীক্ষা শুরু করুন" : "Start Question 1 Now"}</span>
                </button>
              )}
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

        {/* STEP 5: Active Question Mode (Mobile-Ergonomic Keypad + Visual Progress Bars) */}
        {session && participant && session.phase === "question" && session.currentQuestion && (
          <div className="w-full max-w-2xl flex flex-col items-center space-y-3 sm:space-y-4 animate-in fade-in">
            {/* Compact Top Player HUD */}
            <div className="w-full rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between py-2.5 px-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-black text-primary">
                    Q{session.currentQuestionIndex + 1}/{session.totalQuestions}
                  </span>
                  {participant.regionName && (
                    <span className="hidden sm:inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {participant.regionName}
                    </span>
                  )}
                </div>

                {/* Countdown badge */}
                <div className="flex items-center gap-1.5 font-mono text-sm font-black text-foreground">
                  <Clock
                    className={`h-4 w-4 ${
                      timeRemainingSec <= 5 ? "text-destructive animate-pulse" : "text-primary"
                    }`}
                  />
                  <span className={timeRemainingSec <= 5 ? "text-destructive animate-pulse" : ""}>
                    {timeRemainingSec}s
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
                  {proctorEngine.isFullscreenSupported() && (
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
                  )}
                </div>
              </div>

              {/* Smooth Visual Countdown Bar */}
              <div className="h-1.5 w-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ease-linear ${
                    timeRemainingSec <= 5 ? "bg-destructive" : "bg-primary"
                  }`}
                  style={{ width: `${timerProgressPct}%` }}
                />
              </div>
            </div>

            {/* Question Card with Style & Rubric Badges */}
            <div className="w-full rounded-2xl border border-border/80 bg-card p-4 sm:p-6 text-center shadow-sm space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                <span className="rounded-lg bg-muted px-2.5 py-0.5 font-bold text-foreground">
                  {session.currentQuestion.type === "multi_mcq"
                    ? lang === "bn"
                      ? "☑️ একাধিক উত্তর (Multi-Select)"
                      : "☑️ Multiple Correct Options"
                    : session.currentQuestion.type === "true_false"
                      ? lang === "bn"
                        ? "⚖️ সত্য / মিথ্যা (True / False)"
                        : "⚖️ True / False"
                      : session.currentQuestion.type === "written" ||
                          session.currentQuestion.type === "fill_blank"
                        ? lang === "bn"
                          ? "✍️ সংক্ষিপ্ত লিখিত উত্তর"
                          : "✍️ Short Written Answer"
                        : lang === "bn"
                          ? "🔘 একক সঠিক উত্তর (Single MCQ)"
                          : "🔘 Single Best Answer"}
                </span>

                <span className="text-muted-foreground font-bold">
                  +{session.currentQuestion.points || 1000} {t("pts")}
                  {session.settings.negativeMarking > 0
                    ? ` · -${Math.round(session.settings.negativeMarking * 100)}% Negative`
                    : ""}
                </span>
              </div>

              <h2 className="font-display text-base sm:text-xl font-bold text-foreground leading-snug pt-1">
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
              <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl bg-primary/10 border border-primary/30 px-4 py-2.5 text-xs font-bold text-primary">
                <span>
                  ✓ {t("submitted")} —{" "}
                  {isSelfPractice || session.isSelfPractice
                    ? lang === "bn"
                      ? "উত্তর যাচাই করা হচ্ছে..."
                      : "Grading your response..."
                    : lang === "bn"
                      ? "অন্যান্য পরীক্ষার্থীদের জন্য অপেক্ষা করা হচ্ছে"
                      : "Awaiting question timer completion"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* STEP 6: Chart / Leaderboard Phase (Shows Student's Answer, Official Key & Rationale) */}
        {session &&
          participant &&
          (session.phase === "chart" || session.phase === "leaderboard") &&
          session.currentQuestion && (
            <PlayerFeedback
              answer={participant.answers[session.currentQuestion.id]}
              question={session.currentQuestion}
              currentRank={participant.rank}
              totalScore={participant.score}
              isSelfPractice={isSelfPractice || !!session.isSelfPractice}
              isLastQuestion={session.currentQuestionIndex + 1 >= session.totalQuestions}
              onNextQuestion={handleSelfPracticeNextQuestion}
            />
          )}

        {/* STEP 7: Podium, Final Scorecard & Complete Answer Script Review */}
        {session && participant && session.phase === "podium" && (
          <div className="w-full max-w-3xl space-y-6 animate-in zoom-in-95">
            <Confetti active={participant.rank <= 3} />

            {/* Top Result Summary Card */}
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-tactical text-center space-y-5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 shadow-sm">
                <Trophy className="h-8 w-8" />
              </div>

              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-black text-foreground">
                  {t("podium_title")}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  {session.quizTitleBn || session.quizTitleEn}
                </p>
                {participant.regionName && (
                  <span className="mt-2 inline-block rounded-full bg-primary/10 px-3.5 py-0.5 text-xs font-bold text-primary">
                    {participant.regionName} · Roll: {participant.rollNumber || "Verified"}
                  </span>
                )}
              </div>

              {/* Rank & Score Highlight */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="col-span-2 sm:col-span-1 rounded-2xl border border-primary/40 bg-primary/10 p-3.5">
                  <div className="font-mono text-2xl sm:text-3xl font-black text-primary">
                    #{participant.rank}
                  </div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">
                    Merit Rank (of {totalParticipantsCount})
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background p-3.5">
                  <div className="font-mono text-xl sm:text-2xl font-black text-foreground">
                    {participant.score.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">
                    Total Score
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
                  <div className="font-mono text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {studentStats.correctCount}/{session.totalQuestions}
                  </div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">
                    Correct ({studentStats.accuracyPct}%)
                  </div>
                </div>

                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5">
                  <div className="font-mono text-xl sm:text-2xl font-black text-destructive">
                    {studentStats.wrongCount}
                  </div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">
                    Incorrect
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background p-3.5">
                  <div className="font-mono text-xl sm:text-2xl font-black text-muted-foreground">
                    {studentStats.unattemptedCount}
                  </div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">
                    Skipped
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setShowCertificate(true)}
                  className="flex flex-1 min-w-[200px] items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 px-5 text-xs sm:text-sm font-extrabold text-primary-foreground shadow-md transition hover:bg-primary/90"
                >
                  <Award className="h-4 w-4" />
                  <span>{t("download_cert")}</span>
                </button>

                <button
                  onClick={() => setShowAnswerScript(!showAnswerScript)}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3.5 px-5 text-xs sm:text-sm font-bold text-foreground hover:bg-accent transition"
                >
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span>
                    {lang === "bn"
                      ? "উত্তরপত্র ও ব্যাখ্যা দেখুন"
                      : "Review Full Answer Script"}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setSession(null);
                    setParticipant(null);
                    setIsSelfPractice(false);
                    setPin("");
                  }}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 px-5 text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>{t("play_again")}</span>
                </button>
              </div>
            </div>

            {/* Complete Question-by-Question Answer Script & Solution Review */}
            {showAnswerScript && reviewQuestions.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-tactical space-y-4">
                <div className="flex items-center justify-between border-b border-border/80 pb-3">
                  <div>
                    <h3 className="font-display text-lg font-extrabold text-foreground">
                      {lang === "bn"
                        ? "আপনার সম্পূর্ণ উত্তরপত্র ও সমাধান বিশ্লেষণ"
                        : "Complete Answer Script & Rationale Review"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {lang === "bn"
                        ? "প্রতিটি প্রশ্নে আপনার প্রদত্ত উত্তর, সঠিক উত্তর এবং একাডেমিক ব্যাখ্যা নিচে দেওয়া হলো"
                        : "Review your submitted responses against the official answer key and explanations."}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {reviewQuestions.map((q, idx) => {
                    const ans = participant.answers?.[q.id];
                    const isWritten = q.type === "written" || q.type === "fill_blank";
                    const isCorrect = !!ans?.isCorrect;
                    const isSkipped = !ans;

                    const correctText = isWritten
                      ? (q.acceptedAnswers || []).join(" / ")
                      : q.options
                          .filter((o) => q.correctOptionIds.includes(o.id) || o.isCorrect)
                          .map((o) => (lang === "bn" ? o.textBn : o.textEn))
                          .join(", ");

                    const studentText = isSkipped
                      ? lang === "bn"
                        ? "উত্তর দেওয়া হয়নি (Skipped)"
                        : "Unattempted (Skipped)"
                      : isWritten
                        ? ans.writtenAnswer || "—"
                        : q.options
                            .filter((o) => ans.selectedOptionIds?.includes(o.id))
                            .map((o) => (lang === "bn" ? o.textBn : o.textEn))
                            .join(", ") || "—";

                    return (
                      <div
                        key={q.id}
                        className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${
                          isSkipped
                            ? "border-border bg-background/60"
                            : isCorrect
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : "border-destructive/40 bg-destructive/5"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs font-black text-primary">
                            Question #{idx + 1}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold ${
                              isSkipped
                                ? "bg-muted text-muted-foreground"
                                : isCorrect
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            {isSkipped ? (
                              <>
                                <Clock className="h-3 w-3" />
                                <span>Skipped (0 pts)</span>
                              </>
                            ) : isCorrect ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Correct (+{ans.pointsAwarded} pts)</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3" />
                                <span>Incorrect ({ans.pointsAwarded} pts)</span>
                              </>
                            )}
                          </span>
                        </div>

                        <h4 className="font-display text-sm sm:text-base font-bold text-foreground">
                          {lang === "bn" ? q.textBn : q.textEn}
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          <div className="rounded-xl border border-border bg-card p-3">
                            <div className="text-[10px] font-mono font-bold uppercase text-muted-foreground">
                              {lang === "bn" ? "আপনার উত্তর:" : "Your Answer:"}
                            </div>
                            <div
                              className={`mt-0.5 font-bold ${
                                isCorrect
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : isSkipped
                                    ? "text-muted-foreground"
                                    : "text-destructive"
                              }`}
                            >
                              {studentText}
                            </div>
                          </div>

                          <div className="rounded-xl border border-emerald-500/30 bg-card p-3">
                            <div className="text-[10px] font-mono font-bold uppercase text-emerald-600 dark:text-emerald-400">
                              {lang === "bn" ? "সঠিক উত্তর:" : "Correct Answer:"}
                            </div>
                            <div className="mt-0.5 font-bold text-foreground">{correctText}</div>
                          </div>
                        </div>

                        {(q.explanationBn || q.explanationEn) && (
                          <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground leading-relaxed">
                            <strong className="text-foreground">
                              {lang === "bn" ? "💡 ব্যাখ্যা: " : "💡 Rationale: "}
                            </strong>
                            {lang === "bn" ? q.explanationBn : q.explanationEn || q.explanationBn}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
