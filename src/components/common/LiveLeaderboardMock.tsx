import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { gameEngine } from '@/lib/game-engine';
import { Activity, Award, Eye, Flame, Play, ShieldAlert, Sparkles, Trophy, Users, Zap } from 'lucide-react';

interface CandidateTelemetry {
  id: string;
  name: string;
  roll: string;
  score: number;
  streak: number;
  accuracy: number;
  avatar: string;
  bg: string;
  status: 'transmitting' | 'ready' | 'focused';
}

const INITIAL_CANDIDATES: CandidateTelemetry[] = [
  { id: '1', name: 'Cadet Tanvir Hossain', roll: '2026-104', score: 1850, streak: 5, accuracy: 96, avatar: '🦅', bg: '#6366f1', status: 'focused' },
  { id: '2', name: 'Cadet Sumaiya Akter', roll: '2026-102', score: 1720, streak: 4, accuracy: 92, avatar: '⚡', bg: '#10b981', status: 'focused' },
  { id: '3', name: 'Cadet Safwan Ahmed', roll: '2026-108', score: 1640, streak: 3, accuracy: 88, avatar: '🛡️', bg: '#f59e0b', status: 'transmitting' },
  { id: '4', name: 'Cadet Nusrat Jahan', roll: '2026-115', score: 1520, streak: 2, accuracy: 85, avatar: '🎯', bg: '#ec4899', status: 'focused' },
  { id: '5', name: 'Cadet Badhon Mia', roll: '2026-120', score: 1410, streak: 2, accuracy: 80, avatar: '🚀', bg: '#06b6d4', status: 'ready' },
];

export const LiveLeaderboardMock: React.FC<{ sessionPin?: string }> = ({ sessionPin }) => {
  const { lang } = useLanguage();
  const [candidates, setCandidates] = useState<CandidateTelemetry[]>(INITIAL_CANDIDATES);
  const [activeItem, setActiveItem] = useState(4);
  const [totalExaminees, setTotalExaminees] = useState(42);

  // If connected to a real game PIN, subscribe to real participants
  useEffect(() => {
    if (sessionPin) {
      const updateFromRealSession = () => {
        const session = gameEngine.getSession(sessionPin);
        if (session) {
          const participantsList = Object.values(session.participants);
          if (participantsList.length > 0) {
            setTotalExaminees(participantsList.length);
            setActiveItem(session.currentQuestionIndex + 1);
            const mapped: CandidateTelemetry[] = participantsList
              .sort((a, b) => b.score - a.score)
              .slice(0, 5)
              .map((p) => {
                const totalAnswers = Object.keys(p.answers).length;
                const correctCount = Object.values(p.answers).filter((a) => a.isCorrect).length;
                const acc = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 100;
                return {
                  id: p.id,
                  name: p.nickname || p.name,
                  roll: p.rollNumber || '2026-CADET',
                  score: p.score,
                  streak: p.streak,
                  accuracy: acc,
                  avatar: p.avatarEmoji || '🦅',
                  bg: p.avatarBg || '#6366f1',
                  status: p.connected ? 'focused' : 'ready',
                };
              });
            setCandidates(mapped);
          }
        }
      };

      updateFromRealSession();
      const unsub = gameEngine.subscribe(() => updateFromRealSession());
      return () => unsub();
    } else {
      // Landing page hero simulation tick
      const interval = setInterval(() => {
        setCandidates((prev) => {
          const next = [...prev];
          const randomIdx = Math.floor(Math.random() * next.length);
          const bonus = Math.floor(Math.random() * 80) + 20;
          next[randomIdx] = {
            ...next[randomIdx],
            score: next[randomIdx].score + bonus,
            streak: Math.min(8, next[randomIdx].streak + 1),
            status: 'transmitting',
          };
          return next.sort((a, b) => b.score - a.score);
        });
      }, 2800);

      return () => clearInterval(interval);
    }
  }, [sessionPin]);

  return (
    <div className="w-full max-w-md rounded-3xl border-2 border-primary/40 bg-card p-5 sm:p-6 shadow-glow relative overflow-hidden transition-all">
      {/* Top Telemetry Header */}
      <div className="flex items-center justify-between border-b border-border/80 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="font-display text-xs font-bold text-foreground">
              Mission Control HUD · Live Telemetry
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">
              Item #{activeItem} of 25 · Arena Pass: <span className="font-bold text-primary">{sessionPin || '482 910'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          <Eye className="h-3 w-3" />
          <span>Proctor: 100% Active</span>
        </div>
      </div>

      {/* Candidate Live Stream List */}
      <div className="space-y-2.5">
        {candidates.map((cand, idx) => (
          <div
            key={cand.id}
            className={`flex items-center justify-between gap-3 rounded-2xl border p-2.5 px-3.5 transition-all duration-300 ${
              idx === 0
                ? 'border-amber-500/50 bg-amber-500/10 shadow-sm'
                : 'border-border/80 bg-background/80'
            }`}
          >
            {/* Rank & Cadet Crest */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`font-mono text-xs font-black tabular-nums w-4 text-center ${
                idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-amber-700' : 'text-muted-foreground'
              }`}>
                #{idx + 1}
              </span>

              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base shadow-sm"
                style={{ backgroundColor: cand.bg }}
              >
                {cand.avatar}
              </div>

              <div className="min-w-0">
                <div className="font-display text-xs font-bold text-foreground truncate">
                  {cand.name}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                  <span>{cand.roll}</span>
                  {cand.streak >= 3 && (
                    <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                      <Flame className="h-3 w-3 fill-amber-500" />
                      <span>{cand.streak}x</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Score & Pulse */}
            <div className="text-right shrink-0">
              <div className="font-mono text-xs sm:text-sm font-black text-foreground tabular-nums">
                {cand.score.toLocaleString()} <span className="text-[9px] font-normal text-muted-foreground">pts</span>
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                {cand.accuracy}% acc
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Live Metrics */}
      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3 text-primary" />
          <span>{totalExaminees} Candidates Testing</span>
        </span>
        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
          ⚡ Latency: 18ms
        </span>
      </div>
    </div>
  );
};
