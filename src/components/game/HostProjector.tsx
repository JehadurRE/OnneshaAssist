import React, { useEffect, useState } from 'react';
import { GameSession, Question } from '@/lib/types';
import { useLanguage } from '@/lib/i18n';
import { CheckCircle2, Eye, FastForward, Pause, Play, ShieldAlert, Users, X } from 'lucide-react';
import { audioEngine } from '@/lib/audio-engine';

interface HostProjectorProps {
  session: GameSession;
  question: Question;
  onSkipTimer: () => void;
  onPardonPlayer?: (participantId: string) => void;
}

const RESPONSE_STYLES = [
  { key: 'A / 1', bnKey: 'ক / ১', border: 'border-cyan-500/30 bg-cyan-500/5', badge: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/40' },
  { key: 'B / 2', bnKey: 'খ / ২', border: 'border-emerald-500/30 bg-emerald-500/5', badge: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40' },
  { key: 'C / 3', bnKey: 'গ / ৩', border: 'border-amber-500/30 bg-amber-500/5', badge: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40' },
  { key: 'D / 4', bnKey: 'ঘ / ৪', border: 'border-sky-500/30 bg-sky-500/5', badge: 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/40' },
];

export const HostProjector: React.FC<HostProjectorProps> = ({
  session,
  question,
  onSkipTimer,
  onPardonPlayer,
}) => {
  const { lang, t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState(question.timeLimitSec);
  const [isPaused, setIsPaused] = useState(false);
  const [showProctorModal, setShowProctorModal] = useState(false);

  const participants = Object.values(session.participants);
  const totalPlayers = participants.length;
  const answeredCount =
    session.answeredCount ?? participants.filter((p) => p.answers[question.id]).length;

  const flaggedParticipants = participants.filter((p) => (p.proctorFlags || 0) > 0 || p.isSuspended);
  const suspendedParticipants = participants.filter((p) => p.isSuspended);
  const focusedPct =
    totalPlayers > 0
      ? Math.max(0, Math.round(((totalPlayers - flaggedParticipants.length) / totalPlayers) * 100))
      : 100;
  const incidents = session.proctorIncidents || [];

  useEffect(() => {
    setTimeLeft(question.timeLimitSec);
  }, [question.id]);

  // Auto-advance to response chart 1.2s after 100% of connected examinees have submitted their answers
  useEffect(() => {
    if (isPaused || totalPlayers === 0) return;
    if (answeredCount >= totalPlayers) {
      const autoTimer = setTimeout(() => {
        onSkipTimer();
      }, 1200);
      return () => clearTimeout(autoTimer);
    }
    return undefined;
  }, [answeredCount, totalPlayers, isPaused, onSkipTimer]);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onSkipTimer();
          return 0;
        }
        if (prev <= 5) {
          audioEngine.playUrgentTick();
        } else {
          audioEngine.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, onSkipTimer]);

  const pct = (timeLeft / question.timeLimitSec) * 100;
  const isUrgent = timeLeft <= 5;
  const answeredPct = totalPlayers > 0 ? Math.round((answeredCount / totalPlayers) * 100) : 0;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Telemetry & Focus Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-4 px-6 shadow-tactical">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-primary/15 border border-primary/30 px-3.5 py-1.5 font-mono text-xs font-black text-primary uppercase tracking-wider">
            {t('question')} {session.currentQuestionIndex + 1} / {session.totalQuestions}
          </span>
          <span className="text-xs font-semibold text-muted-foreground hidden md:inline">
            {question.category || 'National Assessment Standard'} · {question.points} Max Marks
          </span>
        </div>

        {/* Live Proctor Pulse & Answer Counter */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowProctorModal(true)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              suspendedParticipants.length > 0
                ? 'bg-destructive/15 border-destructive/40 text-destructive animate-pulse'
                : flaggedParticipants.length > 0
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {flaggedParticipants.length > 0 ? (
              <ShieldAlert className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            <span>
              Proctor: {focusedPct}% Focused
              {incidents.length > 0 ? ` (${incidents.length} Alerts)` : ''}
            </span>
          </button>

          <div className="flex items-center gap-2 rounded-xl bg-background border border-border px-3 py-1.5 font-mono text-xs font-bold text-foreground">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span>
              {answeredCount}/{totalPlayers} ({answeredPct}%)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background hover:bg-accent text-foreground"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onSkipTimer}
            className="flex items-center gap-1.5 rounded-xl bg-secondary px-3.5 py-1.5 text-xs font-bold text-secondary-foreground hover:opacity-90"
          >
            <FastForward className="h-3.5 w-3.5" />
            <span>{t('skip_timer')}</span>
          </button>
        </div>
      </div>

      {/* Main Question Display Box */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-border bg-card p-6 sm:p-10 text-center shadow-tactical">
        {/* Countdown Ring */}
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border-4 border-border bg-background shadow-inner relative">
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" className="stroke-muted" strokeWidth="8" fill="transparent" />
            <circle
              cx="50"
              cy="50"
              r="44"
              className={`transition-all duration-1000 ease-linear ${
                isUrgent ? 'stroke-destructive' : 'stroke-primary'
              }`}
              strokeWidth="8"
              strokeDasharray={276}
              strokeDashoffset={276 - (276 * pct) / 100}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <span
            className={`font-mono text-3xl font-black tabular-nums ${
              isUrgent ? 'text-destructive animate-pulse' : 'text-foreground'
            }`}
          >
            {timeLeft}s
          </span>
        </div>

        {/* Question Text */}
        <h1 className="font-display text-2xl sm:text-4xl font-extrabold leading-snug tracking-tight text-foreground max-w-4xl mx-auto">
          {lang === 'bn' ? question.textBn : question.textEn}
        </h1>

        {question.imageUrl && (
          <div className="mt-6 flex justify-center">
            <img
              src={question.imageUrl}
              alt="Question illustration"
              className="max-h-64 rounded-2xl border border-border object-contain shadow-md"
            />
          </div>
        )}

        {/* Live Velocity Bar */}
        <div className="mt-8 mx-auto max-w-md">
          <div className="flex justify-between text-[11px] font-mono text-muted-foreground mb-1">
            <span>Answer Telemetry</span>
            <span>
              {answeredCount} of {totalPlayers} received
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
              style={{ width: `${answeredPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Option Bento Grid or Written Response Prompt */}
      {question.type === 'written' || question.type === 'fill_blank' ? (
        <div className="rounded-3xl border-2 border-dashed border-primary/40 bg-primary/5 p-8 text-center space-y-2">
          <div className="font-mono text-xs font-black uppercase tracking-widest text-primary">
            ✍️ Written / Short Response Question
          </div>
          <p className="text-sm sm:text-base font-bold text-foreground">
            {lang === 'bn'
              ? 'পরীক্ষার্থীরা তাদের মোবাইলে সরাসরি সঠিক উত্তর টাইপ করে সাবমিট করছে।'
              : 'Candidates are typing their exact response directly on their mobile examination terminals.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {question.type === 'multi_mcq' && (
            <div className="text-center font-mono text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
              ☑️ Multi-Select Question — Candidates must select ALL correct options
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {question.options.map((opt, idx) => {
              const style = RESPONSE_STYLES[idx % RESPONSE_STYLES.length]!;
              return (
                <div
                  key={opt.id}
                  className={`flex min-h-[84px] items-center gap-4 rounded-3xl border-2 p-5 font-display shadow-sm transition-all ${style.border}`}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border font-mono text-xs font-black shadow-sm ${style.badge}`}
                  >
                    {lang === 'bn' ? style.bnKey : style.key}
                  </div>
                  <div className="min-w-0 flex-1 text-base sm:text-lg font-bold leading-snug text-foreground">
                    {lang === 'bn' ? opt.textBn : opt.textEn}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Proctor Incident & Seat Suspension Drawer Modal */}
      {showProctorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-primary" />
                <h3 className="font-display text-lg font-bold text-foreground">
                  Live Proctor Pulse &amp; Seat Suspension Control
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProctorModal(false)}
                className="rounded-xl p-1.5 hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {flaggedParticipants.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase text-muted-foreground">
                  Flagged / Suspended Candidates ({flaggedParticipants.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                  {flaggedParticipants.map((fp) => (
                    <div
                      key={fp.id}
                      className="flex items-center justify-between rounded-2xl border border-border bg-background p-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-foreground">
                          {fp.nickname} ({fp.rollNumber || 'N/A'})
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {fp.regionName || 'Dhaka Range'} · {fp.proctorFlags || 0} tab switches
                        </div>
                      </div>
                      {fp.isSuspended ? (
                        <button
                          type="button"
                          onClick={() => onPardonPlayer && onPardonPlayer(fp.id)}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                        >
                          Pardon &amp; Resume
                        </button>
                      ) : (
                        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-600">
                          WARNED
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs font-bold uppercase text-muted-foreground">
                Real-Time Incident Feed ({incidents.length})
              </div>
              {incidents.length === 0 ? (
                <div className="rounded-2xl border border-border bg-background p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  <span>Zero focus violations detected across {totalPlayers} examinees.</span>
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-2xl border border-border bg-background divide-y divide-border/60 text-xs">
                  {incidents.map((inc) => (
                    <div key={inc.id} className="flex items-center justify-between p-3">
                      <div>
                        <span className="font-bold text-foreground">{inc.candidateName}</span>{' '}
                        {inc.rollNumber && (
                          <span className="font-mono text-muted-foreground">({inc.rollNumber})</span>
                        )}
                        {inc.regionName && (
                          <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            {inc.regionName}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-destructive">
                        {inc.type.replace('_', ' ').toUpperCase()} ·{' '}
                        {new Date(inc.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
