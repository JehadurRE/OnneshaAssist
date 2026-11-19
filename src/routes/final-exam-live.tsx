import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import {
  serverCloseFinalExamWindow,
  serverGetFinalExamDesk,
  serverOpenFinalExamWindow,
  serverSavePracticalExam,
} from "@/lib/server-session";
import type { FinalExamAttempt, PracticalExam, Question } from "@/lib/types";
import { generateFinalExamJoinPin } from "@/lib/practical-exam";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  ClipboardList,
  Clock,
  Eye,
  EyeOff,
  Fullscreen,
  KeyRound,
  Loader2,
  Maximize2,
  MonitorPlay,
  RefreshCw,
  Square,
  Timer,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/final-exam-live")({
  head: () => ({
    meta: [
      { title: "Final Exam Live Host · Onnesha Arena" },
      {
        name: "description",
        content:
          "Admin live Final Exam host: PIN, join link, overall timer, screen-share question board, and live attempt monitor.",
      },
    ],
  }),
  component: FinalExamLiveHostPage,
});

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const OPTION_KEYS = ["A", "B", "C", "D", "E", "F"];

function FinalExamLiveHostPage() {
  const { lang } = useLanguage();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const isStaff = isAuthenticated && (user?.role === "admin" || user?.role === "instructor");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exam, setExam] = useState<PracticalExam | null>(null);
  const [course, setCourse] = useState<{
    id: string;
    code: string;
    titleEn: string;
    titleBn: string;
  } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizTitle, setQuizTitle] = useState("");
  const [attempts, setAttempts] = useState<FinalExamAttempt[]>([]);
  const [windowOpen, setWindowOpen] = useState(false);
  const [windowHours, setWindowHours] = useState(3);
  const [qIndex, setQIndex] = useState(0);
  const [revealAnswers, setRevealAnswers] = useState(false);
  const [projectorOnly, setProjectorOnly] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [copied, setCopied] = useState<string | null>(null);

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/final-exam`
      : "https://arena.onnesha.courses/final-exam";

  const refresh = async () => {
    const res = await serverGetFinalExamDesk({
      data: { courseId: "course-sanjibon-ai-dm" },
    });
    if (!res.success || !res.exam) {
      setNotice(res.success === false ? res.error : "Final exam not found.");
      setLoading(false);
      return;
    }
    setExam(res.exam as PracticalExam);
    setCourse(res.course);
    setAttempts((res.attempts as FinalExamAttempt[]) || []);
    setWindowOpen(!!res.windowOpen);
    const qs = (res.quiz?.questions || []) as Question[];
    setQuestions(qs);
    setQuizTitle(
      lang === "bn" ? res.quiz?.titleBn || res.quiz?.titleEn || "" : res.quiz?.titleEn || "",
    );
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading || !isStaff) return;
    void refresh();
  }, [authLoading, isStaff]);

  useEffect(() => {
    if (!isStaff) return undefined;
    const id = window.setInterval(() => {
      void refresh();
      setNowTick(Date.now());
    }, 4000);
    return () => window.clearInterval(id);
  }, [isStaff]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const windowRemainingMs = exam?.closesAt
    ? new Date(exam.closesAt).getTime() - nowTick
    : 0;

  const counts = useMemo(() => {
    const inProgress = attempts.filter((a) => a.status === "in_progress").length;
    const submitted = attempts.filter(
      (a) => a.status === "submitted" || a.status === "graded" || a.status === "expired",
    ).length;
    return { total: attempts.length, inProgress, submitted };
  }, [attempts]);

  const currentQ = questions[qIndex];

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setNotice(`Copy failed — select manually: ${text}`);
    }
  };

  const patchLocal = (patch: Partial<PracticalExam>) => {
    setExam((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const saveMeta = async () => {
    if (!exam) return;
    setBusy("save");
    try {
      const res = await serverSavePracticalExam({ data: { exam } });
      setNotice(res.success ? "Saved PIN & duration." : res.error || "Save failed");
      if (res.success && res.exam) setExam(res.exam as PracticalExam);
    } finally {
      setBusy(null);
    }
  };

  const openWindow = async () => {
    if (!exam) return;
    setBusy("open");
    try {
      const res = await serverOpenFinalExamWindow({
        data: {
          examId: exam.id,
          quizDurationMinutes: exam.quizDurationMinutes || 10,
          durationHours: windowHours || 3,
          regeneratePin: !exam.joinPin,
        },
      });
      setNotice(
        res.success
          ? `Live · PIN ${res.exam?.joinPin} · ${res.exam?.quizDurationMinutes}m quiz · closes ${res.exam?.closesAt ? new Date(res.exam.closesAt).toLocaleString() : "—"}`
          : res.error || "Open failed",
      );
      if (res.success && res.exam) {
        setExam(res.exam as PracticalExam);
        setWindowOpen(true);
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const closeWindow = async () => {
    if (!exam) return;
    if (!window.confirm("Close Final Exam window? Students cannot join after this.")) return;
    setBusy("close");
    try {
      const res = await serverCloseFinalExamWindow({ data: { examId: exam.id } });
      setNotice(res.success ? "Window closed." : res.error || "Close failed");
      if (res.success && res.exam) {
        setExam(res.exam as PracticalExam);
        setWindowOpen(false);
      }
    } finally {
      setBusy(null);
    }
  };

  const enterFullscreen = () => {
    const el = document.getElementById("final-exam-projector");
    if (el?.requestFullscreen) void el.requestFullscreen();
    setProjectorOnly(true);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Final Exam live host…
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <KeyRound className="h-8 w-8 text-muted-foreground" />
          <h1 className="text-xl font-black">Staff sign-in required</h1>
          <p className="text-sm text-muted-foreground">
            Open the Final Exam live host from Admin after signing in.
          </p>
          <Link to="/auth/login" className="staff-btn-primary">
            Sign in
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="mx-auto max-w-lg flex-1 p-6 text-center">
          <p className="text-sm text-muted-foreground">{notice || "No Final Exam configured."}</p>
          <Link to="/admin" className="mt-4 inline-flex staff-btn-primary">
            Back to Admin
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const projectorBoard = (
    <div
      id="final-exam-projector"
      className={`relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white shadow-2xl ${
        projectorOnly ? "min-h-screen rounded-none border-0" : "min-h-[420px]"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.18),_transparent_55%)]" />
      <div className="relative flex flex-col gap-4 p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300/90">
              {course?.code || "AI-DM"} · Final Exam
            </div>
            <h2 className="mt-1 font-display text-2xl font-black tracking-tight sm:text-3xl">
              {lang === "bn" ? exam.titleBn : exam.titleEn}
            </h2>
            <p className="mt-1 text-sm text-white/60">{quizTitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">PIN</div>
              <div className="font-mono text-3xl font-black tracking-[0.25em] text-emerald-300">
                {exam.joinPin || "————"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Quiz time
              </div>
              <div className="font-mono text-2xl font-black">
                {exam.quizDurationMinutes || 10}
                <span className="ml-1 text-sm font-bold text-white/50">min</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Window left
              </div>
              <div
                className={`font-mono text-2xl font-black ${
                  windowOpen && windowRemainingMs > 0 ? "text-amber-300" : "text-white/40"
                }`}
              >
                {windowOpen && windowRemainingMs > 0 ? formatRemaining(windowRemainingMs) : "CLOSED"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
            Join link
          </div>
          <div className="mt-1 break-all font-mono text-lg font-bold text-emerald-200 sm:text-xl">
            {joinUrl}
          </div>
          <div className="mt-1 text-xs text-white/50">
            PIN → Roll + Mobile → Start quiz · one overall countdown (not per-question)
          </div>
        </div>

        {currentQ ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold text-emerald-300">
                Question {qIndex + 1} / {questions.length}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                  disabled={qIndex <= 0}
                  onClick={() => setQIndex((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft className="inline h-3.5 w-3.5" /> Prev
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                  disabled={qIndex >= questions.length - 1}
                  onClick={() => setQIndex((i) => Math.min(questions.length - 1, i + 1))}
                >
                  Next <ChevronRight className="inline h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <h3 className="font-display text-xl font-black leading-snug sm:text-2xl lg:text-3xl">
              {lang === "bn" ? currentQ.textBn || currentQ.textEn : currentQ.textEn}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(currentQ.options || []).map((opt, idx) => {
                const showCorrect = revealAnswers && opt.isCorrect;
                return (
                  <div
                    key={opt.id}
                    className={`rounded-2xl border px-4 py-4 text-base font-semibold sm:text-lg ${
                      showCorrect
                        ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-50"
                        : "border-white/15 bg-white/5 text-white/90"
                    }`}
                  >
                    <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 font-mono text-sm font-black">
                      {OPTION_KEYS[idx] || idx + 1}
                    </span>
                    {lang === "bn" ? opt.textBn || opt.textEn : opt.textEn}
                    {showCorrect && (
                      <CheckCircle2 className="ml-2 inline h-4 w-4 text-emerald-300" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-white/50">No questions linked to this Final Exam.</div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs text-white/50">
          <span>
            Live attempts · {counts.inProgress} in progress · {counts.submitted} submitted ·{" "}
            {counts.total} total
          </span>
          {projectorOnly && (
            <button
              type="button"
              className="rounded-lg border border-white/20 px-2 py-1 font-bold text-white/80"
              onClick={() => {
                setProjectorOnly(false);
                if (document.fullscreenElement) void document.exitFullscreen();
              }}
            >
              Exit projector
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (projectorOnly) {
    return <div className="min-h-screen bg-black">{projectorBoard}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
              Admin live host
            </p>
            <h1 className="font-display text-3xl font-black tracking-tight">
              Final Exam Live Dashboard
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Share PIN + join link, customize overall quiz minutes, project questions for the room,
              and monitor who has joined — while candidates answer on their own devices.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin" className="staff-btn-ghost">
              Admin desk
            </Link>
            <Link to="/final-exam" className="staff-btn-ghost">
              Student join page
            </Link>
            <button type="button" className="staff-btn-ghost" onClick={() => void refresh()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <button type="button" className="staff-btn-primary" onClick={enterFullscreen}>
              <Fullscreen className="h-3.5 w-3.5" /> Projector / screen share
            </button>
          </div>
        </div>

        {notice && (
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">{notice}</div>
        )}

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <section className="staff-panel space-y-3">
              <div className="flex items-center gap-2 font-bold">
                <MonitorPlay className="h-4 w-4 text-primary" /> Controls
                {windowOpen ? (
                  <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                    Live
                  </span>
                ) : (
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                    {exam.status}
                  </span>
                )}
              </div>

              <label className="staff-field">
                <span className="staff-label">Shared PIN</span>
                <div className="flex gap-2">
                  <input
                    className="staff-input font-mono tracking-[0.2em]"
                    value={exam.joinPin || ""}
                    onChange={(e) =>
                      patchLocal({ joinPin: e.target.value.replace(/\D/g, "").slice(0, 8) })
                    }
                  />
                  <button
                    type="button"
                    className="staff-btn-ghost shrink-0"
                    onClick={() => patchLocal({ joinPin: generateFinalExamJoinPin() })}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>
                </div>
              </label>

              <label className="staff-field">
                <span className="staff-label">Quiz duration (overall minutes)</span>
                <input
                  type="number"
                  min={1}
                  max={180}
                  className="staff-input font-mono"
                  value={exam.quizDurationMinutes ?? 10}
                  onChange={(e) =>
                    patchLocal({
                      quizDurationMinutes: Math.max(1, Number(e.target.value) || 10),
                    })
                  }
                />
              </label>

              <label className="staff-field">
                <span className="staff-label">Keep window open (hours)</span>
                <input
                  type="number"
                  min={0.5}
                  max={72}
                  step={0.5}
                  className="staff-input font-mono"
                  value={windowHours}
                  onChange={(e) => setWindowHours(Math.max(0.5, Number(e.target.value) || 3))}
                />
              </label>

              <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-2">
                <div className="font-semibold">Join link</div>
                <div className="break-all font-mono text-[11px]">{joinUrl}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="staff-btn-ghost !py-1.5 !px-2 text-[10px]"
                    onClick={() => void copyText("link", joinUrl)}
                  >
                    <ClipboardCopy className="h-3 w-3" />
                    {copied === "link" ? "Copied" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    className="staff-btn-ghost !py-1.5 !px-2 text-[10px]"
                    onClick={() => void copyText("pin", exam.joinPin || "")}
                    disabled={!exam.joinPin}
                  >
                    <KeyRound className="h-3 w-3" />
                    {copied === "pin" ? "Copied" : "Copy PIN"}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy === "open"}
                  onClick={() => void openWindow()}
                  className="staff-btn-primary flex-1"
                >
                  {busy === "open" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Timer className="h-3.5 w-3.5" />
                  )}
                  {exam.status === "open" ? "Re-open / extend" : "Open Final Exam"}
                </button>
                <button
                  type="button"
                  disabled={busy === "close" || exam.status === "closed"}
                  onClick={() => void closeWindow()}
                  className="inline-flex items-center gap-1 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive"
                >
                  <Square className="h-3.5 w-3.5" /> Close
                </button>
              </div>
              <button
                type="button"
                disabled={busy === "save"}
                onClick={() => void saveMeta()}
                className="staff-btn-ghost w-full"
              >
                {busy === "save" ? "Saving…" : "Save PIN & duration"}
              </button>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="staff-metric">
                  <div className="staff-metric-label flex items-center gap-1">
                    <Users className="h-3 w-3" /> Total
                  </div>
                  <div className="staff-metric-value text-lg">{counts.total}</div>
                </div>
                <div className="staff-metric staff-metric-amber">
                  <div className="staff-metric-label">Live</div>
                  <div className="staff-metric-value text-lg">{counts.inProgress}</div>
                </div>
                <div className="staff-metric staff-metric-emerald">
                  <div className="staff-metric-label">Done</div>
                  <div className="staff-metric-value text-lg">{counts.submitted}</div>
                </div>
              </div>
            </section>

            <section className="staff-panel space-y-2">
              <div className="flex items-center justify-between gap-2 font-bold text-sm">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Question board
                </span>
                <button
                  type="button"
                  className="staff-btn-ghost !py-1 !px-2 text-[10px]"
                  onClick={() => setRevealAnswers((v) => !v)}
                >
                  {revealAnswers ? (
                    <>
                      <EyeOff className="h-3 w-3" /> Hide answers
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" /> Reveal answers
                    </>
                  )}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {questions.map((q, i) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setQIndex(i)}
                    className={`h-8 w-8 rounded-lg text-[11px] font-bold ${
                      i === qIndex
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card hover:bg-accent"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button type="button" className="staff-btn-ghost w-full" onClick={enterFullscreen}>
                <Maximize2 className="h-3.5 w-3.5" /> Fullscreen projector
              </button>
            </section>
          </aside>

          <div className="space-y-4">
            {projectorBoard}

            <section className="staff-panel space-y-3">
              <div className="flex items-center gap-2 font-bold">
                <ClipboardList className="h-4 w-4 text-amber-600" /> Part B — Capstone / practical
                <span className="ml-auto font-mono text-xs">
                  {(exam.tasks || []).reduce((s, t) => s + (t.maxMarks || 0), 0) || 40} marks
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Screen-share this checklist with the room. Students submit on{" "}
                <Link to="/portal" className="font-bold text-primary underline">
                  /portal
                </Link>{" "}
                after the MCQ (closing quiz join does <strong>not</strong> close practical).
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {(exam.tasks || []).map((t, i) => (
                  <li
                    key={t.id}
                    className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs"
                  >
                    <div className="flex justify-between gap-2 font-bold">
                      <span>
                        {i + 1}. {lang === "bn" ? t.titleBn : t.titleEn}
                      </span>
                      <span className="font-mono">{t.maxMarks}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground line-clamp-2">
                      {lang === "bn" ? t.promptBn : t.promptEn}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="staff-panel space-y-3">
              <div className="flex items-center gap-2 font-bold">
                <Users className="h-4 w-4 text-primary" /> Live attempt monitor
                <span className="ml-auto text-[10px] font-semibold text-muted-foreground">
                  auto-refresh ~4s
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-bold">Roll</th>
                      <th className="px-3 py-2 font-bold">Name</th>
                      <th className="px-3 py-2 font-bold">Status</th>
                      <th className="px-3 py-2 font-bold">Score</th>
                      <th className="px-3 py-2 font-bold">Personal timer ends</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                          Waiting for students… Open the window, share PIN + {joinUrl}
                        </td>
                      </tr>
                    ) : (
                      attempts.map((a) => {
                        const endsMs = a.endsAt ? new Date(a.endsAt).getTime() - nowTick : 0;
                        return (
                          <tr key={a.id} className="border-b border-border/60 last:border-0">
                            <td className="px-3 py-2 font-mono font-bold">{a.rollNumber}</td>
                            <td className="px-3 py-2 font-semibold">{a.studentName}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  a.status === "in_progress"
                                    ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                                    : a.status === "submitted" || a.status === "graded"
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                      : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {a.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono">
                              {typeof a.quizMarks === "number"
                                ? `${a.quizMarks}/${a.quizMaxMarks ?? "—"}`
                                : "—"}
                            </td>
                            <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                              {a.status === "in_progress" && endsMs > 0
                                ? formatRemaining(endsMs)
                                : a.submittedAt
                                  ? new Date(a.submittedAt).toLocaleString()
                                  : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
