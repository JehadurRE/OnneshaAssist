import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CertificateView } from "@/components/common/CertificateView";
import { useLanguage } from "@/lib/i18n";
import {
  serverAskCourseTutor,
  serverClearStudentPortal,
  serverGetPortalAuthConfig,
  serverGetStudentPortal,
  serverRequestPortalOtp,
  serverSubmitPracticalWork,
  serverVerifyPortalOtp,
} from "@/lib/server-session";
import type {
  CertificateData,
  CourseMaterial,
  CourseRecording,
  PracticalExam,
  PracticalSubmission,
  PracticalTask,
} from "@/lib/types";
import { isPracticalPastDeadline, isPracticalWindowOpen } from "@/lib/practical-exam";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Film,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
} from "lucide-react";

function localizeMissing(code: string, lang: string): string {
  const mapBn: Record<string, string> = {
    final_quiz_result: "চূড়ান্ত কুইজ ফলাফল নেই",
    final_quiz_pass: "চূড়ান্ত কুইজ পাস হয়নি",
    practical_submission: "প্রায়োগিক জমা নেই",
    practical_grading: "প্রায়োগিক মার্কিং বাকি",
    practical_pass: "প্রায়োগিক পাস হয়নি",
    combined_pass: "সম্মিলিত স্কোর পাস থ্রেশহোল্ডের নিচে",
  };
  const mapEn: Record<string, string> = {
    final_quiz_result: "Final quiz result missing",
    final_quiz_pass: "Final quiz not passed",
    practical_submission: "Practical not submitted",
    practical_grading: "Practical not graded yet",
    practical_pass: "Practical not passed",
    combined_pass: "Combined score below pass threshold",
  };
  return (lang === "bn" ? mapBn : mapEn)[code] || code;
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "open" || status === "graded"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "late" || status === "returned" || status === "scheduled"
        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}
    >
      {status}
    </span>
  );
}

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Student Portal · Onnesha Arena" },
      {
        name: "description",
        content:
          "Candidate portal for course progress, final practical submission, and course completion certificates.",
      },
    ],
  }),
  component: StudentPortalPage,
});

type PortalPayload = Awaited<ReturnType<typeof serverGetStudentPortal>>;

type TaskDraft = {
  textAnswer: string;
  linkUrl: string;
  fileName?: string | undefined;
  fileMime?: string | undefined;
  fileBase64?: string | undefined;
};

function StudentPortalPage() {
  const { lang } = useLanguage();
  const [authChannel, setAuthChannel] = useState<"email" | "mobile">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [rollNumber, setRollNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portal, setPortal] = useState<PortalPayload | null>(null);
  const [portalTab, setPortalTab] = useState<
    "overview" | "materials" | "recordings" | "tutor" | "practical" | "certificate"
  >("overview");
  const [tutorQ, setTutorQ] = useState("");
  const [tutorA, setTutorA] = useState<string | null>(null);
  const [tutorBusy, setTutorBusy] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, TaskDraft>>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"ok" | "err">("ok");

  const practicalExam = portal?.practicalExam as PracticalExam | undefined | null;

  const hydrateDrafts = (exam: PracticalExam | null | undefined, sub?: PracticalSubmission | null) => {
    if (!exam) {
      setDrafts({});
      return;
    }
    const next: Record<string, TaskDraft> = {};
    for (const task of exam.tasks) {
      const ans = sub?.answers?.find((a) => a.taskId === task.id);
      next[task.id] = {
        textAnswer: ans?.textAnswer || "",
        linkUrl: ans?.linkUrl || "",
        fileName: ans?.fileName,
        fileMime: ans?.fileMime,
      };
    }
    setDrafts(next);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await serverGetPortalAuthConfig();
        if (!cancelled && cfg.success) setAuthChannel(cfg.channel);
      } catch {
        // default email
      }
      if (cancelled) return;
      try {
        const res = await serverGetStudentPortal({ data: {} });
        if (!cancelled && res.success) {
          setPortal(res);
          setPhone(res.student?.phone || "");
          setRollNumber(res.student?.rollNumber || "");
          hydrateDrafts(
            res.practicalExam as PracticalExam | undefined,
            res.submission as PracticalSubmission | undefined,
          );
        }
      } catch {
        // not signed in yet
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPortalAfterAuth = async () => {
    const res = await serverGetStudentPortal({ data: {} });
    if (!res.success) {
      setPortal(null);
      setError(res.error || "Could not open portal.");
      return false;
    }
    setPortal(res);
    setPhone(res.student?.phone || phone);
    setRollNumber(res.student?.rollNumber || rollNumber);
    hydrateDrafts(
      res.practicalExam as PracticalExam | undefined,
      res.submission as PracticalSubmission | undefined,
    );
    setPortalTab("overview");
    return true;
  };

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    setDevOtpHint(null);
    try {
      const res = await serverRequestPortalOtp({
        data:
          authChannel === "email"
            ? { email: email.trim() }
            : { phone: phone.trim() },
      });
      if (!res.success) {
        setError(res.error || "Could not send OTP.");
        setOtpSent(false);
        return;
      }
      setOtpSent(true);
      setOtp("");
      if ("devOtp" in res && res.devOtp) setDevOtpHint(String(res.devOtp));
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP request failed.");
      setOtpSent(false);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await serverVerifyPortalOtp({
        data:
          authChannel === "email"
            ? { email: email.trim(), otp: otp.trim() }
            : { phone: phone.trim(), otp: otp.trim() },
      });
      if (!res.success) {
        setError(res.error || "Invalid OTP.");
        return;
      }
      if (res.student?.phone) setPhone(res.student.phone);
      if (res.student?.rollNumber) setRollNumber(res.student.rollNumber);
      if (res.student?.email) setEmail(res.student.email);
      await loadPortalAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const askTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portal?.success || !portal.course?.id) return;
    setTutorBusy(true);
    setTutorA(null);
    try {
      const res = await serverAskCourseTutor({
        data: {
          courseId: portal.course.id,
          question: tutorQ,
          rollNumber: portal.student?.rollNumber,
          lang: lang === "bn" ? "bn" : "en",
        },
      });
      setTutorA(res.success ? res.answer : res.error || "Tutor unavailable.");
    } catch (err) {
      setTutorA(err instanceof Error ? err.message : "Tutor failed.");
    } finally {
      setTutorBusy(false);
    }
  };

  const onFile = async (task: PracticalTask, file: File | null) => {
    if (!file) {
      setDrafts((d) => ({
        ...d,
        [task.id]: {
          ...(d[task.id] || { textAnswer: "", linkUrl: "" }),
          fileName: undefined,
          fileMime: undefined,
          fileBase64: undefined,
        },
      }));
      return;
    }
    const max = practicalExam?.maxFileBytes || 10 * 1024 * 1024;
    if (file.size > max) {
      setNoticeTone("err");
      setNotice(
        lang === "bn"
          ? `ফাইল খুব বড়। সর্বোচ্চ ${Math.round(max / (1024 * 1024))} MB।`
          : `File too large. Max ${Math.round(max / (1024 * 1024))} MB.`,
      );
      return;
    }
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
    setDrafts((d) => ({
      ...d,
      [task.id]: {
        ...(d[task.id] || { textAnswer: "", linkUrl: "" }),
        fileName: file.name,
        fileMime: file.type || "application/octet-stream",
        fileBase64: btoa(binary),
      },
    }));
  };

  const submitPractical = async () => {
    if (!portal?.success || !practicalExam) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await serverSubmitPracticalWork({
        data: {
          practicalExamId: practicalExam.id,
          rollNumber: portal.student!.rollNumber,
          phone: portal.student!.phone || phone,
          answers: practicalExam.tasks.map((task) => {
            const d = drafts[task.id] || { textAnswer: "", linkUrl: "" };
            return {
              taskId: task.id,
              textAnswer: d.textAnswer,
              linkUrl: d.linkUrl,
              ...(d.fileName ? { fileName: d.fileName } : {}),
              ...(d.fileMime ? { fileMime: d.fileMime } : {}),
              ...(d.fileBase64 ? { fileBase64: d.fileBase64 } : {}),
            };
          }),
        },
      });
      if (!res.success) {
        setNoticeTone("err");
        setNotice(res.error || "Submission failed.");
        return;
      }
      setNoticeTone("ok");
      setNotice(lang === "bn" ? "প্রায়োগিক জমা সফল হয়েছে।" : "Practical submission saved.");
      const refreshed = await serverGetStudentPortal({
        data: { rollNumber: portal.student!.rollNumber, phone: portal.student!.phone || phone },
      });
      if (refreshed.success) {
        setPortal(refreshed);
        hydrateDrafts(
          refreshed.practicalExam as PracticalExam | undefined,
          refreshed.submission as PracticalSubmission | undefined,
        );
      }
    } catch (err) {
      setNoticeTone("err");
      setNotice(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const signOutPortal = async () => {
    try {
      await serverClearStudentPortal();
    } catch {
      // ignore
    }
    setPortal(null);
    setDrafts({});
    setNotice(null);
    setError(null);
  };

  const completion = portal?.success ? portal.completion : null;
  const gradedLocked = portal?.submission?.status === "graded";
  const returnedForResubmit = portal?.submission?.status === "returned";
  const windowOpen = practicalExam ? isPracticalWindowOpen(practicalExam) : false;
  const notOpenYet =
    !!practicalExam?.opensAt && new Date().toISOString() < practicalExam.opensAt;
  const canSubmit =
    !!practicalExam &&
    !gradedLocked &&
    (windowOpen || returnedForResubmit);
  const pastDeadline = practicalExam ? isPracticalPastDeadline(practicalExam) : false;

  const progressSummary = useMemo(() => {
    if (!portal?.success) return null;
    const done = (portal.quizProgress || []).filter((q) => q.passed).length;
    const total = (portal.quizProgress || []).length;
    return { done, total };
  }, [portal]);

  if (!portal?.success) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <main className="relative flex-1 overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(245,158,11,0.12),_transparent_45%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:28px_28px] dark:opacity-[0.2] dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)]"
          />

          <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl flex-col justify-center gap-10 px-5 py-12 sm:px-8 lg:flex-row lg:items-center lg:gap-16">
            <div className="flex-1 space-y-6 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                {lang === "bn" ? "শিক্ষার্থী পোর্টাল" : "Student Portal"}
              </div>
              <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl lg:text-[3.25rem] leading-[1.08]">
                {lang === "bn" ? (
                  <>
                    OTP দিয়ে
                    <span className="block text-emerald-600 dark:text-emerald-400">লার্নিং পোর্টাল</span>
                  </>
                ) : (
                  <>
                    Your learning
                    <span className="block text-emerald-600 dark:text-emerald-400">&amp; exam portal</span>
                  </>
                )}
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-md">
                {lang === "bn"
                  ? "ইমেইল OTP দিয়ে সাইন ইন করুন (অ্যাডমিন মোবাইল চালু করতে পারে)। ম্যাটেরিয়াল, AI টিউটর ও পরীক্ষা এক জায়গায়।"
                  : "Sign in with email OTP (admin can switch to mobile). Materials, AI tutor, and exams in one place."}
              </p>
              <ul className="grid gap-3 sm:grid-cols-3 text-xs font-semibold text-muted-foreground">
                {[
                  lang === "bn" ? "ম্যাটেরিয়াল + AI" : "Materials + AI",
                  lang === "bn" ? "প্রায়োগিক জমা" : "Practical submit",
                  lang === "bn" ? "কোর্স সনদ" : "Course certificate",
                ].map((label) => (
                  <li
                    key={label}
                    className="flex items-center gap-2 rounded-2xl border border-border/80 bg-card/70 px-3 py-2.5 backdrop-blur"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            <form
              onSubmit={otpSent ? verifyOtp : requestOtp}
              className="w-full max-w-md shrink-0 rounded-[1.75rem] border border-emerald-500/25 bg-card/95 p-6 sm:p-8 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.55)] backdrop-blur space-y-5"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-black">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    <Lock className="h-4 w-4" />
                  </span>
                  {lang === "bn" ? "OTP লগইন" : "OTP sign-in"}
                </div>
                <p className="text-xs text-muted-foreground pl-11">
                  {authChannel === "email"
                    ? lang === "bn"
                      ? "রোস্টারে থাকা ইমেইলে OTP যাবে — কোড দিয়ে পোর্টাল খুলুন।"
                      : "OTP goes to your roster email — enter the code to open the portal."
                    : lang === "bn"
                      ? "রোস্টারে থাকা মোবাইলে SMS OTP যাবে।"
                      : "SMS OTP goes to your roster mobile number."}
                </p>
              </div>

              {authChannel === "email" ? (
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    {lang === "bn" ? "ইমেইল" : "Email"}
                  </span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setOtpSent(false);
                        setDevOtpHint(null);
                      }}
                      className="w-full rounded-2xl border border-border bg-background py-3.5 pl-10 pr-4 text-sm font-semibold outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-4"
                      placeholder="you@example.com"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      required
                      disabled={otpSent && loading}
                    />
                  </div>
                </label>
              ) : (
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    {lang === "bn" ? "মোবাইল" : "Mobile"}
                  </span>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setOtpSent(false);
                        setDevOtpHint(null);
                      }}
                      className="w-full rounded-2xl border border-border bg-background py-3.5 pl-10 pr-4 text-sm font-semibold outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-4 font-mono"
                      placeholder="01XXXXXXXXX"
                      inputMode="tel"
                      autoComplete="tel"
                      autoFocus
                      required
                    />
                  </div>
                </label>
              )}

              {otpSent && (
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    OTP
                  </span>
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    className="w-full rounded-2xl border border-border bg-background py-3.5 px-4 text-center text-lg font-mono font-black tracking-[0.35em] outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-4"
                    placeholder="••••••"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                  />
                  {devOtpHint && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
                      Dev OTP: {devOtpHint}
                    </p>
                  )}
                </label>
              )}

              {error && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 disabled:opacity-60 transition"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {otpSent
                  ? lang === "bn"
                    ? "OTP দিয়ে লগইন"
                    : "Verify & open portal"
                  : lang === "bn"
                    ? "OTP পাঠান"
                    : "Send OTP"}
              </button>

              {otpSent && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setOtpSent(false);
                    setOtp("");
                    setDevOtpHint(null);
                    setError(null);
                  }}
                  className="w-full text-center text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  {lang === "bn" ? "ইমেইল / নম্বর বদলান" : "Change email / number"}
                </button>
              )}

              <p className="text-center text-[11px] text-muted-foreground">
                {lang === "bn"
                  ? "ইমেইল রোস্টারে না থাকলে অ্যাডমিনকে বলুন যোগ করতে।"
                  : "If your email is not on the roster, ask admin to add it."}
              </p>
            </form>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 pb-28 md:pb-14">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
            {lang === "bn" ? "শিক্ষার্থী পোর্টাল" : "Student Portal"}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            {lang === "bn" ? "কোর্স অগ্রগতি ও চূড়ান্ত জমা" : "Course progress & final submission"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            {lang === "bn"
              ? "কুইজ অগ্রগতি দেখুন, প্রায়োগিক জমা দিন, এবং কোর্স সমাপনী সনদপত্র যাচাই করুন।"
              : "Track quiz progress, submit the Final Practical, and view your course-completion certificate."}
          </p>
        </div>

          <div className="space-y-8">
            <section className="staff-panel">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{portal.student?.name}</h2>
                  <p className="text-sm text-muted-foreground font-mono">
                    {portal.student?.rollNumber} · {portal.student?.regionName || "—"}
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {portal.course?.code} — {lang === "bn" ? portal.course?.titleBn : portal.course?.titleEn}
                  </p>
                  <button
                    type="button"
                    onClick={() => void signOutPortal()}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {lang === "bn" ? "সাইন আউট / অন্য শিক্ষার্থী" : "Sign out / switch student"}
                  </button>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
                  <div className="font-bold text-emerald-700 dark:text-emerald-300">
                    {lang === "bn" ? "সম্মিলিত অগ্রগতি" : "Combined progress"}
                  </div>
                  <div className="mt-1 font-mono text-lg font-black">
                    {completion?.combinedPct ?? 0}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Quiz {completion?.quizAccuracyPct ?? 0}% · Practical{" "}
                    {completion?.practicalScorePct ?? 0}%
                  </div>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-muted/40 p-1.5">
              {(
                [
                  ["overview", lang === "bn" ? "ওভারভিউ" : "Overview", BookOpen],
                  ["materials", lang === "bn" ? "ম্যাটেরিয়াল" : "Materials", BookOpen],
                  ["recordings", lang === "bn" ? "রেকর্ডিং" : "Recordings", Film],
                  ["tutor", lang === "bn" ? "AI টিউটর" : "AI Tutor", Sparkles],
                  ["practical", lang === "bn" ? "প্রায়োগিক" : "Practical", ClipboardList],
                  ["certificate", lang === "bn" ? "সনদ" : "Certificate", Award],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPortalTab(id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold ${
                    portalTab === id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {(portal.announcements as { titleEn: string; titleBn: string; bodyEn: string; bodyBn: string }[] | undefined)
              ?.length ? (
              <section className="staff-panel space-y-2">
                {(portal.announcements as { titleEn: string; titleBn: string; bodyEn: string; bodyBn: string }[]).map(
                  (a, i) => (
                    <div key={i} className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs">
                      <div className="font-bold">{lang === "bn" ? a.titleBn : a.titleEn}</div>
                      <p className="text-muted-foreground">{lang === "bn" ? a.bodyBn : a.bodyEn}</p>
                    </div>
                  ),
                )}
              </section>
            ) : null}

            {portalTab === "materials" && (
              <section className="staff-panel space-y-3">
                <h2 className="font-bold flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  {lang === "bn" ? "কোর্স ম্যাটেরিয়াল" : "Course materials"}
                </h2>
                {((portal.materials as CourseMaterial[] | undefined) || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {lang === "bn" ? "এখনো কোনো ম্যাটেরিয়াল প্রকাশ হয়নি।" : "No published materials yet."}
                  </p>
                ) : (
                  ((portal.materials as CourseMaterial[]) || []).map((m) => (
                    <article key={m.id} className="rounded-2xl border border-border px-4 py-3 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {m.sessionLabel || m.type}
                      </div>
                      <h3 className="font-bold">{lang === "bn" ? m.titleBn : m.titleEn}</h3>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {lang === "bn" ? m.bodyBn || m.descriptionBn : m.bodyEn || m.descriptionEn}
                      </p>
                      {m.url && (
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Open link
                        </a>
                      )}
                    </article>
                  ))
                )}
              </section>
            )}

            {portalTab === "recordings" && (
              <section className="staff-panel space-y-3">
                <h2 className="font-bold flex items-center gap-2">
                  <Film className="h-4 w-4" />
                  {lang === "bn" ? "ক্লাস রেকর্ডিং" : "Class recordings"}
                </h2>
                {((portal.recordings as CourseRecording[] | undefined) || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {lang === "bn" ? "রেকর্ডিং শীঘ্রই আসবে।" : "Recordings coming soon from your instructor."}
                  </p>
                ) : (
                  ((portal.recordings as CourseRecording[]) || []).map((r) => (
                    <a
                      key={r.id}
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start justify-between gap-3 rounded-2xl border border-border px-4 py-3 hover:bg-accent"
                    >
                      <div>
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">
                          {r.sessionLabel || r.provider || "video"}
                        </div>
                        <div className="font-bold">{lang === "bn" ? r.titleBn : r.titleEn}</div>
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0 text-emerald-600" />
                    </a>
                  ))
                )}
              </section>
            )}

            {portalTab === "tutor" && (
              <section className="staff-panel space-y-3">
                <h2 className="font-bold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  {lang === "bn" ? "AI কোর্স টিউটর" : "AI course tutor"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {lang === "bn"
                    ? "প্রকাশিত ম্যাটেরিয়ালের উপর ভিত্তি করে প্রশ্ন করুন। পরীক্ষার আগে রিভিশনে কাজে লাগে।"
                    : "Ask questions grounded in published materials — great for pre-exam revision."}
                </p>
                {!portal.hasAiTutor && (
                  <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
                    AI Tutor needs a Gemini key in Admin → Settings.
                  </p>
                )}
                <form onSubmit={askTutor} className="space-y-2">
                  <textarea
                    className="staff-input min-h-[88px]"
                    value={tutorQ}
                    onChange={(e) => setTutorQ(e.target.value)}
                    placeholder={
                      lang === "bn"
                        ? "যেমন: ফাইনাল ক্যাপস্টোনে কী কী জমা দিতে হবে?"
                        : "e.g. What must I submit in the final capstone?"
                    }
                    required
                  />
                  <button type="submit" disabled={tutorBusy} className="staff-btn-primary">
                    {tutorBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                    {lang === "bn" ? "জিজ্ঞাসা করুন" : "Ask tutor"}
                  </button>
                </form>
                {tutorA && (
                  <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm whitespace-pre-wrap">
                    {tutorA}
                  </div>
                )}
              </section>
            )}

            {(portalTab === "overview" || portalTab === "practical") && (
            <>
            <section className="staff-panel">
              <div className="mb-4 flex items-center gap-2 font-bold">
                <BookOpen className="h-4 w-4" />
                {lang === "bn" ? "কুইজ অগ্রগতি" : "Quiz progress"}
                {progressSummary && (
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {progressSummary.done}/{progressSummary.total} passed
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(portal.quizProgress || []).map((q) => (
                  <div
                    key={q.quizId}
                    className="rounded-2xl border border-border px-3 py-3 text-sm flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold">
                        #{q.quizNumber ?? "—"}{" "}
                        {lang === "bn" ? q.titleBn : q.titleEn}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {q.questionCount} Qs
                        {typeof q.bestAccuracyPct === "number"
                          ? ` · ${q.bestAccuracyPct}%`
                          : ` · ${lang === "bn" ? "এখনো দেননি" : "not taken"}`}
                      </div>
                    </div>
                    {q.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">
                        pending
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {lang === "bn"
                  ? "লাইভ রুম PIN দিয়ে কুইজ দিতে /play এ যান। কুইজ শেষে আর স্বয়ংক্রিয় সার্টিফিকেট ইস্যু হয় না।"
                  : "Take live quizzes via /play with your Host PIN. Quiz completion no longer auto-issues certificates."}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link to="/final-exam" className="inline-flex text-sm font-bold text-amber-700 hover:underline">
                  {lang === "bn" ? "ফাইনাল পরীক্ষা (PIN + মোট টাইমার) →" : "Final Exam desk (PIN + overall timer) →"}
                </Link>
                <Link to="/play" className="inline-flex text-sm font-bold text-emerald-700 hover:underline">
                  {lang === "bn" ? "লাইভ অ্যারেনা যোগ দিন →" : "Join live arena →"}
                </Link>
              </div>
            </section>

            <section className="staff-panel space-y-4">
              <div className="flex flex-wrap items-center gap-2 font-bold">
                <ClipboardList className="h-4 w-4" />
                {lang === "bn"
                  ? practicalExam?.titleBn || "চূড়ান্ত প্রায়োগিক"
                  : practicalExam?.titleEn || "Final Practical"}
                {practicalExam && <StatusPill status={practicalExam.status} />}
              </div>
              {!practicalExam ? (
                <div className="staff-empty text-sm text-muted-foreground">
                  {lang === "bn"
                    ? "প্রায়োগিক পরীক্ষা এখনো খোলা হয়নি অথবা কনফিগার করা হয়নি। প্রশাসকের অপেক্ষা করুন।"
                    : "Final Practical is not open or not configured yet. Please wait for admin setup."}
                </div>
              ) : (
                <>
              <p className="text-sm text-muted-foreground">
                {lang === "bn" ? practicalExam.descriptionBn : practicalExam.descriptionEn}
              </p>
              <div className="rounded-2xl border border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-1">
                <div className="font-mono">
                  {practicalExam.opensAt
                    ? `${lang === "bn" ? "খোলে" : "Opens"} ${new Date(practicalExam.opensAt).toLocaleString()}`
                    : lang === "bn"
                      ? "খোলার সময় নির্ধারিত নয়"
                      : "Open window not set"}
                  {practicalExam.closesAt
                    ? ` · ${lang === "bn" ? "ডেডলাইন" : "Deadline"} ${new Date(practicalExam.closesAt).toLocaleString()}`
                    : ` · ${lang === "bn" ? "ডেডলাইন নেই" : "No deadline"}`}
                </div>
                {notOpenYet && (
                  <div className="font-semibold text-amber-700 dark:text-amber-300">
                    {lang === "bn" ? "এখনো খোলেনি — নির্ধারিত সময়ের পর জমা দিন।" : "Not open yet — submit after the opens time."}
                  </div>
                )}
                {pastDeadline && (windowOpen || returnedForResubmit) && (
                  <div className="text-amber-700 dark:text-amber-300 font-semibold">
                    {lang === "bn" ? "ডেডলাইন পার — বিলম্বে জমা গ্রহণযোগ্য।" : "Past deadline — late submissions accepted."}
                  </div>
                )}
                {!windowOpen && !notOpenYet && !returnedForResubmit && (
                  <div className="font-semibold">
                    {lang === "bn" ? "জমা উইন্ডো বন্ধ।" : "Submission window closed."}
                  </div>
                )}
                {returnedForResubmit && (
                  <div className="font-semibold text-amber-700 dark:text-amber-300">
                    {lang === "bn"
                      ? "ইন্সট্রাক্টর রিটার্ন করেছেন — পুনরায় জমা দিন।"
                      : "Instructor returned your work — please resubmit."}
                  </div>
                )}
              </div>
              {(practicalExam.tasks || []).map((task) => {
                const draft = drafts[task.id] || { textAnswer: "", linkUrl: "" };
                return (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-dashed border-border p-4 space-y-3"
                  >
                    <div className="font-semibold text-sm">
                      {lang === "bn" ? task.titleBn : task.titleEn}
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                        / {task.maxMarks}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {lang === "bn" ? task.promptBn : task.promptEn}
                    </p>
                    <label className="block text-xs font-semibold">
                      {lang === "bn" ? "লিখিত উত্তর / রিফ্লেকশন" : "Written reflection"}
                      {task.requireText ? " *" : ""}
                      <textarea
                        value={draft.textAnswer}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [task.id]: { ...draft, textAnswer: e.target.value },
                          }))
                        }
                        disabled={!canSubmit}
                        rows={4}
                        className="mt-1 staff-input"
                      />
                    </label>
                    <label className="block text-xs font-semibold">
                      {lang === "bn" ? "প্রজেক্ট লিংক (https)" : "Project link (https)"}
                      {task.requireLink ? " *" : ""}
                      <input
                        value={draft.linkUrl}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [task.id]: { ...draft, linkUrl: e.target.value },
                          }))
                        }
                        disabled={!canSubmit}
                        className="mt-1 staff-input"
                        placeholder="https://"
                      />
                    </label>
                    {task.allowFile && canSubmit && (
                      <label className="block text-xs font-semibold">
                        {lang === "bn" ? "ফাইল (ঐচ্ছিক)" : "File (optional)"}
                        <input
                          type="file"
                          className="mt-1 block w-full text-xs"
                          onChange={(e) => void onFile(task, e.target.files?.[0] || null)}
                        />
                        {draft.fileName && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Upload className="h-3 w-3" /> {draft.fileName}
                          </span>
                        )}
                      </label>
                    )}
                  </div>
                );
              })}
              {portal.submission && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StatusPill status={portal.submission.status} />
                  {typeof portal.submission.practicalScorePct === "number" && (
                    <span className="font-mono">practical {portal.submission.practicalScorePct}%</span>
                  )}
                  {portal.submission.instructorFeedback && (
                    <span>feedback: {portal.submission.instructorFeedback}</span>
                  )}
                </div>
              )}
              {canSubmit && (
                <button
                  type="button"
                  onClick={() => void submitPractical()}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {lang === "bn"
                    ? returnedForResubmit
                      ? "পুনরায় জমা দিন"
                      : pastDeadline
                        ? "বিলম্বে জমা দিন"
                        : "প্রায়োগিক জমা দিন"
                    : returnedForResubmit
                      ? "Resubmit practical"
                      : pastDeadline
                        ? "Submit late"
                        : "Submit practical"}
                </button>
              )}
              {gradedLocked && (
                <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
                  {lang === "bn"
                    ? "মার্কিং সম্পন্ন — পুনরায় জমা দিতে ইন্সট্রাক্টরকে রিটার্ন করতে বলুন।"
                    : "Graded — ask an instructor to return the work before resubmitting."}
                </p>
              )}
              {notice && (
                <p
                  className={`text-sm ${
                    noticeTone === "err"
                      ? "text-destructive"
                      : "text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {notice}
                </p>
              )}
                </>
              )}
            </section>
            </>
            )}

            {(portalTab === "overview" || portalTab === "certificate") && (
            <section className="staff-panel">
              <div className="flex items-center gap-2 font-bold">
                <Award className="h-4 w-4" />
                {lang === "bn" ? "কোর্স সমাপনী সনদপত্র" : "Course completion certificate"}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {lang === "bn"
                  ? "সনদপত্র পুরো কোর্সের জন্য ইস্যু হয় (কুইজ আলাদা নয়)। চূড়ান্ত কুইজ + প্রায়োগিক মার্কিং সম্পন্ন হলে প্রশাসক ইস্যু করবেন।"
                  : "Certificates are course-level (not per quiz). Admins issue after Final Quiz + Practical marking."}
              </p>
              {portal.courseCertificate ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                    <div className="font-mono text-sm font-bold">
                      {portal.courseCertificate.certificateNumber}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Issued {portal.courseCertificate.issueDate} · Combined{" "}
                      {portal.courseCertificate.combinedScorePct ?? "—"}%
                    </div>
                    <Link
                      to="/verify/$certId"
                      params={{ certId: portal.courseCertificate.certificateNumber }}
                      className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:underline"
                    >
                      {lang === "bn" ? "যাচাই করুন" : "Verify"} <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  {"studentName" in portal.courseCertificate &&
                    (portal.courseCertificate as CertificateData).studentName && (
                      <CertificateView certificate={portal.courseCertificate as CertificateData} />
                    )}
                </div>
              ) : (
                <div className="mt-4 text-sm">
                  {completion?.eligibleForCourseCertificate ? (
                    <span className="text-amber-700 dark:text-amber-300 font-semibold">
                      {lang === "bn"
                        ? "যোগ্য — প্রশাসকের ইস্যুর অপেক্ষায়।"
                        : "Eligible — awaiting admin issuance."}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {lang === "bn" ? "অসম্পূর্ণ:" : "Missing:"}{" "}
                      {(completion?.missing || [])
                        .map((m) => localizeMissing(m, lang))
                        .join(lang === "bn" ? " · " : "; ") || "—"}
                    </span>
                  )}
                </div>
              )}
            </section>
            )}
          </div>
      </main>
      <Footer />
    </div>
  );
}
