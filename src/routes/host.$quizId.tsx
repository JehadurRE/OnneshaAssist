import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { db } from "@/lib/db";
import { GameSession } from "@/lib/types";

export const Route = createFileRoute("/host/$quizId")({
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
  const navigate = useNavigate();
  const [session, setSession] = useState<GameSession | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;

    const quiz =
      db.getQuizBySlug(quizId) ||
      db.getQuizzes().find((p) => p.id === quizId || p.slug === quizId) ||
      READY_MADE_PACKS.find((p) => p.id === quizId || p.slug === quizId) ||
      READY_MADE_PACKS[0];

    if (!quiz) return undefined;

    gameEngine.createSessionAsync(quiz, true).then((newSession) => {
      if (!active) return;
      setSession(newSession);

      unsubscribe = gameEngine.subscribe((event) => {
        if (event.type === "SESSION_UPDATED" && event.session.pin === newSession.pin) {
          setSession({ ...event.session });
        }
      });
    });

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [quizId]);

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
