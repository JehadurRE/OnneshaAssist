import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { GameSession } from "@/lib/types";
import { Lock, RotateCcw, ShieldAlert } from "lucide-react";

interface HostSearch {
  pin?: string | undefined;
}

export const Route = createFileRoute("/host/$quizId")({
  validateSearch: (search: Record<string, unknown>): HostSearch => ({
    pin: typeof search["pin"] === "string" ? search["pin"] : undefined,
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
  const { pin: requestedPin } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [session, setSession] = useState<GameSession | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);

  const isStaff = isAuthenticated && (user?.role === "admin" || user?.role === "instructor");

  useEffect(() => {
    if (authLoading || !isStaff) return undefined;

    let active = true;
    let unsubscribe: (() => void) | null = null;
    setRoomError(null);

    const quiz =
      db.getQuizBySlug(quizId) ||
      db.getQuizzes().find((p) => p.id === quizId || p.slug === quizId) ||
      READY_MADE_PACKS.find((p) => p.id === quizId || p.slug === quizId) ||
      READY_MADE_PACKS[0];

    const attachSession = (activeSession: GameSession) => {
      if (!active) return;
      setSession(activeSession);
      unsubscribe = gameEngine.subscribe((event) => {
        if (event.type === "SESSION_UPDATED" && event.session.pin === activeSession.pin) {
          setSession({ ...event.session });
        }
      });
    };

    if (requestedPin && requestedPin.trim().length >= 4) {
      gameEngine.resumeHostSessionAsync(requestedPin.trim()).then((existingSession) => {
        if (!active) return;
        if (existingSession) {
          attachSession(existingSession);
        } else {
          setRoomError(
            `Live room PIN ${requestedPin.trim()} has expired or been closed. You can start a fresh examination room below.`
          );
        }
      });
    } else if (quiz) {
      gameEngine.createSessionAsync(quiz, true).then((newSession) => {
        if (!active) return;
        attachSession(newSession);
        navigate({
          to: "/host/$quizId",
          params: { quizId },
          search: { pin: newSession.pin },
          replace: true,
        });
      });
    }

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [quizId, requestedPin, authLoading, isStaff, navigate]);

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
              Only verified Instructors and Super Admins can launch or control live examination rooms.
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

  const handleSkipTimer = () => {
    gameEngine.showChart(session.pin);
  };

  const handleNextFromChart = () => {
    gameEngine.showLeaderboard(session.pin);
  };

  const handleEndExamEarly = () => {
    gameEngine.endGame(session.pin);
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
            onToggleSound={() => audioEngine.toggleMute()}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {/* PHASE 2: Countdown */}
        {session.phase === "countdown" && (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center space-y-4 animate-in zoom-in-95">
            <h2 className="font-display text-3xl font-extrabold text-foreground">
              Starting Question 1...
            </h2>
            <div className="font-mono text-7xl sm:text-8xl font-black text-primary animate-pulse">
              3 · 2 · 1
            </div>
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
          />
        )}

        {/* PHASE 5: Leaderboard */}
        {session.phase === "leaderboard" && (
          <HostLeaderboard
            session={session}
            onNextQuestion={handleNextQuestion}
            isLastQuestion={isLastQuestion}
          />
        )}

        {/* PHASE 6: Podium & Grand Finale */}
        {session.phase === "podium" && (
          <HostPodium session={session} onPlayAgain={handlePlayAgain} />
        )}
      </main>

      <Footer />
    </div>
  );
}
