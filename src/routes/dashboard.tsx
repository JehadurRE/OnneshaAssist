import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { READY_MADE_PACKS, DEFAULT_REGIONS } from "@/lib/mock-data";
import { AiQuizModal } from "@/components/dashboard/AiQuizModal";
import { OmrSheetView } from "@/components/common/OmrSheetView";
import { MeritGazetteView } from "@/components/common/MeritGazetteView";
import {
  Course,
  Quiz,
  Question,
  QuestionType,
  RosterStudent,
  CertificateData,
  ExamSessionRecord,
  ExamResultRecord,
  Region,
} from "@/lib/types";
import {
  db,
  DbSmsLog,
  DbTransaction,
  formatDeterministicCertNumber,
  isCoursePrivate,
  isQuizPrivate,
} from "@/lib/db";
import { computeTotalQuizMarks, isPassingScore, resolvePassThresholdPct } from "@/lib/scoring";
import { computeSessionRetakeDiagnostics } from "@/lib/retake-utils";
import { OnneshaLogo } from "@/components/common/OnneshaLogo";
import { gameEngine } from "@/lib/game-engine";
import { serverGetActiveRooms } from "@/lib/server-session";
import { SmsGateway } from "@/lib/sms-gateway";
import { getAiCredits } from "@/lib/ai-generator";
import {
  Award,
  BookOpen,
  ChevronRight,
  Download,
  FileSpreadsheet,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  PenTool,
  Phone,
  Play,
  Plus,
  Printer,
  Radio,
  Receipt,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  UserPlus,
  Users,
  Wand2,
  X,
} from "lucide-react";

interface DashboardSearch {
  tab?: string | undefined;
  courseId?: string | undefined;
  editQuizId?: string | undefined;
}

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    tab: typeof search["tab"] === "string" ? search["tab"] : undefined,
    courseId: typeof search["courseId"] === "string" ? search["courseId"] : undefined,
    editQuizId: typeof search["editQuizId"] === "string" ? search["editQuizId"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Instructor Studio & Regional Assessment Command · Onnesha Arena" },
      {
        name: "description",
        content:
          "Manage regional candidate rosters, model tests, AI generator, OMR printing, SMS dispatch, and verifiable certificates.",
      },
    ],
  }),
  component: DashboardPage,
});

type TabType =
  | "overview"
  | "quizzes"
  | "ai_creator"
  | "roster"
  | "results"
  | "certificates"
  | "sms_logs"
  | "billing"
  | "settings";

function DashboardPage() {
  const { lang } = useLanguage();
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    updateProfile,
    changePassword,
  } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [regions, setRegions] = useState<Region[]>(DEFAULT_REGIONS);
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("all");
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [smsLogs, setSmsLogs] = useState<DbSmsLog[]>([]);
  const [transactions, setTransactions] = useState<DbTransaction[]>([]);
  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [examSessions, setExamSessions] = useState<ExamSessionRecord[]>([]);
  const [examResults, setExamResults] = useState<ExamResultRecord[]>([]);
  const [showAllModelPacks, setShowAllModelPacks] = useState(false);
  const [activeRooms, setActiveRooms] = useState<
    {
      pin: string;
      quizId: string;
      quizTitleEn: string;
      quizTitleBn: string;
      hostId?: string;
      phase: string;
      participantCount: number;
      totalQuestions: number;
      allowedRegionName: string;
    }[]
  >([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Filters for Roster & Results
  const [selectedRosterRegionId, setSelectedRosterRegionId] = useState<string>("all");
  const [rosterSearchQuery, setRosterSearchQuery] = useState<string>("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");
  const [selectedResultsRegionId, setSelectedResultsRegionId] = useState<string>("all");
  const [retakeSkipCompleted, setRetakeSkipCompleted] = useState<boolean>(true);
  const [retakeMinAnswers, setRetakeMinAnswers] = useState<number>(1);
  const [retakeMinAnswersDraft, setRetakeMinAnswersDraft] = useState<string>("1");
  const editQuizParamAppliedRef = useRef<boolean>(false);
  const editingOriginalMetaRef = useRef<{
    id: string;
    instructorId?: string | undefined;
    instructorName?: string | undefined;
    titleEn: string;
    titleBn: string;
  } | null>(null);

  const [showAiModal, setShowAiModal] = useState(false);
  const [selectedQuizForOmr, setSelectedQuizForOmr] = useState<Quiz | null>(null);
  const [showGazette, setShowGazette] = useState(false);
  const [aiCredits, setAiCredits] = useState(50);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSuccessMsg, setSmsSuccessMsg] = useState<string | null>(null);

  // Password Change State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatusMsg, setPasswordStatusMsg] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Settings Credentials & Co-Branding State
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [smsToken, setSmsToken] = useState("");
  const [institutionNameInput, setInstitutionNameInput] = useState(
    user?.institutionName || "Onnesha Assessment Arena",
  );
  const [instructorNameInput, setInstructorNameInput] = useState(
    user?.name || "Chief Assessment Officer",
  );
  const [showPartnerLogo, setShowPartnerLogo] = useState<boolean>(false);
  const [partnerName, setPartnerName] = useState<string>("");
  const [partnerLogoUrl, setPartnerLogoUrl] = useState<string>("");
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  // Add Region Modal State
  const [showAddRegion, setShowAddRegion] = useState(false);
  const [newRegionCode, setNewRegionCode] = useState("");
  const [newRegionNameEn, setNewRegionNameEn] = useState("");
  const [newRegionNameBn, setNewRegionNameBn] = useState("");
  const [newRegionCenter, setNewRegionCenter] = useState("");

  // New Student Roster Modal State
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentRoll, setNewStudentRoll] = useState("");
  const [newStudentPhone, setNewStudentPhone] = useState("");
  const [newStudentRegionId, setNewStudentRegionId] = useState<string>("reg-dhaka");
  const [newStudentBatch, setNewStudentBatch] = useState("46th BCS & Cadet Batch");
  const [newGuardianPhone, setNewGuardianPhone] = useState("");

  const refreshDbState = () => {
    setRegions(db.getRegions());
    setCourses(db.getCourses());
    setQuizzes(db.getQuizzes());
    setRoster(db.getRoster());
    setSmsLogs(db.getSmsLogs());
    setTransactions(db.getTransactions());
    setCertificates(db.getCertificates());
    setExamSessions(db.getExamSessions());
    setExamResults(db.getAllExamResults());
    setAiCredits(getAiCredits());
    const currentBranding = db.getBranding();
    setShowPartnerLogo(currentBranding.showPartnerLogo);
    setPartnerName(currentBranding.partnerName);
    setPartnerLogoUrl(currentBranding.partnerLogoUrl);
    if (currentBranding.institutionTitle) {
      setInstitutionNameInput(currentBranding.institutionTitle);
    }
  };

  const refreshActiveRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await serverGetActiveRooms();
      if (res.success && Array.isArray(res.rooms)) {
        setActiveRooms(res.rooms);
      }
    } catch {
      // ignore transient network error
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    refreshDbState();
    refreshActiveRooms();
    db.syncFromServerStore().then(refreshDbState);
    const unsub = db.subscribe(() => {
      refreshDbState();
    });

    if (typeof window !== "undefined") {
      setGeminiApiKey(localStorage.getItem("onnesha_gemini_key") || "");
      setSmsToken(localStorage.getItem("onnesha_sms_token") || "");
    }
    return () => unsub();
  }, []);

  const isSuperAdmin = user?.role === "admin";
  const assignedCourses = useMemo(() => {
    if (isSuperAdmin) return courses;
    const assignedIds = new Set(user?.assignedCourseIds || []);
    return courses.filter(
      (c) => assignedIds.has(c.id) || (c.instructorIds || []).includes(user?.id || ""),
    );
  }, [courses, isSuperAdmin, user?.assignedCourseIds, user?.id]);

  const scopedQuizzes = useMemo(() => {
    if (isSuperAdmin) return quizzes;
    const myCourseIds = new Set(assignedCourses.map((c) => c.id));
    if (showAllModelPacks) {
      return quizzes.filter(
        (q) =>
          !isQuizPrivate(q, courses) ||
          q.instructorId === user?.id ||
          (q.courseId && myCourseIds.has(q.courseId)),
      );
    }
    return quizzes.filter(
      (q) => q.instructorId === user?.id || (q.courseId && myCourseIds.has(q.courseId)),
    );
  }, [quizzes, courses, isSuperAdmin, showAllModelPacks, assignedCourses, user?.id]);

  const primaryHostQuizSlug = scopedQuizzes[0]?.slug || scopedQuizzes[0]?.id || "bcs-gk";

  // Filtered Roster by Region & Search Query
  const filteredRoster = useMemo(() => {
    return roster
      .filter((s) => selectedRosterRegionId === "all" || s.regionId === selectedRosterRegionId)
      .filter((s) => {
        if (!rosterSearchQuery.trim()) return true;
        const q = rosterSearchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.rollNumber.toLowerCase().includes(q) ||
          (s.phone || "").includes(q) ||
          (s.regionName || "").toLowerCase().includes(q)
        );
      });
  }, [roster, selectedRosterRegionId, rosterSearchQuery]);

  // Filtered Results by Session & Region
  const activeResults = useMemo(() => {
    return examResults
      .filter(
        (r) =>
          selectedSessionId === "all" ||
          r.sessionId === selectedSessionId ||
          r.pin === selectedSessionId,
      )
      .filter((r) => selectedResultsRegionId === "all" || r.regionId === selectedResultsRegionId);
  }, [examResults, selectedSessionId, selectedResultsRegionId]);

  // Region-Wise Telemetry Summary for Results Tab
  const regionPerformanceSummary = useMemo(() => {
    const sessionFiltered =
      selectedSessionId === "all"
        ? examResults
        : examResults.filter(
            (r) => r.sessionId === selectedSessionId || r.pin === selectedSessionId,
          );

    return regions
      .map((reg) => {
        const regRows = sessionFiltered.filter((r) => r.regionId === reg.id);
        const count = regRows.length;
        const avg =
          count > 0 ? Math.round(regRows.reduce((acc, r) => acc + r.score, 0) / count) : 0;
        const top = count > 0 ? Math.max(...regRows.map((r) => r.score)) : 0;
        return {
          ...reg,
          count,
          avgScore: avg,
          topScore: top,
        };
      })
      .filter((r) => r.count > 0);
  }, [examResults, selectedSessionId, regions]);

  const selectedExamSession = useMemo(
    () =>
      selectedSessionId === "all"
        ? null
        : examSessions.find((s) => s.id === selectedSessionId || s.pin === selectedSessionId) ||
          null,
    [examSessions, selectedSessionId],
  );

  const selectedSessionRetakeDiag = useMemo(() => {
    if (!selectedExamSession) return null;
    return computeSessionRetakeDiagnostics({
      session: selectedExamSession,
      examResults,
      roster,
      regions,
      minCompletedAnswers: retakeMinAnswers,
    });
  }, [selectedExamSession, examResults, roster, regions, retakeMinAnswers]);

  // New / Edit Quiz Builder State
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [editingQuizSlug, setEditingQuizSlug] = useState<string | null>(null);
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [newQuizCategory, setNewQuizCategory] = useState("General Knowledge");
  const [newQuizCourseId, setNewQuizCourseId] = useState<string>("course-bcs-foundation");
  const [newQuizNumber, setNewQuizNumber] = useState<number>(5);
  const [newQuestions, setNewQuestions] = useState<Question[]>([
    {
      id: "nq-1",
      textEn: "What is the capital of Bangladesh?",
      textBn: "বাংলাদেশের রাজধানী কোনটি?",
      type: "single_mcq",
      timeLimitSec: 20,
      points: 1000,
      negativeMarks: 0.25,
      options: [
        { id: "o1", textEn: "Dhaka", textBn: "ঢাকা", isCorrect: true },
        { id: "o2", textEn: "Chittagong", textBn: "চট্টগ্রাম" },
        { id: "o3", textEn: "Sylhet", textBn: "সিলেট" },
        { id: "o4", textEn: "Rajshahi", textBn: "রাজশাহী" },
      ],
      correctOptionIds: ["o1"],
      acceptedAnswers: [],
      explanationBn: "ঢাকা বাংলাদেশের রাজধানী এবং প্রধান প্রশাসনিক কেন্দ্র।",
    },
  ]);

  const handleLoadQuizIntoEditor = (quiz: Quiz, forceClone = false) => {
    const isForeignOrTemplate =
      !!quiz.isTemplate ||
      (user?.role !== "admin" && !!quiz.instructorId && quiz.instructorId !== user?.id);
    const cloneMode = forceClone || isForeignOrTemplate;
    const fallbackCourseId = courses[0]?.id || "course-bcs-foundation";
    const cid = quiz.courseId || fallbackCourseId;
    const nextCourseQuizNum =
      quizzes
        .filter((q) => q.courseId === cid)
        .reduce((m, q) => Math.max(m, q.quizNumber || 0), 0) + 1;

    editingOriginalMetaRef.current = cloneMode
      ? null
      : {
          id: quiz.id,
          instructorId: quiz.instructorId,
          instructorName: quiz.instructorName,
          titleEn: quiz.titleEn || quiz.titleBn,
          titleBn: quiz.titleBn || quiz.titleEn,
        };

    setEditingQuizId(cloneMode ? null : quiz.id);
    setEditingQuizSlug(cloneMode ? null : quiz.slug || quiz.id);
    setNewQuizTitle(
      cloneMode ? `${quiz.titleEn || quiz.titleBn} (Custom Copy)` : quiz.titleBn || quiz.titleEn,
    );
    setNewQuizCourseId(cid);
    setNewQuizNumber(cloneMode ? nextCourseQuizNum : quiz.quizNumber || 1);
    setNewQuizCategory(quiz.categoryEn || "General Knowledge");
    setNewQuestions(
      quiz.questions.length > 0
        ? JSON.parse(JSON.stringify(quiz.questions))
        : [
            {
              id: "nq-1",
              textEn: "Sample Question #1",
              textBn: "নমুনা প্রশ্ন #১",
              type: "single_mcq",
              timeLimitSec: 20,
              points: 1000,
              negativeMarks: 0.25,
              options: [
                { id: "o1", textEn: "Option A", textBn: "অপশন ক", isCorrect: true },
                { id: "o2", textEn: "Option B", textBn: "অপশন খ" },
                { id: "o3", textEn: "Option C", textBn: "অপশন গ" },
                { id: "o4", textEn: "Option D", textBn: "অপশন ঘ" },
              ],
              correctOptionIds: ["o1"],
            },
          ],
    );
    setActiveTab("ai_creator");
  };

  const loadQuizIntoEditorRef = useRef(handleLoadQuizIntoEditor);
  loadQuizIntoEditorRef.current = handleLoadQuizIntoEditor;

  useEffect(() => {
    if (typeof window === "undefined" || authLoading) return;
    if (editQuizParamAppliedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab") as TabType | null;
    const editQuizIdParam = params.get("editQuizId");
    const courseIdParam = params.get("courseId");

    if (tabParam) {
      setActiveTab(tabParam);
    }
    if (courseIdParam) {
      setNewQuizCourseId(courseIdParam);
      const count = db.getQuizzes().filter((q) => q.courseId === courseIdParam).length;
      setNewQuizNumber(count + 1);
    }
    if (editQuizIdParam) {
      const target = db.getQuizBySlug(editQuizIdParam);
      if (target) {
        editQuizParamAppliedRef.current = true;
        loadQuizIntoEditorRef.current(target);
      }
      return;
    }
    editQuizParamAppliedRef.current = true;
  }, [authLoading, quizzes.length]);

  const handleSaveQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuizTitle) return;

    const existingQuiz = editingQuizId
      ? quizzes.find((q) => q.id === editingQuizId || q.slug === editingQuizSlug)
      : undefined;
    const selectedCourse = courses.find((c) => c.id === newQuizCourseId);
    const quizId = editingQuizId || `custom-quiz-${Date.now()}`;
    const quizSlug = editingQuizSlug || `custom-${Date.now().toString(36)}`;
    const origMeta =
      editingOriginalMetaRef.current && editingOriginalMetaRef.current.id === editingQuizId
        ? editingOriginalMetaRef.current
        : null;
    const preserveTitleEn =
      origMeta &&
      origMeta.titleEn &&
      origMeta.titleEn !== origMeta.titleBn &&
      newQuizTitle === origMeta.titleBn
        ? origMeta.titleEn
        : newQuizTitle;
    const ownerId = editingQuizId
      ? origMeta?.instructorId || existingQuiz?.instructorId || user?.id || "usr-instructor-1"
      : user?.id || "usr-instructor-1";
    const ownerName = editingQuizId
      ? origMeta?.instructorName || existingQuiz?.instructorName || user?.name || "Instructor"
      : user?.name || "Instructor";

    const newQuiz: Quiz = {
      id: quizId,
      slug: quizSlug,
      courseId: selectedCourse?.id || (editingQuizId ? newQuizCourseId : undefined),
      courseTitle: selectedCourse?.titleEn || existingQuiz?.courseTitle,
      quizNumber: newQuizNumber || 1,
      instructorId: ownerId,
      instructorName: ownerName,
      titleEn: preserveTitleEn,
      titleBn: newQuizTitle,
      descriptionEn:
        existingQuiz?.descriptionEn && existingQuiz.descriptionEn !== existingQuiz.descriptionBn
          ? existingQuiz.descriptionEn
          : `${selectedCourse ? `${selectedCourse.titleEn} · Quiz #${newQuizNumber || 1} · ` : ""}Created by ${ownerName}.`,
      descriptionBn: `${selectedCourse ? `${selectedCourse.titleBn} · কুইজ #${newQuizNumber || 1} · ` : ""}ইন্সট্রাক্টর ${ownerName} কর্তৃক তৈরি মডেল টেস্ট।`,
      icon: selectedCourse?.icon || existingQuiz?.icon || "🎯",
      categoryEn: selectedCourse?.categoryEn || newQuizCategory,
      categoryBn: selectedCourse?.categoryBn || existingQuiz?.categoryBn || newQuizCategory,
      questions: newQuestions,
      isTemplate: false,
      isPrivate: selectedCourse
        ? isCoursePrivate(selectedCourse)
        : Boolean(existingQuiz?.isPrivate),
      tags: ["Custom", `Quiz ${newQuizNumber || 1}`, "Multi-Format"],
    };

    db.saveCustomQuiz(newQuiz);
    setQuizzes(db.getQuizzes());
    editingOriginalMetaRef.current = null;
    setEditingQuizId(null);
    setEditingQuizSlug(null);
    setNewQuizTitle("");
    setActiveTab("quizzes");
    setSmsSuccessMsg(
      `✓ Saved "${newQuiz.titleEn}" (${selectedCourse ? `${selectedCourse.code} · Quiz #${newQuiz.quizNumber}` : "Custom Module"}) to server database.`,
    );
    setTimeout(() => setSmsSuccessMsg(null), 4000);
  };

  const handleAddRegion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegionCode.trim() || !newRegionNameEn.trim()) return;
    const created = db.addRegion({
      code: newRegionCode,
      nameEn: newRegionNameEn,
      nameBn: newRegionNameBn || newRegionNameEn,
      centerName: newRegionCenter,
    });
    setRegions(db.getRegions());
    setNewStudentRegionId(created.id);
    setNewRegionCode("");
    setNewRegionNameEn("");
    setNewRegionNameBn("");
    setNewRegionCenter("");
    setShowAddRegion(false);
    setSmsSuccessMsg(`✓ Added Region "${created.nameEn}" (${created.code}) and synced to server.`);
    setTimeout(() => setSmsSuccessMsg(null), 4000);
  };

  const handleDeleteRegion = async (regId: string) => {
    const res = await db.deleteRegion(regId);
    setRegions(db.getRegions());
    if (res.success && selectedRosterRegionId === regId) {
      setSelectedRosterRegionId("all");
    }
    if (!res.success) {
      setSmsSuccessMsg(res.error || "Could not delete region from server.");
      setTimeout(() => setSmsSuccessMsg(null), 4000);
    }
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName || !newStudentRoll) return;

    const reg =
      regions.find((r) => r.id === newStudentRegionId) || regions[0] || DEFAULT_REGIONS[0];
    if (!reg) return;

    db.addStudentToRoster({
      name: newStudentName.trim(),
      rollNumber: newStudentRoll.trim(),
      phone: newStudentPhone.trim() || newGuardianPhone.trim(),
      regionId: reg.id,
      regionName: reg.nameEn,
      guardianPhone: newGuardianPhone.trim() || newStudentPhone.trim(),
      email: `${newStudentRoll.trim()}@candidate.local`,
      batch: newStudentBatch.trim() || "46th BCS & Cadet Batch",
    });

    setRoster(db.getRoster());
    setNewStudentName("");
    setNewStudentRoll("");
    setNewStudentPhone("");
    setNewGuardianPhone("");
    setShowAddStudent(false);
    setSmsSuccessMsg(
      `✓ Enrolled ${newStudentName} under ${reg.nameEn} and synced to central server.`,
    );
    setTimeout(() => setSmsSuccessMsg(null), 4000);
  };

  const handleDeleteStudent = (id: string) => {
    db.removeStudentFromRoster(id);
    setRoster(db.getRoster());
  };

  const handleExportCsv = () => {
    const currentRoster = filteredRoster;
    const headers = "Roll,Name,Region,CandidatePhone,GuardianPhone,Batch,Email\n";
    const rows = currentRoster
      .map(
        (s) =>
          `"${s.rollNumber}","${s.name}","${s.regionName || "Dhaka Range"}","${s.phone || ""}","${s.guardianPhone || ""}","${s.batch || "46th BCS"}","${s.email || ""}"`,
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `onnesha_regional_roster_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const firstLine = lines[0] ?? "";
      const startIndex = firstLine.toLowerCase().includes("roll") ? 1 : 0;
      const toImport: Omit<RosterStudent, "id" | "createdAt">[] = [];
      const currentRegions = db.getRegions();

      for (let i = startIndex; i < lines.length; i++) {
        const rawLine = lines[i];
        if (!rawLine) continue;
        const parts = rawLine.split(",").map((p) => p.replace(/^["']|["']$/g, "").trim());
        if (parts.length >= 2 && parts[0] && parts[1]) {
          // Format supported: Roll, Name, RegionName (optional), CandidatePhone, GuardianPhone, Batch
          const regionText = parts[2] || "Dhaka Range";
          const matchedRegion =
            currentRegions.find(
              (r) =>
                r.nameEn.toLowerCase().includes(regionText.toLowerCase()) ||
                r.code.toLowerCase() === regionText.toLowerCase() ||
                r.nameBn.includes(regionText),
            ) ||
            currentRegions.find((r) => r.id === selectedRosterRegionId) ||
            currentRegions[0] ||
            DEFAULT_REGIONS[0];

          if (!matchedRegion) continue;
          const candPhone = parts[3] || parts[4] || "";
          const guardPhone = parts[4] || parts[3] || "";

          toImport.push({
            rollNumber: parts[0],
            name: parts[1],
            regionId: matchedRegion.id,
            regionName: matchedRegion.nameEn,
            phone: candPhone,
            guardianPhone: guardPhone,
            batch: parts[5] || "2026 Regional Assessment",
            email: parts[6] || `${parts[0]}@candidate.local`,
          });
        }
      }

      if (toImport.length > 0) {
        db.bulkAddStudentsToRoster(toImport);
        setRoster(db.getRoster());
        setSmsSuccessMsg(
          `✓ Bulk imported ${toImport.length} candidates across Regions and synced to live server.`,
        );
        setTimeout(() => setSmsSuccessMsg(null), 4000);
      }
    };
    reader.readAsText(file);
  };

  const handleSendGuardianSms = async () => {
    setIsSendingSms(true);
    setSmsSuccessMsg(null);

    const currentRoster = db.getRoster();
    const studentsWithPhone = currentRoster.filter(
      (s) => (s.guardianPhone && s.guardianPhone.length >= 11) || (s.phone && s.phone.length >= 11),
    );

    if (studentsWithPhone.length === 0) {
      setIsSendingSms(false);
      setSmsSuccessMsg(
        "Notice: No registered candidates with valid 11-digit mobile numbers in roster.",
      );
      setTimeout(() => setSmsSuccessMsg(null), 4000);
      return;
    }

    const sortedResults = [...activeResults].sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
    const defaultSelectedSession = examSessions.find((es) => es.id === selectedSessionId);

    const payloads = studentsWithPhone.map((s, idx) => {
      const matchingResult = sortedResults.find(
        (r) =>
          r.rollNumber.toLowerCase() === s.rollNumber.toLowerCase() ||
          r.name.toLowerCase() === s.name.toLowerCase(),
      );
      const matchedSession = matchingResult
        ? examSessions.find(
            (es) => es.id === matchingResult.sessionId || es.pin === matchingResult.pin,
          ) || defaultSelectedSession
        : defaultSelectedSession;
      const matchedQuiz = matchedSession
        ? quizzes.find((q) => q.id === matchedSession.quizId || q.slug === matchedSession.quizId)
        : undefined;

      const score = matchingResult ? matchingResult.score : 0;
      const rank = matchingResult ? matchingResult.rank : idx + 1;
      const totalPoints = computeTotalQuizMarks(
        matchedQuiz?.questions,
        matchedSession?.totalQuestions || 5,
      );
      const currentSessionTitle =
        matchedSession?.quizTitleBn ||
        matchedSession?.quizTitleEn ||
        matchedQuiz?.titleBn ||
        matchedQuiz?.titleEn ||
        "Assessment Evaluation";

      return {
        studentName: s.name,
        rollNumber: s.rollNumber,
        guardianPhone: s.guardianPhone || s.phone || "",
        quizTitle: currentSessionTitle,
        score,
        totalPoints,
        rank,
        totalParticipants: Math.max(
          matchedSession?.participantCount || 0,
          studentsWithPhone.length,
          activeResults.length,
        ),
      };
    });

    const result = await SmsGateway.sendBulkGuardianScorecards(payloads);
    setIsSendingSms(false);
    setSmsLogs(db.getSmsLogs());
    setSmsSuccessMsg(`✓ Dispatched ${result.totalSent} scorecard SMS alerts via SMS Gateway.`);
    setTimeout(() => setSmsSuccessMsg(null), 5000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatusMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordStatusMsg("Error: New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordStatusMsg("Error: Password must be at least 6 characters long.");
      return;
    }

    setIsChangingPassword(true);
    const res = await changePassword(oldPassword, newPassword);
    setIsChangingPassword(false);

    if (res.success) {
      setPasswordStatusMsg("✓ Password successfully updated and verified in registry.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordStatusMsg(null), 4000);
    } else {
      setPasswordStatusMsg(`Error: ${res.error || "Failed to update password."}`);
    }
  };

  const handlePartnerLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setPartnerLogoUrl(dataUrl);
        setShowPartnerLogo(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      const cleanGeminiKey = geminiApiKey.trim();
      localStorage.setItem("onnesha_gemini_key", cleanGeminiKey);
      localStorage.setItem("onnesha_sms_token", smsToken.trim());
      updateProfile({
        name: instructorNameInput,
        institutionName: institutionNameInput,
      });
      if (isSuperAdmin) {
        const currentBranding = db.getBranding();
        db.saveBranding({
          ...currentBranding,
          showPartnerLogo,
          partnerName: partnerName.trim(),
          partnerLogoUrl: partnerLogoUrl.trim(),
          institutionTitle: institutionNameInput.trim() || "Onnesha Assessment Arena",
        });
        await db.saveServerAiKey(cleanGeminiKey);
        setSettingsSavedMsg(
          "✓ Studio credentials, AI API key, Joint Partner Logo, and institutional branding saved to server.",
        );
      } else {
        setSettingsSavedMsg(
          "✓ Instructor profile and API preferences saved cleanly. Global Co-Branding is managed by Super Admin.",
        );
      }
      setTimeout(() => setSettingsSavedMsg(null), 3500);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="flex items-center gap-3 font-display text-base font-bold text-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Loading Instructor Studio...</span>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (
    !authLoading &&
    (!isAuthenticated || (user?.role !== "admin" && user?.role !== "instructor"))
  ) {
    return (
      <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
          <div className="w-full max-w-md bento-card p-6 sm:p-8 shadow-tactical text-center space-y-4 animate-in zoom-in-95">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto">
              <Lock className="h-8 w-8" />
            </div>
            <h1 className="font-display text-2xl font-black text-foreground">
              {isAuthenticated
                ? "Instructor Access Required"
                : "Instructor Studio Authentication Required"}
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isAuthenticated
                ? "This console is reserved for Faculty Instructors and Super Admins. Candidates should use the Student Exam Hub."
                : "Please sign in with your verified instructor credentials to manage Candidate Rosters, Course Quizzes, and Live Assessments."}
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              {isAuthenticated ? (
                <Link
                  to="/play"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition"
                >
                  <span>Go to Student Exam Hub (/play)</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  to="/auth/login"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition"
                >
                  <span>Proceed to Instructor Login</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col transition-colors">
      <Navbar />

      <div className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-8">
        {/* Top Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary mb-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>
                {showPartnerLogo && partnerName
                  ? `Onnesha × ${partnerName}`
                  : institutionNameInput || "Onnesha Assessment Arena"}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
              Instructor Studio &amp; Regional Command Center
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Welcome back,{" "}
              <strong className="text-foreground">{user?.name || "Instructor"}</strong> ·{" "}
              <span className="font-mono text-primary font-bold">
                {isSuperAdmin ? "Super Admin" : `${assignedCourses.length} Assigned Course(s)`}
              </span>{" "}
              ·{" "}
              <span className="font-mono text-foreground font-bold">
                {roster.length} Candidates
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isSuperAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Super Admin Panel</span>
              </Link>
            )}

            {isSuperAdmin && (
              <button
                onClick={() => {
                  setActiveTab("roster");
                  setShowAddRegion(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3.5 py-2.5 text-xs font-bold text-foreground hover:bg-accent transition"
              >
                <MapPin className="h-4 w-4 text-primary" />
                <span>+ Add Region</span>
              </button>
            )}

            <button
              onClick={() => setShowAiModal(true)}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
            >
              <Wand2 className="h-4 w-4" />
              <span>AI Exam Generator</span>
            </button>

            <Link
              to="/host/$quizId"
              params={{ quizId: primaryHostQuizSlug }}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Launch Live Arena</span>
            </Link>
          </div>
        </div>

        {smsSuccessMsg && (
          <div className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-700 dark:text-emerald-300 animate-in fade-in">
            {smsSuccessMsg}
          </div>
        )}

        {/* Dashboard Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-border/60 overflow-x-auto pb-2 no-scrollbar mb-8">
          {[
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "roster", label: `Regions & Candidates (${roster.length})`, icon: MapPin },
            { id: "quizzes", label: "Model Tests & Packs", icon: BookOpen },
            { id: "ai_creator", label: "Manual Question Studio", icon: PenTool },
            { id: "results", label: "Regional Merit & Analysis", icon: Trophy },
            { id: "certificates", label: "Verifiable Certificates", icon: Award },
            { id: "sms_logs", label: "Guardian SMS Logs", icon: MessageSquare },
            { id: "billing", label: "Subscription & bKash", icon: Receipt },
            { id: "settings", label: "API & Settings", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-in fade-in">
            {/* Quick Metrics Bento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bento-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Active Command Regions
                  </span>
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-2 font-mono text-3xl font-black text-foreground">
                  {regions.length}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Divisional Ranges &amp; Exam Centers
                </div>
              </div>

              <div className="bento-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Enrolled Candidates
                  </span>
                  <Users className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-2 font-mono text-3xl font-black text-foreground">
                  {roster.length}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Phone/Roll Verified Seat Locks
                </div>
              </div>

              <div className="bento-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Active Quizzes
                  </span>
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-2 font-mono text-3xl font-black text-foreground">
                  {quizzes.length}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  BCS, Cadet &amp; Custom Packs
                </div>
              </div>

              <div className="bento-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    500+ Seat Engine
                  </span>
                  <Sparkles className="h-4 w-4 text-amber-500" />
                </div>
                <div className="mt-2 font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  DELTA READY
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Server-Authoritative Sync Active
                </div>
              </div>
            </div>

            {/* Active Live Exam Rooms Strip */}
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Radio
                    className={`h-4 w-4 ${
                      activeRooms.length > 0
                        ? "text-emerald-500 animate-pulse"
                        : "text-muted-foreground"
                    }`}
                  />
                  <h2 className="font-display text-sm font-black text-foreground">
                    Live Examination Rooms ({activeRooms.length} Active)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={refreshActiveRooms}
                  disabled={loadingRooms}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-accent transition"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingRooms ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>
              {activeRooms.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No live examination rooms are running right now. Launch a quiz from{" "}
                  <strong>Model Tests &amp; Packs</strong> or click{" "}
                  <strong>Launch Live Arena</strong> above.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeRooms.map((room) => (
                    <div
                      key={room.pin}
                      className="flex flex-col justify-between gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                            PIN {room.pin}
                          </span>
                          <span className="rounded-full bg-background px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-foreground border border-border">
                            {room.phase} · {room.participantCount} joined
                          </span>
                        </div>
                        <div className="mt-1 font-display text-xs font-bold text-foreground truncate">
                          {room.quizTitleEn || room.quizTitleBn}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          to="/host/$quizId"
                          params={{ quizId: room.quizId }}
                          search={{ pin: room.pin }}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 transition"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          <span>Resume Host</span>
                        </Link>
                        {(isSuperAdmin || room.hostId === user?.id) && (
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await gameEngine.closeRoomAsync(room.pin);
                              if (ok) {
                                setSmsSuccessMsg(`✓ Closed live room PIN ${room.pin}.`);
                                setTimeout(() => setSmsSuccessMsg(null), 3000);
                                refreshActiveRooms();
                              }
                            }}
                            className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-[11px] font-bold text-destructive hover:bg-destructive/20"
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bento-card p-6 shadow-sm space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Manage Regions &amp; Candidate Roster
                </h3>
                <p className="text-xs text-muted-foreground">
                  Add regional ranges, enroll candidates with mobile numbers, and bulk import 500+
                  students via CSV.
                </p>
                <button
                  onClick={() => setActiveTab("roster")}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <span>Open Regional Roster →</span>
                </button>
              </div>

              <div className="bento-card p-6 shadow-sm space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <Play className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Launch 500+ Seat Live Assessment
                </h3>
                <p className="text-xs text-muted-foreground">
                  Host a national or region-locked exam with anti-impersonation seat locks and live
                  proctor alerts.
                </p>
                <Link
                  to="/host/$quizId"
                  params={{ quizId: primaryHostQuizSlug }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
                >
                  <span>Open Host Controller →</span>
                </Link>
              </div>

              <div className="bento-card p-6 shadow-sm space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                  <Printer className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Physical OMR &amp; Merit Gazette
                </h3>
                <p className="text-xs text-muted-foreground">
                  Print standardized A4 OMR bubble sheets and region-wise official Merit Gazette
                  notice boards.
                </p>
                <button
                  onClick={() => setSelectedQuizForOmr(quizzes[0] || READY_MADE_PACKS[0] || null)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:underline"
                >
                  <span>Open OMR Bubble Studio →</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: REGIONS & CANDIDATE ROSTERS */}
        {activeTab === "roster" && (
          <div className="space-y-6 animate-in fade-in">
            {/* Regions Command Strip */}
            <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <span>Administrative Regions &amp; Examination Ranges ({regions.length})</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Click any Region below to filter candidates, or add a new Region for your
                    examination centers.
                  </p>
                </div>

                {isSuperAdmin ? (
                  <button
                    type="button"
                    onClick={() => setShowAddRegion(true)}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add New Region</span>
                  </button>
                ) : (
                  <span className="rounded-xl border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                    Regions managed by Super Admin
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRosterRegionId("all")}
                  className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all ${
                    selectedRosterRegionId === "all"
                      ? "border-2 border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-black uppercase text-primary">
                      ALL
                    </span>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
                      {roster.length}
                    </span>
                  </div>
                  <div className="mt-2 font-display text-sm font-bold text-foreground">
                    All Regions (National)
                  </div>
                  <div className="text-[11px] text-muted-foreground">Complete Candidate Roster</div>
                </button>

                {regions.map((reg) => {
                  const count = roster.filter((s) => s.regionId === reg.id).length;
                  const isSelected = selectedRosterRegionId === reg.id;
                  const isDefault = DEFAULT_REGIONS.some((d) => d.id === reg.id);
                  return (
                    <div
                      key={reg.id}
                      onClick={() => setSelectedRosterRegionId(reg.id)}
                      className={`group relative flex flex-col justify-between rounded-2xl border p-3.5 text-left cursor-pointer transition-all ${
                        isSelected
                          ? "border-2 border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-background hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-black uppercase text-primary">
                          {reg.code}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
                            {count}
                          </span>
                          {isSuperAdmin && !isDefault && (
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                handleDeleteRegion(reg.id);
                              }}
                              className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                              title="Delete custom region"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 font-display text-sm font-bold text-foreground truncate">
                        {reg.nameEn}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">{reg.nameBn}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Candidate Roster Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 max-w-md relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={rosterSearchQuery}
                  onChange={(e) => setRosterSearchQuery(e.target.value)}
                  placeholder="Search candidate by Name, Roll Number, or Mobile Number..."
                  className="w-full rounded-2xl border border-border bg-card pl-10 pr-4 py-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-accent transition"
                >
                  <Download className="h-4 w-4 text-primary" />
                  <span>Export CSV ({filteredRoster.length})</span>
                </button>

                <label className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-accent transition cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Bulk Import CSV (500+)</span>
                  <input type="file" accept=".csv" onChange={handleImportCsv} className="hidden" />
                </label>

                <button
                  onClick={() => {
                    if (selectedRosterRegionId !== "all") {
                      setNewStudentRegionId(selectedRosterRegionId);
                    }
                    setShowAddStudent(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Enroll Candidate</span>
                </button>
              </div>
            </div>

            {/* Roster Table */}
            <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-sm">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left font-display">
                    <th className="p-4 font-bold">Roll / Cadet ID</th>
                    <th className="p-4 font-bold">Candidate Name</th>
                    <th className="p-4 font-bold">Assigned Region</th>
                    <th className="p-4 font-bold">Verification Mobile (Login)</th>
                    <th className="p-4 font-bold">Guardian Mobile</th>
                    <th className="p-4 font-bold">Batch</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredRoster.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No candidates match this Region / search filter. Click &quot;Enroll
                        Candidate&quot; or &quot;Bulk Import CSV&quot; to add students.
                      </td>
                    </tr>
                  ) : (
                    filteredRoster.map((student) => (
                      <tr key={student.id} className="hover:bg-accent/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-primary">
                          {student.rollNumber}
                        </td>
                        <td className="p-4 font-bold text-foreground">{student.name}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                            <MapPin className="h-3 w-3" />
                            <span>{student.regionName || "Dhaka Range"}</span>
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {student.phone || student.guardianPhone || "01711000101"}
                        </td>
                        <td className="p-4 font-mono text-muted-foreground">
                          {student.guardianPhone || student.phone || "01711000001"}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {student.batch || "46th BCS & Cadet Batch"}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeleteStudent(student.id)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                            title="Remove candidate"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Add Region Modal */}
            {showAddRegion && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
                <div className="max-w-md w-full rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-foreground">
                      Add Examination Region / Range
                    </h3>
                    <button
                      onClick={() => setShowAddRegion(false)}
                      className="rounded-xl p-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form onSubmit={handleAddRegion} className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1">
                          Short Code *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={newRegionCode}
                          onChange={(e) => setNewRegionCode(e.target.value.toUpperCase())}
                          placeholder="e.g. COM"
                          className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 font-mono text-xs font-bold text-foreground outline-none focus:border-primary"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-muted-foreground mb-1">
                          Region Name (English) *
                        </label>
                        <input
                          type="text"
                          required
                          value={newRegionNameEn}
                          onChange={(e) => setNewRegionNameEn(e.target.value)}
                          placeholder="e.g. Cumilla Range"
                          className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">
                        Region Name (Bengali / বাংলায়)
                      </label>
                      <input
                        type="text"
                        value={newRegionNameBn}
                        onChange={(e) => setNewRegionNameBn(e.target.value)}
                        placeholder="যেমন: কুমিল্লা রেঞ্জ"
                        className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">
                        Regional Command / Exam Center Name
                      </label>
                      <input
                        type="text"
                        value={newRegionCenter}
                        onChange={(e) => setNewRegionCenter(e.target.value)}
                        placeholder="e.g. Cumilla Regional Academy Hall"
                        className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                    >
                      Save Region to Server
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Add Candidate Modal */}
            {showAddStudent && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
                <div className="max-w-md w-full rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-foreground">
                      Enroll Candidate to Regional Roster
                    </h3>
                    <button
                      onClick={() => setShowAddStudent(false)}
                      className="rounded-xl p-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form onSubmit={handleAddStudent} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">
                        Assign Region / Range *
                      </label>
                      <select
                        value={newStudentRegionId}
                        onChange={(e) => setNewStudentRegionId(e.target.value)}
                        className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold text-foreground outline-none focus:border-primary"
                      >
                        {regions.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nameEn} ({r.nameBn})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">
                        Candidate Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newStudentName}
                        onChange={(e) => setNewStudentName(e.target.value)}
                        placeholder="e.g. Cadet Badhon Hossain"
                        className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1">
                          Roll / Service ID *
                        </label>
                        <input
                          type="text"
                          required
                          value={newStudentRoll}
                          onChange={(e) => setNewStudentRoll(e.target.value)}
                          placeholder="e.g. 2026-112"
                          className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 font-mono text-xs font-semibold text-foreground outline-none focus:border-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1">
                          Candidate Mobile (Login) *
                        </label>
                        <input
                          type="tel"
                          required
                          value={newStudentPhone}
                          onChange={(e) => setNewStudentPhone(e.target.value)}
                          placeholder="01711000112"
                          className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 font-mono text-xs font-semibold text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1">
                          Guardian Phone (SMS)
                        </label>
                        <input
                          type="tel"
                          value={newGuardianPhone}
                          onChange={(e) => setNewGuardianPhone(e.target.value)}
                          placeholder="01711000012"
                          className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 font-mono text-xs font-semibold text-foreground outline-none focus:border-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1">
                          Batch / Cohort
                        </label>
                        <input
                          type="text"
                          value={newStudentBatch}
                          onChange={(e) => setNewStudentBatch(e.target.value)}
                          placeholder="46th BCS Batch"
                          className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      When joining an exam, this candidate can either type their Mobile/Roll Number
                      to auto-fill their name and region, or select{" "}
                      <strong>{regions.find((r) => r.id === newStudentRegionId)?.nameEn}</strong>{" "}
                      and verify with their number.
                    </p>

                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                    >
                      Save Candidate &amp; Sync to Server
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MODEL TESTS & REPOSITORIES */}
        {activeTab === "quizzes" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Course Modules, Sequential Quizzes &amp; Question Banks
                </h2>
                <p className="text-xs text-muted-foreground">
                  Organized by Course with sequential progression (Quiz 1 → Quiz 2 → Quiz 3...) and
                  multi-instructor assignments.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    editingOriginalMetaRef.current = null;
                    setEditingQuizId(null);
                    setEditingQuizSlug(null);
                    setNewQuizTitle("");
                    setNewQuestions([
                      {
                        id: `nq-${Date.now()}`,
                        textEn: "Sample Question #1",
                        textBn: "নমুনা প্রশ্ন #১",
                        type: "single_mcq",
                        timeLimitSec: 20,
                        points: 1000,
                        negativeMarks: 0.25,
                        options: [
                          { id: "o1", textEn: "Option A", textBn: "অপশন ক", isCorrect: true },
                          { id: "o2", textEn: "Option B", textBn: "অপশন খ" },
                          { id: "o3", textEn: "Option C", textBn: "অপশন গ" },
                          { id: "o4", textEn: "Option D", textBn: "অপশন ঘ" },
                        ],
                        correctOptionIds: ["o1"],
                      },
                    ]);
                    if (selectedCourseFilter !== "all") {
                      setNewQuizCourseId(selectedCourseFilter);
                      const courseQuizzes = quizzes.filter(
                        (q) => q.courseId === selectedCourseFilter,
                      );
                      setNewQuizNumber(courseQuizzes.length + 1);
                    }
                    setActiveTab("ai_creator");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition"
                >
                  <PenTool className="h-3.5 w-3.5" />
                  <span>+ Build Next Quiz</span>
                </button>

                <button
                  onClick={() => setShowAiModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create with AI</span>
                </button>
              </div>
            </div>

            {/* Course Filter Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCourseFilter("all")}
                  className={`rounded-2xl border px-3.5 py-2 text-xs font-bold transition ${
                    selectedCourseFilter === "all"
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isSuperAdmin ? "All Courses" : "My Courses & Quizzes"} ({scopedQuizzes.length})
                </button>
                {assignedCourses.map((c) => {
                  const count = scopedQuizzes.filter((q) => q.courseId === c.id).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCourseFilter(c.id)}
                      className={`rounded-2xl border px-3.5 py-2 text-xs font-bold transition ${
                        selectedCourseFilter === c.id
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="font-mono mr-1.5 opacity-80">{c.code}</span>
                      <span>{lang === "bn" ? c.titleBn : c.titleEn}</span>
                      <span className="ml-1.5 rounded-full bg-background/20 px-1.5 py-0.5 font-mono text-[10px]">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {!isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setShowAllModelPacks((v) => !v)}
                  className="rounded-xl border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground transition"
                >
                  {showAllModelPacks
                    ? "Show Assigned Only"
                    : `Include All Model Packs (${quizzes.length})`}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scopedQuizzes
                .filter(
                  (q) => selectedCourseFilter === "all" || q.courseId === selectedCourseFilter,
                )
                .sort((a, b) => (a.quizNumber || 99) - (b.quizNumber || 99))
                .map((quiz) => {
                  const canDeleteQuiz =
                    !quiz.isTemplate &&
                    (isSuperAdmin || !quiz.instructorId || quiz.instructorId === user?.id);
                  return (
                    <div
                      key={quiz.id}
                      className="bento-card p-5 shadow-sm space-y-3 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-2xl">{quiz.icon}</span>
                            {quiz.quizNumber && (
                              <span className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-primary">
                                Quiz #{quiz.quizNumber}
                              </span>
                            )}
                            {isQuizPrivate(quiz, courses) && (
                              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                <Lock className="h-2.5 w-2.5" />
                                <span>Live Exam Only</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-[10px] font-bold text-foreground">
                              {quiz.questions.length} Items
                            </span>
                            {canDeleteQuiz && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await db.deleteCustomQuiz(quiz.id);
                                  setQuizzes(db.getQuizzes());
                                  setSmsSuccessMsg(
                                    res.success
                                      ? `✓ Deleted "${quiz.titleEn}" from server database.`
                                      : `⚠ Could not delete "${quiz.titleEn}": ${res.error || "Permission denied"}`,
                                  );
                                  setTimeout(() => setSmsSuccessMsg(null), 4000);
                                }}
                                className="rounded-lg p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                                title="Delete quiz"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {quiz.courseTitle && (
                          <div className="mt-2 text-[11px] font-bold text-primary truncate">
                            {quiz.courseTitle}
                          </div>
                        )}

                        <h3 className="mt-1 font-display text-base font-bold text-foreground leading-snug">
                          {lang === "bn" ? quiz.titleBn : quiz.titleEn}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {lang === "bn" ? quiz.descriptionBn : quiz.descriptionEn}
                        </p>

                        {quiz.instructorName && (
                          <div className="mt-2 text-[11px] text-muted-foreground">
                            Faculty:{" "}
                            <strong className="text-foreground">{quiz.instructorName}</strong>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-border/80 flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLoadQuizIntoEditor(quiz, !canDeleteQuiz)}
                            className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-accent transition"
                            title={
                              canDeleteQuiz
                                ? "Edit Questions"
                                : "Clone into Instructor Studio to customize"
                            }
                          >
                            {canDeleteQuiz ? "Edit" : "Clone & Edit"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedQuizForOmr(quiz)}
                            className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-accent transition"
                          >
                            OMR
                          </button>
                          {!isQuizPrivate(quiz, courses) && (
                            <Link
                              to="/play"
                              search={{ practice: quiz.slug || quiz.id, pin: undefined }}
                              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition"
                            >
                              Practice
                            </Link>
                          )}
                        </div>

                        <Link
                          to="/host/$quizId"
                          params={{ quizId: quiz.slug || quiz.id }}
                          className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                        >
                          Host Arena
                        </Link>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB 4: MANUAL QUESTION STUDIO */}
        {activeTab === "ai_creator" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  {editingQuizId
                    ? `Editing Quiz: ${newQuizTitle}`
                    : "Manual Question Studio & Multi-Style Paper Builder"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Assign quizzes to a Course in sequential order (Quiz 1, Quiz 2...) and mix Single
                  MCQ, True/False, Multiple Select, and Written Short Answer questions.
                </p>
              </div>
              {editingQuizId && (
                <button
                  type="button"
                  onClick={() => {
                    editingOriginalMetaRef.current = null;
                    setEditingQuizId(null);
                    setEditingQuizSlug(null);
                    setNewQuizTitle("");
                  }}
                  className="rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  Cancel Edit (Create New)
                </button>
              )}
            </div>

            <form onSubmit={handleSaveQuiz} className="bento-card p-6 shadow-sm space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    Assign to Course *
                  </label>
                  <select
                    value={newQuizCourseId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setNewQuizCourseId(cid);
                      const count = quizzes.filter((q) => q.courseId === cid).length;
                      setNewQuizNumber(count + 1);
                      const matched = courses.find((c) => c.id === cid);
                      if (matched) setNewQuizCategory(matched.categoryEn || "BCS / Job");
                    }}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs sm:text-sm font-bold text-foreground outline-none focus:border-primary"
                  >
                    {(() => {
                      const opts = [...assignedCourses];
                      if (newQuizCourseId && !opts.some((c) => c.id === newQuizCourseId)) {
                        const currentCourse = courses.find((c) => c.id === newQuizCourseId);
                        if (currentCourse) opts.unshift(currentCourse);
                      }
                      return opts.map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.code}] {c.titleEn} ({c.instructorNames.join(", ")})
                        </option>
                      ));
                    })()}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    Sequential Quiz Number *
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="rounded-xl bg-primary/10 px-3 py-2.5 font-mono text-xs font-black text-primary">
                      Quiz #
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      required
                      value={newQuizNumber}
                      onChange={(e) => setNewQuizNumber(Number(e.target.value) || 1)}
                      className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 font-mono text-xs sm:text-sm font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    Curriculum Category
                  </label>
                  <input
                    type="text"
                    value={newQuizCategory}
                    onChange={(e) => setNewQuizCategory(e.target.value)}
                    placeholder="e.g. BCS Preliminary / Bank Job"
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  Quiz / Assessment Title (English or Bengali) *
                </label>
                <input
                  type="text"
                  required
                  value={newQuizTitle}
                  onChange={(e) => setNewQuizTitle(e.target.value)}
                  placeholder={`e.g. Quiz ${newQuizNumber}: Bangladesh Affairs & Constitutional Law`}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-2">
                  <h4 className="font-display text-sm font-bold text-foreground">
                    Questions ({newQuestions.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const nextNum = newQuestions.length + 1;
                      setNewQuestions([
                        ...newQuestions,
                        {
                          id: `nq-${Date.now()}-${nextNum}`,
                          textEn: `Question #${nextNum}`,
                          textBn: `প্রশ্ন #${nextNum}`,
                          type: "single_mcq",
                          timeLimitSec: 20,
                          points: 1000,
                          negativeMarks: 0.25,
                          options: [
                            {
                              id: `o-${nextNum}-1`,
                              textEn: "Option A",
                              textBn: "অপশন ক",
                              isCorrect: true,
                            },
                            { id: `o-${nextNum}-2`, textEn: "Option B", textBn: "অপশন খ" },
                            { id: `o-${nextNum}-3`, textEn: "Option C", textBn: "অপশন গ" },
                            { id: `o-${nextNum}-4`, textEn: "Option D", textBn: "অপশন ঘ" },
                          ],
                          correctOptionIds: [`o-${nextNum}-1`],
                          acceptedAnswers: [],
                        },
                      ]);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Question Item</span>
                  </button>
                </div>

                {newQuestions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="rounded-2xl border border-border/80 bg-background/80 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          Item #{qIdx + 1}
                        </span>

                        {/* Question Style Selector */}
                        <select
                          value={q.type}
                          onChange={(e) => {
                            const nextType = e.target.value as QuestionType;
                            const updated = [...newQuestions];
                            const target = updated[qIdx];
                            if (!target) return;
                            target.type = nextType;
                            if (nextType === "true_false") {
                              target.options = [
                                {
                                  id: `${q.id}-tf-1`,
                                  textEn: "True",
                                  textBn: "সত্য (True)",
                                  isCorrect: true,
                                },
                                { id: `${q.id}-tf-2`, textEn: "False", textBn: "মিথ্যা (False)" },
                              ];
                              target.correctOptionIds = [`${q.id}-tf-1`];
                            } else if (nextType === "written" || nextType === "fill_blank") {
                              target.options = [];
                              target.correctOptionIds = [];
                              if (!target.acceptedAnswers?.length) {
                                target.acceptedAnswers = ["1971", "১৯৭১"];
                              }
                            } else if (target.options.length < 4) {
                              target.options = [
                                {
                                  id: `${q.id}-1`,
                                  textEn: "Option A",
                                  textBn: "অপশন ক",
                                  isCorrect: true,
                                },
                                { id: `${q.id}-2`, textEn: "Option B", textBn: "অপশন খ" },
                                { id: `${q.id}-3`, textEn: "Option C", textBn: "অপশন গ" },
                                { id: `${q.id}-4`, textEn: "Option D", textBn: "অপশন ঘ" },
                              ];
                              target.correctOptionIds = [`${q.id}-1`];
                            }
                            setNewQuestions(updated);
                          }}
                          className="rounded-xl border border-border bg-card px-2.5 py-1 text-xs font-bold text-foreground outline-none focus:border-primary"
                        >
                          <option value="single_mcq">Single Best MCQ (4 Options)</option>
                          <option value="true_false">True / False (সত্য / মিথ্যা)</option>
                          <option value="multi_mcq">Multiple Correct MCQ (Checkboxes)</option>
                          <option value="written">Written / Short Answer (Auto-Graded)</option>
                        </select>

                        {/* Time Limit */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>Time:</span>
                          <input
                            type="number"
                            min={5}
                            max={180}
                            value={q.timeLimitSec}
                            onChange={(e) => {
                              const updated = [...newQuestions];
                              const target = updated[qIdx];
                              if (!target) return;
                              target.timeLimitSec = Number(e.target.value) || 20;
                              setNewQuestions(updated);
                            }}
                            className="w-14 rounded-lg border border-border bg-card px-2 py-0.5 font-mono text-xs font-bold text-foreground"
                          />
                          <span>s</span>
                        </div>

                        {/* Question Points Weight */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>Pts:</span>
                          <input
                            type="number"
                            min={1}
                            max={5000}
                            step={100}
                            value={q.points || 1000}
                            onChange={(e) => {
                              const updated = [...newQuestions];
                              const target = updated[qIdx];
                              if (!target) return;
                              target.points = Math.max(1, Number(e.target.value) || 1000);
                              setNewQuestions(updated);
                            }}
                            className="w-16 rounded-lg border border-border bg-card px-2 py-0.5 font-mono text-xs font-bold text-foreground"
                          />
                        </div>

                        {/* Question Negative Marks Ratio */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>Neg:</span>
                          <select
                            value={q.negativeMarks ?? 0.25}
                            onChange={(e) => {
                              const updated = [...newQuestions];
                              const target = updated[qIdx];
                              if (!target) return;
                              target.negativeMarks = Number(e.target.value);
                              setNewQuestions(updated);
                            }}
                            className="rounded-lg border border-border bg-card px-1.5 py-0.5 font-mono text-xs font-bold text-foreground"
                          >
                            <option value={0}>0</option>
                            <option value={0.25}>-0.25</option>
                            <option value={0.5}>-0.50</option>
                            <option value={1}>-1.00</option>
                          </select>
                        </div>
                      </div>

                      {newQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewQuestions(newQuestions.filter((_, i) => i !== qIdx))}
                          className="text-xs font-bold text-destructive hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={q.textBn}
                      onChange={(e) => {
                        const updated = [...newQuestions];
                        const target = updated[qIdx];
                        if (!target) return;
                        const prevBn = target.textBn;
                        target.textBn = e.target.value;
                        if (!target.textEn || target.textEn === prevBn) {
                          target.textEn = e.target.value;
                        }
                        setNewQuestions(updated);
                      }}
                      placeholder="প্রশ্ন বাংলায় বা ইংরেজিতে লিখুন..."
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
                    />

                    {q.type === "written" || q.type === "fill_blank" ? (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
                        <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          Accepted Correct Written Answers (comma-separated, case-insensitive) *
                        </label>
                        <input
                          type="text"
                          value={(q.acceptedAnswers || []).join(", ")}
                          onChange={(e) => {
                            const updated = [...newQuestions];
                            const target = updated[qIdx];
                            if (!target) return;
                            target.acceptedAnswers = e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean);
                            setNewQuestions(updated);
                          }}
                          placeholder="e.g. 1971, ১৯৭১, 26 March"
                          className="w-full rounded-xl border border-border bg-card px-3 py-2 font-mono text-xs font-bold text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, optIdx) => {
                          const isChecked = q.correctOptionIds.includes(opt.id);
                          const isMulti = q.type === "multi_mcq";
                          return (
                            <div key={opt.id} className="flex items-center gap-2">
                              <input
                                type={isMulti ? "checkbox" : "radio"}
                                name={`correct-${q.id}`}
                                checked={isChecked}
                                onChange={() => {
                                  const updated = [...newQuestions];
                                  const target = updated[qIdx];
                                  if (!target) return;
                                  if (isMulti) {
                                    const prev = target.correctOptionIds;
                                    target.correctOptionIds = prev.includes(opt.id)
                                      ? prev.filter((id) => id !== opt.id)
                                      : [...prev, opt.id];
                                  } else {
                                    target.correctOptionIds = [opt.id];
                                  }
                                  setNewQuestions(updated);
                                }}
                                className="accent-primary h-4 w-4"
                              />
                              <input
                                type="text"
                                value={opt.textBn}
                                onChange={(e) => {
                                  const updated = [...newQuestions];
                                  const target = updated[qIdx];
                                  const optTarget = target?.options[optIdx];
                                  if (!optTarget) return;
                                  const prevBn = optTarget.textBn;
                                  optTarget.textBn = e.target.value;
                                  if (!optTarget.textEn || optTarget.textEn === prevBn) {
                                    optTarget.textEn = e.target.value;
                                  }
                                  setNewQuestions(updated);
                                }}
                                className="flex-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Answer Rationale / Explanation */}
                    <div>
                      <input
                        type="text"
                        value={q.explanationBn || ""}
                        onChange={(e) => {
                          const updated = [...newQuestions];
                          const target = updated[qIdx];
                          if (!target) return;
                          const prevBn = target.explanationBn || "";
                          target.explanationBn = e.target.value;
                          if (!target.explanationEn || target.explanationEn === prevBn) {
                            target.explanationEn = e.target.value;
                          }
                          setNewQuestions(updated);
                        }}
                        placeholder="ঐচ্ছিক: সঠিক উত্তরের ব্যাখ্যা / Rationale (সমাধান শীটে প্রদর্শিত হবে)..."
                        className="w-full rounded-xl border border-border/70 bg-background px-3 py-1.5 text-[11px] text-muted-foreground outline-none focus:border-primary focus:text-foreground"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-primary py-3.5 text-xs sm:text-sm font-extrabold text-primary-foreground shadow-md hover:bg-primary/90 transition"
              >
                Save Sequential Quiz &amp; Sync to Server Database
              </button>
            </form>
          </div>
        )}

        {/* TAB 5: REGIONAL MERIT GAZETTE & RESULTS */}
        {activeTab === "results" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Regional Examination Merit Gazette &amp; Telemetry
                </h2>
                <p className="text-xs text-muted-foreground">
                  Filter candidate scores by Exam Session and Region, print official notice boards,
                  or dispatch Guardian SMS.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Session Filter */}
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
                >
                  <option value="all">
                    All Completed Assessments ({examResults.length} records)
                  </option>
                  {examSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      PIN {s.pin} — {s.quizTitleBn || s.quizTitleEn} ({s.participantCount}{" "}
                      examinees)
                    </option>
                  ))}
                </select>

                {/* Region Filter */}
                <select
                  value={selectedResultsRegionId}
                  onChange={(e) => setSelectedResultsRegionId(e.target.value)}
                  className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
                >
                  <option value="all">All Regions</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nameEn} ({r.nameBn})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowGazette(true)}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground shadow-sm hover:bg-accent transition"
                >
                  <Printer className="h-3.5 w-3.5 text-primary" />
                  <span>Print Gazette</span>
                </button>

                <button
                  onClick={handleSendGuardianSms}
                  disabled={isSendingSms}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition disabled:opacity-50"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{isSendingSms ? "Dispatching..." : "Send Guardian SMS"}</span>
                </button>
              </div>
            </div>

            {/* Supplementary / Affected Center Retake Diagnostics & Launcher */}
            {selectedExamSession && selectedSessionRetakeDiag ? (
              <div className="rounded-3xl border border-amber-300 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/20 p-5 shadow-sm space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                        <RotateCcw className="h-3.5 w-3.5" />
                        {lang === "bn"
                          ? "ক্ষতিগ্রস্ত কেন্দ্র / মিসড পরীক্ষার্থী পুনঃপরীক্ষা"
                          : "Affected Center & Missed Examinee Retake"}
                      </span>
                      <span className="rounded-full bg-slate-900 dark:bg-slate-800 px-2.5 py-0.5 font-mono text-xs font-semibold text-white">
                        ORIGIN PIN: {selectedExamSession.pin}
                      </span>
                      {(selectedExamSession.makeupRunsCount || 0) > 0 && (
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          +{selectedExamSession.makeupRunsCount} Makeup Merged
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-base font-bold text-foreground">
                      {selectedExamSession.quizTitleBn ||
                        selectedExamSession.quizTitleEn ||
                        "Exam Session"}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {lang === "bn"
                        ? "যারা ইতিমধ্যে অন্তত ১টি প্রশ্নের উত্তর দিয়েছেন তাদের নম্বর ও সার্টিফিকেট অক্ষুণ্ণ রেখে শুধুমাত্র শূন্য-উত্তর (প্রশ্ন পাননি) বা অনুপস্থিত পরীক্ষার্থীদের জন্য পুনরায় রুম চালু করুন।"
                        : "Re-conduct this exam only for affected centers, zero-attempt joins, or missing roster students—completed examinees keep their original marks & sealed certificates and won't be asked to retake."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-300">
                      Completed (&ge;{retakeMinAnswers} ans):{" "}
                      {selectedSessionRetakeDiag.completedCount}
                    </span>
                    <span className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-rose-700 dark:text-rose-300">
                      0-Attempt Stuck: {selectedSessionRetakeDiag.zeroAttemptCount}
                    </span>
                    {(retakeMinAnswers > 1 ||
                      selectedSessionRetakeDiag.partialBelowThresholdCount > 0) && (
                      <span className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-800 dark:text-amber-300">
                        Partial (&lt;{retakeMinAnswers} ans):{" "}
                        {selectedSessionRetakeDiag.partialBelowThresholdCount}
                      </span>
                    )}
                    <span className="rounded-xl border border-border bg-card px-3 py-1.5 text-foreground">
                      Roster Missing: {selectedSessionRetakeDiag.missingRosterCount}
                    </span>
                    <span className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-primary">
                      Eligible Retake: {selectedSessionRetakeDiag.totalEligibleRetakeCount}
                    </span>
                  </div>
                </div>

                {selectedSessionRetakeDiag.regionBreakdown.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Select Target Center / Region (
                      {selectedResultsRegionId === "all"
                        ? "All Affected"
                        : regions.find((r) => r.id === selectedResultsRegionId)?.nameEn ||
                          selectedResultsRegionId}
                      )
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedResultsRegionId("all")}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          selectedResultsRegionId === "all"
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-card text-foreground hover:border-primary/40"
                        }`}
                      >
                        All Regions ({selectedSessionRetakeDiag.totalEligibleRetakeCount} eligible)
                      </button>
                      {selectedSessionRetakeDiag.regionBreakdown.map((reg) => {
                        const isSelected = selectedResultsRegionId === reg.regionId;
                        const hasIssues =
                          reg.zeroAttemptCount > 0 || reg.partialBelowThresholdCount > 0;
                        return (
                          <button
                            key={reg.regionId}
                            type="button"
                            onClick={() => setSelectedResultsRegionId(reg.regionId)}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition ${
                              isSelected
                                ? "border-amber-600 bg-amber-600 text-white shadow-sm"
                                : hasIssues
                                  ? "border-rose-400/60 bg-rose-500/10 text-foreground hover:border-rose-500"
                                  : "border-border bg-card text-foreground hover:border-primary/40"
                            }`}
                          >
                            <span className="font-bold">
                              {lang === "bn" ? reg.regionNameBn : reg.regionNameEn}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                isSelected
                                  ? "bg-white/20 text-white"
                                  : hasIssues
                                    ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              0-att: {reg.zeroAttemptCount}
                              {reg.partialBelowThresholdCount > 0
                                ? ` · <${retakeMinAnswers}: ${reg.partialBelowThresholdCount}`
                                : ""}{" "}
                              · miss: {reg.missingRosterCount} · done: {reg.completedCount}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-amber-300/60 dark:border-amber-500/30 pt-3.5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={retakeSkipCompleted}
                        onChange={(e) => setRetakeSkipCompleted(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-amber-600 focus:ring-amber-500"
                      />
                      <span>
                        Skip examinees who already completed (&ge;{retakeMinAnswers} submitted{" "}
                        {retakeMinAnswers === 1 ? "answer" : "answers"}) &amp; merge retake scores
                        into original merit list
                      </span>
                    </label>

                    {retakeSkipCompleted && (
                      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-400/50 bg-background/80 px-2.5 py-1 text-xs">
                        <span className="text-[11px] font-bold text-muted-foreground">
                          Min Submitted:
                        </span>
                        {[1, 2, 3, 5].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setRetakeMinAnswers(preset);
                              setRetakeMinAnswersDraft(String(preset));
                            }}
                            className={`rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold transition ${
                              retakeMinAnswers === preset
                                ? "bg-amber-600 text-white shadow-xs"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            &ge;{preset}
                          </button>
                        ))}
                        <input
                          type="number"
                          min={1}
                          max={500}
                          aria-label="Custom minimum completed answers"
                          value={retakeMinAnswersDraft}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setRetakeMinAnswersDraft(raw);
                            const val = parseInt(raw, 10);
                            if (Number.isFinite(val) && val >= 1) {
                              setRetakeMinAnswers(Math.max(1, Math.min(500, val)));
                            }
                          }}
                          onBlur={() => {
                            const val = parseInt(retakeMinAnswersDraft, 10);
                            const clamped = Number.isFinite(val)
                              ? Math.max(1, Math.min(500, val))
                              : 1;
                            setRetakeMinAnswers(clamped);
                            setRetakeMinAnswersDraft(String(clamped));
                          }}
                          className="w-12 rounded-lg border border-border bg-card px-1.5 py-0.5 text-center font-mono text-[11px] font-bold text-foreground outline-none focus:border-amber-500"
                          title="Custom minimum submitted answers threshold"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate({
                        to: "/host/$quizId",
                        params: { quizId: selectedExamSession.quizId },
                        search: {
                          retakeSessionId: selectedExamSession.id,
                          regionId: selectedResultsRegionId,
                          skipCompleted: retakeSkipCompleted ? "1" : "0",
                          minAnswers: String(retakeMinAnswers),
                        },
                      })
                    }
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {selectedResultsRegionId === "all"
                      ? "Launch Retake Room (All Regions)"
                      : `Launch Center Retake (${regions.find((r) => r.id === selectedResultsRegionId)?.nameEn || selectedResultsRegionId})`}
                  </button>
                </div>
              </div>
            ) : (
              selectedSessionId === "all" &&
              examSessions.length > 0 && (
                <div className="flex flex-col gap-3 rounded-3xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      Need to re-conduct an exam for an affected center or missed examinees?
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Pick an exam session to inspect 0-attempt joins by region and launch a retake
                      room without re-asking completed students:
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {examSessions.slice(0, 4).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSessionId(s.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:border-primary hover:bg-primary/10"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-primary" />
                        <span>
                          PIN {s.pin} · {s.quizTitleEn || s.quizTitleBn || "Exam"} (
                          {s.participantCount})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* Region-Wise Comparative Summary Strip */}
            {regionPerformanceSummary.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {regionPerformanceSummary.map((rs) => (
                  <div
                    key={rs.id}
                    onClick={() =>
                      setSelectedResultsRegionId(selectedResultsRegionId === rs.id ? "all" : rs.id)
                    }
                    className={`rounded-2xl border p-4 cursor-pointer transition ${
                      selectedResultsRegionId === rs.id
                        ? "border-2 border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">{rs.nameEn}</span>
                      <span className="font-mono text-[11px] font-bold text-primary">
                        {rs.count} examinees
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between font-mono text-xs text-muted-foreground">
                      <span>Avg: {rs.avgScore}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        Top: {rs.topScore}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Results Table */}
            {activeResults.length > 0 ? (
              <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-sm">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left font-display">
                      <th className="p-4 font-bold text-center">Rank</th>
                      <th className="p-4 font-bold">Roll / ID</th>
                      <th className="p-4 font-bold">Candidate</th>
                      <th className="p-4 font-bold">Region</th>
                      <th className="p-4 font-bold text-center">Correct</th>
                      <th className="p-4 font-bold text-center">Wrong</th>
                      <th className="p-4 font-bold text-center">Accuracy</th>
                      <th className="p-4 font-bold text-center">Final Score</th>
                      <th className="p-4 font-bold text-center">Status</th>
                      <th className="p-4 text-right">Certificate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {activeResults.map((r, idx) => {
                      const certNo = formatDeterministicCertNumber(
                        r.pin,
                        r.rollNumber,
                        r.rank || idx + 1,
                      );
                      const activeSess = examSessions.find(
                        (s) => s.id === r.sessionId || s.pin === r.pin,
                      );
                      const sessQuiz = activeSess
                        ? quizzes.find(
                            (q) => q.id === activeSess.quizId || q.slug === activeSess.quizId,
                          )
                        : undefined;
                      const sessCourse = sessQuiz?.courseId
                        ? db.getCourses().find((c) => c.id === sessQuiz.courseId)
                        : undefined;
                      const threshold = resolvePassThresholdPct({
                        sessionThreshold: activeSess?.passThresholdPct,
                        courseThreshold: sessCourse?.passThresholdPct,
                        brandingDefaultThreshold: db.getBranding().defaultPassThresholdPct,
                      });
                      const didPass =
                        typeof r.passed === "boolean"
                          ? r.passed
                          : isPassingScore(r.accuracyPct, threshold);
                      return (
                        <tr key={r.id} className="hover:bg-accent/40 transition-colors">
                          <td className="p-4 text-center font-mono font-bold text-primary">
                            #{idx + 1}
                          </td>
                          <td className="p-4 font-mono font-semibold text-foreground">
                            {r.rollNumber}
                          </td>
                          <td className="p-4 font-bold text-foreground">{r.name}</td>
                          <td className="p-4">
                            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                              {r.regionName || "Dhaka Range"}
                            </span>
                          </td>
                          <td className="p-4 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                            {r.correctCount}
                          </td>
                          <td className="p-4 text-center text-destructive font-bold">
                            {r.incorrectCount}
                          </td>
                          <td className="p-4 text-center font-mono font-semibold text-muted-foreground">
                            {r.accuracyPct}%
                          </td>
                          <td className="p-4 text-center font-mono font-black text-foreground">
                            {r.score.toLocaleString()}
                          </td>
                          <td className="p-4 text-center">
                            {didPass ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                                PASSED (&ge;{threshold}%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-destructive/10 border border-destructive/30 px-2.5 py-0.5 text-[10px] font-extrabold text-destructive">
                                FAILED (&lt;{threshold}%)
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {didPass ? (
                              <Link
                                to="/verify/$certId"
                                params={{ certId: certNo }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                              >
                                <span>View Seal</span>
                                <ChevronRight className="h-3 w-3" />
                              </Link>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                <Lock className="h-3 w-3" />
                                <span>Below {threshold}%</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-sm space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto">
                  <Trophy className="h-8 w-8" />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  No Live Assessment Records Yet
                </h3>
                <p className="max-w-md mx-auto text-xs text-muted-foreground leading-relaxed">
                  Real candidate telemetry, regional rankings, and verifiable certificates populate
                  here automatically when examinees complete a live session.
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={() => setActiveTab("quizzes")}
                    className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Host Live Assessment Room</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: VERIFIABLE CERTIFICATES */}
        {activeTab === "certificates" && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="font-display text-xl font-bold text-foreground">
              Cryptographic QR Verifiable Certificates
            </h2>
            <p className="text-xs text-muted-foreground">
              Official digital credentials issued to examinees with public verification URLs.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {certificates.length > 0 ? (
                certificates.map((cert) => (
                  <div key={cert.id} className="bento-card p-6 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-primary">
                        #{cert.certificateNumber}
                      </span>
                      <span className="rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-[10px] font-bold">
                        VERIFIED
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-foreground">
                      {cert.studentName} (Rank #{cert.rank})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {cert.quizTitle} {cert.regionName ? `· ${cert.regionName}` : ""}
                    </p>
                    <div className="pt-2">
                      <Link
                        to="/verify/$certId"
                        params={{ certId: cert.certificateNumber }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                      >
                        <span>Open Public Verification Page →</span>
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full rounded-3xl border border-border bg-card p-12 text-center shadow-sm space-y-3">
                  <Award className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h3 className="font-display text-base font-bold text-foreground">
                    No Official Certificates Issued Yet
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Certificates are automatically minted whenever examinees conclude a live model
                    test.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: GUARDIAN SMS LOGS */}
        {activeTab === "sms_logs" && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="font-display text-xl font-bold text-foreground">
              Guardian SMS Dispatch Logs
            </h2>
            <p className="text-xs text-muted-foreground">
              Full audit trail of automated scorecard SMS messages transmitted via SMS gateway.
            </p>

            <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-sm">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left font-display">
                    <th className="p-4 font-bold">Time</th>
                    <th className="p-4 font-bold">Recipient Phone</th>
                    <th className="p-4 font-bold">Candidate / Roll</th>
                    <th className="p-4 font-bold">Message Content</th>
                    <th className="p-4 font-bold text-center">Delivery Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {smsLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        No SMS dispatched yet. Click &quot;Send Guardian SMS&quot; in the Results
                        tab.
                      </td>
                    </tr>
                  ) : (
                    smsLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-accent/40 transition-colors">
                        <td className="p-4 font-mono text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="p-4 font-mono font-bold text-foreground">
                          {log.recipientPhone}
                        </td>
                        <td className="p-4 font-semibold text-foreground">
                          {log.studentName} ({log.rollNumber})
                        </td>
                        <td className="p-4 text-muted-foreground max-w-xs truncate">
                          {log.messageText}
                        </td>
                        <td className="p-4 text-center">
                          <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold px-2.5 py-0.5 text-[10px]">
                            {log.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 8: BILLING & BKASH */}
        {activeTab === "billing" && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="font-display text-xl font-bold text-foreground">
              Institutional Subscription &amp; bKash Invoices
            </h2>
            <p className="text-xs text-muted-foreground">
              Manage your concurrent candidate capacity and view transaction receipts.
            </p>

            <div className="bento-card p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-primary font-mono uppercase">
                  CURRENT PLAN
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">
                  Institution Max &amp; Render Dedicated (500+ Concurrent Seats)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Render Persistent Disk &amp; Delta Engine Enabled · Active subscription
                </p>
              </div>

              <Link
                to="/pricing"
                className="rounded-2xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Change Plan
              </Link>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-sm">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left font-display">
                    <th className="p-4 font-bold">Date</th>
                    <th className="p-4 font-bold">Transaction ID</th>
                    <th className="p-4 font-bold">Plan</th>
                    <th className="p-4 font-bold">Method / Account</th>
                    <th className="p-4 font-bold text-right">Amount</th>
                    <th className="p-4 font-bold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        {isSuperAdmin
                          ? "No bKash or card invoice receipts recorded yet."
                          : "Institutional invoice receipts are synchronized for Super Admin accounts. Contact your institutional administrator for billing statements."}
                      </td>
                    </tr>
                  ) : (
                    transactions.map((trx) => (
                      <tr key={trx.id} className="hover:bg-accent/40 transition-colors">
                        <td className="p-4 font-mono text-muted-foreground">
                          {new Date(trx.date).toLocaleString()}
                        </td>
                        <td className="p-4 font-mono font-bold text-foreground">
                          {trx.trxId || trx.id}
                        </td>
                        <td className="p-4 font-semibold uppercase text-foreground">
                          {trx.planId}
                        </td>
                        <td className="p-4 font-mono text-muted-foreground">
                          {trx.method?.toUpperCase()} {trx.msisdn ? `· ${trx.msisdn}` : ""}
                        </td>
                        <td className="p-4 font-mono font-bold text-right text-foreground">
                          ৳{Number(trx.amount || 0).toLocaleString()}
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              trx.status === "completed"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : trx.status === "failed"
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-amber-500/15 text-amber-600"
                            }`}
                          >
                            {trx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 9: SETTINGS & API CREDENTIALS */}
        {activeTab === "settings" && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">
                Studio Settings &amp; API Integrations
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure your cloud Gemini AI engine, Bangladesh SMS gateway tokens, and
                institutional branding.
              </p>
            </div>

            {settingsSavedMsg && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-700 dark:text-emerald-300 animate-in fade-in">
                {settingsSavedMsg}
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="bento-card p-6 shadow-sm space-y-6">
              <div className="space-y-4">
                <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <span>Cloud API Tokens</span>
                </h3>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    Google Gemini API Key (for Infinite AI Question Generation)
                  </label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 font-mono text-xs font-semibold text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    GreenWeb / BulkSMSBD API Token (for Automated Guardian SMS)
                  </label>
                  <input
                    type="password"
                    value={smsToken}
                    onChange={(e) => setSmsToken(e.target.value)}
                    placeholder="greenweb_token_..."
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 font-mono text-xs font-semibold text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              {isSuperAdmin && (
                <div className="space-y-4 pt-4 border-t border-border/80">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                        <Award className="h-4 w-4 text-primary" />
                        <span>Joint Partner Logo (Optional Co-Branding)</span>
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        When enabled, your Joint Partner logo appears alongside Onnesha in the Top
                        Header, Landing Page, Certificates, and Merit Gazette.
                      </p>
                    </div>

                    <label className="inline-flex items-center gap-2.5 cursor-pointer rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-bold text-foreground">
                      <input
                        type="checkbox"
                        checked={showPartnerLogo}
                        onChange={(e) => setShowPartnerLogo(e.target.checked)}
                        className="h-4 w-4 accent-emerald-600 rounded"
                      />
                      <span>Show Joint Partner Logo</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">
                        Joint Partner / Co-Sponsor Organization Name
                      </label>
                      <input
                        type="text"
                        value={partnerName}
                        onChange={(e) => setPartnerName(e.target.value)}
                        placeholder="e.g. Dhaka University / Partner Academy"
                        className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">
                        Partner Logo Image URL (or Upload File Below)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={partnerLogoUrl}
                          onChange={(e) => {
                            setPartnerLogoUrl(e.target.value);
                            if (e.target.value.trim()) setShowPartnerLogo(true);
                          }}
                          placeholder="https://example.org/logo.png or upload image"
                          className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 font-mono text-xs font-semibold text-foreground outline-none focus:border-primary"
                        />
                        <label className="shrink-0 cursor-pointer inline-flex items-center gap-1.5 rounded-2xl border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-xs font-bold text-primary hover:bg-primary/20 transition">
                          <Upload className="h-3.5 w-3.5" />
                          <span>Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePartnerLogoUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {partnerLogoUrl && (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-background/70 p-3.5">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono font-bold uppercase text-muted-foreground">
                          Live Co-Brand Preview:
                        </span>
                        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5">
                          <OnneshaLogo variant="compact" size="xs" />
                          <span className="text-muted-foreground font-mono text-xs">×</span>
                          <img
                            src={partnerLogoUrl}
                            alt={partnerName || "Partner Logo"}
                            className="h-7 max-w-[110px] object-contain"
                          />
                          {partnerName && (
                            <span className="text-xs font-semibold text-muted-foreground">
                              {partnerName}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setPartnerLogoUrl("");
                          setPartnerName("");
                          setShowPartnerLogo(false);
                        }}
                        className="text-xs font-bold text-destructive hover:underline"
                      >
                        Remove Partner Logo
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-border/80">
                <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>Institutional Authority &amp; Certificate Seals</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1">
                      Institution / Academy Title
                    </label>
                    <input
                      type="text"
                      value={institutionNameInput}
                      onChange={(e) => setInstitutionNameInput(e.target.value)}
                      placeholder="Onnesha Assessment Arena"
                      className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1">
                      Chief Examiner / Instructor Name
                    </label>
                    <input
                      type="text"
                      value={instructorNameInput}
                      onChange={(e) => setInstructorNameInput(e.target.value)}
                      placeholder="Chief Assessment Officer"
                      className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-xs font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
              >
                <Save className="h-4 w-4" />
                <span>Save Studio Credentials</span>
              </button>
            </form>

            {/* Password Change Form */}
            <form onSubmit={handleChangePassword} className="bento-card p-6 shadow-sm space-y-4">
              <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <span>Security &amp; Password Update</span>
              </h3>

              {passwordStatusMsg && (
                <div
                  className={`rounded-2xl p-3 text-xs font-semibold ${
                    passwordStatusMsg.startsWith("Error")
                      ? "border border-destructive/40 bg-destructive/10 text-destructive"
                      : "border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {passwordStatusMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 chars"
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Min. 6 chars"
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isChangingPassword}
                className="flex items-center justify-center gap-2 rounded-2xl bg-secondary px-5 py-2.5 text-xs font-bold text-secondary-foreground hover:bg-secondary/90 transition disabled:opacity-50"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>{isChangingPassword ? "Updating..." : "Update Password"}</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* AI Quiz Modal */}
      {showAiModal && (
        <AiQuizModal
          isOpen={showAiModal}
          defaultCourseId={selectedCourseFilter}
          onClose={() => setShowAiModal(false)}
          onQuizGenerated={(quiz) => {
            db.saveCustomQuiz(quiz);
            setQuizzes(db.getQuizzes());
            setAiCredits(getAiCredits());
            setShowAiModal(false);
            setActiveTab("quizzes");
            setSmsSuccessMsg(
              `✓ Generated "${quiz.titleEn}" (${quiz.courseTitle ? `${quiz.courseTitle} · Quiz #${quiz.quizNumber}` : "AI Module"}) and saved to server database.`,
            );
            setTimeout(() => setSmsSuccessMsg(null), 4000);
          }}
        />
      )}

      {/* Physical OMR Sheet Modal */}
      {selectedQuizForOmr && (
        <OmrSheetView quiz={selectedQuizForOmr} onClose={() => setSelectedQuizForOmr(null)} />
      )}

      {/* Official Merit Gazette Modal */}
      {showGazette &&
        (() => {
          const allCourses = db.getCourses();
          const brandingDefault = db.getBranding().defaultPassThresholdPct;
          const gazetteSess = examSessions.find(
            (s) => s.id === selectedSessionId || s.pin === selectedSessionId,
          );
          const gazetteQuiz = gazetteSess
            ? quizzes.find((q) => q.id === gazetteSess.quizId || q.slug === gazetteSess.quizId)
            : undefined;
          const gazetteCourse = gazetteQuiz?.courseId
            ? allCourses.find((c) => c.id === gazetteQuiz.courseId)
            : undefined;
          const distinctThresholds = new Set<number>();
          if (!gazetteSess && activeResults.length > 0) {
            for (const r of activeResults) {
              const s = examSessions.find((es) => es.id === r.sessionId || es.pin === r.pin);
              const q = s
                ? quizzes.find((qz) => qz.id === s.quizId || qz.slug === s.quizId)
                : undefined;
              const c = q?.courseId ? allCourses.find((cr) => cr.id === q.courseId) : undefined;
              distinctThresholds.add(
                resolvePassThresholdPct({
                  sessionThreshold: s?.passThresholdPct,
                  courseThreshold: c?.passThresholdPct,
                  brandingDefaultThreshold: brandingDefault,
                }),
              );
            }
          }
          const hasMixedThresholds = distinctThresholds.size > 1;
          const gazetteThreshold =
            distinctThresholds.size === 1
              ? Array.from(distinctThresholds)[0]!
              : resolvePassThresholdPct({
                  sessionThreshold: gazetteSess?.passThresholdPct,
                  courseThreshold: gazetteCourse?.passThresholdPct,
                  brandingDefaultThreshold: brandingDefault,
                });
          const gazetteNegativeMarking = gazetteQuiz?.questions?.[0]?.negativeMarks ?? 0.25;
          const gazetteRosterFallback =
            selectedResultsRegionId === "all"
              ? roster
              : roster.filter((s) => s.regionId === selectedResultsRegionId);
          return (
            <MeritGazetteView
              quizTitle={
                gazetteSess?.quizTitleEn ||
                gazetteSess?.quizTitleBn ||
                "বিসিএস প্রিলিমিনারি ও প্রাতিষ্ঠানিক মডেল টেস্ট"
              }
              passThresholdPct={gazetteThreshold}
              thresholdLabel={hasMixedThresholds ? "Mixed / Course-Specific" : undefined}
              negativeMarking={gazetteNegativeMarking}
              participants={
                activeResults.length > 0
                  ? activeResults.map((r) => ({
                      id: r.id,
                      nickname: r.name,
                      rollNumber: r.rollNumber,
                      regionId: r.regionId,
                      regionName: r.regionName,
                      finalScore: r.score,
                      rank: r.rank,
                      correctCount: r.correctCount,
                      incorrectCount: r.incorrectCount,
                      unansweredCount: r.unattemptedCount,
                      accuracyPct: r.accuracyPct,
                      passed:
                        typeof r.passed === "boolean"
                          ? r.passed
                          : isPassingScore(r.accuracyPct, gazetteThreshold),
                    }))
                  : gazetteRosterFallback.map((s, idx) => ({
                      id: s.id,
                      nickname: s.name,
                      rollNumber: s.rollNumber,
                      regionId: s.regionId,
                      regionName: s.regionName,
                      finalScore: 0,
                      rank: idx + 1,
                      correctCount: 0,
                      incorrectCount: 0,
                      unansweredCount: 0,
                      accuracyPct: 0,
                      passed: false,
                    }))
              }
              onClose={() => setShowGazette(false)}
            />
          );
        })()}

      <Footer />
    </div>
  );
}
