import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useLanguage } from "@/lib/i18n";
import {
  serverJoinFinalExam,
  serverLookupFinalExamByPin,
  serverLookupFinalExamCandidate,
  serverStartFinalQuizAttempt,
  serverSubmitFinalQuizAttempt,
} from "@/lib/server-session";
import type { PracticalExam, PracticalTask, Question, Quiz } from "@/lib/types";
import {
  FINAL_PRACTICAL_MARKS,
  FINAL_QUIZ_MARKS,
  FINAL_TOTAL_MARKS,
} from "@/lib/practical-exam";
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  KeyRound,
  Loader2,
  Search,
  ShieldCheck,
  Timer,
  User,
} from "lucide-react";

export const Route = createFileRoute("/final-exam")({
  head: () => ({
    meta: [
      { title: "Final Exam Desk · Onnesha Arena" },
      {
        name: "description",
        content:
          "Join the timed Final Exam with a shared PIN. Overall quiz countdown (not per-question) plus capstone practical package.",
      },
    ],
  }),
  component: FinalExamPage,
});

type Phase = "pin" | "lobby" | "quiz" | "done";

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function FinalExamPage() {
  const { lang } = useLanguage();
  const [phase, setPhase] = useState<Phase>("pin");
  const [pin, setPin] = useState("");
  const [searchNumber, setSearchNumber] = useState("");
  const [matchedCandidate, setMatchedCandidate] = useState<{
    id: string;
    name: string;
    rollNumber: string;
    maskedPhone?: string | undefined;
    regionName?: string | undefined;
  } | null>(null);
  const [isSearchingNumber, setIsSearchingNumber] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exam, setExam] = useState<Partial<PracticalExam> | null>(null);
  const [course, setCourse] = useState<{
    id: string;
    code: string;
    titleEn: string;
    titleBn: string;
  } | null>(null);
  const [quizMeta, setQuizMeta] = useState<{
    id: string;
    titleEn: string;
    titleBn: string;
    questionCount: number;
  } | null>(null);
  const [student, setStudent] = useState<{
    name: string;
    rollNumber: string;
    phone?: string | undefined;
  } | null>(null);
  const [quizDone, setQuizDone] = useState(false);
  const [prior, setPrior] = useState<{
    accuracyPct?: number | undefined;
    quizMarks?: number | undefined;
    quizMaxMarks?: number | undefined;
  } | null>(null);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [activeQ, setActiveQ] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    accuracyPct: number;
    quizMarks: number;
    quizMaxMarks: number;
    correctCount: number;
    timedOut?: boolean | undefined;
  } | null>(null);

  useEffect(() => {
    if (phase !== "quiz" || !endsAt) return undefined;
    const id = window.setInterval(() => setNowTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [phase, endsAt]);

  const remainingMs = endsAt ? new Date(endsAt).getTime() - nowTick : 0;
  const timedOut = phase === "quiz" && !!endsAt && remainingMs <= 0;

  useEffect(() => {
    if (!timedOut || submitting || !attemptId) return;
    void submitQuiz(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOut]);

  const questions: Question[] = quiz?.questions || [];
  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id] || []).length > 0).length,
    [questions, answers],
  );

  useEffect(() => {
    if (!exam) {
      setMatchedCandidate(null);
      setLookupError(null);
      return undefined;
    }
    const clean = searchNumber.trim();
    if (!clean || clean.length < 2) {
      setMatchedCandidate(null);
      setLookupError(null);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      setIsSearchingNumber(true);
      setLookupError(null);
      try {
        const res = await serverLookupFinalExamCandidate({
          data: { pin: pin.trim(), query: clean },
        });
        if (res.success && res.candidate) {
          setMatchedCandidate(res.candidate);
          setLookupError(null);
        } else {
          setMatchedCandidate(null);
          setLookupError(
            res.success === false
              ? res.error || "No candidate found."
              : "No candidate found.",
          );
        }
      } catch {
        setMatchedCandidate(null);
        setLookupError(
          lang === "bn" ? "সার্ভারে পৌঁছানো যায়নি।" : "Unable to reach verification server.",
        );
      } finally {
        setIsSearchingNumber(false);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchNumber, pin, exam, lang]);

  const lookupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await serverLookupFinalExamByPin({ data: { pin: pin.trim() } });
      if (!res.success) {
        setError(res.error || "Invalid PIN");
        return;
      }
      setExam(res.exam);
      setCourse(res.course);
      setQuizMeta(res.quizMeta);
      setSearchNumber("");
      setMatchedCandidate(null);
      setLookupError(null);
    } finally {
      setLoading(false);
    }
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedCandidate && searchNumber.trim().length < 2) {
      setError(
        lang === "bn"
          ? "আপনার নিবন্ধিত মোবাইল নম্বর দিয়ে সার্চ করুন — নাম অটো দেখাবে।"
          : "Search your registered mobile number — your name will auto-fill.",
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await serverJoinFinalExam({
        data: {
          pin: pin.trim(),
          query: searchNumber.trim() || matchedCandidate?.rollNumber || "",
        },
      });
      if (!res.success) {
        setError(res.error || "Join failed");
        return;
      }
      setExam(res.exam);
      setQuizMeta(res.quizMeta);
      setStudent(res.student);
      setQuizDone(!!res.quizAlreadySubmitted);
      setPrior(res.priorAttempt);
      setPhase("lobby");
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await serverStartFinalQuizAttempt({
        data: {
          pin: pin.trim(),
          query: searchNumber.trim() || student?.rollNumber || matchedCandidate?.rollNumber || "",
          rollNumber: student?.rollNumber,
          phone: student?.phone,
        },
      });
      if (!res.success) {
        setError(res.error || "Could not start quiz");
        return;
      }
      setAttemptId(res.attempt.id);
      setEndsAt(res.attempt.endsAt);
      setQuiz(res.quiz);
      setAnswers({});
      setActiveQ(0);
      setPhase("quiz");
    } finally {
      setLoading(false);
    }
  };

  const submitQuiz = async (fromTimer = false) => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await serverSubmitFinalQuizAttempt({
        data: {
          attemptId,
          pin: pin.trim(),
          rollNumber: student?.rollNumber || matchedCandidate?.rollNumber || "",
          answers,
        },
      });
      if (!res.success) {
        setError(res.error || "Submit failed");
        return;
      }
      setResult({
        accuracyPct: res.accuracyPct,
        quizMarks: res.quizMarks,
        quizMaxMarks: res.quizMaxMarks,
        correctCount: res.correctCount,
        timedOut: fromTimer || res.timedOut,
      });
      setQuizDone(true);
      setPrior({
        accuracyPct: res.accuracyPct,
        quizMarks: res.quizMarks,
        quizMaxMarks: res.quizMaxMarks,
      });
      setPhase("done");
    } finally {
      setSubmitting(false);
    }
  };

  const selectOption = (q: Question, optionId: string) => {
    const multi = q.type === "multi_mcq";
    setAnswers((prev) => {
      const cur = prev[q.id] || [];
      if (!multi) return { ...prev, [q.id]: [optionId] };
      const next = cur.includes(optionId) ? cur.filter((id) => id !== optionId) : [...cur, optionId];
      return { ...prev, [q.id]: next };
    });
  };

  const tasks = (exam?.tasks || []) as PracticalTask[];
  const quizMax = exam?.quizMaxMarks || FINAL_QUIZ_MARKS;
  const practicalMax = exam?.practicalMaxMarks || FINAL_PRACTICAL_MARKS;
  const totalMax = exam?.totalMaxMarks || FINAL_TOTAL_MARKS;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.14),_transparent_55%),radial-gradient(ellipse_at_bottom_left,_rgba(245,158,11,0.1),_transparent_40%)]"
        />
        <div className="relative mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 pb-28">
          <div className="mb-8 space-y-2">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              {lang === "bn" ? "চূড়ান্ত পরীক্ষা ডেস্ক" : "Final Exam Desk"}
            </p>
            <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">
              {lang === "bn" ? "PIN → মোবাইল সার্চ → কুইজ" : "PIN → mobile search → quiz"}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {lang === "bn"
                ? `PIN যাচাই করুন, নিবন্ধিত মোবাইল দিয়ে নাম অটো-ফিল হবে (রোল জানা লাগবে না)। তারপর ${quizMax} নম্বরের MCQ (একটি মোট টাইমার) + ${practicalMax} নম্বরের ক্যাপস্টোন। মোট ${totalMax}।`
                : `Verify PIN, search your registered mobile (name auto-fills — no roll needed), then ${quizMax}-mark MCQ (one overall timer) + ${practicalMax}-mark capstone. Total ${totalMax}.`}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
              {error}
            </div>
          )}

          {phase === "pin" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <form onSubmit={exam ? join : lookupPin} className="staff-panel space-y-4">
                <div className="staff-panel-header !mb-2 !pb-2">
                  <div>
                    <h2 className="staff-panel-title">
                      {lang === "bn" ? "পরীক্ষায় প্রবেশ" : "Enter the exam"}
                    </h2>
                    <p className="staff-panel-desc">
                      {lang === "bn"
                        ? "ইনস্ট্রাক্টরের দেওয়া শেয়ার PIN ব্যবহার করুন।"
                        : "Use the shared PIN announced by your instructor."}
                    </p>
                  </div>
                </div>
                <label className="staff-field">
                  <span className="staff-label">{lang === "bn" ? "ফাইনাল PIN" : "Final Exam PIN"}</span>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      className="staff-input pl-10 font-mono tracking-[0.2em]"
                      placeholder="482910"
                      required
                      inputMode="numeric"
                    />
                  </div>
                </label>
                {exam && (
                  <>
                    <label className="staff-field">
                      <span className="staff-label">
                        {lang === "bn"
                          ? "মোবাইল নম্বর দিয়ে সার্চ (নাম অটো)"
                          : "Search mobile number (name auto-fills)"}
                      </span>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={searchNumber}
                          onChange={(e) => setSearchNumber(e.target.value)}
                          className="staff-input pl-10 font-mono"
                          placeholder="01XXXXXXXXX"
                          required
                          inputMode="tel"
                          autoComplete="tel"
                          autoFocus
                        />
                        {isSearchingNumber && (
                          <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                        {lang === "bn"
                          ? "কুইজের মতো — রোল জানতে হবে না। নিবন্ধিত মোবাইল লিখুন।"
                          : "Same as quiz join — you do not need your roll. Type your registered mobile."}
                      </span>
                    </label>

                    {matchedCandidate ? (
                      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 space-y-1">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {lang === "bn" ? "ম্যাচ হয়েছে" : "Matched on roster"}
                        </div>
                        <div className="flex items-center gap-2 text-base font-black">
                          <User className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                          {matchedCandidate.name}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {matchedCandidate.rollNumber}
                          {matchedCandidate.maskedPhone ? ` · ${matchedCandidate.maskedPhone}` : ""}
                          {matchedCandidate.regionName ? ` · ${matchedCandidate.regionName}` : ""}
                        </div>
                      </div>
                    ) : lookupError && searchNumber.trim().length >= 2 ? (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                        {lookupError}
                      </div>
                    ) : null}
                  </>
                )}
                <button
                  type="submit"
                  disabled={loading || (!!exam && !matchedCandidate)}
                  className="staff-btn-primary w-full py-3"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : exam ? (
                    lang === "bn" ? "লবিতে প্রবেশ" : "Enter lobby"
                  ) : (
                    lang === "bn" ? "PIN যাচাই" : "Verify PIN"
                  )}
                </button>
              </form>

              <div className="staff-panel space-y-4">
                <h2 className="staff-panel-title">{lang === "bn" ? "নম্বর বণ্টন" : "Mark distribution"}</h2>
                <div className="grid grid-cols-3 gap-3">
                  <div className="staff-metric">
                    <div className="staff-metric-label">Quiz</div>
                    <div className="staff-metric-value">{quizMax}</div>
                  </div>
                  <div className="staff-metric staff-metric-amber">
                    <div className="staff-metric-label">Practical</div>
                    <div className="staff-metric-value">{practicalMax}</div>
                  </div>
                  <div className="staff-metric staff-metric-emerald">
                    <div className="staff-metric-label">Total</div>
                    <div className="staff-metric-value">{totalMax}</div>
                  </div>
                </div>
                {exam && (
                  <div className="rounded-2xl border border-border bg-muted/30 p-4 text-xs space-y-2">
                    <div className="font-bold text-sm">{lang === "bn" ? exam.titleBn : exam.titleEn}</div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {lang === "bn" ? "কুইজ সময়" : "Quiz time"}:{" "}
                      <span className="font-mono font-bold text-foreground">
                        {exam.quizDurationMinutes || 10} min
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {exam.opensAt && (
                        <div>
                          {lang === "bn" ? "খোলে" : "Opens"}:{" "}
                          {new Date(exam.opensAt).toLocaleString()}
                        </div>
                      )}
                      {exam.closesAt && (
                        <div>
                          {lang === "bn" ? "বন্ধ" : "Closes"}:{" "}
                          {new Date(exam.closesAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                    {quizMeta && (
                      <div className="font-semibold">
                        {quizMeta.questionCount} Q · {lang === "bn" ? quizMeta.titleBn : quizMeta.titleEn}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {lang === "bn"
                    ? "প্রায়োগিক জমা পোর্টালেও করা যায় — কুইজ শেষে লিংক পাবেন।"
                    : "Practical uploads also work on /portal after the quiz."}
                </p>
              </div>
            </div>
          )}

          {phase === "lobby" && exam && student && (
            <div className="space-y-6">
              <div className="staff-panel flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {course?.code} · {student.rollNumber}
                  </div>
                  <h2 className="mt-1 text-xl font-black">{student.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {lang === "bn" ? exam.titleBn : exam.titleEn}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center">
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    PIN
                  </div>
                  <div className="font-mono text-2xl font-black tracking-widest">{exam.joinPin}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="staff-panel space-y-4">
                  <div className="flex items-center gap-2 font-bold">
                    <Timer className="h-4 w-4 text-primary" />
                    {lang === "bn" ? "অংশ ক — MCQ কুইজ" : "Part A — MCQ quiz"}
                    <span className="ml-auto font-mono text-xs">{quizMax} marks</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lang === "bn"
                      ? `একটি মোট কাউন্টডাউন (${exam.quizDurationMinutes || 10} মিনিট)। প্রশ্ন একসাথে দেখা যাবে — প্রশ্নপ্রতি টাইমার নেই।`
                      : `One overall countdown (${exam.quizDurationMinutes || 10} minutes). Browse all questions — no per-question timer.`}
                  </p>
                  {quizDone ? (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="mr-1 inline h-4 w-4" />
                      {lang === "bn" ? "জমা হয়েছে" : "Submitted"} · {prior?.quizMarks ?? "—"}/
                      {prior?.quizMaxMarks ?? quizMax} ({prior?.accuracyPct ?? "—"}%)
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startQuiz()}
                      disabled={loading}
                      className="staff-btn-primary w-full py-3"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {lang === "bn" ? "কুইজ শুরু করুন" : "Start Final Quiz"}
                    </button>
                  )}
                </div>

                <div className="staff-panel space-y-4">
                  <div className="flex items-center gap-2 font-bold">
                    <ClipboardList className="h-4 w-4 text-amber-600" />
                    {lang === "bn" ? "অংশ খ — ক্যাপস্টোন প্যাকেজ" : "Part B — Capstone package"}
                    <span className="ml-auto font-mono text-xs">{practicalMax} marks</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {tasks.map((t) => (
                      <li key={t.id} className="flex justify-between gap-2">
                        <span>{lang === "bn" ? t.titleBn : t.titleEn}</span>
                        <span className="font-mono font-bold text-foreground">{t.maxMarks}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/portal"
                    className="staff-btn-ghost w-full justify-center py-3"
                  >
                    {lang === "bn" ? "পোর্টালে প্রায়োগিক জমা →" : "Submit practical on Portal →"}
                  </Link>
                </div>
              </div>
            </div>
          )}

          {phase === "quiz" && quiz && (
            <div className="space-y-4">
              <div className="sticky top-0 z-20 -mx-5 border-b border-border bg-background/95 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-bold">
                    {lang === "bn" ? "ফাইনাল কুইজ" : "Final Quiz"} · {answeredCount}/
                    {questions.length}
                  </div>
                  <div
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-mono text-lg font-black ${
                      remainingMs < 60_000
                        ? "bg-destructive/15 text-destructive"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    <Timer className="h-4 w-4" />
                    {formatRemaining(remainingMs)}
                  </div>
                  <button
                    type="button"
                    onClick={() => void submitQuiz(false)}
                    disabled={submitting}
                    className="staff-btn-primary"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {lang === "bn" ? "কুইজ জমা দিন" : "Submit quiz"}
                  </button>
                </div>
                <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {questions.map((q, i) => {
                    const done = (answers[q.id] || []).length > 0;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setActiveQ(i)}
                        className={`h-8 w-8 shrink-0 rounded-lg text-[11px] font-bold ${
                          i === activeQ
                            ? "bg-primary text-primary-foreground"
                            : done
                              ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {questions[activeQ] && (
                <div className="staff-panel space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Q{activeQ + 1} · {questions[activeQ]!.category || "MCQ"}
                  </div>
                  <h2 className="text-lg font-black leading-snug">
                    {lang === "bn"
                      ? questions[activeQ]!.textBn || questions[activeQ]!.textEn
                      : questions[activeQ]!.textEn}
                  </h2>
                  <div className="space-y-2">
                    {(questions[activeQ]!.options || []).map((opt) => {
                      const selected = (answers[questions[activeQ]!.id] || []).includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => selectOption(questions[activeQ]!, opt.id)}
                          className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                            selected
                              ? "border-primary bg-primary/10"
                              : "border-border bg-card hover:border-primary/40"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border"
                            }`}
                          >
                            {selected ? "✓" : ""}
                          </span>
                          {lang === "bn" ? opt.textBn || opt.textEn : opt.textEn}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-between gap-2 pt-2">
                    <button
                      type="button"
                      disabled={activeQ === 0}
                      onClick={() => setActiveQ((v) => Math.max(0, v - 1))}
                      className="staff-btn-ghost"
                    >
                      {lang === "bn" ? "আগে" : "Prev"}
                    </button>
                    <button
                      type="button"
                      disabled={activeQ >= questions.length - 1}
                      onClick={() => setActiveQ((v) => Math.min(questions.length - 1, v + 1))}
                      className="staff-btn-ghost"
                    >
                      {lang === "bn" ? "পরে" : "Next"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {phase === "done" && result && (
            <div className="staff-panel space-y-5 max-w-xl">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
                <h2 className="text-xl font-black">
                  {result.timedOut
                    ? lang === "bn"
                      ? "সময় শেষ — অটো জমা"
                      : "Time up — auto-submitted"
                    : lang === "bn"
                      ? "কুইজ জমা হয়েছে"
                      : "Quiz submitted"}
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="staff-metric">
                  <div className="staff-metric-label">Marks</div>
                  <div className="staff-metric-value text-2xl">
                    {result.quizMarks}/{result.quizMaxMarks}
                  </div>
                </div>
                <div className="staff-metric staff-metric-emerald">
                  <div className="staff-metric-label">Accuracy</div>
                  <div className="staff-metric-value text-2xl">{result.accuracyPct}%</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {lang === "bn"
                  ? `সঠিক ${result.correctCount}টি। এখন ক্যাপস্টোন প্যাকেজ (${practicalMax} নম্বর) পোর্টালে জমা দিন।`
                  : `Correct ${result.correctCount}. Next: submit the capstone package (${practicalMax} marks) on the portal.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link to="/portal" className="staff-btn-primary">
                  {lang === "bn" ? "প্রায়োগিক পোর্টাল" : "Open practical portal"}
                </Link>
                <button type="button" onClick={() => setPhase("lobby")} className="staff-btn-ghost">
                  {lang === "bn" ? "লবিতে ফিরুন" : "Back to lobby"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
