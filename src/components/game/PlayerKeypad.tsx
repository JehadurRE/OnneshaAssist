import React, { useState, useEffect } from 'react';
import { Question } from '@/lib/types';
import { useLanguage } from '@/lib/i18n';
import { Check, CheckCircle2, Send, ShieldCheck } from 'lucide-react';

interface PlayerKeypadProps {
  question: Question;
  hasAnswered: boolean;
  selectedOptionIds: string[];
  onSubmitAnswer: (selectedIds: string[], writtenAnswer?: string) => void;
  timeRemainingSec: number;
}

// Institutional High-Contrast Keycap Styles (Zero Violet/Slop, Mobile-Ergonomic)
const KEY_STYLES = [
  {
    keycap: '1 · A',
    bnKeycap: '১ · ক',
    border: 'border-emerald-500/40 hover:border-emerald-500 active:border-emerald-400',
    bg: 'bg-card hover:bg-emerald-500/5',
    accentText: 'text-emerald-700 dark:text-emerald-400',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    selectedBg: 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/40',
  },
  {
    keycap: '2 · B',
    bnKeycap: '২ · খ',
    border: 'border-sky-500/40 hover:border-sky-500 active:border-sky-400',
    bg: 'bg-card hover:bg-sky-500/5',
    accentText: 'text-sky-700 dark:text-sky-400',
    glow: 'shadow-[0_0_20px_rgba(14,165,233,0.15)]',
    selectedBg: 'bg-sky-500/15 border-sky-500 ring-2 ring-sky-500/40',
  },
  {
    keycap: '3 · C',
    bnKeycap: '৩ · গ',
    border: 'border-amber-500/40 hover:border-amber-500 active:border-amber-400',
    bg: 'bg-card hover:bg-amber-500/5',
    accentText: 'text-amber-700 dark:text-amber-400',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    selectedBg: 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/40',
  },
  {
    keycap: '4 · D',
    bnKeycap: '৪ · ঘ',
    border: 'border-teal-500/40 hover:border-teal-500 active:border-teal-400',
    bg: 'bg-card hover:bg-teal-500/5',
    accentText: 'text-teal-700 dark:text-teal-400',
    glow: 'shadow-[0_0_20px_rgba(20,184,166,0.15)]',
    selectedBg: 'bg-teal-500/15 border-teal-500 ring-2 ring-teal-500/40',
  },
];

export const PlayerKeypad: React.FC<PlayerKeypadProps> = ({
  question,
  hasAnswered,
  selectedOptionIds,
  onSubmitAnswer,
}) => {
  const { lang, t } = useLanguage();
  const [multiSelected, setMultiSelected] = useState<string[]>(selectedOptionIds);
  const [writtenText, setWrittenText] = useState('');

  useEffect(() => {
    setMultiSelected(selectedOptionIds);
    setWrittenText('');
  }, [question.id]);

  useEffect(() => {
    if (hasAnswered || question.type === 'written' || question.type === 'fill_blank') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (['1', '2', '3', '4'].includes(e.key)) {
        const index = parseInt(e.key, 10) - 1;
        if (question.options[index]) {
          handleOptionClick(question.options[index].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasAnswered, question, multiSelected]);

  const handleOptionClick = (optId: string) => {
    if (hasAnswered) return;

    if (question.type === 'multi_mcq') {
      const next = multiSelected.includes(optId)
        ? multiSelected.filter((id) => id !== optId)
        : [...multiSelected, optId];
      setMultiSelected(next);
    } else {
      onSubmitAnswer([optId]);
    }
  };

  const handleMultiSubmit = () => {
    if (multiSelected.length > 0 && !hasAnswered) {
      onSubmitAnswer(multiSelected);
    }
  };

  const handleWrittenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (writtenText.trim() && !hasAnswered) {
      onSubmitAnswer([], writtenText.trim());
    }
  };

  if (question.type === 'written' || question.type === 'fill_blank') {
    return (
      <div className="w-full max-w-lg space-y-4">
        <form onSubmit={handleWrittenSubmit} className="rounded-3xl border-2 border-border bg-card p-5 sm:p-6 shadow-tactical">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {lang === 'bn'
              ? '✍️ সংক্ষিপ্ত বা সংখ্যাবাচক উত্তর টাইপ করুন:'
              : '✍️ Type Your Short or Numeric Answer:'}
          </label>
          <input
            type="text"
            autoFocus
            disabled={hasAnswered}
            value={writtenText}
            onChange={(e) => setWrittenText(e.target.value)}
            placeholder={lang === 'bn' ? 'এখানে উত্তর লিখুন (যেমন: ১৯৭১ বা 1971)...' : 'Type your exact answer here...'}
            className="w-full rounded-2xl border-2 border-border bg-background px-4 py-3.5 font-mono text-base font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-70"
          />
          {!hasAnswered ? (
            <button
              type="submit"
              disabled={!writtenText.trim() || hasAnswered}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              <span>{lang === 'bn' ? 'উত্তর সাবমিট করুন' : 'Submit Written Answer'}</span>
            </button>
          ) : (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 py-3 px-4 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                {lang === 'bn'
                  ? `আপনার লিখিত উত্তর ("${writtenText}") সংরক্ষিত হয়েছে`
                  : `Your written response ("${writtenText}") has been locked`}
              </span>
            </div>
          )}
        </form>
      </div>
    );
  }

  if (question.type === 'true_false') {
    const opts = question.options.slice(0, 2);
    return (
      <div className="grid w-full max-w-lg grid-cols-2 gap-3 sm:gap-4">
        {opts.map((opt, idx) => {
          const isSelected = selectedOptionIds.includes(opt.id);
          const isTrue = idx === 0;
          return (
            <button
              key={opt.id}
              disabled={hasAnswered}
              onClick={() => handleOptionClick(opt.id)}
              className={`flex h-32 sm:h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                isTrue
                  ? 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-foreground'
                  : 'border-destructive/40 bg-destructive/10 hover:bg-destructive/20 text-foreground'
              } ${isSelected ? 'ring-4 ring-primary ring-offset-2 ring-offset-background' : ''}`}
            >
              <span className="font-mono text-xl sm:text-2xl font-black">
                {isTrue ? '[1] TRUE' : '[2] FALSE'}
              </span>
              <span className="text-sm sm:text-base font-bold">
                {lang === 'bn' ? opt.textBn : opt.textEn}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // Ergonomic 390px-ready Response Grid
  return (
    <div className="w-full max-w-3xl space-y-2.5 sm:space-y-4">
      <div className="flex items-center justify-between px-2 text-[11px] font-mono text-muted-foreground">
        <span>
          {question.type === 'multi_mcq'
            ? lang === 'bn'
              ? '☑️ একাধিক সঠিক উত্তর নির্বাচন করে নিচে সাবমিট চাপুন'
              : '☑️ MULTI-SELECT: Choose all correct options, then tap Transmit'
            : lang === 'bn'
              ? '⚡ সঠিক অপশনে ট্যাপ করুন বা কিবোর্ড [1-4] চাপুন'
              : '⚡ Tap an option or press keyboard keys [1, 2, 3, 4]'}
        </span>
        <span className="hidden sm:flex items-center gap-1 text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Encrypted Seat Lock Active</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
        {question.options.map((opt, idx) => {
          const style = KEY_STYLES[idx % KEY_STYLES.length]!;
          const isSelected =
            question.type === 'multi_mcq'
              ? multiSelected.includes(opt.id)
              : selectedOptionIds.includes(opt.id);

          return (
            <button
              key={opt.id}
              type="button"
              disabled={hasAnswered}
              onClick={() => handleOptionClick(opt.id)}
              className={`group relative flex min-h-[64px] sm:min-h-[88px] items-center gap-3.5 rounded-2xl border-2 px-4 py-3 sm:p-5 text-left transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed ${
                style.bg
              } ${isSelected ? style.selectedBg + ' ' + style.glow : style.border} ${
                hasAnswered ? 'opacity-70' : 'hover:-translate-y-0.5'
              }`}
            >
              <div
                className={`flex h-10 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/60 font-mono text-xs font-black shadow-sm transition-all ${
                  isSelected ? 'bg-primary text-primary-foreground border-primary' : style.accentText
                }`}
              >
                {lang === 'bn' ? style.bnKeycap : style.keycap}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-base font-bold text-foreground leading-snug">
                  {lang === 'bn' ? opt.textBn : opt.textEn}
                </p>
              </div>

              {isSelected && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {question.type === 'multi_mcq' && !hasAnswered && (
        <button
          onClick={handleMultiSubmit}
          disabled={multiSelected.length === 0}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-40"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>{lang === 'bn' ? 'উত্তর ট্রান্সমিট করুন' : 'Transmit Selected Responses'}</span>
        </button>
      )}
    </div>
  );
};
