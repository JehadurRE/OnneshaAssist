import React from 'react';
import { ParticipantAnswer, Question } from '@/lib/types';
import { useLanguage } from '@/lib/i18n';
import { CheckCircle2, ChevronRight, Clock, Flame, Trophy, XCircle } from 'lucide-react';

interface PlayerFeedbackProps {
  answer?: ParticipantAnswer;
  question: Question;
  currentRank: number;
  totalScore: number;
  isSelfPractice?: boolean;
  isLastQuestion?: boolean;
  onNextQuestion?: () => void;
}

export const PlayerFeedback: React.FC<PlayerFeedbackProps> = ({
  answer,
  question,
  currentRank,
  totalScore,
  isSelfPractice = false,
  isLastQuestion = false,
  onNextQuestion,
}) => {
  const { lang, t } = useLanguage();

  const isWritten = question.type === 'written' || question.type === 'fill_blank';
  const isTimedOut = !answer;
  const isCorrect = !!answer?.isCorrect;

  // Format official correct answer text for all 4 question styles
  const correctAnswerDisplay = isWritten
    ? (question.acceptedAnswers && question.acceptedAnswers.length > 0
        ? question.acceptedAnswers.join(' / ')
        : 'Verified Key')
    : question.options
        .filter((o) => question.correctOptionIds.includes(o.id) || o.isCorrect)
        .map((o) => (lang === 'bn' ? o.textBn : o.textEn))
        .join(', ');

  // Format student's submitted answer text
  const studentAnswerDisplay = !answer
    ? lang === 'bn'
      ? 'সময় শেষ (উত্তর দেওয়া হয়নি)'
      : 'Time Expired (Unattempted)'
    : isWritten
      ? answer.writtenAnswer || '—'
      : question.options
          .filter((o) => answer.selectedOptionIds?.includes(o.id))
          .map((o) => (lang === 'bn' ? o.textBn : o.textEn))
          .join(', ') || '—';

  return (
    <div
      className={`relative w-full max-w-lg overflow-hidden rounded-3xl border-2 p-6 sm:p-8 text-center shadow-tactical animate-in zoom-in-95 transition-all ${
        isTimedOut
          ? 'border-amber-500/40 bg-card'
          : isCorrect
            ? 'border-emerald-500/50 bg-card'
            : 'border-destructive/50 bg-card'
      }`}
    >
      {/* Top Status Icon */}
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm mb-3">
        {isTimedOut ? (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
            <Clock className="h-10 w-10" />
          </div>
        ) : isCorrect ? (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
            <CheckCircle2 className="h-11 w-11" />
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
            <XCircle className="h-11 w-11" />
          </div>
        )}
      </div>

      {/* Result Status Title */}
      <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
        {isTimedOut
          ? t('time_up')
          : isCorrect
            ? t('correct')
            : t('incorrect')}
      </h2>

      {/* Points, Time Taken & Streak Banner */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
        <span
          className={`rounded-xl px-3.5 py-1 font-mono text-lg font-black ${
            isTimedOut
              ? 'bg-muted text-muted-foreground'
              : isCorrect
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-destructive/15 text-destructive'
          }`}
        >
          {isTimedOut
            ? '0'
            : answer.pointsAwarded >= 0
              ? `+${answer.pointsAwarded}`
              : `${answer.pointsAwarded}`}{' '}
          <span className="text-xs font-bold">{t('pts')}</span>
        </span>

        {answer?.timeTakenSec !== undefined && (
          <span className="rounded-xl border border-border bg-background px-3 py-1 font-mono text-xs font-bold text-muted-foreground">
            ⏱ {answer.timeTakenSec.toFixed(1)}s
          </span>
        )}

        {(answer?.streakCount || 0) >= 2 && (
          <span className="inline-flex items-center gap-1 rounded-xl bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
            <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            <span>
              {answer?.streakCount}x {t('streak')}
            </span>
          </span>
        )}
      </div>

      {/* Answer Comparison Card (Student's Answer vs Official Key) */}
      <div className="mt-5 space-y-2.5 text-left">
        {!isCorrect && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3.5 text-xs">
            <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-destructive">
              {lang === 'bn' ? 'আপনার প্রদত্ত উত্তর:' : 'Your Response:'}
            </div>
            <div className="mt-0.5 font-bold text-foreground">{studentAnswerDisplay}</div>
          </div>
        )}

        {correctAnswerDisplay && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs">
            <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              {lang === 'bn' ? '✓ সঠিক উত্তর (Official Key):' : '✓ Official Correct Answer:'}
            </div>
            <div className="mt-0.5 font-display text-sm font-extrabold text-emerald-800 dark:text-emerald-200">
              {correctAnswerDisplay}
            </div>
          </div>
        )}

        {/* Pedagogical Explanation */}
        {(question.explanationBn || question.explanationEn) && (
          <div className="rounded-2xl border border-border bg-background/80 p-3.5 text-xs leading-relaxed text-muted-foreground">
            <p className="font-bold text-foreground mb-1">
              {lang === 'bn' ? '💡 একাডেমিক ব্যাখ্যা ও সমাধান:' : '💡 Key Rationale & Explanation:'}
            </p>
            <p>{lang === 'bn' ? question.explanationBn : question.explanationEn || question.explanationBn}</p>
          </div>
        )}
      </div>

      {/* Current Rank & Score Bar */}
      <div className="mt-5 flex items-center justify-between rounded-2xl border border-border/80 bg-background p-3 px-5 shadow-xs">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">{t('rank')}:</span>
          <span className="font-mono text-sm font-black text-foreground">#{currentRank}</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-sm font-black text-foreground">
          <span>{totalScore.toLocaleString()}</span>
          <span className="text-xs font-normal text-muted-foreground">{t('pts')}</span>
        </div>
      </div>

      {/* Self-Practice Next Question Action */}
      {isSelfPractice && onNextQuestion && (
        <button
          type="button"
          onClick={onNextQuestion}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-md transition hover:bg-primary/90"
        >
          <span>
            {isLastQuestion
              ? lang === 'bn'
                ? 'চূড়ান্ত ফলাফল ও উত্তরপত্র দেখুন'
                : 'View Final Results & Answer Script'
              : lang === 'bn'
                ? 'পরবর্তী প্রশ্নে যান'
                : 'Next Question'}
          </span>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
