import React from 'react';
import { ParticipantAnswer, Question } from '@/lib/types';
import { useLanguage } from '@/lib/i18n';
import { CheckCircle2, Flame, Trophy, XCircle } from 'lucide-react';

interface PlayerFeedbackProps {
  answer?: ParticipantAnswer;
  question: Question;
  currentRank: number;
  totalScore: number;
}

export const PlayerFeedback: React.FC<PlayerFeedbackProps> = ({
  answer,
  question,
  currentRank,
  totalScore,
}) => {
  const { lang, t } = useLanguage();

  if (!answer) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-border bg-card shadow-glow animate-in zoom-in-95">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl mb-3">
          ⏱️
        </div>
        <h3 className="font-display text-2xl font-bold text-foreground">
          {t('time_up')}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {lang === 'bn' ? 'আপনি কোনো উত্তর নির্বাচন করেননি।' : 'No answer was submitted in time.'}
        </p>
      </div>
    );
  }

  const isCorrect = answer.isCorrect;

  return (
    <div
      className={`relative w-full max-w-md overflow-hidden rounded-3xl border p-8 text-center shadow-glow animate-in zoom-in-95 transition-all ${
        isCorrect
          ? 'border-emerald-500/40 bg-emerald-500/10'
          : 'border-destructive/40 bg-destructive/10'
      }`}
    >
      {/* Icon */}
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full shadow-lg">
        {isCorrect ? (
          <CheckCircle2 className="h-16 w-16 text-emerald-500 animate-bounce" />
        ) : (
          <XCircle className="h-16 w-16 text-destructive" />
        )}
      </div>

      {/* Result Status Title */}
      <h2 className="mt-4 font-display text-2xl sm:text-3xl font-extrabold text-foreground">
        {isCorrect ? t('correct') : t('incorrect')}
      </h2>

      {/* Points & Streak Banner */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <span
          className={`font-mono text-xl font-extrabold ${
            isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
          }`}
        >
          {answer.pointsAwarded >= 0 ? `+${answer.pointsAwarded}` : `${answer.pointsAwarded}`}{' '}
          <span className="text-xs font-normal text-muted-foreground">{t('pts')}</span>
        </span>

        {answer.streakCount >= 2 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
            <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            <span>
              {answer.streakCount}x {t('streak')}
            </span>
          </span>
        )}
      </div>

      {/* Current Rank & Score bar */}
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-border/80 bg-card p-3 px-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">{t('rank')}:</span>
          <span className="font-mono text-sm font-bold text-foreground">#{currentRank}</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-sm font-extrabold text-foreground">
          <span>{totalScore.toLocaleString()}</span>
          <span className="text-xs font-normal text-muted-foreground">{t('pts')}</span>
        </div>
      </div>

      {/* Explanation toggle */}
      {(question.explanationBn || question.explanationEn) && (
        <div className="mt-5 rounded-2xl border border-border/60 bg-card/60 p-4 text-left text-xs leading-relaxed text-muted-foreground">
          <p className="font-bold text-foreground mb-1">
            {lang === 'bn' ? '💡 ব্যাখ্যা:' : '💡 Explanation:'}
          </p>
          <p>{lang === 'bn' ? question.explanationBn : question.explanationEn}</p>
        </div>
      )}
    </div>
  );
};
