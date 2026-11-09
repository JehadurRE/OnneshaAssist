import React, { useEffect, useMemo, useState } from 'react';
import { GameSession } from '@/lib/types';
import { useLanguage } from '@/lib/i18n';
import { db } from '@/lib/db';
import { ChevronRight, Flame, MapPin, Trophy } from 'lucide-react';
import { audioEngine } from '@/lib/audio-engine';

interface HostLeaderboardProps {
  session: GameSession;
  onNextQuestion: () => void;
  isLastQuestion: boolean;
}

export const HostLeaderboard: React.FC<HostLeaderboardProps> = ({
  session,
  onNextQuestion,
  isLastQuestion,
}) => {
  const { lang, t } = useLanguage();
  const [selectedRegionId, setSelectedRegionId] = useState<string>('all');
  const regions = db.getRegions();

  useEffect(() => {
    audioEngine.playDrumroll();
    const tId = setTimeout(() => {
      audioEngine.playWhoosh();
    }, 600);
    return () => clearTimeout(tId);
  }, []);

  const allSorted = useMemo(
    () => Object.values(session.participants).sort((a, b) => b.score - a.score),
    [session.participants]
  );

  const filteredSorted = useMemo(() => {
    if (selectedRegionId === 'all') return allSorted;
    return allSorted.filter((p) => p.regionId === selectedRegionId);
  }, [allSorted, selectedRegionId]);

  const topPlayers = filteredSorted.slice(0, 8);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in-95">
      {/* Header bar with Region Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-primary" />
          <h2 className="font-display text-base font-bold text-foreground">
            {lang === 'bn' ? 'লাইভ মেধা তালিকা' : 'Live Merit Leaderboard'}
          </h2>

          {/* Region Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1 text-xs">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <select
              value={selectedRegionId}
              onChange={(e) => setSelectedRegionId(e.target.value)}
              className="bg-transparent font-bold text-foreground outline-none cursor-pointer"
            >
              <option value="all">All Regions ({allSorted.length})</option>
              {regions.map((r) => {
                const c = allSorted.filter((p) => p.regionId === r.id).length;
                if (c === 0) return null;
                return (
                  <option key={r.id} value={r.id}>
                    {r.nameEn} ({c})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <button
          onClick={onNextQuestion}
          className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90"
        >
          <span>{isLastQuestion ? t('end_game') : t('next_question')}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Main Leaderboard Cards */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-tactical space-y-3">
        {topPlayers.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No candidates in this region filter.
          </div>
        ) : (
          topPlayers.map((player, idx) => {
            const rank = idx + 1;
            const isTop1 = rank === 1;
            const isTop3 = rank <= 3;

            return (
              <div
                key={player.id}
                className={`flex items-center gap-4 rounded-2xl border p-4 px-5 transition-all duration-500 ease-out shadow-sm ${
                  isTop1
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : isTop3
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-background'
                }`}
              >
                {/* Rank pill */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-mono text-base font-extrabold shadow-sm ${
                    isTop1
                      ? 'bg-amber-500 text-amber-950 ring-2 ring-amber-400'
                      : rank === 2
                      ? 'bg-slate-300 dark:bg-slate-700 text-foreground'
                      : rank === 3
                      ? 'bg-amber-700 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  #{rank}
                </div>

                {/* Avatar Emoji */}
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm ring-1 ring-border"
                  style={{ backgroundColor: player.avatarBg + '25' }}
                >
                  {player.avatarEmoji}
                </div>

                {/* Name, Roll & Region */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base sm:text-lg font-bold text-foreground truncate">
                      {player.nickname}
                    </span>
                    {player.streak >= 2 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        <Flame className="h-3 w-3 fill-amber-500 text-amber-500" />
                        <span>{player.streak}x</span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                    {player.rollNumber && <span>Roll: {player.rollNumber}</span>}
                    {player.regionName && (
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {player.regionName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className="text-right">
                  <div className="font-mono text-xl sm:text-2xl font-black text-foreground tabular-nums">
                    {player.score.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{t('pts')}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
