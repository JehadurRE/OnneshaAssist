import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HostLobby } from "@/components/game/HostLobby";
import { HostProjector } from "@/components/game/HostProjector";
import { HostBarChart } from "@/components/game/HostBarChart";
import { HostLeaderboard } from "@/components/game/HostLeaderboard";
import { HostPodium } from "@/components/game/HostPodium";
import { READY_MADE_PACKS } from "@/lib/mock-data";
import { gameEngine } from "@/lib/game-engine";
import { audioEngine } from "@/lib/audio-engine";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { sqliteEngine } from "@/lib/db/sqlite-engine";
import { GameSession } from "@/lib/types";
import { resolveStartCountdownSec, splitBetweenQuestionDelays } from "@/lib/scoring";
import { coercePinSearchParam, coerceSearchString } from "@/lib/utils";
import { Lock, RotateCcw, ShieldAlert } from "lucide-react";

interface HostSearch {
  pin?: string | undefined;
  retakeSessionId?: string | undefined;
  regionId?: string | undefined;
  skipCompleted?: string | undefined;
  minAnswers?: string | undefined;
}

export const Route = createFileRoute("/host/$quizId")({
  validateSearch: (search: Record<string, unknown>): HostSearch => ({
    pin: coercePinSearchParam(search["pin"] ?? search["PIN"]),
    retakeSessionId: coerceSearchString(search["retakeSessionId"]),
    regionId: coerceSearchString(search["regionId"]),
    skipCompleted: coerceSearchString(search["skipCompleted"]),
    minAnswers: coerceSearchString(search["minAnswers"]),
  }),
  head: () => ({
    meta: [
      { title: "Host Live Controller & Projector · Onnesha Arena" },
      { name: "description", content: "Big-screen live projector and host controller room." },
    ],
  }),
  component: HostPage,
});

function HostPage() {
  const { quizId } = Route.useParams();
  const {
    pin: requestedPin,
    retakeSessionId,
    regionId: requestedRegionId,
    skipCompleted: requestedSkipCompleted,
    minAnswers: requestedMinAnswers,
  } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [session, setSession] = useState<GameSession | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [, setCountdownTick] = useState(0);
  const sessionRef = useRef<GameSession | null>(null);

  useEffect(() => {
    if (session?.phase !== "countdown") return;
    const id = setInterval(() => setCountdownTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [session?.phase]);
  const justCreatedPinRef = useRef<string | null>(null);
  const suppressStopPinRef = useRef<string | null>(null);
  const attachedPinRef = useRef<string | null>(null);

  const isStaff = isAuthenticated && (user?.role === "admin" || user?.role === "instructor");

  useEffect(() => {
    return () => {
      gameEngine.stopPolling();
    };
  }, []);

  useEffect(() => {
    if (authLoading || !isStaff) return undefined;

    let active = true;
    let unsubscribe: (() => void) | null = null;
    setRoomError(null);

    const attachSession = (activeSession: GameSession) => {
      if (!active) return;
      attachedPinRef.current = activeSession.pin;
      sessionRef.current = activeSession;
      setSession(activeSession);
      unsubscribe = gameEngine.subscribe((event) => {
        if (!active) return;
        if (event.type === "SESSION_UPDATED" && event.session.pin === activeSession.pin) {
          sessionRef.current = event.session;
          setSession({ ...event.session });
        }
      });
    };

    const trimmedPin = requestedPin?.trim();
    if (
      trimmedPin &&
      justCreatedPinRef.current === trimmedPin &&
      sessionRef.current?.pin === trimmedPin &&
      gameEngine.isPolling(trimmedPin)
    ) {
      justCreatedPinRef.current = null;
      suppressStopPinRef.current = null;
      if (sessionRef.current) attachSession(sessionRef.current);
      return () => {
        active = false;
        if (unsubscribe) unsubscribe();
      };
    }

    const bootstrapHostRoom = async () => {
      if (trimmedPin && trimmedPin.length >= 4) {
        const existingSession = await gameEngine.resumeHostSessionAsync(trimmedPin);
        if (!active) return;
        if (existingSession) {
          attachSession(existingSession);
        } else {
          setRoomError(
            `Live room PIN ${trimmedPin} has expired or been closed. You can start a fresh examination room below.`,
          );
        }
        return;
      }

      try {
        await sqliteEngine.ready();
      } catch {
        // ignore sqlite init notice
      }

      let quiz =
        db.getQuizBySlug(quizId) ||
        db.getQuizzes().find((p) => p.id === quizId || p.slug === quizId) ||
        READY_MADE_PACKS.find((p) => p.id === quizId || p.slug === quizId);

      if (!quiz) {
        try {
          await db.syncFromServerStore();
          quiz =
            db.getQuizBySlug(quizId) ||
            db.getQuizzes().find((p) => p.id === quizId || p.slug === quizId) ||
            READY_MADE_PACKS.find((p) => p.id === quizId || p.slug === quizId);
        } catch {
          // ignore server sync fallback notice
        }
      }

      if (!active) return;
      if (!quiz) {
        setRoomError(
          "Requested assessment pack could not be found. Return to the dashboard and launch an active quiz.",
        );
        return;
      }

      try {
        const regions = db.getRegions();
        const regionScopeId =
          requestedRegionId && requestedRegionId !== "all" ? requestedRegionId : "all";
        const matchedReg =
          regionScopeId !== "all" ? regions.find((r) => r.id === regionScopeId) : undefined;
        const regionScopeName = matchedReg
          ? `${matchedReg.nameEn} (${matchedReg.nameBn})`
          : "All Regions (National)";
        const skipCompletedFlag = requestedSkipCompleted === "0" ? false : true;
        const parsedMinAns = requestedMinAnswers ? parseInt(requestedMinAnswers, 10) : NaN;
        const minCompletedAnswersVal =
          Number.isFinite(parsedMinAns) && parsedMinAns >= 1
            ? Math.min(500, Math.round(parsedMinAns))
            : 1;

        const newSession = await gameEngine.createSessionAsync(
          quiz,
          true,
          regionScopeId,
          regionScopeName,
          false,
          retakeSessionId
            ? {
                retakeForSessionId: retakeSessionId,
                retakeSkipCompleted: skipCompletedFlag,
                retakeMinCompletedAnswers: minCompletedAnswersVal,
              }
            : undefined,
        );
        if (!active) return;
        justCreatedPinRef.current = newSession.pin;
        suppressStopPinRef.current = newSession.pin;
        attachSession(newSession);
        navigate({
          to: "/host/$quizId",
          params: { quizId },
          search: { pin: newSession.pin },
          replace: true,
        });
      } catch (err) {
        if (!active) return;
        setRoomError(
          err instanceof Error ? err.message : "Could not initialize live examination room.",
        );
      }
    };

    void bootstrapHostRoom();

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
      if (!suppressStopPinRef.current || suppressStopPinRef.current !== attachedPinRef.current) {
        gameEngine.stopPolling();
      }
    };
  }, [quizId, requestedPin, authLoading, isStaff, navigate]);

  const handleSkipTimer = useCallback(() => {
    const pin = sessionRef.current?.pin;
    if (pin) gameEngine.showChart(pin);
  }, []);

  const handleNextFromChart = useCallback(() => {
    const pin = sessionRef.current?.pin;
    if (pin) gameEngine.showLeaderboard(pin);
  }, []);

  const handleEndExamEarly = useCallback(() => {
    const pin = sessionRef.current?.pin;
    if (pin) gameEngine.endGame(pin);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground bg-grid flex items-center justify-center">
        <div className="flex items-center gap-3 font-display text-lg font-bold">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Verifying controller authorization...</span>
        </div>
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-tactical text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
              <Lock className="h-7 w-7" />
            </div>
            <h1 className="font-display text-xl font-black text-foreground">
              Examiner Authorization Required
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Only verified Instructors and Super Admins can launch or control live examination
              rooms.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Link
                to="/auth/login"
                className="flex-1 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
              >
                Sign In as Instructor / Admin
              </Link>
              <Link
                to="/play"
                className="flex-1 rounded-2xl border border-border bg-background py-3 text-xs font-bold text-foreground hover:bg-accent transition"
              >
                Student Exam Hub →
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (roomError) {
    return (
      <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-3xl border border-amber-500/40 bg-card p-6 sm:p-8 shadow-tactical text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h1 className="font-display text-xl font-black text-foreground">Room Not Active</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">{roomError}</p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRoomError(null);
                  navigate({
                    to: "/host/$quizId",
                    params: { quizId },
                    search: {},
                    replace: true,
                  });
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Start Fresh Live Room</span>
              </button>
              <Link
                to="/dashboard"
                className="flex-1 rounded-2xl border border-border bg-background py-3 text-xs font-bold text-foreground hover:bg-accent transition"
              >
                Back to Studio
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background text-foreground bg-grid flex items-center justify-center">
        <div className="flex items-center gap-3 font-display text-lg font-bold">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Initializing institutional examination room...</span>
        </div>
      </div>
    );
  }

  const handleStartGame = () => {
    gameEngine.startGame(session.pin);
  };

  const handleAddBots = () => {
    gameEngine.addBotPlayers(session.pin, 8);
  };

  const handleKickPlayer = (pId: string) => {
    gameEngine.kickPlayer(session.pin, pId);
  };

  const handlePardonPlayer = (pId: string) => {
    gameEngine.pardonPlayer(session.pin, pId);
  };

  const handleUpdateSettings = (settings: Partial<GameSession["settings"]>) => {
    gameEngine.updateSessionSettings(session.pin, settings);
  };

  const handleCloseRoom = async () => {
    await gameEngine.closeRoomAsync(session.pin);
    navigate({ to: "/dashboard" });
  };

  const handleNextQuestion = () => {
    const nextIdx = session.currentQuestionIndex + 1;
    if (nextIdx >= session.totalQuestions) {
      gameEngine.endGame(session.pin);
    } else {
      gameEngine.nextQuestion(session.pin, nextIdx);
    }
  };

  const handlePlayAgain = () => {
    navigate({ to: "/dashboard" });
  };

  const isLastQuestion = session.currentQuestionIndex + 1 >= session.totalQuestions;
  const betweenDelays = splitBetweenQuestionDelays(session.settings.betweenQuestionSec);
  const startCountdownTotalSec = resolveStartCountdownSec(session.settings.startCountdownSec);
  const countdownStarted = session.countdownStartedAt || session.updatedAt || Date.now();
  const countdownLeftSec =
    session.phase === "countdown"
      ? Math.max(
          0,
          Math.ceil(
            (countdownStarted + startCountdownTotalSec * 1000 - gameEngine.getServerNow()) / 1000,
          ),
        )
      : 0;

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      <main className="flex-1 px-4 sm:px-6 py-8">
        {/* PHASE 1: Lobby */}
        {session.phase === "lobby" && (
          <HostLobby
            session={session}
            onStartGame={handleStartGame}
            onAddBots={handleAddBots}
            onKickPlayer={handleKickPlayer}
            onToggleSound={() => {}}
            onUpdateSettings={handleUpdateSettings}
            onCloseRoom={handleCloseRoom}
          />
        )}

        {/* PHASE 2: Countdown */}
        {session.phase === "countdown" && (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center space-y-4 animate-in zoom-in-95">
            <h2 className="font-display text-3xl font-extrabold text-foreground">
              Starting Question 1...
            </h2>
            <div className="font-mono text-7xl sm:text-8xl font-black text-primary animate-pulse tabular-nums">
              {countdownLeftSec > 0 ? countdownLeftSec : "GO!"}
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              {(session.settings.speedBonus ?? true)
                ? "⚡ Speed Marking Active · Faster correct responses score higher"
                : "Accuracy Scoring Mode · Speed breaks ranking ties"}
            </p>
          </div>
        )}

        {/* PHASE 3: Active Question Broadcast */}
        {session.phase === "question" && session.currentQuestion && (
          <HostProjector
            session={session}
            question={session.currentQuestion}
            onSkipTimer={handleSkipTimer}
            onPardonPlayer={handlePardonPlayer}
            onKickPlayer={handleKickPlayer}
            onEndExam={handleEndExamEarly}
          />
        )}

        {/* PHASE 4: Answer Distribution Bar Chart */}
        {session.phase === "chart" && session.currentQuestion && (
          <HostBarChart
            session={session}
            question={session.currentQuestion}
            onNext={handleNextFromChart}
            autoAdvanceSec={betweenDelays.enabled ? betweenDelays.chartSec : undefined}
            onToggleAutoPause={(paused) =>
              gameEngine.setBetweenAutoAdvancePaused(session.pin, paused)
            }
          />
        )}

        {(session.phase === "question" || session.phase === "chart") &&
          !session.currentQuestion && (
            <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8 text-center shadow-tactical space-y-4">
              <p className="font-display text-lg font-extrabold text-foreground">
                Synchronizing Question Slide...
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground"
                >
                  Advance Question →
                </button>
                <button
                  type="button"
                  onClick={handleEndExamEarly}
                  className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold text-foreground"
                >
                  Conclude Exam
                </button>
              </div>
            </div>
          )}

        {/* PHASE 5: Leaderboard */}
        {session.phase === "leaderboard" && (
          <HostLeaderboard
            session={session}
            onNextQuestion={handleNextQuestion}
            isLastQuestion={isLastQuestion}
            autoAdvanceSec={betweenDelays.enabled ? betweenDelays.leaderboardSec : undefined}
            onToggleAutoPause={(paused) =>
              gameEngine.setBetweenAutoAdvancePaused(session.pin, paused)
            }
          />
        )}

        {/* PHASE 6: Podium & Grand Finale */}
        {(session.phase === "podium" || session.phase === "finished") && (
          <HostPodium session={session} onPlayAgain={handlePlayAgain} />
        )}
      </main>

      <Footer />
    </div>
  );
}
