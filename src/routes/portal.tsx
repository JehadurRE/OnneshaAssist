import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useLanguage } from "@/lib/i18n";
import {
  serverGetStudentPortal,
  serverSubmitPracticalWork,
} from "@/lib/server-session";
import type { PracticalExam, PracticalSubmission } from "@/lib/types";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Loader2,
  Lock,
  Upload,
  User,
} from "lucide-react";

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

function StudentPortalPage() {
  const { lang } = useLanguage();
  const [rollNumber, setRollNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portal, setPortal] = useState<PortalPayload | null>(null);

  const [textAnswer, setTextAnswer] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [fileName, setFileName] = useState<string | undefined>();
  const [fileMime, setFileMime] = useState<string | undefined>();
  const [fileBase64, setFileBase64] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const practicalExam = portal?.practicalExam as PracticalExam | undefined | null;
  const primaryTask = practicalExam?.tasks?.[0];

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
      const existing = res.submission as PracticalSubmission | undefined;
      const ans = existing?.answers?.[0];
      if (ans) {
        setTextAnswer(ans.textAnswer || "");
        setLinkUrl(ans.linkUrl || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal unlock failed.");
    } finally {
      setLoading(false);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file) {
      setFileName(undefined);
      setFileMime(undefined);
      setFileBase64(undefined);
      return;
    }
    const max = practicalExam?.maxFileBytes || 10 * 1024 * 1024;
    if (file.size > max) {
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
    setFileName(file.name);
    setFileMime(file.type || "application/octet-stream");
    setFileBase64(btoa(binary));
  };

  const submitPractical = async () => {
    if (!portal?.success || !practicalExam || !primaryTask) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await serverSubmitPracticalWork({
        data: {
          practicalExamId: practicalExam.id,
          rollNumber: portal.student!.rollNumber,
          phone: portal.student!.phone || phone,
          answers: [
            {
              taskId: primaryTask.id,
              textAnswer,
              linkUrl,
              ...(fileName ? { fileName } : {}),
              ...(fileMime ? { fileMime } : {}),
              ...(fileBase64 ? { fileBase64 } : {}),
            },
          ],
        },
      });
      if (!res.success) {
        setNotice(res.error || "Submission failed.");
        return;
      }
      setNotice(lang === "bn" ? "প্রায়োগিক জমা সফল হয়েছে।" : "Practical submission saved.");
      // Refresh portal snapshot
      const refreshed = await serverGetStudentPortal({
        data: { rollNumber: portal.student!.rollNumber, phone: portal.student!.phone || phone },
      });
      if (refreshed.success) setPortal(refreshed);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const completion = portal?.success ? portal.completion : null;
  const gradedLocked = portal?.submission?.status === "graded";

  const progressSummary = useMemo(() => {
    if (!portal?.success) return null;
    const done = (portal.quizProgress || []).filter((q) => q.passed).length;
    const total = (portal.quizProgress || []).length;
    return { done, total };
  }, [portal]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
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
              <div className="flex items-center gap-2 font-bold">
                <ClipboardList className="h-4 w-4" />
                {lang === "bn"
                  ? practicalExam?.titleBn || "চূড়ান্ত প্রায়োগিক"
                  : practicalExam?.titleEn || "Final Practical"}
              </div>
              <p className="text-sm text-muted-foreground">
                {lang === "bn" ? practicalExam?.descriptionBn : practicalExam?.descriptionEn}
              </p>
              {primaryTask && (
                <div className="rounded-2xl border border-dashed border-border p-4 space-y-3">
                  <div className="font-semibold text-sm">
                    {lang === "bn" ? primaryTask.titleBn : primaryTask.titleEn}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lang === "bn" ? primaryTask.promptBn : primaryTask.promptEn}
                  </p>
                  <label className="block text-xs font-semibold">
                    {lang === "bn" ? "লিখিত উত্তর / রিফ্লেকশন" : "Written reflection"}
                    <textarea
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      disabled={gradedLocked}
                      rows={4}
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs font-semibold">
                    {lang === "bn" ? "প্রজেক্ট লিংক (https)" : "Project link (https)"}
                    <input
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      disabled={gradedLocked}
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                      placeholder="https://"
                    />
                  </label>
                  {primaryTask.allowFile && !gradedLocked && (
                    <label className="block text-xs font-semibold">
                      {lang === "bn" ? "ফাইল (ঐচ্ছিক, সর্বোচ্চ ১০ MB)" : "File (optional, max 10 MB)"}
                      <input
                        type="file"
                        className="mt-1 block w-full text-xs"
                        onChange={(e) => void onFile(e.target.files?.[0] || null)}
                      />
                      {fileName && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Upload className="h-3 w-3" /> {fileName}
                        </span>
                      )}
                    </label>
                  )}
                  {portal.submission && (
                    <p className="text-xs font-mono text-muted-foreground">
                      Status: {portal.submission.status}
                      {typeof portal.submission.practicalScorePct === "number"
                        ? ` · practical ${portal.submission.practicalScorePct}%`
                        : ""}
                      {portal.submission.instructorFeedback
                        ? ` · feedback: ${portal.submission.instructorFeedback}`
                        : ""}
                    </p>
                  )}
                  {!gradedLocked && (
                    <button
                      type="button"
                      onClick={() => void submitPractical()}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-bold text-background disabled:opacity-60"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {lang === "bn" ? "প্রায়োগিক জমা দিন" : "Submit practical"}
                    </button>
                  )}
                </div>
              )}
              {notice && <p className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
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
                <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
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
                      {(completion?.missing || []).join(", ") || "—"}
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
