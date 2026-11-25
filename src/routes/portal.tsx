import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CertificateView } from "@/components/common/CertificateView";
import { useLanguage } from "@/lib/i18n";
import { downloadCertificatePdf } from "@/lib/pdf-generator";
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
  CourseMaterialResource,
  CourseRecording,
  PracticalExam,
  PracticalSubmission,
  PracticalTask,
} from "@/lib/types";
import {
  DEFAULT_PRACTICAL_MAX_FILE_BYTES,
  isPracticalPastDeadline,
  isPracticalWindowOpen,
} from "@/lib/practical-exam";
import type { TutorStudyMode } from "@/lib/ai-tutor-core";
import {
  AlertCircle,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Film,
  FolderOpen,
  GraduationCap,
  Home,
  Image as ImageIcon,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Palette,
  Phone,
  Play,
  Presentation,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type PortalTab =
  | "overview"
  | "materials"
  | "recordings"
  | "quizzes"
  | "final"
  | "practical"
  | "tutor"
  | "certificate";

type PortalPayload = Awaited<ReturnType<typeof serverGetStudentPortal>>;

type TaskDraft = {
  textAnswer: string;
  linkUrl: string;
  fileName?: string | undefined;
  fileMime?: string | undefined;
  fileBase64?: string | undefined;
};

type TutorChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sourcesUsed?: Array<{ id: string; title: string; kind: string }> | undefined;
  provider?: string | undefined;
  model?: string | undefined;
  latencyMs?: number | undefined;
  error?: boolean | undefined;
};

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Student Learning Portal · Onnesha Arena" },
      {
        name: "description",
        content:
          "Student learning workspace for course materials, class recordings, AI Course Tutor, quizzes, practical capstone submission, and verified certificates.",
      },
    ],
  }),
  component: StudentPortalPage,
});

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
    final_quiz_result: "Final quiz not completed",
    final_quiz_pass: "Final quiz below pass mark",
    practical_submission: "Practical capstone not submitted",
    practical_grading: "Practical awaiting instructor grading",
    practical_pass: "Practical below pass mark",
    combined_pass: "Combined score below pass threshold",
  };
  return (lang === "bn" ? mapBn : mapEn)[code] || code;
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace(/^\/+/, "").split("/")[0];
      return id && id.length === 11 ? id : null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && v.length === 11) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live");
      if (embedIdx >= 0 && parts[embedIdx + 1]?.length === 11) {
        return parts[embedIdx + 1]!;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function StatusPill({ status, lang }: { status: string; lang: string }) {
  const labelsBn: Record<string, string> = {
    open: "খোলা আছে",
    graded: "মার্কিং সম্পন্ন",
    submitted: "জমা হয়েছে",
    late: "বিলম্বে জমা",
    returned: "সংশোধন প্রয়োজন",
    scheduled: "নির্ধারিত",
    closed: "বন্ধ",
  };
  const tone =
    status === "open" || status === "graded"
      ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
      : status === "submitted"
        ? "border-sky-500/30 bg-sky-500/12 text-sky-700 dark:text-sky-300"
        : status === "late" || status === "returned" || status === "scheduled"
          ? "border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-300"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${tone}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "open" || status === "graded"
            ? "bg-emerald-500"
            : status === "submitted"
              ? "bg-sky-500"
              : status === "late" || status === "returned" || status === "scheduled"
                ? "bg-amber-500"
                : "bg-muted-foreground"
        }`}
      />
      {lang === "bn" ? labelsBn[status] || status : status}
    </span>
  );
}

function ProgressRing({ pct, size = 68 }: { pct: number; size?: number }) {
  const clamped = Math.min(100, Math.max(0, Math.round(pct)));
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/70"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-all duration-500"
        />
      </svg>
      <span className="absolute font-mono text-sm font-black text-foreground">{clamped}%</span>
    </div>
  );
}

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
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portal, setPortal] = useState<PortalPayload | null>(null);
  const [portalTab, setPortalTab] = useState<PortalTab>("overview");
  const [switchingCourse, setSwitchingCourse] = useState(false);

  // Materials search, session filter & expand
  const [materialQuery, setMaterialQuery] = useState("");
  const [materialSessionFilter, setMaterialSessionFilter] = useState<string>("all");
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [expandedFilesId, setExpandedFilesId] = useState<string | null>(null);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const [quizFilter, setQuizFilter] = useState<"all" | "passed" | "pending">("all");

  // AI Tutor state
  const [tutorQ, setTutorQ] = useState("");
  const [tutorMode, setTutorMode] = useState<TutorStudyMode>("explain");
  const [tutorMessages, setTutorMessages] = useState<TutorChatMessage[]>([]);
  const [copiedTutorMsgId, setCopiedTutorMsgId] = useState<string | null>(null);
  const [tutorBusy, setTutorBusy] = useState(false);
  const tutorEndRef = useRef<HTMLDivElement | null>(null);

  // Practical submission state
  const [drafts, setDrafts] = useState<Record<string, TaskDraft>>({});
  const [submitting, setSubmitting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
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
    try {
      const raw = sessionStorage.getItem("onnesha_portal_handoff");
      if (raw) {
        const handoff = JSON.parse(raw) as {
          email?: string;
          phone?: string;
          rollNumber?: string;
          name?: string;
        };
        if (handoff.email) setEmail(handoff.email);
        if (handoff.phone) setPhone(handoff.phone);
        if (handoff.rollNumber) setRollNumber(handoff.rollNumber);
      }
    } catch {
      // ignore bad handoff
    }
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
          if (res.student?.email) setEmail(res.student.email);
          hydrateDrafts(
            res.practicalExam as PracticalExam | undefined,
            res.submission as PracticalSubmission | undefined,
          );
          try {
            sessionStorage.removeItem("onnesha_portal_handoff");
          } catch {
            // ignore
          }
        }
      } catch {
        // not signed in yet
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (portalTab === "tutor") {
      tutorEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [tutorMessages, tutorBusy, portalTab]);

  // Derived data (all hooks BEFORE any conditional returns!)
  const completion = portal?.success ? portal.completion : null;
  const gradedLocked = portal?.submission?.status === "graded";
  const returnedForResubmit = portal?.submission?.status === "returned";
  const windowOpen = practicalExam ? isPracticalWindowOpen(practicalExam) : false;
  const notOpenYet =
    !!practicalExam?.opensAt && new Date().toISOString() < practicalExam.opensAt;
  const canSubmit = !!practicalExam && !gradedLocked && (windowOpen || returnedForResubmit);
  const pastDeadline = practicalExam ? isPracticalPastDeadline(practicalExam) : false;

  const materials = useMemo(
    () => (portal?.success ? ((portal.materials as CourseMaterial[] | undefined) || []) : []),
    [portal],
  );
  const recordings = useMemo(
    () => (portal?.success ? ((portal.recordings as CourseRecording[] | undefined) || []) : []),
    [portal],
  );
  const announcements = useMemo(
    () =>
      portal?.success
        ? ((portal.announcements as
            | Array<{ id?: string; titleEn: string; titleBn: string; bodyEn: string; bodyBn: string; createdAt?: string }>
            | undefined) || [])
        : [],
    [portal],
  );

  const materialSessionOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const m of materials) {
      const label = (m.sessionLabel || "").trim();
      if (label && !seen.has(label)) {
        seen.add(label);
        list.push(label);
      }
    }
    return list;
  }, [materials]);

  const totalMaterialResources = useMemo(
    () => materials.reduce((sum, m) => sum + (m.resources?.length || (m.url ? 1 : 0)), 0),
    [materials],
  );

  const masterDriveLink = useMemo(() => {
    for (const m of materials) {
      const folder = m.resources?.find(
        (r) => r.kind === "folder" && r.url.includes("drive.google.com/drive/folders/"),
      );
      if (m.id === "mat-sanjibon-drive-master" && folder) return folder.url;
    }
    return materials.find((m) => m.url?.includes("drive.google.com/drive/folders/"))?.url || null;
  }, [materials]);

  const masterCanvaLink = useMemo(() => {
    for (const m of materials) {
      const canva = m.resources?.find((r) => r.kind === "canva_folder");
      if (m.id === "mat-sanjibon-drive-master" && canva) return canva.url;
    }
    return null;
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    const q = materialQuery.trim().toLowerCase();
    return materials.filter((m) => {
      if (
        materialSessionFilter !== "all" &&
        (m.sessionLabel || "").trim() !== materialSessionFilter
      ) {
        return false;
      }
      if (!q) return true;
      const resText = (m.resources || [])
        .map((r) => [r.labelEn, r.labelBn, r.fileName].filter(Boolean).join(" "))
        .join(" ");
      return [m.sessionLabel, m.titleEn, m.titleBn, m.descriptionEn, m.descriptionBn, m.bodyEn, m.bodyBn, resText]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [materials, materialQuery, materialSessionFilter]);

  const progressSummary = useMemo(() => {
    if (!portal?.success) return { done: 0, total: 0, pct: 0 };
    const list = portal.quizProgress || [];
    const done = list.filter((q) => q.passed).length;
    const total = list.length;
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [portal]);

  const filteredQuizzes = useMemo(() => {
    if (!portal?.success) return [];
    const list = portal.quizProgress || [];
    if (quizFilter === "passed") return list.filter((q) => q.passed);
    if (quizFilter === "pending") return list.filter((q) => !q.passed);
    return list;
  }, [portal, quizFilter]);

  const practicalCompletion = useMemo(() => {
    const tasks = practicalExam?.tasks || [];
    if (tasks.length === 0) return { filled: 0, total: 0 };
    let filled = 0;
    for (const t of tasks) {
      const d = drafts[t.id];
      if (d && (d.textAnswer.trim() || d.linkUrl.trim() || d.fileName)) {
        filled += 1;
      }
    }
    return { filled, total: tasks.length };
  }, [practicalExam, drafts]);

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

  const switchCourse = async (nextCourseId: string) => {
    if (!nextCourseId || nextCourseId === portal?.course?.id) return;
    setSwitchingCourse(true);
    setNotice(null);
    try {
      const res = await serverGetStudentPortal({ data: { courseId: nextCourseId } });
      if (!res.success) {
        setNoticeTone("err");
        setNotice(res.error || "Could not switch course.");
        return;
      }
      setPortal(res);
      hydrateDrafts(
        res.practicalExam as PracticalExam | undefined,
        res.submission as PracticalSubmission | undefined,
      );
      setTutorMessages([]);
      setTutorQ("");
      setMaterialQuery("");
      setMaterialSessionFilter("all");
      setExpandedMaterialId(null);
      setExpandedFilesId(null);
      setPlayingRecordingId(null);
    } catch (err) {
      setNoticeTone("err");
      setNotice(err instanceof Error ? err.message : "Could not switch course.");
    } finally {
      setSwitchingCourse(false);
    }
  };

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    setDevOtpHint(null);
    try {
      const res = await serverRequestPortalOtp({
        data: authChannel === "email" ? { email: email.trim() } : { phone: phone.trim() },
      });
      if (!res.success) {
        setError(res.error || "Could not send verification code.");
        setOtpSent(false);
        return;
      }
      setOtpSent(true);
      setOtp("");
      if ("devOtp" in res && res.devOtp) setDevOtpHint(String(res.devOtp));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification code request failed.");
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
        setError(res.error || "Invalid verification code.");
        return;
      }
      if (res.student?.phone) setPhone(res.student.phone);
      if (res.student?.rollNumber) setRollNumber(res.student.rollNumber);
      if (res.student?.email) setEmail(res.student.email);
      await loadPortalAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const sendTutorQuestion = async (questionText: string) => {
    const cleanQ = questionText.trim();
    if (!cleanQ || !portal?.success || !portal.course?.id || tutorBusy) return;
    const userMsgId = `u-${Date.now()}`;
    const historySnapshot = tutorMessages
      .filter((m) => !m.error)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));
    setTutorMessages((prev) => [...prev, { id: userMsgId, role: "user", content: cleanQ }]);
    setTutorQ("");
    setTutorBusy(true);
    try {
      const res = await serverAskCourseTutor({
        data: {
          courseId: portal.course.id,
          question: cleanQ,
          rollNumber: portal.student?.rollNumber,
          lang: lang === "bn" ? "bn" : "en",
          mode: tutorMode,
          history: historySnapshot,
        },
      });
      if (res.success) {
        setTutorMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: res.answer,
            sourcesUsed: res.sourcesUsed,
            provider: res.provider,
            model: res.model,
            latencyMs: res.latencyMs,
          },
        ]);
      } else {
        setTutorMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: res.error || "Tutor unavailable.",
            error: true,
          },
        ]);
      }
    } catch (err) {
      setTutorMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: err instanceof Error ? err.message : "Tutor failed.",
          error: true,
        },
      ]);
    } finally {
      setTutorBusy(false);
    }
  };

  const askTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendTutorQuestion(tutorQ);
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
    const max = practicalExam?.maxFileBytes || DEFAULT_PRACTICAL_MAX_FILE_BYTES;
    const allowed = practicalExam?.allowedMimeTypes;
    if (allowed?.length && file.type && !allowed.includes(file.type)) {
      setNoticeTone("err");
      setNotice(
        lang === "bn"
          ? `এই ফাইল টাইপ অনুমোদিত নয় (${file.type || "unknown"}).`
          : `File type not allowed (${file.type || "unknown"}).`,
      );
      return;
    }
    if (file.size > max) {
      setNoticeTone("err");
      setNotice(
        lang === "bn"
          ? `ফাইলটি অনেক বড়। সর্বোচ্চ ${Math.round(max / (1024 * 1024))} MB অনুমোদিত।`
          : `File exceeds the ${Math.round(max / (1024 * 1024))} MB size limit.`,
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
      setNotice(
        lang === "bn"
          ? "আপনার প্রায়োগিক প্রজেক্ট সফলভাবে জমা হয়েছে।"
          : "Practical capstone submitted successfully.",
      );
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
    setTutorMessages([]);
    setNotice(null);
    setError(null);
  };

  const handleDownloadCertificate = async () => {
    if (!portal?.success || !portal.courseCertificate || !("studentName" in portal.courseCertificate)) {
      return;
    }
    setDownloadingPdf(true);
    try {
      await downloadCertificatePdf(portal.courseCertificate as CertificateData);
    } catch (err) {
      setNoticeTone("err");
      setNotice(err instanceof Error ? err.message : "Could not generate PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // =========================================================================
  // 1. SIGN-IN VIEW (Clean, Focused, Bilingual OTP Desk)
  // =========================================================================
  if (!portal?.success) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <main className="relative flex-1 overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(15,118,110,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(217,119,6,0.08),_transparent_50%)]"
          />

          <div className="relative mx-auto flex min-h-[calc(100dvh-4.5rem)] w-full max-w-6xl flex-col justify-center gap-12 px-5 py-12 sm:px-8 lg:flex-row lg:items-center lg:gap-16">
            {/* Left Column: Clear Student Value Proposition */}
            <div className="flex-1 space-y-6 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3.5 py-1.5 text-xs font-semibold text-primary">
                <GraduationCap className="h-4 w-4" />
                <span>{lang === "bn" ? "অন্বেষা শিক্ষার্থী ডেস্ক" : "Onnesha Student Workspace"}</span>
              </div>

              <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl leading-[1.12]">
                {lang === "bn"
                  ? "আপনার কোর্স, পরীক্ষা ও সনদ — এক ডেস্কে"
                  : "Everything for your course, in one calm desk"}
              </h1>

              <p className="text-base text-muted-foreground leading-relaxed max-w-lg">
                {lang === "bn"
                  ? "কোনো পাসওয়ার্ড লাগবে না। আপনার নিবন্ধিত ইমেইল বা মোবাইলে পাওয়া ৬ ডিজিটের কোড দিয়ে প্রবেশ করে ক্লাস নোট, রেকর্ডিং, AI টিউটর ও ফাইনাল জমা পরিচালনা করুন।"
                  : "No passwords to remember. Sign in with a one-time code sent to your roster contact to read notes, watch recordings, ask your course AI tutor, and submit capstone work."}
              </p>

              {/* 4 Concrete Student Capabilities */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  {
                    icon: BookOpen,
                    title: lang === "bn" ? "লেকচার নোট ও রেকর্ডিং" : "Notes & Class Recordings",
                    desc: lang === "bn" ? "সেশন অনুযায়ী সাজানো ম্যাটেরিয়াল ও ভিডিও" : "Session-organized study guides and videos",
                  },
                  {
                    icon: Bot,
                    title: lang === "bn" ? "কোর্স AI টিউটর" : "Dedicated Course AI Tutor",
                    desc: lang === "bn" ? "কোর্স নলেজবেস থেকে বাংলা/ইংরেজি ব্যাখ্যা" : "Grounded bilingual Q&A and exam practice",
                  },
                  {
                    icon: ClipboardCheck,
                    title: lang === "bn" ? "ফাইনাল ও প্র্যাকটিক্যাল জমা" : "Final Exam & Capstone",
                    desc: lang === "bn" ? "নম্বর, ইন্সট্রাক্টর মন্তব্য ও ফাইল আপলোড" : "Deliverable uploads and rubric feedback",
                  },
                  {
                    icon: Award,
                    title: lang === "bn" ? "যাচাইযোগ্য কোর্স সনদ" : "Verified Certificate PDF",
                    desc: lang === "bn" ? "QR কোড ও পাবলিক ভেরিফিকেশন লিংক" : "One-click PDF download with public QR seal",
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="flex items-start gap-3 rounded-2xl border border-border/80 bg-card/85 p-3.5 backdrop-blur-sm"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-display text-sm font-bold text-foreground">
                          {item.title}
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Focused 2-Step OTP Sign-In Card */}
            <div className="w-full max-w-md shrink-0">
              <form
                onSubmit={otpSent ? verifyOtp : requestOtp}
                className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl shadow-black/5 space-y-5"
              >
                {/* 2-Step Indicator */}
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                      !otpSent
                        ? "bg-primary text-primary-foreground"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {otpSent ? <Check className="h-3.5 w-3.5" /> : "1"}
                    <span>{lang === "bn" ? "পরিচয়" : "Verify contact"}</span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                      otpSent
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span>2</span>
                    <span>{lang === "bn" ? "কোড যাচাই" : "Enter code"}</span>
                  </span>
                </div>

                <div>
                  <h2 className="font-display text-xl font-extrabold text-foreground">
                    {otpSent
                      ? lang === "bn"
                        ? "ভেরিফিকেশন কোড লিখুন"
                        : "Enter your 6-digit code"
                      : lang === "bn"
                        ? "শিক্ষার্থী সাইন ইন"
                        : "Sign in to your portal"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {otpSent
                      ? authChannel === "email"
                        ? lang === "bn"
                          ? `${email} ঠিকানায় পাঠানো কোডটি নিচে লিখুন।`
                          : `Enter the one-time code sent to ${email}.`
                        : lang === "bn"
                          ? `${phone} নম্বরে পাঠানো SMS কোডটি নিচে লিখুন।`
                          : `Enter the SMS code sent to ${phone}.`
                      : authChannel === "email"
                        ? lang === "bn"
                          ? "কোর্স রোস্টারে থাকা আপনার ইমেইল লিখুন — আমরা একটি ৬ ডিজিটের কোড পাঠাব।"
                          : "Enter your course roster email and we will send a one-time sign-in code."
                        : lang === "bn"
                          ? "কোর্স রোস্টারে থাকা আপনার মোবাইল নম্বর লিখুন।"
                          : "Enter your course roster mobile number for SMS verification."}
                  </p>
                </div>

                {bootstrapping ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs font-semibold text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>{lang === "bn" ? "সেশন যাচাই হচ্ছে…" : "Checking active session…"}</span>
                  </div>
                ) : (
                  <>
                    {authChannel === "email" ? (
                      <label className="block space-y-1.5">
                        <span className="text-xs font-semibold text-foreground">
                          {lang === "bn" ? "নিবন্ধিত ইমেইল" : "Registered email"}
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
                            className="w-full rounded-2xl border border-border bg-background py-3 pl-10 pr-4 text-sm font-medium outline-none ring-primary/20 focus:border-primary focus:ring-4 transition"
                            placeholder="student@example.com"
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
                        <span className="text-xs font-semibold text-foreground">
                          {lang === "bn" ? "নিবন্ধিত মোবাইল নম্বর" : "Registered mobile number"}
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
                            className="w-full rounded-2xl border border-border bg-background py-3 pl-10 pr-4 text-sm font-mono font-semibold outline-none ring-primary/20 focus:border-primary focus:ring-4 transition"
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
                      <label className="block space-y-1.5 animate-in fade-in">
                        <span className="text-xs font-semibold text-foreground">
                          {lang === "bn" ? "৬ ডিজিটের OTP কোড" : "6-digit verification code"}
                        </span>
                        <input
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                          className="w-full rounded-2xl border border-primary/50 bg-background py-3.5 px-4 text-center text-xl font-mono font-black tracking-[0.35em] outline-none ring-primary/20 focus:border-primary focus:ring-4 transition"
                          placeholder="••••••"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          autoFocus
                          required
                        />
                        {devOtpHint && (
                          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300 font-semibold">
                            Dev OTP: <code className="font-mono font-black">{devOtpHint}</code>
                          </p>
                        )}
                      </label>
                    )}

                    {error && (
                      <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs font-semibold text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60 transition"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      <span>
                        {otpSent
                          ? lang === "bn"
                            ? "যাচাই করে পোর্টাল খুলুন"
                            : "Verify & open portal"
                          : lang === "bn"
                            ? "কোড পাঠান"
                            : "Send verification code"}
                      </span>
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
                        className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground transition"
                      >
                        {lang === "bn" ? "অন্য ইমেইল / নম্বর ব্যবহার করুন" : "Use a different contact"}
                      </button>
                    )}

                    <div className="border-t border-border/70 pt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {lang === "bn" ? "লাইভ কুইজের PIN আছে?" : "Have a live quiz PIN?"}
                      </span>
                      <Link to="/play" className="font-bold text-primary hover:underline">
                        {lang === "bn" ? "অ্যারেনায় যান →" : "Join live arena →"}
                      </Link>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // =========================================================================
  // 2. AUTHENTICATED STUDENT LEARNING WORKSPACE
  // =========================================================================

  const combinedPct = completion?.combinedPct ?? 0;
  const quizPct = completion?.quizAccuracyPct ?? 0;
  const practicalPct = completion?.practicalScorePct ?? 0;
  const studentInitials = (portal.student?.name || "S")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  const hasCert = Boolean(portal.courseCertificate);
  const finalDone = Boolean(portal.finalAttempt && portal.finalAttempt.status !== "in_progress");
  const practicalSubmitted = Boolean(
    portal.submission && (portal.submission.status === "submitted" || portal.submission.status === "graded" || portal.submission.status === "late"),
  );
  const practicalGraded = portal.submission?.status === "graded";

  // Smart Next Recommended Action Banner
  const nextAction = (() => {
    if (hasCert) {
      return {
        tone: "emerald" as const,
        title: lang === "bn" ? "আপনার কোর্স সনদপত্র প্রস্তুত!" : "Your official course certificate is ready",
        desc:
          lang === "bn"
            ? "আপনার যাচাইযোগ্য কোর্স সমাপনী সনদপত্র দেখুন এবং PDF হিসেবে ডাউনলোড করুন।"
            : "View your verified course-completion certificate and download a print-ready PDF.",
        cta: lang === "bn" ? "সনদপত্র দেখুন" : "Open certificate",
        action: () => setPortalTab("certificate"),
      };
    }
    if (returnedForResubmit) {
      return {
        tone: "amber" as const,
        title:
          lang === "bn"
            ? "আপনার প্রায়োগিক জমা সংশোধনের জন্য ফেরত পাঠানো হয়েছে"
            : "Action needed: instructor returned your practical work",
        desc:
          portal.submission?.instructorFeedback ||
          (lang === "bn"
            ? "ইন্সট্রাক্টরের মন্তব্য দেখে সংশোধন করে পুনরায় জমা দিন।"
            : "Review your instructor's feedback and resubmit your deliverables."),
        cta: lang === "bn" ? "সংশোধন ও পুনরায় জমা দিন" : "Revise & resubmit",
        action: () => setPortalTab("practical"),
      };
    }
    if (canSubmit && !practicalSubmitted) {
      return {
        tone: "primary" as const,
        title:
          lang === "bn"
            ? "ফাইনাল প্রায়োগিক (Capstone) জমার উইন্ডো খোলা আছে"
            : "Final Practical capstone window is open",
        desc:
          practicalExam?.closesAt
            ? `${lang === "bn" ? "জমা দেওয়ার শেষ সময়:" : "Deadline:"} ${new Date(practicalExam.closesAt).toLocaleString()}`
            : lang === "bn"
              ? "আপনার ক্যাপস্টোন টাস্কগুলো সম্পন্ন করে জমা দিন।"
              : "Complete your capstone tasks and upload your deliverables before closing.",
        cta: lang === "bn" ? "প্রায়োগিক জমা দিন" : "Open practical desk",
        action: () => setPortalTab("practical"),
      };
    }
    if (!finalDone) {
      return {
        tone: "amber" as const,
        title:
          lang === "bn"
            ? "চূড়ান্ত ফাইনাল কুইজের প্রস্তুতি নিন"
            : "Prepare for your timed Final Exam",
        desc:
          lang === "bn"
            ? "ম্যাটেরিয়াল ও AI টিউটরের সাহায্যে রিভিশন করুন অথবা PIN দিয়ে /final-exam এ অংশ নিন।"
            : "Revise with Study Materials and your Course AI Tutor, or enter the Final Exam when your PIN opens.",
        cta: lang === "bn" ? "ফাইনাল পরীক্ষা দেখুন" : "View Final Exam",
        action: () => setPortalTab("final"),
      };
    }
    return {
      tone: "primary" as const,
      title:
        lang === "bn"
          ? "দুর্দান্ত অগ্রগতি! AI টিউটরের সাথে রিভিশন চালিয়ে যান"
          : "Great momentum — keep building with your course workspace",
      desc:
        lang === "bn"
          ? "আপনার প্রকাশিত নোট, রেকর্ডিং ও ডেডিকেটেড AI টিউটর যেকোনো সময় ব্যবহার করুন।"
          : "Explore published study notes, class recordings, and your Course AI Tutor anytime.",
      cta: lang === "bn" ? "AI টিউটর খুলুন" : "Open AI Tutor",
      action: () => setPortalTab("tutor"),
    };
  })();

  const navItems: Array<{
    id: PortalTab;
    label: string;
    icon: typeof Home;
    badge?: string | number | undefined;
    highlight?: boolean | undefined;
  }> = [
    { id: "overview", label: lang === "bn" ? "আমার ডেস্ক" : "Overview", icon: Home },
    {
      id: "materials",
      label: lang === "bn" ? "স্টাডি নোট" : "Materials",
      icon: BookOpen,
      badge: materials.length || undefined,
    },
    {
      id: "recordings",
      label: lang === "bn" ? "ক্লাস রেকর্ডিং" : "Recordings",
      icon: Film,
      badge: recordings.length || undefined,
    },
    {
      id: "quizzes",
      label: lang === "bn" ? "কুইজ ফলাফল" : "Quizzes",
      icon: CheckCircle2,
      badge: progressSummary.total ? `${progressSummary.done}/${progressSummary.total}` : undefined,
    },
    { id: "final", label: lang === "bn" ? "ফাইনাল পরীক্ষা" : "Final Exam", icon: Timer },
    {
      id: "practical",
      label: lang === "bn" ? "প্রায়োগিক কাজ" : "Practical",
      icon: ClipboardList,
      badge: returnedForResubmit
        ? "!"
        : practicalGraded
          ? "✓"
          : practicalExam?.tasks.length || undefined,
      highlight: returnedForResubmit,
    },
    {
      id: "tutor",
      label: lang === "bn" ? "AI টিউটর" : "AI Tutor",
      icon: Sparkles,
      badge: portal.hasAiTutor ? "AI" : undefined,
    },
    {
      id: "certificate",
      label: lang === "bn" ? "সনদপত্র" : "Certificate",
      icon: Award,
      badge: hasCert ? "✓" : undefined,
    },
  ];

  const journeySteps = [
    {
      key: "quizzes",
      title: lang === "bn" ? "সেশন কুইজ" : "Session Quizzes",
      detail: `${progressSummary.done}/${progressSummary.total} ${lang === "bn" ? "পাস" : "passed"}`,
      done: progressSummary.total > 0 && progressSummary.done >= progressSummary.total,
      active: progressSummary.done > 0 && progressSummary.done < progressSummary.total,
      tab: "quizzes" as PortalTab,
    },
    {
      key: "final",
      title: lang === "bn" ? "ফাইনাল MCQ" : "Final MCQ",
      detail:
        typeof portal.finalAttempt?.quizMarks === "number"
          ? `${portal.finalAttempt.quizMarks}/${portal.finalAttempt.quizMaxMarks ?? 30}`
          : lang === "bn"
            ? "বাকি আছে"
            : "Pending",
      done: finalDone,
      active: portal.finalAttempt?.status === "in_progress",
      tab: "final" as PortalTab,
    },
    {
      key: "practical",
      title: lang === "bn" ? "প্রায়োগিক ক্যাপস্টোন" : "Practical Capstone",
      detail: practicalGraded
        ? `${practicalPct}%`
        : practicalSubmitted
          ? lang === "bn"
            ? "জমা হয়েছে"
            : "Submitted"
          : lang === "bn"
            ? "জমা বাকি"
            : "Not submitted",
      done: practicalGraded,
      active: practicalSubmitted || canSubmit,
      tab: "practical" as PortalTab,
    },
    {
      key: "cert",
      title: lang === "bn" ? "কোর্স সনদ" : "Certificate",
      detail: hasCert
        ? lang === "bn"
          ? "ইস্যু হয়েছে"
          : "Issued"
        : completion?.eligibleForCourseCertificate
          ? lang === "bn"
            ? "যোগ্য"
            : "Eligible"
          : lang === "bn"
            ? "অপেক্ষমান"
            : "Locked",
      done: hasCert,
      active: Boolean(completion?.eligibleForCourseCertificate),
      tab: "certificate" as PortalTab,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <div className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 pb-28 md:pb-14">
        {/* Mobile Compact Student Header + Horizontal Tab Strip */}
        <div className="lg:hidden mb-5 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 font-display text-sm font-black text-primary">
                {studentInitials}
              </div>
              <div className="min-w-0">
                <div className="font-display text-sm font-extrabold text-foreground truncate">
                  {portal.student?.name}
                </div>
                <div className="font-mono text-[11px] text-muted-foreground truncate">
                  {portal.student?.rollNumber} · {portal.course?.code}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded-xl bg-primary/10 px-2.5 py-1 font-mono text-xs font-black text-primary">
                {combinedPct}%
              </span>
              <button
                type="button"
                onClick={() => void signOutPortal()}
                className="rounded-xl border border-border p-2 text-muted-foreground hover:text-foreground"
                title={lang === "bn" ? "সাইন আউট" : "Sign out"}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          {(portal.courses?.length || 0) > 1 && (
            <select
              className="w-full rounded-2xl border border-border bg-card px-3.5 py-2.5 text-xs font-bold text-foreground outline-none focus:border-primary"
              value={portal.course?.id || ""}
              disabled={switchingCourse}
              onChange={(e) => void switchCourse(e.target.value)}
            >
              {(portal.courses || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {lang === "bn" ? c.titleBn : c.titleEn}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = portalTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPortalTab(item.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "border border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-extrabold ${
                        active ? "bg-white/20 text-white" : "bg-muted text-foreground"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop 2-Column Student Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT STICKY NAVIGATION RAIL (Desktop) */}
          <aside className="hidden lg:flex lg:col-span-3 flex-col gap-4 sticky top-20">
            {/* Student Identity & Progress Ring Card */}
            <div className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 font-display text-sm font-black text-primary">
                  {studentInitials}
                </div>
                <div className="min-w-0">
                  <div className="font-display text-sm font-extrabold text-foreground truncate">
                    {portal.student?.name}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground truncate">
                    {portal.student?.rollNumber}
                  </div>
                  {portal.student?.regionName && (
                    <div className="text-[11px] text-muted-foreground truncate">
                      {portal.student.regionName}
                    </div>
                  )}
                </div>
              </div>

              {/* Active Course Selector */}
              <div className="rounded-2xl border border-border/80 bg-muted/30 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                  <span>{lang === "bn" ? "সক্রিয় কোর্স" : "Active course"}</span>
                  <span className="font-mono font-bold text-primary">{portal.course?.code}</span>
                </div>
                {(portal.courses?.length || 0) > 1 ? (
                  <div className="flex items-center gap-1.5">
                    <select
                      className="w-full rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground outline-none focus:border-primary"
                      value={portal.course?.id || ""}
                      disabled={switchingCourse}
                      onChange={(e) => void switchCourse(e.target.value)}
                    >
                      {(portal.courses || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {lang === "bn" ? c.titleBn : c.titleEn}
                        </option>
                      ))}
                    </select>
                    {switchingCourse && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
                  </div>
                ) : (
                  <div className="text-xs font-bold text-foreground leading-snug">
                    {lang === "bn" ? portal.course?.titleBn : portal.course?.titleEn}
                  </div>
                )}
              </div>

              {/* Combined Score Ring */}
              <div className="flex items-center gap-3.5 pt-1">
                <ProgressRing pct={combinedPct} size={64} />
                <div className="min-w-0 space-y-1 text-xs">
                  <div className="font-display font-bold text-foreground">
                    {lang === "bn" ? "সম্মিলিত অগ্রগতি" : "Overall score"}
                  </div>
                  <div className="text-muted-foreground font-mono text-[11px]">
                    Quiz {quizPct}% · Prac {practicalPct}%
                  </div>
                  <div className="text-[11px] font-semibold text-primary">
                    {hasCert
                      ? lang === "bn"
                        ? "সনদ ইস্যু হয়েছে"
                        : "Certificate issued"
                      : `${progressSummary.done}/${progressSummary.total} ${lang === "bn" ? "কুইজ পাস" : "quizzes passed"}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Navigation List */}
            <nav className="rounded-3xl border border-border bg-card p-2.5 shadow-xs space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = portalTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPortalTab(item.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-left text-xs font-bold transition ${
                      active
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span
                        className={`rounded-lg px-2 py-0.5 font-mono text-[10px] font-extrabold ${
                          active
                            ? "bg-white/20 text-white"
                            : item.highlight
                              ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                              : "bg-muted text-foreground"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="pt-2 mt-2 border-t border-border/70 px-1">
                <button
                  type="button"
                  onClick={() => void signOutPortal()}
                  className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{lang === "bn" ? "সাইন আউট" : "Sign out"}</span>
                </button>
              </div>
            </nav>
          </aside>

          {/* MAIN WORKSPACE COLUMN */}
          <main className="lg:col-span-9 space-y-6 min-w-0">
            {/* Global Notice Banner */}
            {notice && (
              <div
                className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-bold animate-in fade-in ${
                  noticeTone === "err"
                    ? "border-destructive/35 bg-destructive/10 text-destructive"
                    : "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  {noticeTone === "err" ? (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  )}
                  <span>{notice}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="opacity-70 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 1: OVERVIEW ("MY LEARNING HUB")                           */}
            {/* ============================================================= */}
            {portalTab === "overview" && (
              <div className="space-y-6">
                {/* Personalized Welcome & Smart Next-Action Hero */}
                <section
                  className={`relative overflow-hidden rounded-3xl border p-6 sm:p-7 ${
                    nextAction.tone === "emerald"
                      ? "border-emerald-500/35 bg-gradient-to-br from-emerald-500/12 via-card to-card"
                      : nextAction.tone === "amber"
                        ? "border-amber-500/35 bg-gradient-to-br from-amber-500/12 via-card to-card"
                        : "border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                    <div className="space-y-2 max-w-2xl">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {lang === "bn"
                          ? `স্বাগতম, ${portal.student?.name}`
                          : `Welcome back, ${portal.student?.name}`}
                      </p>
                      <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                        {nextAction.title}
                      </h1>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {nextAction.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={nextAction.action}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                    >
                      <span>{nextAction.cta}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </section>

                {/* 4-Step Course Journey Stepper */}
                <section className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-base font-extrabold text-foreground">
                      {lang === "bn" ? "কোর্স সম্পন্ন করার ধাপ" : "Your course completion roadmap"}
                    </h2>
                    <span className="font-mono text-xs font-bold text-primary">
                      {combinedPct}% {lang === "bn" ? "সম্মিলিত" : "combined"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {journeySteps.map((step, idx) => (
                      <button
                        key={step.key}
                        type="button"
                        onClick={() => setPortalTab(step.tab)}
                        className={`group rounded-2xl border p-4 text-left transition ${
                          step.done
                            ? "border-emerald-500/35 bg-emerald-500/8 hover:border-emerald-500/60"
                            : step.active
                              ? "border-primary/35 bg-primary/5 hover:border-primary/60"
                              : "border-border bg-background hover:bg-accent/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-xl font-mono text-xs font-black ${
                              step.done
                                ? "bg-emerald-500 text-white"
                                : step.active
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {step.done ? <Check className="h-4 w-4" /> : idx + 1}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <div className="mt-3 font-display text-sm font-bold text-foreground">
                          {step.title}
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {step.detail}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Latest Announcements */}
                {announcements.length > 0 && (
                  <section className="rounded-3xl border border-amber-500/25 bg-amber-500/6 p-5 space-y-3">
                    <div className="flex items-center gap-2 font-display text-sm font-extrabold text-foreground">
                      <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span>{lang === "bn" ? "কোর্স নোটিশ" : "Course announcements"}</span>
                    </div>
                    <div className="space-y-2.5">
                      {announcements.slice(0, 3).map((a, i) => (
                        <div
                          key={a.id || i}
                          className="rounded-2xl border border-border/80 bg-card/90 px-4 py-3 space-y-1"
                        >
                          <div className="text-sm font-bold text-foreground">
                            {lang === "bn" ? a.titleBn : a.titleEn}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {lang === "bn" ? a.bodyBn : a.bodyEn}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Quick Access Workspace Tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setPortalTab("materials")}
                    className="group rounded-3xl border border-border bg-card p-5 text-left hover:border-primary/45 transition shadow-xs flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <h3 className="font-display text-base font-extrabold text-foreground">
                        {lang === "bn" ? "স্টাডি ম্যাটেরিয়াল" : "Study Materials"}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {materials.length}{" "}
                        {lang === "bn" ? "টি প্রকাশিত নোট ও গাইড" : "published notes & guides"}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setPortalTab("recordings")}
                    className="group rounded-3xl border border-border bg-card p-5 text-left hover:border-primary/45 transition shadow-xs flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/12 text-sky-600 dark:text-sky-400">
                        <Film className="h-5 w-5" />
                      </div>
                      <h3 className="font-display text-base font-extrabold text-foreground">
                        {lang === "bn" ? "ক্লাস রেকর্ডিং" : "Class Recordings"}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {recordings.length}{" "}
                        {lang === "bn" ? "টি ক্লাস ভিডিও ও সেশন" : "recorded sessions ready to watch"}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setPortalTab("tutor")}
                    className="group rounded-3xl border border-border bg-card p-5 text-left hover:border-primary/45 transition shadow-xs flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-600 dark:text-violet-400">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <h3 className="font-display text-base font-extrabold text-foreground">
                        {lang === "bn" ? "AI কোর্স টিউটর" : "AI Course Tutor"}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {lang === "bn"
                          ? "কোর্স নলেজবেস থেকে ২৪/৭ ব্যাখ্যা ও প্র্যাকটিস"
                          : "24/7 explanations & exam practice from course KB"}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition" />
                  </button>

                  <div className="rounded-3xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-600 dark:text-amber-400">
                        <Play className="h-5 w-5" />
                      </div>
                      <h3 className="font-display text-base font-extrabold text-foreground">
                        {lang === "bn" ? "লাইভ পরীক্ষা ডেস্ক" : "Live Exam Desks"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {lang === "bn"
                          ? "PIN দিয়ে লাইভ কুইজ বা ফাইনাল পরীক্ষায় প্রবেশ করুন"
                          : "Join live classroom quizzes or the timed Final Exam with your PIN"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to="/play"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        <span>{lang === "bn" ? "লাইভ কুইজ" : "Live Quiz"}</span>
                      </Link>
                      <Link
                        to="/final-exam"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 transition"
                      >
                        <Timer className="h-3 w-3" />
                        <span>{lang === "bn" ? "ফাইনাল পরীক্ষা" : "Final Exam"}</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 2: STUDY MATERIALS (Session Packs + Drive Resource Hub)   */}
            {/* ============================================================= */}
            {portalTab === "materials" && (
              <section className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-extrabold text-foreground">
                      {lang === "bn" ? "কোর্স ম্যাটেরিয়াল ও স্টাডি নোট" : "Course Materials"}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {lang === "bn"
                        ? `${materials.length}টি সেশন প্যাক • ${totalMaterialResources}টি স্লাইড, হ্যান্ডবুক, লেসন প্ল্যান, ক্যানভা ও ভিজ্যুয়াল লিংক।`
                        : `${materials.length} session packs · ${totalMaterialResources} slides, handbooks, lesson plans, Canva decks & visuals.`}
                    </p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      value={materialQuery}
                      onChange={(e) => setMaterialQuery(e.target.value)}
                      placeholder={lang === "bn" ? "সেশন, টপিক বা ফাইল খুঁজুন…" : "Search sessions, topics, files…"}
                      className="w-full rounded-2xl border border-border bg-card py-2 pl-9 pr-3 text-xs font-medium outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Official Google Drive & Canva Quick-Access Strip */}
                {(masterDriveLink || masterCanvaLink) && (
                  <div className="rounded-3xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card to-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                        <FolderOpen className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-display text-sm font-extrabold text-foreground">
                          {lang === "bn"
                            ? "সম্পূর্ণ কোর্স রিসোর্স ভল্ট (Google Drive ও Canva)"
                            : "Complete Course Resource Vault (Google Drive & Canva)"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {lang === "bn"
                            ? "প্রতিটি সেশনের PDF/PPTX স্লাইড, বাংলা হ্যান্ডবুক, লেসন প্ল্যান, ক্যানভা ও ভিজ্যুয়াল একসাথে।"
                            : "All session PDF/PPTX slides, Bangla handbooks, lesson plans, Canva decks, and visual assets."}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {masterDriveLink && (
                        <a
                          href={masterDriveLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                          <span>{lang === "bn" ? "Google Drive খুলুন" : "Open Google Drive"}</span>
                          <ExternalLink className="h-3 w-3 opacity-80" />
                        </a>
                      )}
                      {masterCanvaLink && (
                        <a
                          href={masterCanvaLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-bold text-foreground hover:border-primary/40 hover:text-primary transition"
                        >
                          <Palette className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                          <span>{lang === "bn" ? "সকল Canva স্লাইড" : "All Canva Decks"}</span>
                          <ExternalLink className="h-3 w-3 opacity-70" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Session Filter Pills */}
                {materialSessionOptions.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setMaterialSessionFilter("all")}
                      className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                        materialSessionFilter === "all"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "border border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {lang === "bn" ? `সকল (${materials.length})` : `All (${materials.length})`}
                    </button>
                    {materialSessionOptions.map((sess) => (
                      <button
                        key={sess}
                        type="button"
                        onClick={() => setMaterialSessionFilter(sess)}
                        className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          materialSessionFilter === sess
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "border border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {sess}
                      </button>
                    ))}
                  </div>
                )}

                {filteredMaterials.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center space-y-2">
                    <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/60" />
                    <p className="font-display text-sm font-bold text-foreground">
                      {materials.length === 0
                        ? lang === "bn"
                          ? "এখনো কোনো ম্যাটেরিয়াল প্রকাশ হয়নি"
                          : "No study materials published yet"
                        : lang === "bn"
                          ? "কোনো ফলাফল পাওয়া যায়নি"
                          : "No matching materials found"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredMaterials.map((m) => {
                      const summary =
                        lang === "bn"
                          ? m.descriptionBn || m.descriptionEn || ""
                          : m.descriptionEn || m.descriptionBn || "";
                      const body =
                        lang === "bn"
                          ? m.bodyBn || m.bodyEn || ""
                          : m.bodyEn || m.bodyBn || "";
                      const isExpanded = expandedMaterialId === m.id || (body.length > 0 && body.length < 340);
                      const resources: CourseMaterialResource[] = m.resources || [];
                      const primaryResources = resources.filter(
                        (r) =>
                          r.kind === "canva_view" ||
                          r.kind === "canva_edit" ||
                          r.kind === "pdf" ||
                          r.kind === "pptx",
                      );
                      const secondaryResources = resources.filter(
                        (r) =>
                          r.kind !== "canva_view" &&
                          r.kind !== "canva_edit" &&
                          r.kind !== "pdf" &&
                          r.kind !== "pptx",
                      );
                      const showAllFiles =
                        expandedFilesId === m.id ||
                        materialSessionFilter !== "all" ||
                        Boolean(materialQuery.trim()) ||
                        resources.length <= 6;

                      const renderResourceIcon = (kind: CourseMaterialResource["kind"]) => {
                        switch (kind) {
                          case "canva_view":
                          case "canva_edit":
                          case "canva_folder":
                            return <Palette className="h-3.5 w-3.5 shrink-0" />;
                          case "pptx":
                            return <Presentation className="h-3.5 w-3.5 shrink-0" />;
                          case "image":
                            return <ImageIcon className="h-3.5 w-3.5 shrink-0" />;
                          case "folder":
                            return <FolderOpen className="h-3.5 w-3.5 shrink-0" />;
                          default:
                            return <FileText className="h-3.5 w-3.5 shrink-0" />;
                        }
                      };

                      const resourcePillStyle = (kind: CourseMaterialResource["kind"]) => {
                        if (kind === "canva_view" || kind === "canva_edit") {
                          return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-500/18";
                        }
                        if (kind === "pdf") {
                          return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/18";
                        }
                        if (kind === "pptx") {
                          return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/18";
                        }
                        if (kind === "folder" || kind === "canva_folder") {
                          return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/18";
                        }
                        return "border-border bg-background text-foreground hover:border-primary/40 hover:text-primary";
                      };

                      return (
                        <article
                          key={m.id}
                          className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-3.5 hover:border-primary/35 transition"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-lg bg-primary/12 px-2.5 py-0.5 text-[11px] font-extrabold text-primary">
                                  {m.sessionLabel || m.type}
                                </span>
                                {resources.length > 0 ? (
                                  <span className="rounded-lg border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                                    {resources.length}{" "}
                                    {lang === "bn" ? "টি ফাইল ও লিংক" : "files & links"}
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-muted-foreground capitalize">
                                    {m.type}
                                  </span>
                                )}
                              </div>
                              <h3 className="font-display text-base sm:text-lg font-extrabold text-foreground leading-snug">
                                {lang === "bn" ? m.titleBn : m.titleEn}
                              </h3>
                              {summary && (
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {summary}
                                </p>
                              )}
                            </div>
                            {m.url && (
                              <a
                                href={m.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/8 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/15 transition"
                              >
                                {m.url.includes("/folders/") ? (
                                  <FolderOpen className="h-3.5 w-3.5" />
                                ) : (
                                  <ExternalLink className="h-3.5 w-3.5" />
                                )}
                                <span>
                                  {m.url.includes("/folders/")
                                    ? lang === "bn"
                                      ? "Drive ফোল্ডার"
                                      : "Drive folder"
                                    : lang === "bn"
                                      ? "লিংক খুলুন"
                                      : "Open resource"}
                                </span>
                              </a>
                            )}
                          </div>

                          {/* Primary Slides & Canva Chips */}
                          {primaryResources.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {primaryResources.map((res, idx) => (
                                <a
                                  key={`${m.id}-p-${idx}`}
                                  href={res.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={res.fileName || res.labelEn}
                                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${resourcePillStyle(res.kind)}`}
                                >
                                  {renderResourceIcon(res.kind)}
                                  <span>{lang === "bn" ? res.labelBn || res.labelEn : res.labelEn}</span>
                                  <ExternalLink className="h-3 w-3 opacity-65" />
                                </a>
                              ))}
                            </div>
                          )}

                          {/* Secondary Handbooks, Lesson Plans, Visuals & Subfolders */}
                          {secondaryResources.length > 0 && (
                            <div className="rounded-2xl border border-border/80 bg-muted/25 p-3 space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-muted-foreground">
                                  {lang === "bn"
                                    ? `হ্যান্ডবুক, লেসন প্ল্যান, ভিজ্যুয়াল ও ফোল্ডার (${secondaryResources.length}টি)`
                                    : `Handbooks, lesson plans, visuals & folders (${secondaryResources.length})`}
                                </span>
                                {resources.length > 6 &&
                                  materialSessionFilter === "all" &&
                                  !materialQuery.trim() && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedFilesId(showAllFiles ? null : m.id)
                                      }
                                      className="text-[11px] font-bold text-primary hover:underline"
                                    >
                                      {showAllFiles
                                        ? lang === "bn"
                                          ? "লুকান"
                                          : "Hide files"
                                        : lang === "bn"
                                          ? "সব ফাইল দেখুন"
                                          : "Show all files"}
                                    </button>
                                  )}
                              </div>
                              {showAllFiles && (
                                <div className="flex flex-wrap gap-1.5">
                                  {secondaryResources.map((res, idx) => (
                                    <a
                                      key={`${m.id}-s-${idx}`}
                                      href={res.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      title={res.fileName || res.labelEn}
                                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${resourcePillStyle(res.kind)}`}
                                    >
                                      {renderResourceIcon(res.kind)}
                                      <span>
                                        {lang === "bn" ? res.labelBn || res.labelEn : res.labelEn}
                                      </span>
                                      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {body && (
                            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap max-w-3xl">
                              {isExpanded ? body : `${body.slice(0, 280)}…`}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
                            {body.length >= 340 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedMaterialId(isExpanded ? null : m.id)
                                }
                                className="text-xs font-bold text-primary hover:underline"
                              >
                                {isExpanded
                                  ? lang === "bn"
                                    ? "নোট সংক্ষিপ্ত করুন"
                                    : "Show less"
                                  : lang === "bn"
                                    ? "সম্পূর্ণ স্টাডি নোট পড়ুন"
                                    : "Read full study notes"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setPortalTab("tutor");
                                setTutorQ(
                                  lang === "bn"
                                    ? `"${m.titleBn || m.titleEn}" সহজ করে বুঝিয়ে দাও এবং পরীক্ষার গুরুত্বপূর্ণ পয়েন্ট বলো`
                                    : `Explain "${m.titleEn}" with key exam takeaways and practical steps`,
                                );
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition ml-auto"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>{lang === "bn" ? "AI টিউটরকে জিজ্ঞাসা করুন" : "Ask AI Tutor about this"}</span>
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ============================================================= */}
            {/* TAB 3: CLASS RECORDINGS (Visual Video Gallery + Inline Play)  */}
            {/* ============================================================= */}
            {portalTab === "recordings" && (
              <section className="space-y-5">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-foreground">
                    {lang === "bn" ? "ক্লাস রেকর্ডিং লাইব্রেরি" : "Class Recordings"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lang === "bn"
                      ? "Zoom ক্লাউড রেকর্ডিং ও ক্লাস ভিডিও যেকোনো সময় রিভিশন করুন।"
                      : "Watch recorded sessions directly here or open in Zoom, YouTube, or Google Drive."}
                  </p>
                </div>

                {recordings.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center space-y-2">
                    <Film className="h-8 w-8 mx-auto text-muted-foreground/60" />
                    <p className="font-display text-sm font-bold text-foreground">
                      {lang === "bn" ? "রেকর্ডিং শীঘ্রই যুক্ত হবে" : "Recordings coming soon"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recordings.map((r) => {
                      const ytId = extractYouTubeId(r.url);
                      const isZoom = r.provider === "zoom" || r.url.toLowerCase().includes("zoom.us");
                      const hasAutoPasscode = isZoom && r.url.includes("pwd=");
                      const isPlaying = playingRecordingId === r.id;
                      return (
                        <div
                          key={r.id}
                          className="overflow-hidden rounded-3xl border border-border bg-card shadow-xs flex flex-col"
                        >
                          {ytId ? (
                            isPlaying ? (
                              <div className="aspect-video w-full bg-black">
                                <iframe
                                  src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
                                  title={r.titleEn}
                                  className="h-full w-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPlayingRecordingId(r.id)}
                                className="group relative aspect-video w-full overflow-hidden bg-slate-900"
                              >
                                <img
                                  src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                                  alt={r.titleEn}
                                  className="h-full w-full object-cover opacity-85 group-hover:scale-105 transition duration-300"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/15 transition">
                                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg">
                                    <Play className="h-5 w-5 fill-current ml-0.5" />
                                  </span>
                                </div>
                                {r.durationMin && (
                                  <span className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/75 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                                    {r.durationMin}m
                                  </span>
                                )}
                              </button>
                            )
                          ) : isZoom ? (
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              className="group relative flex items-center justify-between gap-4 bg-gradient-to-br from-sky-600/15 via-blue-600/10 to-card px-5 py-6 border-b border-border/60 hover:from-sky-600/20 transition"
                            >
                              <div className="flex items-center gap-3.5">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md group-hover:scale-105 transition-transform">
                                  <Play className="h-5 w-5 fill-current ml-0.5" />
                                </div>
                                <div>
                                  <div className="text-xs font-extrabold text-sky-700 dark:text-sky-300">
                                    Zoom Cloud Recording
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                                    {hasAutoPasscode
                                      ? lang === "bn"
                                        ? "পাসকোড স্বয়ংক্রিয়ভাবে যুক্ত • ক্লিক করে দেখুন"
                                        : "Direct access link with passcode included"
                                      : lang === "bn"
                                        ? "ক্লিক করে Zoom-এ ভিডিও দেখুন"
                                        : "Click to watch recording on Zoom"}
                                  </div>
                                </div>
                              </div>
                              {r.durationMin && (
                                <span className="rounded-lg bg-card border border-border px-2.5 py-1 font-mono text-xs font-bold shrink-0">
                                  {r.durationMin} min
                                </span>
                              )}
                            </a>
                          ) : (
                            <div className="flex items-center justify-between bg-muted/40 px-5 py-6 border-b border-border/60">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                                  <Film className="h-5 w-5" />
                                </div>
                                <span className="text-xs font-bold capitalize text-muted-foreground">
                                  {r.provider || "Class video"}
                                </span>
                              </div>
                              {r.durationMin && (
                                <span className="rounded-lg bg-card border border-border px-2.5 py-1 font-mono text-xs font-bold">
                                  {r.durationMin} min
                                </span>
                              )}
                            </div>
                          )}

                          <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                  {r.sessionLabel || r.provider || "Session"}
                                </span>
                                {isZoom && (
                                  <span className="rounded-md bg-sky-500/12 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                                    Zoom
                                  </span>
                                )}
                              </div>
                              <h3 className="mt-2 font-display text-sm font-extrabold text-foreground leading-snug">
                                {lang === "bn" ? r.titleBn : r.titleEn}
                              </h3>
                              {(r.descriptionEn || r.descriptionBn) && (
                                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                  {lang === "bn"
                                    ? r.descriptionBn || r.descriptionEn
                                    : r.descriptionEn || r.descriptionBn}
                                </p>
                              )}
                            </div>
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                                isZoom
                                  ? "bg-sky-600 text-white hover:bg-sky-500 shadow-xs"
                                  : "border border-primary/30 bg-primary/8 text-primary hover:bg-primary/15"
                              }`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span>
                                {isZoom
                                  ? lang === "bn"
                                    ? "Zoom রেকর্ডিং দেখুন"
                                    : "Watch Zoom Recording"
                                  : lang === "bn"
                                    ? "নতুন ট্যাবে খুলুন"
                                    : "Open video externally"}
                              </span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ============================================================= */}
            {/* TAB 4: QUIZZES & SCORES                                       */}
            {/* ============================================================= */}
            {portalTab === "quizzes" && (
              <section className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-extrabold text-foreground">
                      {lang === "bn" ? "সেশন কুইজ অগ্রগতি" : "Session Quizzes"}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {progressSummary.done}/{progressSummary.total}{" "}
                      {lang === "bn" ? "টি কুইজ সম্পন্ন হয়েছে" : "quizzes passed in this course"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-xl border border-border bg-card p-0.5 text-xs font-bold">
                      {(
                        [
                          ["all", lang === "bn" ? "সব" : "All"],
                          ["passed", lang === "bn" ? "পাস" : "Passed"],
                          ["pending", lang === "bn" ? "বাকি" : "Pending"],
                        ] as const
                      ).map(([fId, lbl]) => (
                        <button
                          key={fId}
                          type="button"
                          onClick={() => setQuizFilter(fId)}
                          className={`rounded-lg px-2.5 py-1 transition ${
                            quizFilter === fId
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>

                    <Link
                      to="/play"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>{lang === "bn" ? "কুইজ দিন" : "Join quiz"}</span>
                    </Link>
                  </div>
                </div>

                {filteredQuizzes.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                    {lang === "bn"
                      ? "এই ফিল্টারে কোনো কুইজ নেই।"
                      : "No quizzes match this filter."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filteredQuizzes.map((q) => {
                      const acc = typeof q.bestAccuracyPct === "number" ? q.bestAccuracyPct : null;
                      return (
                        <div
                          key={q.quizId}
                          className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-mono text-[11px] font-bold text-primary">
                                Quiz #{q.quizNumber ?? "—"}
                              </span>
                              <h3 className="font-display text-sm font-extrabold text-foreground mt-0.5 leading-snug">
                                {lang === "bn" ? q.titleBn : q.titleEn}
                              </h3>
                            </div>
                            {q.passed ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {lang === "bn" ? "পাস" : "Passed"}
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                                {acc !== null
                                  ? lang === "bn"
                                    ? "পুনরায় চেষ্টা"
                                    : "Below pass"
                                  : lang === "bn"
                                    ? "বাকি"
                                    : "Pending"}
                              </span>
                            )}
                          </div>

                          {/* Visual Accuracy Bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                              <span>{q.questionCount} questions</span>
                              <span className="font-bold text-foreground">
                                {acc !== null ? `${acc}%` : "Not attempted"}
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  q.passed ? "bg-emerald-500" : acc !== null ? "bg-amber-500" : "bg-transparent"
                                }`}
                                style={{ width: `${acc ?? 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ============================================================= */}
            {/* TAB 5: FINAL EXAM SUMMARY (Part A + Part B Split)             */}
            {/* ============================================================= */}
            {portalTab === "final" && (
              <section className="space-y-5">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-foreground">
                    {lang === "bn" ? "চূড়ান্ত মূল্যায়ন (Final Exam)" : "Final Examination"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lang === "bn"
                      ? "অংশ ক (টাইমড MCQ কুইজ) এবং অংশ খ (প্রায়োগিক ক্যাপস্টোন) এর সমন্বিত ফলাফল।"
                      : "Combined evaluation across Part A (timed Final MCQ) and Part B (Practical Capstone)."}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Part A Card */}
                  <div className="rounded-3xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/12 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                          <Timer className="h-3.5 w-3.5" />
                          <span>{lang === "bn" ? "অংশ ক · টাইমড MCQ" : "Part A · Timed MCQ"}</span>
                        </span>
                        {portal.finalAttempt && (
                          <StatusPill status={portal.finalAttempt.status} lang={lang} />
                        )}
                      </div>

                      {portal.finalAttempt ? (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="rounded-2xl bg-muted/40 p-3.5">
                            <div className="text-xs text-muted-foreground">
                              {lang === "bn" ? "প্রাপ্ত নম্বর" : "Marks earned"}
                            </div>
                            <div className="mt-1 font-mono text-2xl font-black text-foreground">
                              {typeof portal.finalAttempt.quizMarks === "number"
                                ? `${portal.finalAttempt.quizMarks}/${portal.finalAttempt.quizMaxMarks ?? 30}`
                                : "—"}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-emerald-500/10 p-3.5">
                            <div className="text-xs text-emerald-700 dark:text-emerald-300">
                              {lang === "bn" ? "সঠিকতা" : "Accuracy"}
                            </div>
                            <div className="mt-1 font-mono text-2xl font-black text-emerald-700 dark:text-emerald-300">
                              {typeof portal.finalAttempt.accuracyPct === "number"
                                ? `${portal.finalAttempt.accuracyPct}%`
                                : "—"}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {lang === "bn"
                            ? "এখনো ফাইনাল MCQ অংশগ্রহণ করেননি। পরীক্ষা শুরু হলে শেয়ার্ড PIN দিয়ে ফাইনাল ডেস্কে প্রবেশ করুন।"
                            : "You have not attempted the Final MCQ yet. When your exam window opens, join with the classroom PIN."}
                        </p>
                      )}

                      {portal.finalAttempt?.submittedAt && (
                        <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {lang === "bn" ? "জমা:" : "Submitted:"}{" "}
                            {new Date(portal.finalAttempt.submittedAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    <Link
                      to="/final-exam"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition"
                    >
                      <Timer className="h-4 w-4" />
                      <span>{lang === "bn" ? "ফাইনাল পরীক্ষা ডেস্ক খুলুন" : "Open Final Exam Desk"}</span>
                    </Link>
                  </div>

                  {/* Part B Card */}
                  <div className="rounded-3xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                          <ClipboardList className="h-3.5 w-3.5" />
                          <span>{lang === "bn" ? "অংশ খ · প্রায়োগিক" : "Part B · Practical"}</span>
                        </span>
                        {portal.submission && (
                          <StatusPill status={portal.submission.status} lang={lang} />
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="rounded-2xl bg-muted/40 p-3.5">
                          <div className="text-xs text-muted-foreground">
                            {lang === "bn" ? "প্রায়োগিক স্কোর" : "Practical score"}
                          </div>
                          <div className="mt-1 font-mono text-2xl font-black text-foreground">
                            {typeof portal.submission?.practicalScorePct === "number"
                              ? `${portal.submission.practicalScorePct}%`
                              : "—"}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-primary/10 p-3.5">
                          <div className="text-xs text-primary">
                            {lang === "bn" ? "সম্মিলিত স্কোর" : "Combined"}
                          </div>
                          <div className="mt-1 font-mono text-2xl font-black text-primary">
                            {combinedPct}%
                          </div>
                        </div>
                      </div>

                      {portal.submission?.instructorFeedback && (
                        <p className="rounded-2xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed">
                          <strong className="text-foreground">
                            {lang === "bn" ? "ইন্সট্রাক্টরের মন্তব্য: " : "Instructor feedback: "}
                          </strong>
                          {portal.submission.instructorFeedback}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setPortalTab("practical")}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-xs font-bold text-foreground hover:bg-accent transition"
                    >
                      <ClipboardCheck className="h-4 w-4 text-primary" />
                      <span>
                        {practicalGraded
                          ? lang === "bn"
                            ? "নম্বর ও বিস্তারিত মন্তব্য দেখুন"
                            : "View rubric marks & feedback"
                          : lang === "bn"
                            ? "প্রায়োগিক জমা ডেস্ক খুলুন"
                            : "Open Practical Submission"}
                      </span>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* ============================================================= */}
            {/* TAB 6: PRACTICAL CAPSTONE SUBMISSION & GRADED RUBRIC VIEW     */}
            {/* ============================================================= */}
            {portalTab === "practical" && (
              <section className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-2xl font-extrabold text-foreground">
                        {lang === "bn"
                          ? practicalExam?.titleBn || "চূড়ান্ত প্রায়োগিক প্রজেক্ট"
                          : practicalExam?.titleEn || "Final Practical Capstone"}
                      </h2>
                      {practicalExam && <StatusPill status={practicalExam.status} lang={lang} />}
                    </div>
                    {practicalExam && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                        {lang === "bn" ? practicalExam.descriptionBn : practicalExam.descriptionEn}
                      </p>
                    )}
                  </div>

                  {practicalExam && (
                    <div className="rounded-2xl border border-border bg-card px-3.5 py-2 text-xs font-mono font-bold text-foreground">
                      {practicalCompletion.filled}/{practicalCompletion.total}{" "}
                      {lang === "bn" ? "টাস্ক পূরণ" : "tasks filled"}
                    </div>
                  )}
                </div>

                {!practicalExam ? (
                  <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center space-y-2">
                    <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/60" />
                    <p className="font-display text-sm font-bold text-foreground">
                      {lang === "bn"
                        ? "প্রায়োগিক পরীক্ষা এখনো খোলা হয়নি"
                        : "Final Practical is not open yet"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lang === "bn"
                        ? "অ্যাডমিন বা ইন্সট্রাক্টর উইন্ডো খুললে এখানে টাস্কগুলো দেখতে পাবেন।"
                        : "Tasks will appear here once your instructor opens the submission window."}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Window & Deadline Info Strip */}
                    <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-4 text-muted-foreground font-mono">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {practicalExam.opensAt
                            ? `${lang === "bn" ? "শুরু:" : "Opens:"} ${new Date(practicalExam.opensAt).toLocaleString()}`
                            : lang === "bn"
                              ? "চলমান উইন্ডো"
                              : "Rolling open window"}
                        </span>
                        {practicalExam.closesAt && (
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-amber-500" />
                            {lang === "bn" ? "শেষ সময়:" : "Deadline:"}{" "}
                            {new Date(practicalExam.closesAt).toLocaleString()}
                          </span>
                        )}
                      </div>

                      <div>
                        {notOpenYet && (
                          <span className="font-semibold text-amber-700 dark:text-amber-300">
                            {lang === "bn" ? "নির্ধারিত সময়ের পর জমা দিন" : "Opens soon"}
                          </span>
                        )}
                        {pastDeadline && (windowOpen || returnedForResubmit) && (
                          <span className="font-semibold text-amber-700 dark:text-amber-300">
                            {lang === "bn"
                              ? "ডেডলাইন পার — বিলম্বে জমা নেওয়া হচ্ছে"
                              : "Past deadline · late submission accepted"}
                          </span>
                        )}
                        {!windowOpen && !notOpenYet && !returnedForResubmit && !gradedLocked && (
                          <span className="font-semibold text-muted-foreground">
                            {lang === "bn" ? "জমা উইন্ডো বন্ধ" : "Submission window closed"}
                          </span>
                        )}
                        {returnedForResubmit && (
                          <span className="font-semibold text-amber-700 dark:text-amber-300">
                            {lang === "bn"
                              ? "সংশোধন করে পুনরায় জমা দিন"
                              : "Returned for revision — please resubmit"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Overall Graded Summary Card (Visible when submission exists) */}
                    {portal.submission && (
                      <div
                        className={`rounded-3xl border p-5 space-y-2 ${
                          gradedLocked
                            ? "border-emerald-500/35 bg-emerald-500/8"
                            : returnedForResubmit
                              ? "border-amber-500/35 bg-amber-500/8"
                              : "border-sky-500/30 bg-sky-500/8"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <StatusPill status={portal.submission.status} lang={lang} />
                            {typeof portal.submission.practicalScorePct === "number" && (
                              <span className="font-mono text-sm font-black text-foreground">
                                {portal.submission.practicalScorePct}%
                              </span>
                            )}
                          </div>
                          {portal.submission.submittedAt && (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {new Date(portal.submission.submittedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {portal.submission.instructorFeedback && (
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap pt-1">
                            <span className="font-bold">
                              {lang === "bn" ? "ইন্সট্রাক্টরের সার্বিক মন্তব্য: " : "Instructor feedback: "}
                            </span>
                            {portal.submission.instructorFeedback}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Numbered Task Cards with Per-Task Rubric Marks & Bilingual Remarks */}
                    <div className="space-y-4">
                      {(practicalExam.tasks || []).map((task, idx) => {
                        const draft = drafts[task.id] || { textAnswer: "", linkUrl: "" };
                        const taskGrade = portal.submission?.grades?.find(
                          (g) => g.taskId === task.id,
                        );
                        const hasEntry = Boolean(
                          draft.textAnswer.trim() || draft.linkUrl.trim() || draft.fileName,
                        );
                        return (
                          <div
                            key={task.id}
                            className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <span
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-black ${
                                    taskGrade
                                      ? "bg-emerald-500 text-white"
                                      : hasEntry
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                                <div>
                                  <h3 className="font-display text-base font-extrabold text-foreground">
                                    {lang === "bn" ? task.titleBn : task.titleEn}
                                  </h3>
                                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                                    {lang === "bn" ? task.promptBn : task.promptEn}
                                  </p>
                                </div>
                              </div>

                              <span className="shrink-0 rounded-xl border border-border bg-muted/40 px-3 py-1 font-mono text-xs font-extrabold text-foreground">
                                {taskGrade
                                  ? `${taskGrade.marks} / ${task.maxMarks}`
                                  : `${task.maxMarks} ${lang === "bn" ? "নম্বর" : "marks"}`}
                              </span>
                            </div>

                            {/* Instructor Per-Task Bilingual Remark (when graded!) */}
                            {taskGrade?.comment && (
                              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 text-xs text-foreground leading-relaxed">
                                <div className="font-bold text-emerald-700 dark:text-emerald-300 mb-0.5 flex items-center gap-1.5">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  <span>
                                    {lang === "bn" ? "এই টাস্কের মন্তব্য" : "Task evaluation note"}
                                  </span>
                                </div>
                                <div className="whitespace-pre-wrap">{taskGrade.comment}</div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 gap-3.5">
                              <label className="block space-y-1.5">
                                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>
                                    {lang === "bn" ? "লিখিত উত্তর / বিবরণ" : "Written explanation / reflection"}
                                  </span>
                                  {task.requireText && (
                                    <span className="text-destructive font-bold">*</span>
                                  )}
                                </span>
                                <textarea
                                  value={draft.textAnswer}
                                  onChange={(e) =>
                                    setDrafts((d) => ({
                                      ...d,
                                      [task.id]: { ...draft, textAnswer: e.target.value },
                                    }))
                                  }
                                  disabled={!canSubmit}
                                  rows={3}
                                  placeholder={
                                    lang === "bn"
                                      ? "আপনার কাজের সংক্ষিপ্ত বিবরণ বা উত্তর লিখুন…"
                                      : "Describe your workflow, findings, or deliverables…"
                                  }
                                  className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-65 transition"
                                />
                              </label>

                              <label className="block space-y-1.5">
                                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>
                                    {lang === "bn"
                                      ? "প্রজেক্ট লিংক (Drive / Canva / Live URL)"
                                      : "Project link (Drive / Canva / Live URL)"}
                                  </span>
                                  {task.requireLink && (
                                    <span className="text-destructive font-bold">*</span>
                                  )}
                                </span>
                                <input
                                  value={draft.linkUrl}
                                  onChange={(e) =>
                                    setDrafts((d) => ({
                                      ...d,
                                      [task.id]: { ...draft, linkUrl: e.target.value },
                                    }))
                                  }
                                  disabled={!canSubmit}
                                  className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-sm font-mono outline-none focus:border-primary disabled:opacity-65 transition"
                                  placeholder="https://"
                                />
                              </label>

                              {task.allowFile && (
                                <div className="space-y-1.5">
                                  <span className="text-xs font-semibold text-foreground block">
                                    {lang === "bn" ? "ফাইল সংযুক্তি (ঐচ্ছিক)" : "File attachment (optional)"}
                                  </span>
                                  {canSubmit ? (
                                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-3.5">
                                      <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition">
                                        <Upload className="h-3.5 w-3.5" />
                                        <span>
                                          {draft.fileName
                                            ? lang === "bn"
                                              ? "ফাইল বদলান"
                                              : "Replace file"
                                            : lang === "bn"
                                              ? "ফাইল নির্বাচন করুন"
                                              : "Choose file"}
                                        </span>
                                        <input
                                          type="file"
                                          accept={(practicalExam.allowedMimeTypes || []).join(",") || undefined}
                                          className="hidden"
                                          onChange={(e) => {
                                            void onFile(task, e.target.files?.[0] || null);
                                            e.target.value = "";
                                          }}
                                        />
                                      </label>
                                      {draft.fileName ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                          <FileCheck2 className="h-3.5 w-3.5" />
                                          <span className="max-w-[220px] truncate">{draft.fileName}</span>
                                          <button
                                            type="button"
                                            onClick={() => void onFile(task, null)}
                                            className="ml-1 hover:text-destructive"
                                            title="Remove file"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </span>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">
                                          {lang === "bn"
                                            ? `সর্বোচ্চ ${Math.round((practicalExam.maxFileBytes || DEFAULT_PRACTICAL_MAX_FILE_BYTES) / (1024 * 1024))} MB`
                                            : `Up to ${Math.round((practicalExam.maxFileBytes || DEFAULT_PRACTICAL_MAX_FILE_BYTES) / (1024 * 1024))} MB`}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    draft.fileName && (
                                      <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-foreground">
                                        <FileCheck2 className="h-3.5 w-3.5 text-primary" />
                                        <span>{draft.fileName}</span>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Submit Action Footer */}
                    {canSubmit && (
                      <div className="sticky bottom-20 md:bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl p-4 shadow-lg">
                        <div className="text-xs text-muted-foreground">
                          <span className="font-bold text-foreground">
                            {practicalCompletion.filled}/{practicalCompletion.total}
                          </span>{" "}
                          {lang === "bn"
                            ? "টি টাস্কে তথ্য দেওয়া হয়েছে — জমা দেওয়ার আগে লিংকগুলো যাচাই করুন।"
                            : "tasks have content — verify your public links before submitting."}
                        </div>
                        <button
                          type="button"
                          onClick={() => void submitPractical()}
                          disabled={submitting}
                          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60 transition"
                        >
                          {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          <span>
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
                                  : "Submit practical work"}
                          </span>
                        </button>
                      </div>
                    )}

                    {gradedLocked && (
                      <p className="text-xs font-semibold text-muted-foreground">
                        {lang === "bn"
                          ? "মার্কিং সম্পন্ন হওয়ায় জমা লক করা হয়েছে। কোনো পরিবর্তনের জন্য ইন্সট্রাক্টরের সাথে যোগাযোগ করুন।"
                          : "Submission is locked because grading is complete. Contact your instructor if a revision is needed."}
                      </p>
                    )}
                  </>
                )}
              </section>
            )}

            {/* ============================================================= */}
            {/* TAB 7: DEDICATED COURSE AI TUTOR (Full Conversational Studio) */}
            {/* ============================================================= */}
            {portalTab === "tutor" && (
              <section className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-lg font-extrabold text-foreground">
                          {lang === "bn" ? "কোর্স AI টিউটর" : "Course AI Tutor"}
                        </h2>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            portal.hasAiTutor
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              portal.hasAiTutor ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                            }`}
                          />
                          {portal.hasAiTutor ? "Online" : "Offline"}
                        </span>
                        {"courseKbCount" in portal && typeof portal.courseKbCount === "number" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                            <Database className="h-3 w-3 text-primary" />
                            {portal.courseKbCount + materials.length} KB docs
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {lang === "bn"
                          ? `${portal.course?.titleBn} এর নিজস্ব নলেজবেস ও স্টাডি নোট থেকে তাৎক্ষণিক উত্তর।`
                          : `Grounded strictly in ${portal.course?.titleEn}'s dedicated Knowledge Base & materials.`}
                      </p>
                    </div>
                  </div>

                  {tutorMessages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTutorMessages([])}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{lang === "bn" ? "চ্যাট মুছুন" : "Clear chat"}</span>
                    </button>
                  )}
                </div>

                {/* Study Mode Selector */}
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ["explain", lang === "bn" ? "সহজ ব্যাখ্যা" : "Explain concept"],
                      ["practice", lang === "bn" ? "প্র্যাকটিস প্রশ্ন" : "Practice quiz"],
                      ["capstone", lang === "bn" ? "ক্যাপস্টোন গাইড" : "Capstone checklist"],
                      ["summary", lang === "bn" ? "দ্রুত রিভিশন" : "Rapid summary"],
                    ] as Array<[TutorStudyMode, string]>
                  ).map(([modeId, label]) => (
                    <button
                      key={modeId}
                      type="button"
                      onClick={() => setTutorMode(modeId)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                        tutorMode === modeId
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {!portal.hasAiTutor && (
                  <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-800 dark:text-amber-200">
                    {lang === "bn"
                      ? "AI টিউটর চালু করতে অ্যাডমিনকে Admin → AI Pool এ একটি AI প্রোভাইডার যুক্ত করতে হবে।"
                      : "AI Tutor needs an active provider (OpenRouter, Gemini, OpenAI, Claude, or Groq) in Admin → AI Pool."}
                  </div>
                )}

                {/* Chat Thread */}
                <div className="min-h-[300px] max-h-[500px] overflow-y-auto rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-4">
                  {tutorMessages.length === 0 ? (
                    <div className="py-8 text-center space-y-4">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-display text-sm font-bold text-foreground">
                          {lang === "bn"
                            ? "আপনার কোর্সের যেকোনো বিষয় জানতে প্রশ্ন করুন"
                            : "Ask anything about your course, exam, or capstone"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lang === "bn"
                            ? "দ্রুত শুরু করতে নিচের যেকোনো প্রশ্ন ট্যাপ করুন:"
                            : "Tap a starter question below or write your own:"}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                        {(lang === "bn"
                          ? [
                              "ফাইনাল ক্যাপস্টোনে কী কী জমা দিতে হবে?",
                              "গুরুত্বপূর্ণ টপিকগুলোর দ্রুত রিভিশন সামারি দাও",
                              "পরীক্ষার জন্য ৩টি প্র্যাকটিস MCQ প্রশ্ন করো",
                            ]
                          : [
                              "What deliverables are required for the final capstone?",
                              "Summarize the core exam topics for quick revision",
                              "Quiz me with 3 exam-style practice questions",
                            ]
                        ).map((starter) => (
                          <button
                            key={starter}
                            type="button"
                            disabled={!portal.hasAiTutor || tutorBusy}
                            onClick={() => void sendTutorQuestion(starter)}
                            className="rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:border-primary/50 hover:bg-primary/5 transition disabled:opacity-50"
                          >
                            {starter}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    tutorMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {msg.role === "assistant" && (
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                            <Bot className="h-4 w-4" />
                          </div>
                        )}
                        <div
                          className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-tr-sm"
                              : msg.error
                                ? "border border-destructive/35 bg-destructive/10 text-destructive rounded-tl-sm"
                                : "border border-border bg-card text-foreground rounded-tl-sm shadow-xs"
                          }`}
                        >
                          <div>{msg.content}</div>
                          {msg.role === "assistant" && !msg.error && (
                            <div className="mt-2.5 pt-2 border-t border-border/60 space-y-1.5">
                              {msg.sourcesUsed && msg.sourcesUsed.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                  <BookOpen className="h-3 w-3 text-primary shrink-0" />
                                  {msg.sourcesUsed.slice(0, 4).map((src) => (
                                    <span
                                      key={src.id}
                                      className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary"
                                    >
                                      {src.title}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono">
                                <span>
                                  {msg.provider ? `${msg.provider} · ` : ""}
                                  {msg.model || "AI Pool"}
                                  {msg.latencyMs ? ` · ${msg.latencyMs}ms` : ""}
                                </span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(msg.content);
                                      setCopiedTutorMsgId(msg.id);
                                      window.setTimeout(() => setCopiedTutorMsgId(null), 1800);
                                    } catch {
                                      // ignore
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 font-sans font-bold text-primary hover:underline"
                                >
                                  {copiedTutorMsgId === msg.id ? (
                                    <>
                                      <Check className="h-3 w-3" /> Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" /> Copy
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {tutorBusy && (
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>
                        {lang === "bn"
                          ? "কোর্স নলেজবেস থেকে উত্তর তৈরি হচ্ছে…"
                          : "Searching course knowledge base…"}
                      </span>
                    </div>
                  )}
                  <div ref={tutorEndRef} />
                </div>

                {/* Message Composer */}
                <form onSubmit={askTutor} className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                    value={tutorQ}
                    disabled={tutorBusy || !portal.hasAiTutor}
                    onChange={(e) => setTutorQ(e.target.value)}
                    placeholder={
                      lang === "bn"
                        ? "আপনার প্রশ্ন লিখুন…"
                        : "Ask your course tutor anything…"
                    }
                    required
                  />
                  <button
                    type="submit"
                    disabled={tutorBusy || !tutorQ.trim() || !portal.hasAiTutor}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
                  >
                    {tutorBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span>{lang === "bn" ? "পাঠান" : "Send"}</span>
                  </button>
                </form>
              </section>
            )}

            {/* ============================================================= */}
            {/* TAB 8: OFFICIAL COURSE CERTIFICATE                            */}
            {/* ============================================================= */}
            {portalTab === "certificate" && (
              <section className="space-y-5">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-foreground">
                    {lang === "bn" ? "কোর্স সমাপনী সনদপত্র" : "Course Completion Certificate"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lang === "bn"
                      ? "চূড়ান্ত কুইজ এবং প্রায়োগিক মার্কিং সম্পন্ন হলে প্রশাসক আপনার অফিশিয়াল সনদ ইস্যু করেন।"
                      : "Official verifiable course-level credential issued after Final Quiz and Practical grading."}
                  </p>
                </div>

                {portal.courseCertificate ? (
                  <div className="space-y-5">
                    <div className="rounded-3xl border border-emerald-500/35 bg-emerald-500/8 p-5 flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>{lang === "bn" ? "যাচাইকৃত সনদপত্র" : "Verified Credential"}</span>
                        </div>
                        <div className="font-mono text-base font-black text-foreground">
                          {portal.courseCertificate.certificateNumber}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          Issued {portal.courseCertificate.issueDate} · Combined{" "}
                          {portal.courseCertificate.combinedScorePct ?? "—"}%
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {"studentName" in portal.courseCertificate && (
                          <button
                            type="button"
                            disabled={downloadingPdf}
                            onClick={() => void handleDownloadCertificate()}
                            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition"
                          >
                            {downloadingPdf ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            <span>
                              {downloadingPdf
                                ? lang === "bn"
                                  ? "PDF তৈরি হচ্ছে…"
                                  : "Generating PDF…"
                                : lang === "bn"
                                  ? "PDF ডাউনলোড"
                                  : "Download PDF"}
                            </span>
                          </button>
                        )}
                        <Link
                          to="/verify/$certId"
                          params={{ certId: portal.courseCertificate.certificateNumber }}
                          className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground hover:bg-accent transition"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-primary" />
                          <span>{lang === "bn" ? "পাবলিক যাচাই পেজ" : "Public verification"}</span>
                        </Link>
                      </div>
                    </div>

                    {"studentName" in portal.courseCertificate &&
                      (portal.courseCertificate as CertificateData).studentName && (
                        <CertificateView certificate={portal.courseCertificate as CertificateData} />
                      )}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-600 dark:text-amber-400">
                        <Award className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-display text-base font-extrabold text-foreground">
                          {completion?.eligibleForCourseCertificate
                            ? lang === "bn"
                              ? "আপনি সনদের জন্য যোগ্য — অ্যাডমিন ইস্যুর অপেক্ষায়"
                              : "You are eligible — awaiting admin issuance"
                            : lang === "bn"
                              ? "সনদপত্র আনলক করতে নিচের ধাপগুলো সম্পন্ন করুন"
                              : "Complete the remaining requirements to unlock your certificate"}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {lang === "bn"
                            ? "সব ধাপ সম্পন্ন হলে আপনার ইমেইলে এবং এই ট্যাবে সনদপত্র চলে আসবে।"
                            : "Once requirements are graded and issued, your downloadable PDF and QR verification link appear here."}
                        </p>
                      </div>
                    </div>

                    {!completion?.eligibleForCourseCertificate &&
                      (completion?.missing || []).length > 0 && (
                        <ul className="space-y-2 pt-1">
                          {(completion?.missing || []).map((code) => (
                            <li
                              key={code}
                              className="flex items-center gap-2.5 rounded-2xl border border-border bg-muted/25 px-4 py-2.5 text-xs font-semibold text-foreground"
                            >
                              <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                              <span>{localizeMissing(code, lang)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
