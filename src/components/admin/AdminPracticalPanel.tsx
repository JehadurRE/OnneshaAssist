import React, { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  serverAiSuggestPracticalGrade,
  serverBulkIssueCourseCertificates,
  serverCloseFinalExamWindow,
  serverDownloadPracticalFile,
  serverExtendFinalExamAttempt,
  serverGetBootstrapData,
  serverGetFinalExamDesk,
  serverGetFinalGradeSheet,
  serverGradePracticalSubmission,
  serverApplyReviewedPracticalGrades,
  serverGetStudentFinalQuizRecord,
  serverImportGoogleFormPracticals,
  serverMergeQuiz17IntoFinal,
  serverIssueCourseCertificate,
  serverRefreshPracticalQuizScores,
  serverOpenFinalExamWindow,
  serverReturnPracticalForResubmit,
  serverSaveCourseRequirement,
  serverSavePracticalExam,
  serverSendCourseCertificateEmail,
  serverSendTestEmail,
  serverSetAutoIssueQuizCertificates,
} from "@/lib/server-session";
import { EMAIL_TEMPLATE_CATALOG, type EmailTemplateId } from "@/lib/email-templates";
import { db } from "@/lib/db";
import type {
  Course,
  CourseCompletionRequirement,
  FinalExamAttempt,
  PracticalExam,
  PracticalExamStatus,
  PracticalSubmission,
  PracticalSubmissionStatus,
  PracticalTask,
  Quiz,
} from "@/lib/types";
import {
  buildDefaultCourseRequirement,
  buildDefaultFinalPracticalExam,
  generateFinalExamJoinPin,
  type FinalQuizRecordSnapshot,
} from "@/lib/practical-exam";
import {
  finalGradeSheetCsv,
  formatPracticalStatusLabel,
  type FinalGradeSheetRow,
} from "@/lib/final-gradesheet";
import {
  GRADE_QUEUE_SORT_OPTIONS,
  enrichGradingQueue,
  filterAndSortGradingQueue,
  getFlipSortTarget,
  type GradeQueueScoreFilter,
  type GradeQueueSortBy,
  type GradeQueueStatusFilter,
} from "@/lib/grading-queue";
import { downloadFinalGradeSheetPdf } from "@/lib/pdf-generator";
import {
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpNarrowWide,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Filter,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings2,
  Sparkles,
  Square,
  Timer,
  Trash2,
  Trophy,
  Users,
  Wrench,
  X,
} from "lucide-react";

export type FinalExamDeskView = "live" | "grade" | "setup" | "certs" | "sheet";

type DeskAttempt = FinalExamAttempt & {
  practicalStatus?: string | undefined;
};

function escapeCsvCell(value: string | number | undefined | null): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatMissingRequirement(code: string): string {
  switch (code) {
    case "final_quiz_result":
      return "Final quiz attempt";
    case "final_quiz_pass":
      return "Final quiz pass mark";
    case "practical_submission":
      return "Practical submission";
    case "practical_grading":
      return "Practical grading";
    case "practical_pass":
      return "Practical pass mark";
    case "combined_pass":
      return "Combined pass threshold";
    default:
      return code;
  }
}

function StatusPill({
  status,
}: {
  status: PracticalSubmissionStatus | PracticalExamStatus | string;
}) {
  const tone =
    status === "open" || status === "graded"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "late" || status === "returned" || status === "scheduled" || status === "quiz_only"
        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
        : status === "not_participated"
          ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
          : status === "closed" || status === "archived" || status === "draft"
            ? "bg-muted text-muted-foreground"
            : "bg-sky-500/15 text-sky-800 dark:text-sky-300";
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}
    >
      {formatPracticalStatusLabel(status)}
    </span>
  );
}

export function AdminPracticalPanel(props: {
  courses: Course[];
  quizzes: Quiz[];
  initialCourseId?: string | undefined;
  /** Default destination email prefilled in the Test Mail checker. */
  defaultTestEmail?: string | undefined;
  /** Controlled desk section from the URL (?desk=). */
  desk?: FinalExamDeskView | undefined;
  /** Controlled submission id from the URL (?sub=) — one student per page. */
  subId?: string | undefined;
  /** Push desk/course/student into the route search so the address bar updates. */
  onDeskNavigate?:
    | ((patch: {
        courseId?: string | undefined;
        desk?: FinalExamDeskView | undefined;
        subId?: string | null | undefined;
      }) => void)
    | undefined;
}) {
  const [courseId, setCourseId] = useState(
    props.initialCourseId || props.courses[0]?.id || "course-sanjibon-ai-dm",
  );
  const [exams, setExams] = useState<PracticalExam[]>([]);
  const [subs, setSubs] = useState<PracticalSubmission[]>([]);
  const [attempts, setAttempts] = useState<DeskAttempt[]>([]);
  const [requirements, setRequirements] = useState<CourseCompletionRequirement[]>([]);
  const [autoIssue, setAutoIssue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deskRefreshing, setDeskRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [marksBySubTask, setMarksBySubTask] = useState<Record<string, string>>({});
  const [feedbackBySub, setFeedbackBySub] = useState<Record<string, string>>({});
  const [aiGradingSubId, setAiGradingSubId] = useState<string | null>(null);
  const [aiDraftMetaBySub, setAiDraftMetaBySub] = useState<
    Record<string, { summary: string; model: string; provider: string; latencyMs: number }>
  >({});
  const [windowHours, setWindowHours] = useState(3);
  const [windowOpen, setWindowOpen] = useState(false);
  const [deskView, setDeskView] = useState<FinalExamDeskView>(props.desk || "live");
  const [activeSubId, setActiveSubId] = useState<string | null>(props.subId || null);
  const [queueFilter, setQueueFilter] = useState<GradeQueueStatusFilter>("all");
  const [queueScoreFilter, setQueueScoreFilter] = useState<GradeQueueScoreFilter>("all");
  const [queueRegion, setQueueRegion] = useState<string>("all");
  const [queueSearch, setQueueSearch] = useState<string>("");
  const [queueSort, setQueueSort] = useState<GradeQueueSortBy>("total_desc");
  const [showBatchTools, setShowBatchTools] = useState(false);
  const [quizRecord, setQuizRecord] = useState<FinalQuizRecordSnapshot | null>(null);
  const [quizRecordMeta, setQuizRecordMeta] = useState<{
    combinedPct?: number;
    practicalScorePct?: number;
    weights?: {
      quizWeightPct?: number;
      practicalWeightPct?: number;
      quizMaxMarks?: number;
      practicalMaxMarks?: number;
      totalMaxMarks?: number;
    };
  } | null>(null);
  const [sheetRows, setSheetRows] = useState<FinalGradeSheetRow[]>([]);
  const [sheetMeta, setSheetMeta] = useState<{
    courseTitle: string;
    examTitle: string;
    courseCode: string;
    generatedAt: string;
    counts: {
      total: number;
      participated: number;
      notParticipated: number;
      graded: number;
      withQuiz: number;
      certified: number;
      emailed: number;
    };
    emailStatus?:
      | {
          configured: boolean;
          resend: boolean;
          brevo: boolean;
          fromEmail: string;
        }
      | undefined;
    quizMaxMarks: number;
    practicalMaxMarks: number;
    totalMaxMarks: number;
  } | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetTab, setSheetTab] = useState<"all" | "participated" | "not_participated">("all");
  const [sheetSearch, setSheetSearch] = useState("");
  const [sheetRegion, setSheetRegion] = useState("all");
  const [rowSendResult, setRowSendResult] = useState<
    Record<string, { tone: "ok" | "err"; text: string }>
  >({});
  const [showTestMailPanel, setShowTestMailPanel] = useState(false);
  const [testMailTo, setTestMailTo] = useState(props.defaultTestEmail || "");
  const [testMailTemplate, setTestMailTemplate] =
    useState<EmailTemplateId>("course_certificate");
  const [testMailRoll, setTestMailRoll] = useState("");
  const [testMailBusy, setTestMailBusy] = useState(false);
  const [testMailFeedback, setTestMailFeedback] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  const goDesk = (patch: {
    courseId?: string;
    desk?: FinalExamDeskView;
    subId?: string | null;
  }) => {
    if (patch.courseId !== undefined) setCourseId(patch.courseId);
    if (patch.desk !== undefined) setDeskView(patch.desk);
    if (patch.subId !== undefined) setActiveSubId(patch.subId);
    props.onDeskNavigate?.(patch);
  };

  const course = useMemo(
    () => props.courses.find((c) => c.id === courseId) || props.courses[0],
    [props.courses, courseId],
  );

  const exam = useMemo(
    () => (course ? exams.find((e) => e.courseId === course.id) : undefined),
    [exams, course],
  );

  const requirement = useMemo(() => {
    if (!course) return null;
    return (
      requirements.find((r) => r.courseId === course.id) || buildDefaultCourseRequirement(course.id)
    );
  }, [requirements, course]);

  const courseQuizzes = useMemo(
    () =>
      props.quizzes
        .filter((q) => q.courseId === courseId)
        .sort((a, b) => (a.quizNumber || 0) - (b.quizNumber || 0)),
    [props.quizzes, courseId],
  );

  const attemptCounts = useMemo(() => {
    const inProgress = attempts.filter((a) => a.status === "in_progress").length;
    const submitted = attempts.filter(
      (a) => a.status === "submitted" || a.status === "graded" || a.status === "expired",
    ).length;
    return { total: attempts.length, inProgress, submitted };
  }, [attempts]);

  const refresh = async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    try {
      const res = await serverGetBootstrapData();
      if (res.success) {
        setExams((res.practicalExams as PracticalExam[]) || []);
        setSubs((res.practicalSubmissions as PracticalSubmission[]) || []);
        setRequirements((res.courseRequirements as CourseCompletionRequirement[]) || []);
        setAutoIssue(!!res.autoIssueQuizCertificates);
        const allAttempts = (res.finalExamAttempts as FinalExamAttempt[] | undefined) || [];
        if (courseId) {
          const examForCourse = ((res.practicalExams as PracticalExam[]) || []).find(
            (e) => e.courseId === courseId,
          );
          setAttempts(
            examForCourse
              ? allAttempts.filter((a) => a.practicalExamId === examForCourse.id)
              : [],
          );
        }
      }
    } finally {
      if (!opts?.soft) setLoading(false);
    }
  };

  const refreshDesk = async () => {
    if (!courseId) return;
    setDeskRefreshing(true);
    try {
      const res = await serverGetFinalExamDesk({ data: { courseId } });
      if (res.success && res.exam) {
        setExams((prev) => {
          const others = prev.filter((e) => e.id !== res.exam!.id && e.courseId !== res.exam!.courseId);
          return [res.exam as PracticalExam, ...others];
        });
        setAttempts((res.attempts as DeskAttempt[]) || []);
        setWindowOpen(!!res.windowOpen);
      }
    } finally {
      setDeskRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (props.initialCourseId) setCourseId(props.initialCourseId);
  }, [props.initialCourseId]);

  useEffect(() => {
    if (props.desk) setDeskView(props.desk);
  }, [props.desk]);

  useEffect(() => {
    setActiveSubId(props.subId || null);
  }, [props.subId]);

  useEffect(() => {
    void refreshDesk();
  }, [courseId]);

  useEffect(() => {
    if (!activeSubId || !courseId) {
      setQuizRecord(null);
      setQuizRecordMeta(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await serverGetStudentFinalQuizRecord({
        data: { courseId, submissionId: activeSubId },
      });
      if (cancelled) return;
      if (res.success && res.quiz) {
        setQuizRecord(res.quiz as FinalQuizRecordSnapshot);
        setQuizRecordMeta({
          ...(typeof res.combinedPct === "number" ? { combinedPct: res.combinedPct } : {}),
          ...(typeof res.practicalScorePct === "number" ? { practicalScorePct: res.practicalScorePct } : {}),
          weights: res.weights,
        });
      } else {
        setQuizRecord(null);
        setQuizRecordMeta(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSubId, courseId, subs]);

  useEffect(() => {
    if (!exam || (exam.status !== "open" && exam.status !== "scheduled")) return undefined;
    const id = window.setInterval(() => {
      void refreshDesk();
    }, 12_000);
    return () => window.clearInterval(id);
  }, [exam?.id, exam?.status]);

  const patchExam = (patch: Partial<PracticalExam>) => {
    if (!exam) return;
    setExams((prev) => prev.map((p) => (p.id === exam.id ? { ...p, ...patch } : p)));
  };

  const patchRequirement = (patch: Partial<CourseCompletionRequirement>) => {
    if (!course) return;
    setRequirements((prev) => {
      const idx = prev.findIndex((r) => r.courseId === course.id);
      const base = idx >= 0 ? prev[idx]! : buildDefaultCourseRequirement(course.id);
      const next = { ...base, ...patch, courseId: course.id };
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = next;
        return copy;
      }
      return [...prev, next];
    });
  };

  const ensureExamLocal = (): PracticalExam | undefined => {
    if (!course) return undefined;
    if (exam) return exam;
    const created = buildDefaultFinalPracticalExam(course);
    setExams((prev) => [created, ...prev.filter((e) => e.courseId !== course.id)]);
    return created;
  };

  const courseSubs = useMemo(
    () => subs.filter((s) => s.courseId === courseId),
    [subs, courseId],
  );

  const { items: enrichedQueue, stats: queueStats } = useMemo(
    () => enrichGradingQueue(courseSubs, exam),
    [courseSubs, exam],
  );

  const pendingGradeCount = queueStats.needs;

  const queueRegions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of courseSubs) {
      const reg = (s.regionName || "").trim();
      if (!reg) continue;
      counts.set(reg, (counts.get(reg) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [courseSubs]);

  const filteredQueueItems = useMemo(
    () =>
      filterAndSortGradingQueue(enrichedQueue, {
        statusFilter: queueFilter,
        scoreFilter: queueScoreFilter,
        region: queueRegion,
        search: queueSearch,
        sortBy: queueSort,
      }),
    [enrichedQueue, queueFilter, queueScoreFilter, queueRegion, queueSearch, queueSort],
  );

  const filteredQueue = useMemo(
    () => filteredQueueItems.map((it) => it.sub),
    [filteredQueueItems],
  );

  const activeSortMeta = useMemo(
    () => GRADE_QUEUE_SORT_OPTIONS.find((o) => o.id === queueSort) || GRADE_QUEUE_SORT_OPTIONS[0]!,
    [queueSort],
  );

  const hasActiveQueueFilters =
    queueFilter !== "all" ||
    queueScoreFilter !== "all" ||
    queueRegion !== "all" ||
    queueSearch.trim() !== "" ||
    queueSort !== "total_desc";

  const resetQueueFilters = () => {
    setQueueFilter("all");
    setQueueScoreFilter("all");
    setQueueRegion("all");
    setQueueSearch("");
    setQueueSort("total_desc");
  };

  const activeSub = useMemo(() => {
    if (!activeSubId) return undefined;
    return (
      courseSubs.find((s) => s.id === activeSubId) ||
      filteredQueue.find((s) => s.id === activeSubId)
    );
  }, [activeSubId, courseSubs, filteredQueue]);

  const navQueue = useMemo(() => {
    if (activeSub && !filteredQueue.some((s) => s.id === activeSub.id)) {
      return [activeSub, ...filteredQueue];
    }
    return filteredQueue;
  }, [activeSub, filteredQueue]);

  const activeSubIndex = useMemo(() => {
    if (!activeSub) return -1;
    return navQueue.findIndex((s) => s.id === activeSub.id);
  }, [navQueue, activeSub]);

  const markKey = (subId: string, taskId: string) => `${subId}::${taskId}`;

  const canGrade = (status: PracticalSubmissionStatus) =>
    status === "submitted" || status === "late" || status === "graded" || status === "returned";

  const canIssueCert = (sub: PracticalSubmission) => sub.status === "graded";

  const studentInitials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("") || "?";

  const syncCertsIntoAdmin = async () => {
    try {
      await db.syncFromServerStore();
    } catch {
      // best-effort; Issued Certificates tab refreshes via db.subscribe
    }
  };

  const suggestGradeWithAi = async (sub: PracticalSubmission) => {
    setAiGradingSubId(sub.id);
    setNotice(null);
    try {
      const res = await serverAiSuggestPracticalGrade({
        data: { submissionId: sub.id },
      });
      if (!res.success || !res.suggestion) {
        setNotice(res.error || "AI grading copilot unavailable.");
        return;
      }
      const { suggestion } = res;
      setMarksBySubTask((prev) => {
        const next = { ...prev };
        for (const g of suggestion.grades) {
          next[markKey(sub.id, g.taskId)] = String(g.marks);
          if (g.comment) {
            next[markKey(sub.id, `${g.taskId}::comment`)] = g.comment;
          }
        }
        return next;
      });
      if (suggestion.overallFeedback) {
        setFeedbackBySub((prev) => ({ ...prev, [sub.id]: suggestion.overallFeedback }));
      }
      setAiDraftMetaBySub((prev) => ({
        ...prev,
        [sub.id]: {
          summary: suggestion.rationaleSummary,
          model: suggestion.model,
          provider: suggestion.provider,
          latencyMs: suggestion.latencyMs,
        },
      }));
      setNotice(
        `AI drafted rubric marks & bilingual remarks via ${suggestion.nodeLabel} (${suggestion.model}, ${suggestion.latencyMs}ms). Review before clicking Save grade.`,
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "AI grading suggestion failed.");
    } finally {
      setAiGradingSubId(null);
    }
  };

  const gradeOne = async (sub: PracticalSubmission) => {
    if (!exam?.tasks.length) return;
    const overallFeedback =
      feedbackBySub[sub.id] !== undefined
        ? feedbackBySub[sub.id]!
        : sub.instructorFeedback || "";
    const grades = exam.tasks.map((task) => {
      const existing = sub.grades?.find((g) => g.taskId === task.id);
      const raw =
        marksBySubTask[markKey(sub.id, task.id)] ?? String(existing?.marks ?? "");
      if (raw.trim() === "") {
        return null;
      }
      const marks = Number(raw);
      // Keep per-task bilingual remarks unless staff explicitly edited overall-only flow.
      // Never replace task comments with the overall feedback box (that wiped EN/BN notes).
      const commentKey = markKey(sub.id, `${task.id}::comment`);
      const editedComment = marksBySubTask[commentKey];
      const comment =
        editedComment !== undefined
          ? editedComment
          : existing?.comment || "";
      return {
        taskId: task.id,
        marks,
        maxMarks: task.maxMarks,
        comment,
      };
    });
    if (grades.some((g) => !g || !Number.isFinite(g.marks) || g.marks < 0)) {
      setNotice("Enter valid marks for every task (blank is not allowed).");
      return;
    }
    const validGrades = grades.filter(
      (g): g is { taskId: string; marks: number; maxMarks: number; comment: string } => !!g,
    );
    setBusyId(sub.id);
    setNotice(null);
    try {
      const res = await serverGradePracticalSubmission({
        data: {
          submissionId: sub.id,
          grades: validGrades,
          instructorFeedback: overallFeedback,
        },
      });
      setNotice(res.success ? `Graded ${sub.rollNumber}.` : res.error || "Grade failed.");
      if (res.success) {
        setMarksBySubTask((m) => {
          const next = { ...m };
          for (const key of Object.keys(next)) {
            if (key.startsWith(`${sub.id}::`)) delete next[key];
          }
          return next;
        });
        setFeedbackBySub((m) => {
          const next = { ...m };
          delete next[sub.id];
          return next;
        });
      }
      await refresh({ soft: true });
    } finally {
      setBusyId(null);
    }
  };

  const returnOne = async (sub: PracticalSubmission) => {
    setBusyId(`return-${sub.id}`);
    try {
      const res = await serverReturnPracticalForResubmit({
        data: {
          submissionId: sub.id,
          feedback: feedbackBySub[sub.id] || "Please revise and resubmit.",
        },
      });
      setNotice(res.success ? `Returned ${sub.rollNumber} for resubmit.` : res.error || "Return failed.");
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const issueOne = async (roll: string) => {
    if (!course) return;
    setBusyId(`issue-${roll}`);
    try {
      const res = await serverIssueCourseCertificate({
        data: { courseId: course.id, rollNumber: roll, sendEmail: true },
      });
      if (!res.success) {
        setNotice(res.error || "Issue failed.");
        return;
      }
      const mail = "email" in res ? res.email : undefined;
      const mailNote = mail?.emailed
        ? ` · emailed ${mail.to}`
        : mail && "reason" in mail
          ? ` · email: ${mail.reason}`
          : "";
      setNotice(`Issued ${res.certificate?.certificateNumber}${mailNote}`);
      await syncCertsIntoAdmin();
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const emailCertOne = async (roll: string) => {
    if (!course) return;
    const cert = db
      .getCertificates()
      .find(
        (c) =>
          c.kind === "course_completion" &&
          c.courseId === course.id &&
          (c.studentRoll || "").toLowerCase() === roll.toLowerCase(),
      );
    if (!cert) {
      setNotice("Issue the course certificate first, then email it.");
      return;
    }
    setBusyId(`email-${roll}`);
    try {
      const res = await serverSendCourseCertificateEmail({
        data: { certificateNumber: cert.certificateNumber },
      });
      setNotice(
        res.success
          ? `Certificate email sent to ${res.to} via ${res.provider}`
          : res.error || "Email failed.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const bulkIssue = async () => {
    if (!course) return;
    if (
      !window.confirm(
        `Issue course certificates for all eligible graded candidates in ${course.code}?\n\nRoster emails will receive completion certificate mail automatically.`,
      )
    ) {
      return;
    }
    setBusyId("bulk");
    try {
      const res = await serverBulkIssueCourseCertificates({
        data: { courseId: course.id, sendEmail: true },
      });
      setNotice(
        res.success
          ? `Bulk issued ${res.issuedCount}; emailed ${res.emailedCount ?? 0}. Skipped ${res.skipped?.length || 0}.`
          : res.error || "Bulk issue failed.",
      );
      await syncCertsIntoAdmin();
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const importGoogleFormBackups = async (dryRun: boolean) => {
    if (!course) return;
    if (
      !dryRun &&
      !window.confirm(
        `Import Google Form practical backups into ${course.code}?\n\nMatched students get a late submission in the Grade queue. Already-graded rows are skipped.`,
      )
    ) {
      return;
    }
    setBusyId(dryRun ? "gform-dry" : "gform");
    setNotice(null);
    try {
      const res = await serverImportGoogleFormPracticals({
        data: { courseId: course.id, dryRun },
      });
      if (!res.success) {
        setNotice(res.error || "Google Form import failed.");
        return;
      }
      const unmatched = (res.unmatchedPhone || []).slice(0, 8).join("; ");
      setNotice(
        `${dryRun ? "Dry run — " : ""}Google Form import: ${res.imported || 0} new, ${res.updated || 0} updated, ${res.skippedGraded || 0} skipped (graded), ${(res.unmatchedPhone || []).length} unmatched phones.${unmatched ? ` Unmatched: ${unmatched}` : ""}`,
      );
      if (!dryRun) await refresh({ soft: true });
    } finally {
      setBusyId(null);
    }
  };

  const mergeQuiz17IntoFinal = async (dryRun: boolean) => {
    if (!course) return;
    if (
      !dryRun &&
      !window.confirm(
        `Merge Quiz 17 makeup scores into the Final Exam for ${course.code}?\n\nStudents who sat Quiz 17 individually will get final-quiz credit. Weak final attempts are upgraded; practical quiz % is refreshed.`,
      )
    ) {
      return;
    }
    setBusyId(dryRun ? "q17-dry" : "q17-merge");
    setNotice(null);
    try {
      const res = await serverMergeQuiz17IntoFinal({
        data: { courseId: course.id, dryRun },
      });
      if (!res.success) {
        setNotice(res.error || "Quiz 17 merge failed.");
        return;
      }
      setNotice(
        `${dryRun ? "Dry run — " : ""}Quiz 17 → Final: created ${res.attemptsCreated || 0}, upgraded ${res.attemptsUpgraded || 0}, skipped ${res.attemptsSkipped || 0}, practical refreshed ${res.submissionsUpdated || 0}.`,
      );
      if (!dryRun) {
        await refresh({ soft: true });
        if (deskView === "live") await refreshDesk();
      }
    } finally {
      setBusyId(null);
    }
  };

  const refreshQuizScores = async () => {
    if (!course) return;
    if (
      !window.confirm(
        `Refresh Final Quiz % on all practicals for ${course.code}?\n\nFixes students whose quiz used a different roll/phone (e.g. NOA-08 ↔ 009297).`,
      )
    ) {
      return;
    }
    setBusyId("quiz-refresh");
    setNotice(null);
    try {
      const res = await serverRefreshPracticalQuizScores({
        data: { courseId: course.id },
      });
      if (!res.success) {
        setNotice(res.error || "Quiz score refresh failed.");
        return;
      }
      const sample = (res.sample || [])
        .slice(0, 5)
        .map((s) => `${s.rollNumber}: ${s.from ?? "—"}→${s.to}%`)
        .join("; ");
      setNotice(
        `Quiz scores refreshed: ${res.updated || 0} updated, ${res.unchanged || 0} unchanged.${sample ? ` Sample: ${sample}` : ""}`,
      );
      await refresh({ soft: true });
    } finally {
      setBusyId(null);
    }
  };

  const applyReviewedGrades = async (dryRun: boolean, regrade = false) => {
    if (!course) return;
    if (
      !dryRun &&
      !window.confirm(
        regrade
          ? `Restore reviewed marks + bilingual comments for ALL graded students in ${course.code}?\n\nThis overwrites current marks/comments from the reviewed grade sheet.`
          : `Apply reviewed practical marks for ${course.code}?\n\nEach task has bilingual EN/BN comments. You can still edit any student afterward.`,
      )
    ) {
      return;
    }
    setBusyId(dryRun ? "revgrade-dry" : regrade ? "revgrade-restore" : "revgrade");
    setNotice(null);
    try {
      const res = await serverApplyReviewedPracticalGrades({
        data: { courseId: course.id, dryRun, regrade },
      });
      if (!res.success) {
        setNotice(res.error || "Apply reviewed grades failed.");
        return;
      }
      const sample = (res.sample || [])
        .slice(0, 5)
        .map((s) => `${s.rollNumber} ${s.earned}/${s.max}`)
        .join("; ");
      setNotice(
        `${dryRun ? "Dry run — " : ""}${regrade ? "Restored" : "Reviewed marks"}: applied ${res.applied || 0}, skipped graded ${res.skippedGraded || 0}, missing ${res.missing || 0}.${sample ? ` Sample: ${sample}` : ""}`,
      );
      if (!dryRun) {
        setMarksBySubTask({});
        setFeedbackBySub({});
        await refresh({ soft: true });
      }
    } finally {
      setBusyId(null);
    }
  };

  const downloadFile = async (sub: PracticalSubmission, taskId: string) => {
    setBusyId(`dl-${sub.id}-${taskId}`);
    try {
      const res = await serverDownloadPracticalFile({
        data: { submissionId: sub.id, taskId },
      });
      if (!res.success || !res.fileBase64) {
        setNotice(res.error || "Download failed.");
        return;
      }
      const bin = atob(res.fileBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: res.fileMime || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName || "submission.bin";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusyId(null);
    }
  };

  const saveExamMeta = async (override?: PracticalExam) => {
    if (!course) return;
    const toSave = override || exam || ensureExamLocal();
    if (!toSave) return;
    const q = Number(toSave.quizWeightPct ?? 40);
    const p = Number(toSave.practicalWeightPct ?? 60);
    if (q + p !== 100) {
      setNotice(`Weights must sum to 100 (currently ${q}+${p}=${q + p}). Server will normalize on save.`);
    }
    setBusyId("exam");
    try {
      const res = await serverSavePracticalExam({ data: { exam: toSave } });
      setNotice(res.success ? "Practical exam saved." : res.error || "Save failed.");
      if (res.success && res.exam) {
        setExams((prev) => {
          const others = prev.filter((e) => e.id !== res.exam!.id);
          return [res.exam as PracticalExam, ...others];
        });
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const saveRequirement = async () => {
    if (!course || !requirement) return;
    setBusyId("req");
    try {
      const res = await serverSaveCourseRequirement({ data: { requirement } });
      setNotice(res.success ? "Course certificate policy saved." : res.error || "Save failed.");
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const toggleAutoIssue = async (enabled: boolean) => {
    setBusyId("auto");
    try {
      const res = await serverSetAutoIssueQuizCertificates({ data: { enabled } });
      if (res.success) {
        setAutoIssue(!!res.autoIssueQuizCertificates);
        setNotice(
          enabled
            ? "Quiz-wise auto certificates ENABLED (not recommended)."
            : "Quiz-wise auto certificates remain disabled.",
        );
      } else {
        setNotice(res.error || "Could not update auto-issue setting.");
      }
    } finally {
      setBusyId(null);
    }
  };

  const updateTask = (taskId: string, patch: Partial<PracticalTask>) => {
    if (!exam) return;
    patchExam({
      tasks: exam.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    });
  };

  const addTask = () => {
    if (!exam) {
      ensureExamLocal();
      return;
    }
    const n = exam.tasks.length + 1;
    patchExam({
      tasks: [
        ...exam.tasks,
        {
          id: `task-${n}-${Date.now()}`,
          titleEn: `Task ${n}`,
          titleBn: `টাস্ক ${n}`,
          promptEn: "Describe the deliverable.",
          promptBn: "ডেলিভারেবল বর্ণনা করুন।",
          maxMarks: 100,
          requireLink: false,
          requireText: true,
          allowFile: true,
          sortOrder: n,
        },
      ],
    });
  };

  const removeTask = (taskId: string) => {
    if (!exam || exam.tasks.length <= 1) {
      setNotice("Keep at least one task.");
      return;
    }
    patchExam({ tasks: exam.tasks.filter((t) => t.id !== taskId) });
  };

  const toggleRequiredQuiz = (quizId: string) => {
    if (!requirement) return;
    const current = new Set(requirement.requiredQuizIds || []);
    if (current.has(quizId)) current.delete(quizId);
    else current.add(quizId);
    patchRequirement({ requiredQuizIds: Array.from(current) });
  };

  const loadGradeSheet = async () => {
    if (!course) return;
    setSheetLoading(true);
    setNotice(null);
    try {
      const res = await serverGetFinalGradeSheet({ data: { courseId: course.id } });
      if (!res.success) {
        setNotice(res.error || "Could not load gradesheet.");
        setSheetRows([]);
        setSheetMeta(null);
        return;
      }
      setSheetRows(res.rows);
      setSheetMeta({
        courseTitle: res.courseTitle,
        examTitle: res.examTitle,
        courseCode: res.courseCode,
        generatedAt: res.generatedAt,
        counts: res.counts,
        emailStatus: res.emailStatus,
        quizMaxMarks: res.quizMaxMarks,
        practicalMaxMarks: res.practicalMaxMarks,
        totalMaxMarks: res.totalMaxMarks,
      });
    } finally {
      setSheetLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && deskView === "sheet" && course) {
      void loadGradeSheet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when desk/course/load changes
  }, [loading, deskView, courseId]);

  useEffect(() => {
    if (props.defaultTestEmail && !testMailTo) {
      setTestMailTo(props.defaultTestEmail);
    }
  }, [props.defaultTestEmail, testMailTo]);

  const sheetCounts = useMemo(() => {
    const total = sheetRows.length;
    const participated = sheetRows.filter((r) => r.participated).length;
    const notParticipated = total - participated;
    const graded = sheetRows.filter((r) => r.practicalGraded).length;
    const withQuiz = sheetRows.filter((r) => r.quizFound).length;
    const certified = sheetRows.filter((r) => !!r.certificateNumber).length;
    const emailed = sheetRows.filter((r) => !!r.certificateEmailedAt).length;
    return {
      total,
      participated,
      notParticipated,
      graded,
      withQuiz,
      certified,
      emailed,
    };
  }, [sheetRows]);

  const sheetRegions = useMemo(() => {
    const set = new Set<string>();
    for (const r of sheetRows) {
      if (r.regionName?.trim()) set.add(r.regionName.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sheetRows]);

  const filteredSheetRows = useMemo(() => {
    const q = sheetSearch.trim().toLowerCase();
    return sheetRows.filter((r) => {
      if (sheetTab === "participated" && !r.participated) return false;
      if (sheetTab === "not_participated" && r.participated) return false;
      if (sheetRegion !== "all" && (r.regionName || "").trim() !== sheetRegion) return false;
      if (q) {
        const hay = `${r.rollNumber} ${r.studentName} ${r.regionName} ${r.email || ""} ${r.phone || ""} ${r.certificateNumber || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sheetRows, sheetTab, sheetRegion, sheetSearch]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading practical exam desk…
      </div>
    );
  }

  const weightSum = (exam?.quizWeightPct ?? 40) + (exam?.practicalWeightPct ?? 60);

  const openFinalExam = async () => {
    if (!exam) return;
    setBusyId("open-final");
    setNotice(null);
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
          ? `Final open · PIN ${res.exam?.joinPin} · quiz ${res.exam?.quizDurationMinutes}m · closes ${res.exam?.closesAt ? new Date(res.exam.closesAt).toLocaleString() : "—"}`
          : res.error || "Open failed",
      );
      if (res.success && res.exam) {
        setExams((prev) => prev.map((e) => (e.id === res.exam!.id ? res.exam! : e)));
        setWindowOpen(true);
      }
      await refresh({ soft: true });
      await refreshDesk();
    } finally {
      setBusyId(null);
    }
  };

  const closeFinalExam = async () => {
    if (!exam) return;
    if (!window.confirm("Close the Final Exam window now? Students will no longer be able to join.")) {
      return;
    }
    setBusyId("close-final");
    try {
      const res = await serverCloseFinalExamWindow({ data: { examId: exam.id } });
      setNotice(res.success ? "Final Exam window closed." : res.error || "Close failed");
      if (res.success && res.exam) {
        setExams((prev) => prev.map((e) => (e.id === res.exam!.id ? res.exam! : e)));
        setWindowOpen(false);
      }
      await refreshDesk();
    } finally {
      setBusyId(null);
    }
  };

  const exportAttemptsCsv = () => {
    const header = [
      "roll",
      "name",
      "status",
      "quizMarks",
      "practicalStatus",
      "startedAt",
      "submittedAt",
    ];
    const rows = attempts.map((a) =>
      [
        a.rollNumber,
        a.studentName,
        a.status,
        typeof a.quizMarks === "number" ? a.quizMarks : "",
        a.practicalStatus || "none",
        a.startedAt || "",
        a.submittedAt || "",
      ]
        .map(escapeCsvCell)
        .join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `final-exam-attempts-${course?.code || courseId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${attempts.length} attempt(s) to CSV.`);
  };

  const extendAttempt = async (attemptId: string, extraMinutes: number) => {
    setBusyId(`extend-${attemptId}-${extraMinutes}`);
    setNotice(null);
    try {
      const res = await serverExtendFinalExamAttempt({
        data: { attemptId, extraMinutes },
      });
      setNotice(
        res.success
          ? `Extended attempt +${extraMinutes} min (ends ${res.attempt?.endsAt ? new Date(res.attempt.endsAt).toLocaleTimeString() : "—"}).`
          : res.error || "Extend failed.",
      );
      if (res.success && res.attempt) {
        setAttempts((prev) =>
          prev.map((a) => (a.id === res.attempt!.id ? { ...a, ...res.attempt! } : a)),
        );
      }
      await refreshDesk();
    } finally {
      setBusyId(null);
    }
  };

  const sendCertFromSheet = async (row: FinalGradeSheetRow) => {
    if (!course) return;
    const rowKey = row.rollNumber;
    let overrideEmail: string | undefined;

    if (row.certificateNumber) {
      if (!row.email) {
        const entered = window.prompt(
          `No email on roster for ${row.studentName} (${row.rollNumber}).\nEnter recipient email to send certificate ${row.certificateNumber}:`,
        );
        if (!entered || !entered.trim()) return;
        overrideEmail = entered.trim();
      }
      setBusyId(`sheet-cert-${rowKey}`);
      setNotice(null);
      try {
        const res = await serverSendCourseCertificateEmail({
          data: {
            certificateNumber: row.certificateNumber,
            ...(overrideEmail ? { toEmail: overrideEmail } : {}),
          },
        });
        if (res.success) {
          const emailedAt = res.emailedAt || new Date().toISOString();
          setSheetRows((prev) =>
            prev.map((r) =>
              r.rollNumber === row.rollNumber
                ? { ...r, certificateEmailedAt: emailedAt, certificateEmailedTo: res.to }
                : r,
            ),
          );
          setRowSendResult((prev) => ({
            ...prev,
            [rowKey]: { tone: "ok", text: `Sent via ${res.provider}` },
          }));
          setNotice(
            `Certificate ${row.certificateNumber} sent to ${res.to} via ${res.provider}.`,
          );
        } else {
          const errMsg = res.error || "Certificate email failed.";
          setRowSendResult((prev) => ({ ...prev, [rowKey]: { tone: "err", text: errMsg } }));
          setNotice(`${row.rollNumber}: ${errMsg}`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Certificate email failed.";
        setRowSendResult((prev) => ({ ...prev, [rowKey]: { tone: "err", text: errMsg } }));
        setNotice(`${row.rollNumber}: ${errMsg}`);
      } finally {
        setBusyId(null);
      }
      return;
    }

    // Not yet issued — confirm if student hasn't met automated requirements
    const needsForce = row.eligibleForCertificate === false;
    if (needsForce) {
      const missingList = (row.missingRequirements || [])
        .map(formatMissingRequirement)
        .join(", ");
      const targetEmailHint = row.email || "an email you enter next";
      const ok = window.confirm(
        `${row.studentName} (${row.rollNumber}) has not met all automatic eligibility criteria${
          missingList ? ` (missing: ${missingList})` : ""
        }.\n\nIssue the Course Completion Certificate anyway and send it to ${targetEmailHint}?`,
      );
      if (!ok) return;
    }

    if (!row.email) {
      const entered = window.prompt(
        `No email on roster for ${row.studentName} (${row.rollNumber}).\nEnter recipient email to send their certificate:`,
      );
      if (!entered || !entered.trim()) return;
      overrideEmail = entered.trim();
    }

    setBusyId(`sheet-cert-${rowKey}`);
    setNotice(null);
    try {
      const res = await serverIssueCourseCertificate({
        data: {
          courseId: course.id,
          rollNumber: row.rollNumber,
          sendEmail: true,
          force: needsForce,
          ...(overrideEmail ? { toEmail: overrideEmail } : {}),
        },
      });
      if (!res.success || !res.certificate) {
        const errMsg = res.error || "Could not issue certificate.";
        setRowSendResult((prev) => ({ ...prev, [rowKey]: { tone: "err", text: errMsg } }));
        setNotice(`${row.rollNumber}: ${errMsg}`);
        return;
      }
      const cert = res.certificate;
      const mail = "email" in res ? res.email : undefined;
      setSheetRows((prev) =>
        prev.map((r) =>
          r.rollNumber === row.rollNumber
            ? {
                ...r,
                certificateNumber: cert.certificateNumber,
                certificateIssuedAt: cert.signedAt || cert.issueDate,
                ...(mail?.emailed
                  ? {
                      certificateEmailedAt:
                        ("emailedAt" in mail && mail.emailedAt) || new Date().toISOString(),
                      certificateEmailedTo: mail.to,
                    }
                  : {}),
              }
            : r,
        ),
      );
      if (mail?.emailed) {
        setRowSendResult((prev) => ({
          ...prev,
          [rowKey]: { tone: "ok", text: `Sent via ${mail.provider}` },
        }));
        setNotice(
          `Issued ${cert.certificateNumber} & emailed ${mail.to} via ${mail.provider}.`,
        );
      } else {
        const reason = mail && "reason" in mail ? mail.reason : "Email not sent";
        setRowSendResult((prev) => ({
          ...prev,
          [rowKey]: { tone: "err", text: `Issued · ${reason}` },
        }));
        setNotice(`Issued ${cert.certificateNumber}, but email failed: ${reason}`);
      }
      await syncCertsIntoAdmin();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Certificate send failed.";
      setRowSendResult((prev) => ({ ...prev, [rowKey]: { tone: "err", text: errMsg } }));
      setNotice(`${row.rollNumber}: ${errMsg}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleSendTestMail = async (e: React.FormEvent) => {
    e.preventDefault();
    const to = testMailTo.trim();
    if (!to || testMailBusy) return;
    setTestMailBusy(true);
    setTestMailFeedback(null);
    try {
      const res = await serverSendTestEmail({
        data: {
          to,
          templateId: testMailTemplate,
          ...(testMailTemplate === "course_certificate" && course
            ? {
                courseId: course.id,
                ...(testMailRoll ? { rollNumber: testMailRoll } : {}),
              }
            : {}),
        },
      });
      if (res.success) {
        const msg = `Test email delivered to ${res.to} via ${res.provider} · Subject: ${res.subject}`;
        setTestMailFeedback({ tone: "ok", text: msg });
        setNotice(msg);
      } else {
        const errMsg = res.error || "Test email failed.";
        setTestMailFeedback({ tone: "err", text: errMsg });
      }
    } catch (err) {
      setTestMailFeedback({
        tone: "err",
        text: err instanceof Error ? err.message : "Test email failed.",
      });
    } finally {
      setTestMailBusy(false);
    }
  };

  const exportGradeSheetCsv = () => {
    if (!filteredSheetRows.length || !sheetMeta) {
      setNotice("No rows in the current view to export.");
      return;
    }
    const csv = finalGradeSheetCsv(filteredSheetRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const tabSuffix = sheetTab === "all" ? "" : `-${sheetTab}`;
    a.download = `Onnesha-Final-Gradesheet-${sheetMeta.courseCode || "final"}${tabSuffix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(`Downloaded CSV (${filteredSheetRows.length} students).`);
  };

  const exportGradeSheetPdf = async () => {
    if (!filteredSheetRows.length || !sheetMeta) {
      setNotice("No rows in the current view to export.");
      return;
    }
    setBusyId("sheet-pdf");
    setNotice(null);
    try {
      await downloadFinalGradeSheetPdf({
        courseTitle: sheetMeta.courseTitle,
        examTitle: sheetMeta.examTitle,
        courseCode: sheetMeta.courseCode,
        rows: filteredSheetRows,
        branding: db.getBranding(),
        generatedAt: sheetMeta.generatedAt,
      });
      setNotice(`Downloaded PDF gradesheet (${filteredSheetRows.length} students).`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "PDF export failed.");
    } finally {
      setBusyId(null);
    }
  };

  const deskTabs: {
    id: FinalExamDeskView;
    label: string;
    icon: React.ReactNode;
    badge?: number | undefined;
  }[] = [
    { id: "live", label: "Live session", icon: <Radio className="h-3.5 w-3.5" /> },
    {
      id: "grade",
      label: "Grade work",
      icon: <ClipboardCheck className="h-3.5 w-3.5" />,
      badge: pendingGradeCount || undefined,
    },
    {
      id: "sheet",
      label: "Gradesheet",
      icon: <FileSpreadsheet className="h-3.5 w-3.5" />,
      badge: sheetMeta?.counts.total || (subs.length ? subs.length : undefined),
    },
    { id: "setup", label: "Exam setup", icon: <Settings2 className="h-3.5 w-3.5" /> },
    { id: "certs", label: "Certificates", icon: <Award className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-6 staff-surface">
      <div className="staff-panel-header !border-0 !pb-0 !mb-0">
        <div className="min-w-0 space-y-1">
          <h2 className="staff-panel-title">Final Exam Desk</h2>
          <p className="staff-panel-desc">
            Open a PIN window, watch attempts, grade practicals, and issue course certificates.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/final-exam-live" className="staff-btn-primary">
            <ExternalLink className="h-3.5 w-3.5" /> Live host
          </Link>
          <button
            type="button"
            onClick={() => {
              void refresh({ soft: true });
              void refreshDesk();
            }}
            className="staff-btn-ghost"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${deskRefreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="staff-field">
          <span className="staff-label">Course</span>
          <select
            className="staff-input"
            value={courseId}
            onChange={(e) => goDesk({ courseId: e.target.value, subId: null })}
          >
            {props.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.titleEn}
              </option>
            ))}
          </select>
        </label>
        {exam && (
          <div className="flex items-center gap-2 pb-1">
            <StatusPill status={exam.status} />
            {windowOpen && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                window open
              </span>
            )}
            <span className="text-[11px] text-muted-foreground font-mono">
              {exam.tasks.length} task{exam.tasks.length === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>

      <nav
        className="flex flex-wrap gap-1 rounded-2xl border border-border/80 bg-muted/30 p-1"
        aria-label="Final Exam Desk sections"
      >
        {deskTabs.map((tab) => {
          const active = deskView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => goDesk({ desk: tab.id, subId: tab.id === "grade" ? activeSubId : null })}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
              {typeof tab.badge === "number" && tab.badge > 0 ? (
                <span className="ml-0.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black text-amber-800 dark:text-amber-200">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {notice && (
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">{notice}</div>
      )}

      {deskView === "live" && exam && (
        <section className="rounded-2xl border border-border/80 bg-card p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                Live session
              </div>
              <h3 className="mt-1 text-lg font-black tracking-tight">{exam.titleEn}</h3>
              <p className="text-xs text-muted-foreground">
                Students join at <span className="font-mono">/final-exam</span> with the PIN, then
                finish practical work in the portal.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/final-exam-live"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Live host (projector + monitor)
              </Link>
              <Link
                to="/final-exam"
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-card px-3 py-2 text-[11px] font-bold hover:bg-accent"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Student join page
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Shared PIN</div>
              <div className="mt-1 font-mono text-3xl font-black tracking-[0.2em]">
                {exam.joinPin || "————"}
              </div>
              <button
                type="button"
                className="mt-2 staff-btn-ghost !py-1 !px-2 text-[10px]"
                onClick={() => patchExam({ joinPin: generateFinalExamJoinPin() })}
              >
                <KeyRound className="h-3 w-3" /> New PIN
              </button>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Quiz timer</div>
              <div className="mt-1 flex items-end gap-2">
                <input
                  type="number"
                  min={1}
                  max={180}
                  className="staff-input w-24 font-mono text-xl font-black"
                  value={exam.quizDurationMinutes ?? 10}
                  onChange={(e) =>
                    patchExam({
                      quizDurationMinutes: Math.max(1, Number(e.target.value) || 10),
                    })
                  }
                />
                <span className="pb-2 text-xs font-semibold text-muted-foreground">minutes overall</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Keep open</div>
              <div className="mt-1 flex items-end gap-2">
                <input
                  type="number"
                  min={0.5}
                  max={72}
                  step={0.5}
                  className="staff-input w-24 font-mono text-xl font-black"
                  value={windowHours}
                  onChange={(e) => setWindowHours(Math.max(0.5, Number(e.target.value) || 3))}
                />
                <span className="pb-2 text-xs font-semibold text-muted-foreground">hours</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 space-y-1 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Window</div>
              <div>
                Opens:{" "}
                <span className="font-mono font-semibold">
                  {exam.opensAt ? new Date(exam.opensAt).toLocaleString() : "—"}
                </span>
              </div>
              <div>
                Closes:{" "}
                <span className="font-mono font-semibold">
                  {exam.closesAt ? new Date(exam.closesAt).toLocaleString() : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busyId === "open-final"}
              onClick={() => void openFinalExam()}
              className="staff-btn-primary"
            >
              {busyId === "open-final" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Timer className="h-3.5 w-3.5" />
              )}
              {exam.status === "open" ? "Re-open / extend window" : "Open Final Exam"}
            </button>
            {(exam.status === "open" || exam.status === "scheduled") && (
              <button
                type="button"
                disabled={busyId === "close-final"}
                onClick={() => void closeFinalExam()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive"
              >
                {busyId === "close-final" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                Close window
              </button>
            )}
            <button
              type="button"
              onClick={() => void saveExamMeta()}
              disabled={busyId === "exam"}
              className="staff-btn-ghost"
            >
              <Save className="h-3.5 w-3.5" />
              {busyId === "exam" ? "Saving…" : "Save PIN & duration"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="staff-metric">
              <div className="staff-metric-label flex items-center gap-1">
                <Users className="h-3 w-3" /> Attempts
              </div>
              <div className="staff-metric-value">{attemptCounts.total}</div>
            </div>
            <div className="staff-metric staff-metric-amber">
              <div className="staff-metric-label">In progress</div>
              <div className="staff-metric-value">{attemptCounts.inProgress}</div>
            </div>
            <div className="staff-metric staff-metric-emerald">
              <div className="staff-metric-label">Submitted</div>
              <div className="staff-metric-value">{attemptCounts.submitted}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-muted-foreground">
              Live attempts ({attempts.length})
            </div>
            <button
              type="button"
              onClick={exportAttemptsCsv}
              disabled={attempts.length === 0}
              className="staff-btn-ghost !py-1.5 !px-2 text-[10px] disabled:opacity-50"
            >
              <Download className="h-3 w-3" /> Export CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-bold">Roll</th>
                  <th className="px-3 py-2 font-bold">Name</th>
                  <th className="px-3 py-2 font-bold">Status</th>
                  <th className="px-3 py-2 font-bold">Score</th>
                  <th className="px-3 py-2 font-bold">Practical</th>
                  <th className="px-3 py-2 font-bold">Ends / submitted</th>
                  <th className="px-3 py-2 font-bold">Extend</th>
                </tr>
              </thead>
              <tbody>
                {attempts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                      No quiz attempts yet. After you open the window, students joining with PIN →
                      mobile search appear here (auto-refresh every 12s).
                    </td>
                  </tr>
                ) : (
                  attempts.map((a) => (
                    <tr key={a.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 font-mono font-bold">{a.rollNumber}</td>
                      <td className="px-3 py-2 font-semibold">{a.studentName}</td>
                      <td className="px-3 py-2">
                        <StatusPill status={a.status} />
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {typeof a.quizMarks === "number"
                          ? `${a.quizMarks}/${a.quizMaxMarks ?? "—"} (${a.accuracyPct ?? "—"}%)`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill status={a.practicalStatus || "none"} />
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                        {a.submittedAt
                          ? new Date(a.submittedAt).toLocaleString()
                          : a.endsAt
                            ? `until ${new Date(a.endsAt).toLocaleTimeString()}`
                            : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {a.status === "in_progress" ? (
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              disabled={busyId === `extend-${a.id}-5`}
                              onClick={() => void extendAttempt(a.id, 5)}
                              className="rounded-lg border border-border bg-background px-1.5 py-0.5 text-[10px] font-bold hover:bg-accent disabled:opacity-50"
                            >
                              +5m
                            </button>
                            <button
                              type="button"
                              disabled={busyId === `extend-${a.id}-10`}
                              onClick={() => void extendAttempt(a.id, 10)}
                              className="rounded-lg border border-border bg-background px-1.5 py-0.5 text-[10px] font-bold hover:bg-accent disabled:opacity-50"
                            >
                              +10m
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {deskView === "live" && !exam && (
        <div className="staff-empty space-y-3">
          <p className="staff-empty-title">No final exam yet</p>
          <p className="staff-empty-desc">
            Create the exam under Setup for {course?.code || "this course"}, then open the PIN window
            here.
          </p>
          <button
            type="button"
            onClick={() => {
              goDesk({ desk: "setup", subId: null });
              const created = ensureExamLocal();
              if (created) void saveExamMeta(created);
            }}
            className="staff-btn-primary mx-auto"
          >
            <Plus className="h-3.5 w-3.5" /> Create final exam
          </button>
        </div>
      )}

      {deskView === "setup" && !exam && (
        <div className="staff-empty space-y-3">
          <p className="staff-empty-title">No practical exam configured</p>
          <p className="staff-empty-desc">
            Create a default final practical for {course?.code || "this course"}.
          </p>
          <button
            type="button"
            onClick={() => {
              const created = ensureExamLocal();
              if (created) void saveExamMeta(created);
            }}
            className="staff-btn-primary mx-auto"
          >
            <Plus className="h-3.5 w-3.5" /> Create default Final Practical
          </button>
        </div>
      )}

      {deskView === "setup" && exam && (
        <>
          <section className="staff-row-card space-y-4">
            <div className="text-sm font-bold">Window &amp; scoring</div>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <label className="font-semibold">
                Title (EN)
                <input
                  className="mt-1 staff-input"
                  value={exam.titleEn}
                  onChange={(e) => patchExam({ titleEn: e.target.value })}
                />
              </label>
              <label className="font-semibold">
                Title (BN)
                <input
                  className="mt-1 staff-input"
                  value={exam.titleBn}
                  onChange={(e) => patchExam({ titleBn: e.target.value })}
                />
              </label>
              <label className="font-semibold sm:col-span-2">
                Description (EN)
                <textarea
                  className="mt-1 staff-input"
                  rows={2}
                  value={exam.descriptionEn || ""}
                  onChange={(e) => patchExam({ descriptionEn: e.target.value })}
                />
              </label>
              <label className="font-semibold sm:col-span-2">
                Description (BN)
                <textarea
                  className="mt-1 staff-input"
                  rows={2}
                  value={exam.descriptionBn || ""}
                  onChange={(e) => patchExam({ descriptionBn: e.target.value })}
                />
              </label>
              <label className="font-semibold">
                Status
                <select
                  className="mt-1 staff-input"
                  value={exam.status}
                  onChange={(e) => patchExam({ status: e.target.value as PracticalExamStatus })}
                >
                  {(["draft", "scheduled", "open", "closed", "archived"] as PracticalExamStatus[]).map(
                    (s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="font-semibold">
                Linked final quiz
                <select
                  className="mt-1 staff-input"
                  value={exam.linkedQuizId || ""}
                  onChange={(e) =>
                    patchExam({ linkedQuizId: e.target.value || undefined })
                  }
                >
                  <option value="">— none —</option>
                  {courseQuizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      #{q.quizNumber ?? "?"} {q.titleEn}
                    </option>
                  ))}
                </select>
              </label>
              <label className="font-semibold">
                Shared Final Exam PIN
                <div className="mt-1 flex gap-2">
                  <input
                    className="staff-input font-mono tracking-widest"
                    value={exam.joinPin || ""}
                    onChange={(e) =>
                      patchExam({ joinPin: e.target.value.replace(/\D/g, "").slice(0, 8) })
                    }
                    placeholder="482910"
                  />
                  <button
                    type="button"
                    className="staff-btn-ghost shrink-0"
                    onClick={() => patchExam({ joinPin: generateFinalExamJoinPin() })}
                  >
                    <KeyRound className="h-3.5 w-3.5" /> New
                  </button>
                </div>
                <span className="mt-1 block font-normal text-[10px] text-muted-foreground">
                  Candidates join at /final-exam with this PIN (same for everyone).
                </span>
              </label>
              <label className="font-semibold">
                Quiz duration (minutes, overall)
                <input
                  type="number"
                  min={1}
                  max={180}
                  className="mt-1 staff-input"
                  value={exam.quizDurationMinutes ?? 10}
                  onChange={(e) =>
                    patchExam({
                      quizDurationMinutes: Math.max(1, Number(e.target.value) || 10),
                    })
                  }
                />
                <span className="mt-1 block font-normal text-[10px] text-muted-foreground">
                  One countdown for the whole MCQ paper — not per-question timers.
                </span>
              </label>
              <label className="font-semibold">
                Opens (local time)
                <input
                  type="datetime-local"
                  className="mt-1 staff-input"
                  value={toLocalInput(exam.opensAt)}
                  onChange={(e) => patchExam({ opensAt: fromLocalInput(e.target.value) })}
                />
              </label>
              <label className="font-semibold">
                Closes (local time)
                <input
                  type="datetime-local"
                  className="mt-1 staff-input"
                  value={toLocalInput(exam.closesAt)}
                  onChange={(e) => patchExam({ closesAt: fromLocalInput(e.target.value) })}
                />
                <span className="mt-1 block font-normal text-[10px] text-muted-foreground">
                  After close, late submissions stay allowed while status is open/scheduled.
                </span>
              </label>
              <label className="font-semibold">
                Quiz weight %
                <input
                  type="number"
                  className="mt-1 staff-input"
                  value={exam.quizWeightPct ?? 40}
                  onChange={(e) => patchExam({ quizWeightPct: Number(e.target.value) })}
                />
              </label>
              <label className="font-semibold">
                Practical weight %
                <input
                  type="number"
                  className="mt-1 staff-input"
                  value={exam.practicalWeightPct ?? 60}
                  onChange={(e) => patchExam({ practicalWeightPct: Number(e.target.value) })}
                />
                {weightSum !== 100 && (
                  <span className="mt-1 block font-normal text-[10px] text-amber-700 dark:text-amber-300">
                    Sum is {weightSum} — will normalize to 100 on save.
                  </span>
                )}
              </label>
              <label className="font-semibold">
                Pass threshold %
                <input
                  type="number"
                  className="mt-1 staff-input"
                  value={exam.passThresholdPct ?? 50}
                  onChange={(e) => patchExam({ passThresholdPct: Number(e.target.value) })}
                />
              </label>
              <label className="font-semibold">
                Max file size (MB)
                <input
                  type="number"
                  className="mt-1 staff-input"
                  value={Math.round((exam.maxFileBytes || 10 * 1024 * 1024) / (1024 * 1024))}
                  onChange={(e) =>
                    patchExam({
                      maxFileBytes: Math.max(1, Number(e.target.value) || 10) * 1024 * 1024,
                    })
                  }
                />
              </label>
            </div>
          </section>

          <section className="staff-row-card space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold">Tasks ({exam.tasks.length})</div>
              <button
                type="button"
                onClick={addTask}
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold hover:bg-accent"
              >
                <Plus className="h-3 w-3" /> Add task
              </button>
            </div>
            {exam.tasks.map((task, idx) => (
              <div key={task.id} className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Task {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    className="rounded-lg border border-destructive/40 px-2 py-1 text-destructive"
                    title="Remove task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 items-start">
                  <label className="text-[11px] font-semibold flex-1 min-w-[140px]">
                    Title EN
                    <input
                      className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                      value={task.titleEn}
                      onChange={(e) => updateTask(task.id, { titleEn: e.target.value })}
                    />
                  </label>
                  <label className="text-[11px] font-semibold flex-1 min-w-[140px]">
                    Title BN
                    <input
                      className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                      value={task.titleBn}
                      onChange={(e) => updateTask(task.id, { titleBn: e.target.value })}
                    />
                  </label>
                  <label className="text-[11px] font-semibold w-24">
                    Max marks
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                      value={task.maxMarks}
                      onChange={(e) => updateTask(task.id, { maxMarks: Number(e.target.value) })}
                    />
                  </label>
                </div>
                <label className="block text-[11px] font-semibold">
                  Prompt EN
                  <textarea
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                    rows={2}
                    value={task.promptEn}
                    onChange={(e) => updateTask(task.id, { promptEn: e.target.value })}
                  />
                </label>
                <label className="block text-[11px] font-semibold">
                  Prompt BN
                  <textarea
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                    rows={2}
                    value={task.promptBn}
                    onChange={(e) => updateTask(task.id, { promptBn: e.target.value })}
                  />
                </label>
                <div className="flex flex-wrap gap-4 text-[11px] font-semibold">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!task.requireText}
                      onChange={(e) => updateTask(task.id, { requireText: e.target.checked })}
                    />
                    Require text
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!task.requireLink}
                      onChange={(e) => updateTask(task.id, { requireLink: e.target.checked })}
                    />
                    Require link
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!task.allowFile}
                      onChange={(e) => updateTask(task.id, { allowFile: e.target.checked })}
                    />
                    Allow file
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => void saveExamMeta()}
              disabled={busyId === "exam"}
              className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {busyId === "exam" ? "Saving…" : "Save exam settings"}
            </button>
          </section>
        </>
      )}

      {deskView === "sheet" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h3 className="text-base font-black tracking-tight">Final Exam gradesheet</h3>
              <p className="text-xs text-muted-foreground">
                Full roster &amp; exam results — quiz /{sheetMeta?.quizMaxMarks ?? 30}, practical /
                {sheetMeta?.practicalMaxMarks ?? 40}, total /{sheetMeta?.totalMaxMarks ?? 70}.
                Issue or resend certificates per student, or run a test mail check.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowTestMailPanel((prev) => !prev);
                  setTestMailFeedback(null);
                }}
                className={
                  showTestMailPanel
                    ? "inline-flex items-center gap-1.5 rounded-xl border border-primary/50 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-colors"
                    : "staff-btn-ghost"
                }
              >
                <Send className="h-3.5 w-3.5" />
                {showTestMailPanel ? "Hide mail test" : "Test mail / cert"}
              </button>
              <button
                type="button"
                onClick={() => void loadGradeSheet()}
                disabled={sheetLoading || !course}
                className="staff-btn-ghost"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${sheetLoading ? "animate-spin" : ""}`} />
                {sheetLoading ? "Loading…" : "Reload"}
              </button>
              <button
                type="button"
                onClick={exportGradeSheetCsv}
                disabled={!filteredSheetRows.length}
                className="staff-btn-ghost"
              >
                <Download className="h-3.5 w-3.5" /> CSV ({filteredSheetRows.length})
              </button>
              <button
                type="button"
                onClick={() => void exportGradeSheetPdf()}
                disabled={!filteredSheetRows.length || busyId === "sheet-pdf"}
                className="staff-btn-primary"
              >
                {busyId === "sheet-pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                PDF export
              </button>
            </div>
          </div>

          {showTestMailPanel && (
            <form
              onSubmit={handleSendTestMail}
              className="rounded-2xl border border-primary/30 bg-card p-4 shadow-xs space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-black tracking-tight">
                    <Mail className="h-4 w-4 text-primary" />
                    <span>Test Mail &amp; Certificate Delivery Check</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Enter any email address to verify mail delivery and inspect how a certificate or
                    transactional email renders in a real inbox (does not email students or issue
                    real certificates).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                  {sheetMeta?.emailStatus && (
                    <>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                          sheetMeta.emailStatus.resend
                            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            sheetMeta.emailStatus.resend
                              ? "bg-emerald-500"
                              : "bg-muted-foreground"
                          }`}
                        />
                        Resend {sheetMeta.emailStatus.resend ? "Ready" : "Off"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                          sheetMeta.emailStatus.brevo
                            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            sheetMeta.emailStatus.brevo
                              ? "bg-emerald-500"
                              : "bg-muted-foreground"
                          }`}
                        />
                        Brevo {sheetMeta.emailStatus.brevo ? "Ready" : "Off"}
                      </span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowTestMailPanel(false)}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Close test mail panel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end">
                <label className="staff-field lg:col-span-4">
                  <span className="staff-label">Test recipient email</span>
                  <input
                    type="email"
                    required
                    value={testMailTo}
                    onChange={(e) => setTestMailTo(e.target.value)}
                    placeholder="any-email@example.com"
                    className="staff-input text-xs"
                  />
                </label>

                <label className="staff-field lg:col-span-3">
                  <span className="staff-label">Email template</span>
                  <select
                    value={testMailTemplate}
                    onChange={(e) => setTestMailTemplate(e.target.value as EmailTemplateId)}
                    className="staff-input text-xs"
                  >
                    {EMAIL_TEMPLATE_CATALOG.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.label}
                      </option>
                    ))}
                  </select>
                </label>

                {testMailTemplate === "course_certificate" && (
                  <label className="staff-field lg:col-span-3">
                    <span className="staff-label">Preview student data (optional)</span>
                    <select
                      value={testMailRoll}
                      onChange={(e) => setTestMailRoll(e.target.value)}
                      className="staff-input text-xs"
                    >
                      <option value="">Sample student (preview)</option>
                      {sheetRows.map((r) => (
                        <option key={r.rollNumber} value={r.rollNumber}>
                          {r.rollNumber} — {r.studentName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div
                  className={
                    testMailTemplate === "course_certificate"
                      ? "lg:col-span-2"
                      : "lg:col-span-5"
                  }
                >
                  <button
                    type="submit"
                    disabled={testMailBusy || !testMailTo.trim()}
                    className="staff-btn-primary w-full !justify-center disabled:opacity-50"
                  >
                    {testMailBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    {testMailBusy ? "Sending…" : "Send test"}
                  </button>
                </div>
              </div>

              {sheetMeta?.emailStatus?.fromEmail && (
                <div className="text-[10px] font-mono text-muted-foreground">
                  Sender: {sheetMeta.emailStatus.fromEmail}
                </div>
              )}

              {testMailFeedback && (
                <div
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                    testMailFeedback.tone === "ok"
                      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-destructive/35 bg-destructive/10 text-destructive"
                  }`}
                >
                  {testMailFeedback.tone === "ok" && (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>{testMailFeedback.text}</span>
                </div>
              )}
            </form>
          )}

          {sheetMeta && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-muted-foreground">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span>{sheetCounts.total} total students</span>
                <span>· {sheetCounts.participated} participated</span>
                <span>· {sheetCounts.notParticipated} did not participate</span>
                <span>· {sheetCounts.graded} graded</span>
                <span>· {sheetCounts.withQuiz} with quiz</span>
                <span>· {sheetCounts.certified} certs issued</span>
                <span>· {sheetCounts.emailed} emailed</span>
              </div>
              <span className="font-mono text-[10px]">
                Generated {new Date(sheetMeta.generatedAt).toLocaleString()}
              </span>
            </div>
          )}

          {/* Participation Tabs + Search/Region Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex flex-wrap gap-1 rounded-2xl border border-border/80 bg-muted/30 p-1"
              role="tablist"
              aria-label="Gradesheet student filter tabs"
            >
              {(
                [
                  { id: "all" as const, label: "All Students", count: sheetCounts.total },
                  {
                    id: "participated" as const,
                    label: "Participated",
                    count: sheetCounts.participated,
                  },
                  {
                    id: "not_participated" as const,
                    label: "Did Not Participate",
                    count: sheetCounts.notParticipated,
                  },
                ] as const
              ).map((t) => {
                const active = sheetTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSheetTab(t.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                      active
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{t.label}</span>
                    <span
                      className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                        t.id === "not_participated"
                          ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                          : t.id === "participated"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={sheetSearch}
                  onChange={(e) => setSheetSearch(e.target.value)}
                  placeholder="Search roll, name, email…"
                  className="staff-input !py-1.5 !pl-8 !pr-3 text-xs w-52"
                />
              </div>
              {sheetRegions.length > 0 && (
                <select
                  value={sheetRegion}
                  onChange={(e) => setSheetRegion(e.target.value)}
                  className="staff-input !py-1.5 text-xs w-auto max-w-[200px]"
                  aria-label="Filter by region"
                >
                  <option value="all">All regions</option>
                  {sheetRegions.map((reg) => (
                    <option key={reg} value={reg}>
                      {reg}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {sheetLoading && !sheetRows.length ? (
            <div className="rounded-2xl border border-border/80 bg-card p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Building gradesheet…
            </div>
          ) : sheetRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              No students or practical submissions found for this course yet.
            </div>
          ) : filteredSheetRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              No students match the current tab or search filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card">
              <table className="w-full min-w-[920px] text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">Roll</th>
                    <th className="px-3 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Region</th>
                    <th className="px-3 py-2.5 text-right">Quiz</th>
                    <th className="px-3 py-2.5 text-right">Practical</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                    <th className="px-3 py-2.5 text-right">Combined %</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSheetRows.map((r) => {
                    const rowBusy = busyId === `sheet-cert-${r.rollNumber}`;
                    const rowFeedback = rowSendResult[r.rollNumber];
                    const hasCert = !!r.certificateNumber;
                    const wasEmailed = !!r.certificateEmailedAt;
                    const missingHint = (r.missingRequirements || [])
                      .map(formatMissingRequirement)
                      .join(", ");
                    return (
                      <tr
                        key={r.submissionId || `${r.rollNumber}-${r.rank}`}
                        className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {r.rank > 0 ? r.rank : "—"}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap">
                          {r.rollNumber}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-foreground">{r.studentName}</div>
                          {r.email ? (
                            <div className="font-mono text-[10px] text-muted-foreground truncate max-w-[220px]">
                              {r.email}
                            </div>
                          ) : (
                            <div className="text-[10px] italic text-amber-700 dark:text-amber-300">
                              No email on roster
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.regionName || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {r.quizFound || r.quizAccuracyPct > 0
                            ? `${r.quizMarks}/${r.quizMaxMarks}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {r.practicalGraded || r.practicalScorePct > 0
                            ? `${r.practicalMarks}/${r.practicalMaxMarks}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold">
                          {r.participated ? `${r.totalMarks}/${r.maxTotal}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {r.participated ? `${r.combinedPct}%` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill status={r.practicalStatus} />
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className="inline-flex flex-col items-end gap-1">
                            <div className="inline-flex items-center gap-1.5">
                              {hasCert && (
                                <Link
                                  to="/verify/$certId"
                                  params={{ certId: r.certificateNumber! }}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] font-bold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                                  title={`View certificate ${r.certificateNumber}`}
                                >
                                  <Award className="h-3 w-3" />
                                  {wasEmailed ? "Emailed" : "Issued"}
                                </Link>
                              )}
                              <button
                                type="button"
                                disabled={rowBusy}
                                onClick={() => void sendCertFromSheet(r)}
                                title={
                                  hasCert
                                    ? `Resend certificate ${r.certificateNumber} to ${r.email || "email"}`
                                    : r.eligibleForCertificate === false
                                      ? `Not yet eligible (${missingHint || "requirements incomplete"}). Click to override & send certificate.`
                                      : `Issue & send certificate to ${r.email || "email"}`
                                }
                                className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                                  hasCert
                                    ? "border-border bg-background text-foreground hover:bg-accent"
                                    : r.eligibleForCertificate === false
                                      ? "border-border/80 bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground"
                                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-200"
                                }`}
                              >
                                {rowBusy ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Mail className="h-3 w-3" />
                                )}
                                <span>
                                  {rowBusy
                                    ? "Sending…"
                                    : hasCert
                                      ? "Resend Cert"
                                      : "Send Certificate"}
                                </span>
                              </button>
                            </div>
                            {rowFeedback && (
                              <span
                                className={`max-w-[200px] truncate text-[10px] font-semibold ${
                                  rowFeedback.tone === "ok"
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : "text-destructive"
                                }`}
                                title={rowFeedback.text}
                              >
                                {rowFeedback.text}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {deskView === "certs" && (
        <>
      <section className="staff-row-card space-y-3">
        <div className="text-sm font-bold">Quiz certificates</div>
        <p className="text-[11px] text-muted-foreground">
          Off by default. Turn on only if each quiz session should email a certificate automatically.
          Course completion certificates are issued from Grade work after the final package.
        </p>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={autoIssue}
            disabled={busyId === "auto"}
            onChange={(e) => void toggleAutoIssue(e.target.checked)}
          />
          Auto-issue quiz-session certificates
        </label>
      </section>

      {requirement && course && (
        <section className="staff-row-card space-y-3">
          <div className="text-sm font-bold">Course certificate policy</div>
          <div className="flex flex-wrap gap-4 text-xs font-semibold">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={requirement.requireQuiz}
                onChange={(e) => patchRequirement({ requireQuiz: e.target.checked })}
              />
              Require final quiz pass
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={requirement.requirePractical}
                onChange={(e) => patchRequirement({ requirePractical: e.target.checked })}
              />
              Require graded practical
            </label>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold">Required quizzes</div>
            {courseQuizzes.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No quizzes linked to this course yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {courseQuizzes.map((q) => {
                  const checked = (requirement.requiredQuizIds || []).includes(q.id);
                  return (
                    <label
                      key={q.id}
                      className="inline-flex items-start gap-2 rounded-xl border border-border bg-background px-3 py-2 text-[11px] font-semibold"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        onChange={() => toggleRequiredQuiz(q.id)}
                      />
                      <span>
                        #{q.quizNumber ?? "?"} {q.titleEn}
                        <span className="block font-mono font-normal text-muted-foreground">{q.id}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <label className="font-semibold">
              Certificate title (EN)
              <input
                className="mt-1 staff-input"
                value={requirement.certificateTitleEn || ""}
                onChange={(e) => patchRequirement({ certificateTitleEn: e.target.value })}
              />
            </label>
            <label className="font-semibold">
              Certificate title (BN)
              <input
                className="mt-1 staff-input"
                value={requirement.certificateTitleBn || ""}
                onChange={(e) => patchRequirement({ certificateTitleBn: e.target.value })}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void saveRequirement()}
            disabled={busyId === "req"}
            className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {busyId === "req" ? "Saving…" : "Save certificate policy"}
          </button>
        </section>
      )}
        </>
      )}

      {deskView === "grade" && !activeSub && (
        <section className="space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h3 className="text-base font-black tracking-tight">Grading queue</h3>
              <p className="text-xs text-muted-foreground">
                Filter and sort by rank, marks, quiz, practical, or centre. Prev / Next inside a
                student follows your active order.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBatchTools((v) => !v)}
                className={
                  showBatchTools
                    ? "inline-flex items-center gap-1.5 rounded-xl border border-primary/50 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-colors"
                    : "staff-btn-ghost"
                }
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>{showBatchTools ? "Hide batch tools" : "Batch & import tools"}</span>
              </button>
              <button
                type="button"
                onClick={() => void bulkIssue()}
                disabled={busyId === "bulk" || !course || courseSubs.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-200"
              >
                <Award className="h-3.5 w-3.5" />
                <span>{busyId === "bulk" ? "Issuing…" : "Issue all eligible"}</span>
              </button>
            </div>
          </div>

          {/* Collapsible Batch & Import Tools */}
          {showBatchTools && (
            <div className="rounded-2xl border border-border/80 bg-muted/25 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Batch sync, reviewed grades &amp; imports
                </span>
                <button
                  type="button"
                  onClick={() => setShowBatchTools(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close batch tools"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void refreshQuizScores()}
                  disabled={!!busyId || !course}
                  className="staff-btn-ghost disabled:opacity-50"
                >
                  {busyId === "quiz-refresh" ? "Refreshing…" : "Refresh quiz scores"}
                </button>
                <button
                  type="button"
                  onClick={() => void applyReviewedGrades(true)}
                  disabled={!!busyId || !course}
                  className="staff-btn-ghost disabled:opacity-50"
                >
                  {busyId === "revgrade-dry" ? "Checking…" : "Preview reviewed marks"}
                </button>
                <button
                  type="button"
                  onClick={() => void applyReviewedGrades(false)}
                  disabled={!!busyId || !course || pendingGradeCount === 0}
                  className="staff-btn-ghost disabled:opacity-50"
                >
                  {busyId === "revgrade"
                    ? "Applying…"
                    : `Apply reviewed marks (${pendingGradeCount})`}
                </button>
                <button
                  type="button"
                  onClick={() => void applyReviewedGrades(false, true)}
                  disabled={!!busyId || !course}
                  className="staff-btn-ghost disabled:opacity-50"
                >
                  {busyId === "revgrade-restore" ? "Restoring…" : "Restore comments"}
                </button>
                <button
                  type="button"
                  onClick={() => void mergeQuiz17IntoFinal(true)}
                  disabled={!!busyId || !course}
                  className="staff-btn-ghost disabled:opacity-50"
                >
                  {busyId === "q17-dry" ? "Checking…" : "Preview Quiz 17 → Final"}
                </button>
                <button
                  type="button"
                  onClick={() => void mergeQuiz17IntoFinal(false)}
                  disabled={!!busyId || !course}
                  className="staff-btn-ghost disabled:opacity-50"
                >
                  {busyId === "q17-merge" ? "Merging…" : "Merge Quiz 17 → Final"}
                </button>
                <button
                  type="button"
                  onClick={() => void importGoogleFormBackups(true)}
                  disabled={!!busyId || !course}
                  className="staff-btn-ghost disabled:opacity-50"
                >
                  {busyId === "gform-dry" ? "Checking…" : "Preview Google Form import"}
                </button>
                <button
                  type="button"
                  onClick={() => void importGoogleFormBackups(false)}
                  disabled={!!busyId || !course}
                  className="staff-btn-ghost disabled:opacity-50"
                >
                  {busyId === "gform" ? "Importing…" : "Import Google Form (33)"}
                </button>
              </div>
            </div>
          )}

          {/* Interactive Summary Metrics */}
          {courseSubs.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => {
                  setQueueFilter("all");
                  setQueueScoreFilter("all");
                }}
                className={`staff-metric staff-metric-clickable text-left ${
                  queueFilter === "all" && queueScoreFilter === "all"
                    ? "ring-2 ring-primary/40 border-primary/50"
                    : ""
                }`}
              >
                <div className="staff-metric-label">Total submissions</div>
                <div className="staff-metric-value">{queueStats.total}</div>
                <div className="staff-metric-hint">
                  {queueStats.avgTotalMarks !== null
                    ? `Avg ${queueStats.avgTotalMarks}/${exam?.totalMaxMarks ?? 70} (${queueStats.avgCombinedPct}%)`
                    : `${queueStats.withQuiz} with quiz linked`}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQueueFilter("needs");
                  setQueueScoreFilter("all");
                }}
                className={`staff-metric staff-metric-amber staff-metric-clickable text-left ${
                  queueFilter === "needs" ? "ring-2 ring-amber-500/40 border-amber-500/50" : ""
                }`}
              >
                <div className="staff-metric-label">Needs grading</div>
                <div className="staff-metric-value">{queueStats.needs}</div>
                <div className="staff-metric-hint">
                  {queueStats.late} late · {queueStats.returned} returned
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQueueFilter("graded");
                  setQueueScoreFilter("all");
                }}
                className={`staff-metric staff-metric-emerald staff-metric-clickable text-left ${
                  queueFilter === "graded" && queueScoreFilter === "all"
                    ? "ring-2 ring-emerald-500/40 border-emerald-500/50"
                    : ""
                }`}
              >
                <div className="staff-metric-label">Graded</div>
                <div className="staff-metric-value">{queueStats.graded}</div>
                <div className="staff-metric-hint">
                  {queueStats.passing} passing · {queueStats.topPerformers} top 80%+
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQueueFilter("all");
                  setQueueScoreFilter(queueStats.failing > 0 ? "failing" : "missing_quiz");
                  if (queueStats.failing > 0) setQueueSort("total_asc");
                }}
                className={`staff-metric staff-metric-rose staff-metric-clickable text-left ${
                  queueScoreFilter === "failing" || queueScoreFilter === "missing_quiz"
                    ? "ring-2 ring-rose-500/40 border-rose-500/50"
                    : ""
                }`}
              >
                <div className="staff-metric-label">Below pass (&lt;{queueStats.passThresholdPct}%)</div>
                <div className="staff-metric-value">{queueStats.failing}</div>
                <div className="staff-metric-hint">
                  {queueStats.missingQuiz} missing quiz score
                </div>
              </button>
            </div>
          )}

          {/* Filter & Sorting Control Bar */}
          <div className="rounded-2xl border border-border/80 bg-card p-3 space-y-3 shadow-xs">
            {/* Row 1: Status Tabs + 1-Click Quick Sort Chips */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div
                className="flex flex-wrap gap-1 rounded-xl border border-border/80 bg-muted/35 p-1"
                role="tablist"
                aria-label="Grading status filter"
              >
                {(
                  [
                    { id: "all" as const, label: "All", count: queueStats.total },
                    { id: "needs" as const, label: "Needs grade", count: queueStats.needs },
                    { id: "graded" as const, label: "Graded", count: queueStats.graded },
                    ...(queueStats.late > 0
                      ? [{ id: "late" as const, label: "Late", count: queueStats.late }]
                      : []),
                    ...(queueStats.returned > 0
                      ? [{ id: "returned" as const, label: "Returned", count: queueStats.returned }]
                      : []),
                  ] as const
                ).map((f) => {
                  const active = queueFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setQueueFilter(f.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                        active
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>{f.label}</span>
                      <span
                        className={`inline-flex min-w-[1.2rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                          f.id === "needs" && f.count > 0
                            ? "bg-amber-500/20 text-amber-800 dark:text-amber-200"
                            : f.id === "graded"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {f.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 1-Click Quick Sort Pills */}
              <div className="flex flex-wrap items-center gap-1.5" aria-label="Quick sort options">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-0.5">
                  Quick sort:
                </span>
                {(
                  [
                    {
                      label: "Rank (High → Low)",
                      active: queueSort === "total_desc",
                      onClick: () => setQueueSort("total_desc"),
                      icon: <ArrowDownWideNarrow className="h-3 w-3" />,
                    },
                    {
                      label: "Low → High",
                      active: queueSort === "total_asc",
                      onClick: () => setQueueSort("total_asc"),
                      icon: <ArrowUpNarrowWide className="h-3 w-3" />,
                    },
                    {
                      label:
                        queueSort === "practical_asc"
                          ? "Practical ↑"
                          : queueSort === "practical_desc"
                            ? "Practical ↓"
                            : "Practical",
                      active: queueSort === "practical_desc" || queueSort === "practical_asc",
                      onClick: () =>
                        setQueueSort(
                          queueSort === "practical_desc" ? "practical_asc" : "practical_desc",
                        ),
                    },
                    {
                      label:
                        queueSort === "quiz_asc"
                          ? "Quiz ↑"
                          : queueSort === "quiz_desc"
                            ? "Quiz ↓"
                            : "Quiz",
                      active: queueSort === "quiz_desc" || queueSort === "quiz_asc",
                      onClick: () =>
                        setQueueSort(queueSort === "quiz_desc" ? "quiz_asc" : "quiz_desc"),
                    },
                    {
                      label: queueSort === "roll_desc" ? "Roll Z–A" : "Roll A–Z",
                      active: queueSort === "roll_asc" || queueSort === "roll_desc",
                      onClick: () =>
                        setQueueSort(queueSort === "roll_asc" ? "roll_desc" : "roll_asc"),
                    },
                  ] as const
                ).map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={chip.onClick}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      chip.active
                        ? "border-primary/50 bg-primary/12 text-primary shadow-2xs"
                        : "border-border bg-background/70 text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {"icon" in chip ? chip.icon : null}
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: Search, Region, Score Band, Full Sort Selector + Flip Direction */}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-12">
              <div className="relative lg:col-span-4">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  placeholder="Search roll, student name, region, phone…"
                  className="staff-input !py-1.5 !pl-8 !pr-7 text-xs"
                />
                {queueSearch && (
                  <button
                    type="button"
                    onClick={() => setQueueSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="lg:col-span-2">
                <select
                  value={queueRegion}
                  onChange={(e) => setQueueRegion(e.target.value)}
                  className="staff-input !py-1.5 text-xs"
                  aria-label="Filter by region"
                >
                  <option value="all">All regions ({queueRegions.length})</option>
                  {queueRegions.map(([reg, count]) => (
                    <option key={reg} value={reg}>
                      {reg} ({count})
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-3">
                <select
                  value={queueScoreFilter}
                  onChange={(e) => setQueueScoreFilter(e.target.value as GradeQueueScoreFilter)}
                  className="staff-input !py-1.5 text-xs"
                  aria-label="Filter by score band"
                >
                  <option value="all">All scores &amp; results</option>
                  <option value="top">Top performers 80%+ ({queueStats.topPerformers})</option>
                  <option value="passing">
                    Passing ≥{queueStats.passThresholdPct}% ({queueStats.passing})
                  </option>
                  <option value="failing">
                    Below pass &lt;{queueStats.passThresholdPct}% ({queueStats.failing})
                  </option>
                  <option value="missing_quiz">
                    Missing quiz score ({queueStats.missingQuiz})
                  </option>
                  <option value="has_quiz">Has quiz score ({queueStats.withQuiz})</option>
                  <option value="ungraded_practical">
                    Ungraded practical ({queueStats.total - queueStats.graded})
                  </option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 lg:col-span-3">
                <select
                  value={queueSort}
                  onChange={(e) => setQueueSort(e.target.value as GradeQueueSortBy)}
                  className="staff-input !py-1.5 text-xs flex-1"
                  aria-label="Sort submissions"
                >
                  {GRADE_QUEUE_SORT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setQueueSort(getFlipSortTarget(queueSort))}
                  title="Flip sort direction (High ↔ Low / A ↔ Z)"
                  aria-label="Flip sort direction"
                  className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Active Filter Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              <div className="flex flex-wrap items-center gap-1.5">
                <Filter className="h-3 w-3 text-primary" />
                <span>
                  Showing <strong className="text-foreground">{filteredQueueItems.length}</strong>{" "}
                  of <strong className="text-foreground">{courseSubs.length}</strong> submissions ·{" "}
                  Sorted by <strong className="text-foreground">{activeSortMeta.label}</strong>
                </span>
              </div>
              {hasActiveQueueFilters && (
                <button
                  type="button"
                  onClick={resetQueueFilters}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/10"
                >
                  <RotateCcw className="h-3 w-3" /> Reset filters
                </button>
              )}
            </div>
          </div>

          {/* Queue List */}
          {courseSubs.length === 0 ? (
            <div className="staff-empty">
              <p className="staff-empty-title">No submissions yet</p>
              <p className="staff-empty-desc">
                Students submit practical work from the portal after the final quiz unlocks.
              </p>
            </div>
          ) : filteredQueueItems.length === 0 ? (
            <div className="staff-empty space-y-2">
              <p className="staff-empty-title">No submissions match these filters</p>
              <p className="staff-empty-desc">
                Try clearing the search query, region, or score band filter.
              </p>
              {hasActiveQueueFilters && (
                <button
                  type="button"
                  onClick={resetQueueFilters}
                  className="staff-btn-ghost mx-auto !py-1.5 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset all filters
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
              {filteredQueueItems.map((item, idx) => {
                const { sub } = item;
                const pctBar = Math.max(
                  0,
                  Math.min(100, Math.round((item.totalMarks / Math.max(1, item.maxTotal)) * 100)),
                );
                const barTone =
                  item.combinedPct === null
                    ? "bg-muted-foreground/30"
                    : item.combinedPct >= 80
                      ? "bg-emerald-500"
                      : item.isPassing
                        ? "bg-sky-500"
                        : "bg-rose-500";
                const scoreTextTone =
                  item.combinedPct === null
                    ? "text-muted-foreground"
                    : item.combinedPct >= 80
                      ? "text-emerald-700 dark:text-emerald-300"
                      : item.isPassing
                        ? "text-foreground"
                        : "text-rose-700 dark:text-rose-300";
                const rankBadgeTone =
                  item.meritRank === 1
                    ? "border-amber-500/45 bg-amber-500/15 text-amber-800 dark:text-amber-200"
                    : item.meritRank === 2
                      ? "border-slate-400/45 bg-slate-400/15 text-slate-700 dark:text-slate-200"
                      : item.meritRank === 3
                        ? "border-orange-500/40 bg-orange-500/15 text-orange-800 dark:text-orange-200"
                        : "border-border bg-muted/50 text-muted-foreground";
                return (
                  <li key={sub.id}>
                    <button
                      type="button"
                      onClick={() => goDesk({ desk: "grade", subId: sub.id })}
                      className="flex w-full flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 text-left transition-colors hover:bg-muted/40 sm:flex-nowrap"
                    >
                      {/* Row Position & Avatar */}
                      <span className="w-6 shrink-0 font-mono text-[11px] font-bold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <div className="assess-avatar !h-9 !w-9 !text-[11px] shrink-0" aria-hidden>
                        {studentInitials(sub.studentName)}
                      </div>

                      {/* Identity & Meta */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-foreground">
                            {sub.studentName}
                          </span>
                          {item.meritRank !== null && (
                            <span
                              className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-black ${rankBadgeTone}`}
                              title={`Course merit rank #${item.meritRank}`}
                            >
                              {item.meritRank <= 3 && <Trophy className="h-2.5 w-2.5" />}
                              #{item.meritRank}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground/80">{sub.rollNumber}</span>
                          {sub.regionName && <span>· {sub.regionName}</span>}
                          {item.totalTaskCount > 0 && (
                            <span className="text-[10px]">
                              · {item.answeredTaskCount}/{item.totalTaskCount} tasks
                            </span>
                          )}
                          {item.fileCount > 0 && (
                            <span className="text-[10px]">
                              · {item.fileCount} file{item.fileCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Score Breakdown Pills */}
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px]">
                          <span
                            className={`rounded-lg border px-2 py-1 ${
                              item.hasQuiz
                                ? "border-border/80 bg-muted/35 text-foreground"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                            }`}
                            title={
                              item.hasQuiz
                                ? `Final Quiz: ${item.quizMarks}/${item.quizMaxMarks} (${item.quizPct}%)`
                                : "No Final Quiz score linked yet"
                            }
                          >
                            <span className="text-[9px] font-sans font-bold uppercase text-muted-foreground mr-1">
                              Q
                            </span>
                            {item.hasQuiz ? `${item.quizMarks}/${item.quizMaxMarks}` : "—"}
                          </span>
                          <span
                            className={`rounded-lg border px-2 py-1 ${
                              item.hasPracticalScore
                                ? "border-border/80 bg-muted/35 text-foreground"
                                : "border-border/60 bg-muted/20 text-muted-foreground"
                            }`}
                            title={
                              item.hasPracticalScore
                                ? `Practical: ${item.practicalMarks}/${item.practicalMaxMarks} (${item.practicalPct}%)`
                                : "Practical not graded yet"
                            }
                          >
                            <span className="text-[9px] font-sans font-bold uppercase text-muted-foreground mr-1">
                              P
                            </span>
                            {item.hasPracticalScore
                              ? `${item.practicalMarks}/${item.practicalMaxMarks}`
                              : "—"}
                          </span>
                        </div>

                        {/* Total Score + Micro Bar */}
                        <div className="min-w-[82px] text-right">
                          <div className={`font-mono text-xs font-black ${scoreTextTone}`}>
                            {item.combinedPct !== null
                              ? `${item.totalMarks}/${item.maxTotal}`
                              : "—"}
                            {item.combinedPct !== null && (
                              <span className="ml-1 text-[10px] font-semibold text-muted-foreground">
                                {item.combinedPct}%
                              </span>
                            )}
                          </div>
                          <div className="mt-1 ml-auto h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full transition-all ${barTone}`}
                              style={{ width: `${pctBar}%` }}
                            />
                          </div>
                        </div>

                        <div className="w-[74px] flex justify-end">
                          <StatusPill status={sub.status} />
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {deskView === "grade" && activeSub && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => goDesk({ desk: "grade", subId: null })}
              className="staff-btn-ghost !py-1.5 !px-2.5 text-[11px]"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Queue
            </button>
            <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-muted-foreground">
              <span>
                {activeSubIndex + 1} / {navQueue.length}
              </span>
              <span className="hidden sm:inline font-sans text-[10px] font-semibold opacity-80">
                · {activeSortMeta.shortLabel}
              </span>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={activeSubIndex <= 0}
                onClick={() => {
                  const prev = navQueue[activeSubIndex - 1];
                  if (prev) goDesk({ desk: "grade", subId: prev.id });
                }}
                className="staff-btn-ghost !py-1.5 !px-2.5 text-[11px] disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                type="button"
                disabled={activeSubIndex < 0 || activeSubIndex >= navQueue.length - 1}
                onClick={() => {
                  const next = navQueue[activeSubIndex + 1];
                  if (next) goDesk({ desk: "grade", subId: next.id });
                }}
                className="staff-btn-ghost !py-1.5 !px-2.5 text-[11px] disabled:opacity-40"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {(() => {
            const sub = activeSub;
            const graded = sub.status === "graded";
            const issueReady = canIssueCert(sub);
            return (
              <article className="assess-card">
                <header className="assess-card-head">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="assess-avatar" aria-hidden>
                      {studentInitials(sub.studentName)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-lg font-black tracking-tight">
                        {sub.studentName}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {sub.rollNumber}
                        {sub.regionName ? ` · ${sub.regionName}` : ""}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <StatusPill status={sub.status} />
                        <span className="staff-chip">
                          Quiz{" "}
                          {quizRecord?.found
                            ? `${quizRecord.quizMarks}/${quizRecord.quizMaxMarks} (${quizRecord.accuracyPct}%)`
                            : typeof sub.quizAccuracyPct === "number"
                              ? `${sub.quizAccuracyPct}%`
                              : "—"}
                        </span>
                        {typeof (quizRecordMeta?.practicalScorePct ?? sub.practicalScorePct) ===
                          "number" && (
                          <span className="staff-chip">
                            Practical {quizRecordMeta?.practicalScorePct ?? sub.practicalScorePct}%
                          </span>
                        )}
                        <span className="staff-chip">
                          Combined{" "}
                          {typeof (quizRecordMeta?.combinedPct ?? sub.combinedPct) === "number"
                            ? `${quizRecordMeta?.combinedPct ?? sub.combinedPct}%`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {graded && (
                    <button
                      type="button"
                      onClick={() => void returnOne(sub)}
                      disabled={busyId === `return-${sub.id}`}
                      className="staff-btn-ghost !py-1.5 !px-2.5 text-[11px]"
                    >
                      <RotateCcw className="h-3 w-3" /> Ask to resubmit
                    </button>
                  )}
                </header>

                <div className="assess-body">
                  <div className="assess-work">
                    <section className="mb-4 rounded-2xl border border-border/70 bg-muted/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-bold tracking-wide text-muted-foreground">
                          Final Quiz record
                        </div>
                        {quizRecord?.matchedVia && quizRecord.found && (
                          <span className="staff-chip !normal-case">
                            matched via {quizRecord.matchedVia}
                            {quizRecord.matchedRollNumber &&
                            quizRecord.matchedRollNumber !== sub.rollNumber
                              ? ` · roll ${quizRecord.matchedRollNumber}`
                              : ""}
                          </span>
                        )}
                      </div>
                      {quizRecord?.found ? (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="rounded-xl bg-background/80 px-3 py-2">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              Marks
                            </div>
                            <div className="font-mono text-sm font-black">
                              {quizRecord.quizMarks}/{quizRecord.quizMaxMarks}
                              <span className="ml-1 text-xs font-semibold text-muted-foreground">
                                ({quizRecord.accuracyPct}%)
                              </span>
                            </div>
                          </div>
                          <div className="rounded-xl bg-background/80 px-3 py-2">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              Answers
                            </div>
                            <div className="text-sm font-semibold">
                              ✓ {quizRecord.correctCount} · ✗ {quizRecord.incorrectCount} · —{" "}
                              {quizRecord.unattemptedCount}
                            </div>
                          </div>
                          <div className="rounded-xl bg-background/80 px-3 py-2">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              Session
                            </div>
                            <div className="font-mono text-[11px] font-semibold">
                              PIN {quizRecord.pin || "—"}
                              {quizRecord.quizTitleEn ? (
                                <div className="mt-0.5 truncate font-sans text-[10px] font-medium text-muted-foreground">
                                  {quizRecord.quizTitleEn}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          {(quizRecord.noteEn || quizRecord.submittedAt) && (
                            <div className="sm:col-span-2 lg:col-span-3 text-[11px] leading-relaxed text-muted-foreground">
                              {quizRecord.noteEn}
                              {quizRecord.noteBn ? ` / ${quizRecord.noteBn}` : ""}
                              {quizRecord.submittedAt
                                ? ` · submitted ${new Date(quizRecord.submittedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} Asia/Dhaka`
                                : ""}
                            </div>
                          )}
                          {typeof quizRecordMeta?.weights?.quizWeightPct === "number" &&
                            typeof quizRecordMeta.practicalScorePct === "number" && (
                              <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-dashed border-border/80 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                                Combined = quiz {quizRecord.accuracyPct}% ×{" "}
                                {quizRecordMeta.weights.quizWeightPct}% + practical{" "}
                                {quizRecordMeta.practicalScorePct}% ×{" "}
                                {quizRecordMeta.weights.practicalWeightPct}%
                                {typeof quizRecordMeta.combinedPct === "number"
                                  ? ` → ${quizRecordMeta.combinedPct}%`
                                  : ""}
                                {typeof quizRecordMeta.weights.quizMaxMarks === "number" &&
                                typeof quizRecordMeta.weights.practicalMaxMarks === "number"
                                  ? ` · package ${quizRecord.quizMarks}/${quizRecordMeta.weights.quizMaxMarks} quiz + practical /${quizRecordMeta.weights.practicalMaxMarks}`
                                  : ""}
                              </div>
                            )}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {quizRecord?.noteEn ||
                            "No Final Quiz result linked to this roll yet."}
                          {quizRecord?.noteBn ? ` / ${quizRecord.noteBn}` : ""}
                          {" "}
                          Use <span className="font-semibold">Refresh quiz scores</span> if they
                          sat under another roll/phone.
                        </p>
                      )}
                    </section>

                    <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" /> Submitted work
                    </div>
                    {sub.answers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No answers attached.</p>
                    ) : (
                      sub.answers.map((a, taskIdx) => {
                        const task = exam?.tasks.find((t) => t.id === a.taskId);
                        return (
                          <div key={a.taskId} className="assess-task">
                            <div className="assess-task-title">
                              {taskIdx + 1}. {task?.titleEn || a.taskId}
                            </div>
                            <div className="assess-task-body">{a.textAnswer || "—"}</div>
                            {a.linkUrl && (
                              <a
                                href={a.linkUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex break-all text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-300"
                              >
                                {a.linkUrl}
                              </a>
                            )}
                            {a.fileName && (
                              <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[10px] text-muted-foreground">
                                <span>
                                  {a.fileName}
                                  {typeof a.fileSizeBytes === "number"
                                    ? ` · ${Math.round(a.fileSizeBytes / 1024)} KB`
                                    : ""}
                                </span>
                                {a.fileRelPath && (
                                  <button
                                    type="button"
                                    onClick={() => void downloadFile(sub, a.taskId)}
                                    disabled={busyId === `dl-${sub.id}-${a.taskId}`}
                                    className="staff-btn-ghost !px-2 !py-0.5 text-[10px]"
                                  >
                                    <Download className="h-3 w-3" /> Download
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <aside className="assess-grade-rail">
                    <div className="flex items-center justify-between gap-2">
                      <h4>Marks</h4>
                      {exam && canGrade(sub.status) && (
                        <button
                          type="button"
                          disabled={aiGradingSubId === sub.id}
                          onClick={() => void suggestGradeWithAi(sub)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-extrabold text-violet-700 hover:bg-violet-500/20 transition disabled:opacity-50 dark:text-violet-300"
                          title="Draft rubric scores & bilingual EN/BN remarks with AI Pool"
                        >
                          {aiGradingSubId === sub.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          <span>{aiGradingSubId === sub.id ? "Drafting…" : "AI Suggest"}</span>
                        </button>
                      )}
                    </div>
                    {aiDraftMetaBySub[sub.id] && (
                      <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[11px] text-violet-900 dark:text-violet-200 space-y-0.5">
                        <div className="font-extrabold flex items-center justify-between gap-2">
                          <span>AI Draft Ready — Review &amp; Save</span>
                          <span className="font-mono text-[10px] opacity-80">
                            {aiDraftMetaBySub[sub.id]!.provider} · {aiDraftMetaBySub[sub.id]!.latencyMs}ms
                          </span>
                        </div>
                        <p className="opacity-90 leading-snug">{aiDraftMetaBySub[sub.id]!.summary}</p>
                      </div>
                    )}
                    {exam && canGrade(sub.status) ? (
                      <>
                        <div className="space-y-3">
                          {exam.tasks.map((task) => {
                            const existing = sub.grades?.find((g) => g.taskId === task.id);
                            const commentKey = markKey(sub.id, `${task.id}::comment`);
                            return (
                              <div key={task.id} className="staff-field">
                                <label className="block">
                                  <span className="staff-label">
                                    {task.titleEn}{" "}
                                    <span className="font-mono font-normal text-muted-foreground">
                                      / {task.maxMarks}
                                    </span>
                                  </span>
                                  <input
                                    className="staff-input font-mono"
                                    inputMode="decimal"
                                    value={
                                      marksBySubTask[markKey(sub.id, task.id)] ??
                                      String(existing?.marks ?? "")
                                    }
                                    onChange={(e) =>
                                      setMarksBySubTask((m) => ({
                                        ...m,
                                        [markKey(sub.id, task.id)]: e.target.value,
                                      }))
                                    }
                                  />
                                </label>
                                <label className="mt-1.5 block">
                                  <span className="sr-only">Comment for {task.titleEn}</span>
                                  <textarea
                                    className="staff-input min-h-[52px] text-[10px] leading-snug"
                                    rows={2}
                                    placeholder="EN / BN remark for this task"
                                    value={
                                      marksBySubTask[commentKey] ?? existing?.comment ?? ""
                                    }
                                    onChange={(e) =>
                                      setMarksBySubTask((m) => ({
                                        ...m,
                                        [commentKey]: e.target.value,
                                      }))
                                    }
                                  />
                                </label>
                              </div>
                            );
                          })}
                          <label className="staff-field">
                            <span className="staff-label">Feedback to student</span>
                            <textarea
                              className="staff-input min-h-[72px]"
                              rows={3}
                              value={feedbackBySub[sub.id] ?? sub.instructorFeedback ?? ""}
                              onChange={(e) =>
                                setFeedbackBySub((m) => ({ ...m, [sub.id]: e.target.value }))
                              }
                            />
                          </label>
                        </div>
                        <div className="assess-actions">
                          <button
                            type="button"
                            onClick={() => void gradeOne(sub)}
                            disabled={busyId === sub.id}
                            className="staff-btn-primary w-full disabled:opacity-60"
                          >
                            {busyId === sub.id
                              ? "Saving…"
                              : graded
                                ? "Update grade"
                                : "Save grade"}
                          </button>
                          {issueReady ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void issueOne(sub.rollNumber)}
                                disabled={busyId === `issue-${sub.rollNumber}`}
                                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-500/15 disabled:opacity-50 dark:text-emerald-200"
                              >
                                <Award className="h-3.5 w-3.5" /> Issue &amp; email certificate
                              </button>
                              <button
                                type="button"
                                onClick={() => void emailCertOne(sub.rollNumber)}
                                disabled={busyId === `email-${sub.rollNumber}`}
                                className="staff-btn-ghost w-full !justify-center disabled:opacity-50"
                              >
                                <Mail className="h-3.5 w-3.5" /> Resend certificate email
                              </button>
                            </>
                          ) : (
                            <p className="text-[11px] leading-relaxed text-muted-foreground">
                              Save a grade first to unlock the course certificate.
                            </p>
                          )}
                          {activeSubIndex < navQueue.length - 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = navQueue[activeSubIndex + 1];
                                if (next) goDesk({ desk: "grade", subId: next.id });
                              }}
                              className="staff-btn-ghost w-full !justify-center"
                            >
                              Next student <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        This submission is not ready to grade yet.
                      </p>
                    )}
                  </aside>
                </div>
              </article>
            );
          })()}
        </section>
      )}
    </div>
  );
}

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
