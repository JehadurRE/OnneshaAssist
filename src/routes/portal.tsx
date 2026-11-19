import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CertificateView } from "@/components/common/CertificateView";
import { useLanguage } from "@/lib/i18n";
import {
  serverClearStudentPortal,
  serverGetStudentPortal,
  serverSubmitPracticalWork,
} from "@/lib/server-session";
import type {
  CertificateData,
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
  Loader2,
  Lock,
  LogOut,
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
  const [rollNumber, setRollNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portal, setPortal] = useState<PortalPayload | null>(null);

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

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await serverGetStudentPortal({
        data: { rollNumber: rollNumber.trim(), phone: phone.trim() },
      });
      if (!res.success) {
        setPortal(null);
        setError(res.error || "Could not open portal.");
        return;
      }
      setPortal(res);
      hydrateDrafts(res.practicalExam as PracticalExam | undefined, res.submission as PracticalSubmission | undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal unlock failed.");
    } finally {
      setLoading(false);
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
              ? "রোল ও মোবাইল দিয়ে প্রবেশ করুন। কুইজ অগ্রগতি দেখুন, প্রায়োগিক জমা দিন, এবং কোর্স সমাপনী সনদপত্র (কুইজ-ভিত্তিক নয়) যাচাই করুন।"
              : "Verify with roll + mobile. Track quiz progress, submit the Final Practical, and view your course-completion certificate (not quiz-wise)."}
          </p>
        </div>

        {!portal?.success ? (
          <form
            onSubmit={unlock}
            className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4 max-w-lg"
          >
            <div className="flex items-center gap-2 text-sm font-bold">
              <Lock className="h-4 w-4 text-emerald-600" />
              {lang === "bn" ? "রোস্টার যাচাই" : "Roster verification"}
            </div>
            <label className="block text-xs font-semibold text-muted-foreground">
              {lang === "bn" ? "রোল নম্বর" : "Roll number"}
              <input
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                placeholder="BAR-01"
                required
              />
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              {lang === "bn" ? "মোবাইল নম্বর" : "Mobile number"}
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                placeholder="01XXXXXXXXX"
                required
              />
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
              {lang === "bn" ? "পোর্টাল খুলুন" : "Open portal"}
            </button>
          </form>
        ) : (
          <div className="space-y-8">
            <section className="rounded-3xl border border-border bg-card p-6">
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

            <section className="rounded-3xl border border-border bg-card p-6">
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
              <Link to="/play" className="mt-2 inline-flex text-sm font-bold text-emerald-700 hover:underline">
                {lang === "bn" ? "লাইভ পরীক্ষায় যোগ দিন →" : "Join live exam →"}
              </Link>
            </section>

            <section className="rounded-3xl border border-border bg-card p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2 font-bold">
                <ClipboardList className="h-4 w-4" />
                {lang === "bn"
                  ? practicalExam?.titleBn || "চূড়ান্ত প্রায়োগিক"
                  : practicalExam?.titleEn || "Final Practical"}
                {practicalExam && <StatusPill status={practicalExam.status} />}
              </div>
              {!practicalExam ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
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
                        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
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
                        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
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

            <section className="rounded-3xl border border-border bg-card p-6">
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
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
