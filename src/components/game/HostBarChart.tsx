import React, { useEffect } from 'react';
import { GameSession, Question } from '@/lib/types';
import { useLanguage } from '@/lib/i18n';
import { Check, CheckCircle2, ChevronRight, PieChart, ShieldCheck } from 'lucide-react';
import { audioEngine } from '@/lib/audio-engine';

interface HostBarChartProps {
  session: GameSession;
  question: Question;
  onNext: () => void;
}

const BAR_STYLES = [
  { key: 'A / 1', bnKey: 'ক / ১', bar: 'bg-cyan-500', badge: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/40' },
  { key: 'B / 2', bnKey: 'খ / ২', bar: 'bg-indigo-500', badge: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/40' },
  { key: 'C / 3', bnKey: 'গ / ৩', bar: 'bg-amber-500', badge: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40' },
  { key: 'D / 4', bnKey: 'ঘ / ৪', bar: 'bg-emerald-500', badge: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40' },
];

export const HostBarChart: React.FC<HostBarChartProps> = ({
  session,
  question,
  onNext,
}) => {
  const { lang, t } = useLanguage();

  useEffect(() => {
    audioEngine.playCorrect();
  }, []);

  const participants = Object.values(session.participants);
  const totalPlayers = participants.length;

  const counts: Record<string, number> = {};
  question.options.forEach((o) => {
    counts[o.id] = 0;
  });

  participants.forEach((p) => {
    const ans = p.answers[question.id];
    if (ans && ans.selectedOptionIds) {
      ans.selectedOptionIds.forEach((optId) => {
        if (counts[optId] !== undefined) {
          counts[optId]++;
        }
      });
    }
  });

  const maxCount = Math.max(...Object.values(counts), 1);
  const isWritten = question.type === 'written' || question.type === 'fill_blank';
  const correctParticipantCount = participants.filter(
    (p) => p.answers[question.id]?.isCorrect
  ).length;
  const itemDifficultyPValue =
    totalPlayers > 0 ? (correctParticipantCount / totalPlayers).toFixed(2) : '1.00';

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in zoom-in-95">
      {/* Header bar */}
      <div className="flex items-center justify-between rounded-3xl border border-border bg-card p-4 px-6 shadow-tactical">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PieChart className="h-4 w-4" />
          </div>
          <div>
            <div className="font-display text-sm font-bold text-foreground">
              {t('question')} {session.currentQuestionIndex + 1}: Psychometric Response Matrix
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              Item Facility ($P$-Value): <span className="font-bold text-primary">{itemDifficultyPValue}</span> · {totalPlayers} Examinees
            </div>
          </div>
        </div>

        <button
          onClick={onNext}
          className="flex items-center gap-1.5 rounded-2xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition hover:bg-primary/90"
        >
          <span>{t('show_leaderboard')}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Main Bar Chart Container */}
      <div className="rounded-3xl border-2 border-border bg-card p-8 sm:p-12 shadow-glow">
        <h3 className="text-center font-display text-xl sm:text-2xl font-bold text-foreground mb-8">
          {lang === 'bn' ? 'পরীক্ষার্থীদের উত্তর বণ্টন ও সঠিক সমাধান' : 'Response Distribution & Key Rationale'}
        </h3>

        {isWritten ? (
          <div className="space-y-6 py-4">
            <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-6 text-center space-y-2">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                {lang === 'bn' ? 'গ্রহণযোগ্য সঠিক উত্তরসমূহ' : 'Official Accepted Answer Key'}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {(question.acceptedAnswers || []).map((ansText, idx) => (
                  <span
                    key={idx}
                    className="rounded-xl border border-emerald-500/40 bg-card px-4 py-2 font-mono text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 shadow-sm"
                  >
                    {ansText}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <div className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {correctParticipantCount}
                </div>
                <div className="text-xs font-bold text-muted-foreground">
                  {lang === 'bn' ? 'সঠিক লিখিত উত্তর' : 'Correct Responses'}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-center">
                <div className="font-mono text-2xl font-black text-foreground">
                  {Math.max(0, totalPlayers - correctParticipantCount)}
                </div>
                <div className="text-xs font-bold text-muted-foreground">
                  {lang === 'bn' ? 'ভুল বা অনুত্তরিত' : 'Incorrect / Unanswered'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Telemetry Response Bars */
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 items-end min-h-[260px] pb-4">
            {question.options.map((opt, idx) => {
              const count = counts[opt.id] || 0;
              const heightPct = Math.max(12, (count / maxCount) * 100);
              const isCorrect = question.correctOptionIds.includes(opt.id);
              const style = BAR_STYLES[idx % BAR_STYLES.length]!;

              return (
                <div key={opt.id} className="flex flex-col items-center gap-3">
                  {/* Number of votes */}
                  <div className="font-mono text-sm sm:text-base font-black text-foreground tabular-nums">
                    {count}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({totalPlayers > 0 ? Math.round((count / totalPlayers) * 100) : 0}%)
                    </span>
                  </div>

                  {/* The Bar */}
                  <div className="relative w-full rounded-2xl bg-muted/40 p-1 flex items-end justify-center h-48">
                    <div
                      className={`w-full rounded-xl transition-all duration-1000 ease-out flex items-center justify-center ${style.bar
                        } ${isCorrect ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-background shadow-neon' : 'opacity-70'}`}
                      style={{ height: `${heightPct}%` }}
                    >
                      {isCorrect && (
                        <Check className="h-6 w-6 text-white stroke-[3] animate-pulse" />
                      )}
                    </div>
                  </div>

                  {/* Option Badge & Text */}
                  <div className="flex items-center gap-2 text-center">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border font-mono text-[11px] font-bold ${style.badge
                        }`}
                    >
                      {lang === 'bn' ? style.bnKey : style.key}
                    </span>
                    <span
                      className={`text-xs sm:text-sm font-bold line-clamp-2 ${isCorrect ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-foreground'
                        }`}
                    >
                      {lang === 'bn' ? opt.textBn : opt.textEn}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pedagogical Explanation Banner */}
        {(question.explanationBn || question.explanationEn) && (
          <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-left text-xs sm:text-sm leading-relaxed text-foreground">
            <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300 mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span>{lang === 'bn' ? 'একাডেমিক বিশ্লেষণ ও সঠিক উত্তরের যুক্তি:' : 'Pedagogical Analysis & Key Rationale:'}</span>
            </div>
            <p className="mt-1">
              {lang === 'bn' ? question.explanationBn : question.explanationEn}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
