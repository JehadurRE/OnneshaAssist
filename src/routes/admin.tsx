import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CertificateDesignerStudio } from "@/components/admin/CertificateDesignerStudio";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { db, DbSalesLead, DbTransaction } from "@/lib/db";
import { gameEngine } from "@/lib/game-engine";
import { serverGetActiveRooms } from "@/lib/server-session";
import {
  BrandingSettings,
  Course,
  ExamSessionRecord,
  ManagedUser,
  Quiz,
  Region,
  RosterStudent,
} from "@/lib/types";
import {
  AlertCircle,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  Layers,
  LayoutDashboard,
  Lock,
  MapPin,
  Play,
  Plus,
  Radio,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";

interface ActiveRoomRow {
  pin: string;
  quizId: string;
  quizTitleEn: string;
  quizTitleBn: string;
  hostId?: string;
  phase: string;
  participantCount: number;
  totalQuestions: number;
  allowedRegionName: string;
}

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Super Admin Control Center · Onnesha Arena" },
      {
        name: "description",
        content:
          "Institutional Super Admin panel for managing courses, multi-instructor assignments, sequential quizzes, regions, anti-cheat policies, and database backups.",
      },
    ],
  }),
  component: SuperAdminPage,
});

type AdminTab = "courses" | "instructors" | "roster" | "settings" | "sales_billing";

function SuperAdminPage() {
  const { lang } = useLanguage();
  const { user, isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  // Admin Gate Login State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active Live Rooms Monitor
  const [activeRooms, setActiveRooms] = useState<ActiveRoomRow[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Core Database State
  const [activeTab, setActiveTab] = useState<AdminTab>("courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [examSessions, setExamSessions] = useState<ExamSessionRecord[]>([]);
  const [salesLeads, setSalesLeads] = useState<DbSalesLead[]>([]);
  const [transactions, setTransactions] = useState<DbTransaction[]>([]);
  const [branding, setBranding] = useState<BrandingSettings>(() => db.getBranding());
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Course Creation / Edit Form State
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseCode, setCourseCode] = useState("");
  const [courseTitleEn, setCourseTitleEn] = useState("");
  const [courseTitleBn, setCourseTitleBn] = useState("");
  const [courseDescEn, setCourseDescEn] = useState("");
  const [courseCategory, setCourseCategory] = useState("Civil Service & Training");
  const [courseIcon, setCourseIcon] = useState("🎯");
  const [selectedCourseInstructors, setSelectedCourseInstructors] = useState<string[]>([
    "usr-instructor-1",
  ]);

  // Quick Sequential Quiz Under Course Modal State
  const [addingQuizForCourse, setAddingQuizForCourse] = useState<Course | null>(null);
  const [newQuizNumber, setNewQuizNumber] = useState<number>(1);
  const [newQuizTitleEn, setNewQuizTitleEn] = useState("");
  const [newQuizTitleBn, setNewQuizTitleBn] = useState("");
  const [newQuizInstructorId, setNewQuizInstructorId] = useState("usr-instructor-1");

  // Instructor / User Creation Form State
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("instructor123");
  const [newUserRole, setNewUserRole] = useState<"instructor" | "admin">("instructor");
  const [newUserDesignation, setNewUserDesignation] = useState("Course Instructor");
  const [newUserInstitution, setNewUserInstitution] = useState("Onnesha Academic Wing");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserCourses, setNewUserCourses] = useState<string[]>(["course-bcs-foundation"]);

  // Edit Existing Instructor / Reset Password Modal State
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserDesignation, setEditUserDesignation] = useState("");
  const [editUserInstitution, setEditUserInstitution] = useState("");
  const [editUserPhone, setEditUserPhone] = useState("");
  const [editUserRole, setEditUserRole] = useState<"instructor" | "admin">("instructor");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserCourses, setEditUserCourses] = useState<string[]>([]);

  // Region & Candidate Form State
  const [newRegCode, setNewRegCode] = useState("");
  const [newRegNameEn, setNewRegNameEn] = useState("");
  const [newRegNameBn, setNewRegNameBn] = useState("");
  const [newRegCenter, setNewRegCenter] = useState("");

  const [stdRoll, setStdRoll] = useState("");
  const [stdName, setStdName] = useState("");
  const [stdPhone, setStdPhone] = useState("");
  const [stdRegionId, setStdRegionId] = useState("reg-dhaka");
  const [stdBatch, setStdBatch] = useState("46th BCS & Cadet Batch");
  const [rosterRegionFilter, setRosterRegionFilter] = useState("all");
  const [rosterSearch, setRosterSearch] = useState("");

  const showNotice = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3500);
  };

  const refreshAll = () => {
    setCourses(db.getCourses());
    setUsers(db.getUsers());
    setQuizzes(db.getQuizzes());
    setRegions(db.getRegions());
    setRoster(db.getRoster());
    setExamSessions(db.getExamSessions());
    setSalesLeads(db.getSalesLeads());
    setTransactions(db.getTransactions());
    setBranding(db.getBranding());
  };

  const refreshActiveRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await serverGetActiveRooms();
      if (res.success && Array.isArray(res.rooms)) {
        setActiveRooms(res.rooms);
      }
    } catch {
      // ignore transient network errors
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    refreshAll();
    refreshActiveRooms();
    db.syncFromServerStore().then(refreshAll);
    const unsub = db.subscribe(refreshAll);
    return () => unsub();
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    const res = await login(loginEmail, loginPassword);
    setIsLoggingIn(false);
    if (!res.success) {
      setLoginError(res.error || "Invalid credentials");
    }
  };

  // Save or Update Course with Multi-Instructor Assignments
  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitleEn.trim() || !courseCode.trim()) return;

    const instructorObjs = users.filter((u) => selectedCourseInstructors.includes(u.id));
    const id =
      editingCourseId ||
      `course-${courseCode
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36).slice(-4)}`;

    const courseObj: Course = {
      id,
      code: courseCode.trim().toUpperCase(),
      titleEn: courseTitleEn.trim(),
      titleBn: (courseTitleBn || courseTitleEn).trim(),
      descriptionEn:
        courseDescEn.trim() || "Multi-quiz structured course managed under Onnesha Super Admin.",
      descriptionBn: courseDescEn.trim() || "অন্বেষা সুপার অ্যাডমিন পরিচালিত ধারাবাহিক কুইজ কোর্স।",
      categoryEn: courseCategory,
      categoryBn: courseCategory,
      icon: courseIcon || "🎯",
      color: "from-emerald-500/20 to-teal-500/20",
      instructorIds: selectedCourseInstructors,
      instructorNames: instructorObjs.map((i) => i.name),
      status: "active",
      createdAt: new Date().toISOString(),
    };

    db.saveCourse(courseObj);
    // Also update each assigned instructor's assignedCourseIds
    users.forEach((u) => {
      const hasCourse = selectedCourseInstructors.includes(u.id);
      const currentSet = new Set(u.assignedCourseIds || []);
      if (hasCourse) currentSet.add(courseObj.id);
      else if (editingCourseId) currentSet.delete(courseObj.id);
      db.saveUser({ ...u, assignedCourseIds: Array.from(currentSet) });
    });

    setEditingCourseId(null);
    setCourseCode("");
    setCourseTitleEn("");
    setCourseTitleBn("");
    setCourseDescEn("");
    refreshAll();
    showNotice(
      `Saved course "${courseObj.code} — ${courseObj.titleEn}" with ${instructorObjs.length} instructor(s).`,
    );
  };

  const handleEditCourse = (c: Course) => {
    setEditingCourseId(c.id);
    setCourseCode(c.code);
    setCourseTitleEn(c.titleEn);
    setCourseTitleBn(c.titleBn);
    setCourseDescEn(c.descriptionEn);
    setCourseCategory(c.categoryEn || "BCS / Job");
    setCourseIcon(c.icon || "🎯");
    setSelectedCourseInstructors(c.instructorIds || []);
  };

  // Create Sequential Quiz (Quiz 1, Quiz 2, Quiz 3...) under a Course
  const openAddSequentialQuiz = (course: Course) => {
    const courseQuizzes = quizzes.filter((q) => q.courseId === course.id);
    const nextNum = courseQuizzes.reduce((max, q) => Math.max(max, q.quizNumber || 0), 0) + 1;
    setAddingQuizForCourse(course);
    setNewQuizNumber(nextNum);
    setNewQuizTitleEn(`Quiz ${nextNum} — ${course.titleEn}`);
    setNewQuizTitleBn(`কুইজ ${nextNum} — ${course.titleBn}`);
    const fallbackInstructor =
      course.instructorIds[0] ||
      users.find((u) => u.role === "instructor")?.id ||
      users[0]?.id ||
      "";
    setNewQuizInstructorId(fallbackInstructor);
  };

  const handleCreateSequentialQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingQuizForCourse || !newQuizTitleEn.trim()) return;

    const assignedInst = users.find((u) => u.id === newQuizInstructorId);
    const id = `quiz-${addingQuizForCourse.code.toLowerCase()}-q${newQuizNumber}-${Date.now().toString(36).slice(-4)}`;
    const newQuiz: Quiz = {
      id,
      slug: id,
      courseId: addingQuizForCourse.id,
      courseTitle: addingQuizForCourse.titleEn,
      quizNumber: newQuizNumber,
      instructorId: assignedInst?.id || user?.id || "",
      instructorName: assignedInst?.name || user?.name || "Course Instructor",
      titleEn: newQuizTitleEn.trim(),
      titleBn: (newQuizTitleBn || newQuizTitleEn).trim(),
      descriptionEn: `Sequential Assessment Quiz #${newQuizNumber} under ${addingQuizForCourse.titleEn}`,
      descriptionBn: `${addingQuizForCourse.titleBn} এর অধীনে ধারাবাহিক কুইজ #${newQuizNumber}`,
      categoryEn: addingQuizForCourse.categoryEn || "BCS / Job",
      categoryBn: addingQuizForCourse.categoryBn || "বিসিএস / চাকরি",
      icon: addingQuizForCourse.icon || "🎯",
      createdAt: new Date().toISOString(),
      questions: [
        {
          id: `q-${Date.now()}-1`,
          textEn: `Sample Question 1 for ${newQuizTitleEn}`,
          textBn: `${newQuizTitleBn || newQuizTitleEn} - প্রশ্ন ১`,
          type: "single_mcq",
          timeLimitSec: 20,
          points: 1000,
          negativeMarks: 0.25,
          options: [
            { id: "o1", textEn: "Option A (Correct)", textBn: "অপশন ক (সঠিক)", isCorrect: true },
            { id: "o2", textEn: "Option B", textBn: "অপশন খ" },
            { id: "o3", textEn: "Option C", textBn: "অপশন গ" },
            { id: "o4", textEn: "Option D", textBn: "অপশন ঘ" },
          ],
          correctOptionIds: ["o1"],
        },
      ],
    };

    db.saveCustomQuiz(newQuiz);
    setAddingQuizForCourse(null);
    refreshAll();
    showNotice(
      `Created Quiz #${newQuizNumber} under ${addingQuizForCourse.titleEn}. Instructors can now add questions in Instructor Studio.`,
    );
  };

  // Add New Instructor / Admin Account
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) return;

    const cleanEmail = newUserEmail.trim().toLowerCase();
    const id = `usr-${Date.now().toString(36)}`;
    const newUser: ManagedUser = {
      id,
      name: newUserName.trim(),
      email: cleanEmail,
      passwordHash: newUserPassword.trim(),
      role: newUserRole,
      institution: newUserInstitution.trim() || "Onnesha Assessment Wing",
      designation: newUserDesignation.trim() || "Faculty Instructor",
      phone: newUserPhone.trim(),
      plan: "institution_max",
      assignedCourseIds: newUserCourses,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    db.saveUser(newUser);

    // Also add this instructor to their assigned courses
    courses.forEach((c) => {
      if (newUserCourses.includes(c.id) && !c.instructorIds.includes(id)) {
        const updatedCourse: Course = {
          ...c,
          instructorIds: [...c.instructorIds, id],
          instructorNames: [...c.instructorNames, newUser.name],
        };
        db.saveCourse(updatedCourse);
      }
    });

    setNewUserName("");
    setNewUserEmail("");
    setNewUserPhone("");
    refreshAll();
    showNotice(
      `Added ${newUser.role.toUpperCase()} account: ${newUser.email} (Password set cleanly with salted scrypt)`,
    );
  };

  const handleToggleUserStatus = (u: ManagedUser) => {
    if (u.email === "admin@onnesha.app") return;
    const nextStatus = u.status === "active" ? "suspended" : "active";
    db.saveUser({ ...u, status: nextStatus });
    refreshAll();
    showNotice(`Updated ${u.name} status to ${nextStatus.toUpperCase()}.`);
  };

  const openEditUser = (u: ManagedUser) => {
    setEditingUser(u);
    setEditUserName(u.name);
    setEditUserDesignation(u.designation || "Course Instructor");
    setEditUserInstitution(u.institution || u.institutionName || "Onnesha Academic Wing");
    setEditUserPhone(u.phone || "");
    setEditUserRole(u.role === "admin" ? "admin" : "instructor");
    setEditUserPassword("");
    const currentCourseIds = new Set<string>(u.assignedCourseIds || []);
    courses.forEach((c) => {
      if ((c.instructorIds || []).includes(u.id)) currentCourseIds.add(c.id);
    });
    setEditUserCourses(Array.from(currentCourseIds));
  };

  const handleSaveEditedUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editUserName.trim()) return;

    const updatedUser: ManagedUser = {
      ...editingUser,
      name: editUserName.trim(),
      designation: editUserDesignation.trim() || "Course Instructor",
      institution: editUserInstitution.trim() || "Onnesha Academic Wing",
      institutionName: editUserInstitution.trim() || "Onnesha Academic Wing",
      phone: editUserPhone.trim(),
      role: editingUser.email === "admin@onnesha.app" ? "admin" : editUserRole,
      assignedCourseIds: editUserCourses,
      ...(editUserPassword.trim() ? { passwordHash: editUserPassword.trim() } : {}),
    };

    db.saveUser(updatedUser);

    courses.forEach((c) => {
      const shouldHave = editUserCourses.includes(c.id);
      const hasNow = (c.instructorIds || []).includes(updatedUser.id);
      if (shouldHave && !hasNow) {
        db.saveCourse({
          ...c,
          instructorIds: [...(c.instructorIds || []), updatedUser.id],
          instructorNames: [...(c.instructorNames || []), updatedUser.name],
        });
      } else if (!shouldHave && hasNow) {
        const nextIds = (c.instructorIds || []).filter((id) => id !== updatedUser.id);
        const nextNames = nextIds
          .map((id) =>
            id === updatedUser.id ? updatedUser.name : users.find((x) => x.id === id)?.name || "",
          )
          .filter(Boolean);
        db.saveCourse({
          ...c,
          instructorIds: nextIds,
          instructorNames: nextNames,
        });
      } else if (shouldHave && hasNow && updatedUser.name !== editingUser.name) {
        const nextNames = (c.instructorIds || [])
          .map((id) =>
            id === updatedUser.id ? updatedUser.name : users.find((x) => x.id === id)?.name || "",
          )
          .filter(Boolean);
        db.saveCourse({ ...c, instructorNames: nextNames });
      }
    });

    setEditingUser(null);
    setEditUserPassword("");
    refreshAll();
    showNotice(
      `Updated "${updatedUser.name}" (${editUserCourses.length} course(s)${
        editUserPassword.trim() ? ", password reset" : ""
      }).`,
    );
  };

  const handleAddRegion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegCode.trim() || !newRegNameEn.trim()) return;
    db.addRegion({
      code: newRegCode,
      nameEn: newRegNameEn,
      nameBn: newRegNameBn || newRegNameEn,
      centerName: newRegCenter,
    });
    setNewRegCode("");
    setNewRegNameEn("");
    setNewRegNameBn("");
    setNewRegCenter("");
    refreshAll();
    showNotice("Added new Regional Command Center.");
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stdRoll.trim() || !stdName.trim()) return;
    const reg = regions.find((r) => r.id === stdRegionId);
    db.addStudentToRoster({
      rollNumber: stdRoll.trim(),
      name: stdName.trim(),
      phone: stdPhone.trim(),
      regionId: stdRegionId,
      regionName: reg?.nameEn || "Dhaka Range",
      batch: stdBatch.trim(),
    });
    setStdRoll("");
    setStdName("");
    setStdPhone("");
    refreshAll();
    showNotice(`Enrolled candidate ${stdName} (${stdRoll}) into ${reg?.nameEn || "Dhaka Range"}.`);
  };

  const handleSaveBrandingAndSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    db.saveBranding(branding);
    showNotice("Saved Global Anti-Cheat Policy & Co-Branding settings to Server Database.");
  };

  const handleExportDatabase = () => {
    const json = db.exportFullBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `onnesha-db-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice("Downloaded full JSON database backup.");
  };

  const handleImportDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        const ok = await db.importFullBackup(content);
        if (ok) {
          refreshAll();
          showNotice("Restored full database backup to Server & SQLite!");
        } else {
          showNotice("Failed to parse backup JSON file.");
        }
      }
    };
    reader.readAsText(file);
  };

  const handleHostQuizNow = (quiz: Quiz) => {
    navigate({
      to: "/host/$quizId",
      params: { quizId: quiz.slug || quiz.id },
    });
  };

  // If user is not logged in as Super Admin, show the Dedicated Super Admin Security Gate
  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-3xl border-2 border-amber-500/40 bg-card p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Restricted Console
                </span>
                <h1 className="font-display text-xl font-black text-foreground">
                  Super Admin Control Center
                </h1>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              This portal (<code className="font-mono text-foreground">/admin</code>) is strictly
              separated from the Instructor Studio (
              <code className="font-mono text-foreground">/dashboard</code>). Sign in with Super
              Admin credentials to manage courses, multi-instructor assignments, regions, and
              anti-cheat locks.
            </p>

            {loginError && (
              <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-bold text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Super Admin Email
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Super Admin Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
                />
              </div>

              {import.meta.env.DEV && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] font-mono">
                  <div>
                    <div className="font-bold text-amber-600 dark:text-amber-400">
                      Demo Admin Access:
                    </div>
                    <div className="text-foreground">admin@onnesha.app · admin123</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail("admin@onnesha.app");
                      setLoginPassword("admin123");
                    }}
                    className="shrink-0 rounded-lg border border-amber-500/40 bg-background px-2.5 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-300 hover:bg-amber-500/20"
                  >
                    Auto-Fill
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 text-xs font-black text-black shadow-lg hover:bg-amber-400 transition"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>
                  {isLoggingIn ? "Authenticating..." : "Unlock Super Admin Console (/admin)"}
                </span>
              </button>
            </form>

            <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Are you a Course Instructor?</span>
              <Link to="/dashboard" className="font-bold text-primary hover:underline">
                Go to Instructor Studio →
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const filteredRoster = roster.filter((s) => {
    const regionOk = rosterRegionFilter === "all" || s.regionId === rosterRegionFilter;
    const q = rosterSearch.trim().toLowerCase();
    const searchOk =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.rollNumber.toLowerCase().includes(q) ||
      (s.phone || "").includes(q);
    return regionOk && searchOk;
  });

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid flex flex-col">
      <Navbar />

      {statusToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-2xl animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-8 space-y-6">
        {/* Super Admin Top Command Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-3xl border border-amber-500/30 bg-card p-6 shadow-tactical">
          <div className="flex items-start sm:items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  SUPER ADMIN PORTAL (/admin)
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  ● Server DB + SQLite Synced
                </span>
              </div>
              <h1 className="mt-1 font-display text-2xl sm:text-3xl font-black text-foreground">
                Institutional Command &amp; Multi-Course Governance
              </h1>
              <p className="text-xs text-muted-foreground">
                Signed in as <strong>{user.name}</strong> ({user.email}) · Separate from Instructor
                Studio
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold text-foreground hover:bg-accent transition"
            >
              <LayoutDashboard className="h-4 w-4 text-primary" />
              <span>Open Instructor Studio (/dashboard)</span>
            </Link>
            <button
              type="button"
              onClick={handleExportDatabase}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
            >
              <Download className="h-4 w-4" />
              <span>Backup DB</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
              <span>Active Courses</span>
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 font-mono text-2xl font-black text-foreground">
              {courses.length}
            </div>
            <div className="text-[11px] text-muted-foreground">With multi-instructor teams</div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
              <span>Faculty &amp; Admins</span>
              <GraduationCap className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 font-mono text-2xl font-black text-foreground">{users.length}</div>
            <div className="text-[11px] text-muted-foreground">
              {users.filter((u) => u.role === "instructor").length} Instructors ·{" "}
              {users.filter((u) => u.role === "admin").length} Admins
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
              <span>Sequential Quizzes</span>
              <BookOpen className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 font-mono text-2xl font-black text-foreground">
              {quizzes.length}
            </div>
            <div className="text-[11px] text-muted-foreground">4 question styles supported</div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
              <span>Enrolled Trainees</span>
              <Users className="h-4 w-4 text-sky-500" />
            </div>
            <div className="mt-2 font-mono text-2xl font-black text-foreground">
              {roster.length}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Across {regions.length} Regional Ranges
            </div>
          </div>
        </div>

        {/* Live Examination Rooms Monitor */}
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Radio
                className={`h-4 w-4 ${activeRooms.length > 0 ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`}
              />
              <h2 className="font-display text-sm font-black text-foreground">
                Live Examination Rooms Oversight ({activeRooms.length} Active)
              </h2>
            </div>
            <button
              type="button"
              onClick={refreshActiveRooms}
              disabled={loadingRooms}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-accent transition"
            >
              <RefreshCw className={`h-3 w-3 ${loadingRooms ? "animate-spin" : ""}`} />
              <span>Refresh Rooms</span>
            </button>
          </div>

          {activeRooms.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No live examination rooms are currently open. Launch any quiz below or monitor
              instructor sessions here.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeRooms.map((room) => (
                <div
                  key={room.pin}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-black tracking-wider text-emerald-600 dark:text-emerald-400">
                        PIN {room.pin}
                      </span>
                      <span className="rounded-full bg-background px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-foreground border border-border">
                        {room.phase} · {room.participantCount} joined
                      </span>
                    </div>
                    <div className="mt-1 font-display text-xs font-bold text-foreground truncate">
                      {room.quizTitleEn || room.quizTitleBn}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      Scope: {room.allowedRegionName}
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
                      <span>Open Controller</span>
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await gameEngine.closeRoomAsync(room.pin);
                        if (ok) {
                          showNotice(`Closed live room PIN ${room.pin}.`);
                          refreshActiveRooms();
                        }
                      }}
                      className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-[11px] font-bold text-destructive hover:bg-destructive/20 transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("courses")}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-extrabold transition ${
              activeTab === "courses"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>1. Courses &amp; Sequential Quizzes ({courses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("instructors")}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-extrabold transition ${
              activeTab === "instructors"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            <span>2. Multiple Instructors &amp; Accounts ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("roster")}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-extrabold transition ${
              activeTab === "roster"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapPin className="h-4 w-4" />
            <span>3. Regions &amp; Trainee Roster ({roster.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-extrabold transition ${
              activeTab === "settings"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>4. Anti-Cheat Lock, Co-Branding &amp; DB Backup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sales_billing")}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-extrabold transition ${
              activeTab === "sales_billing"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>5. Sales Leads &amp; Billing ({salesLeads.length + transactions.length})</span>
          </button>
        </div>

        {/* =================================================================== */}
        {/* TAB 1: COURSES, MULTI-INSTRUCTOR TEAMS & SEQUENTIAL QUIZZES         */}
        {/* =================================================================== */}
        {activeTab === "courses" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Create / Edit Course with Multiple Instructors */}
            <div className="lg:col-span-4 rounded-3xl border border-border bg-card p-6 space-y-4 h-fit">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-black text-foreground">
                  {editingCourseId ? "Update Course & Instructors" : "Create New Course"}
                </h2>
                {editingCourseId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCourseId(null);
                      setCourseCode("");
                      setCourseTitleEn("");
                      setCourseTitleBn("");
                      setCourseDescEn("");
                    }}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveCourse} className="space-y-3.5">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                      Course Code
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="BCS-101"
                      value={courseCode}
                      onChange={(e) => setCourseCode(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs font-bold uppercase text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                      Category / Wing
                    </label>
                    <input
                      type="text"
                      value={courseCategory}
                      onChange={(e) => setCourseCategory(e.target.value)}
                      placeholder="Civil Service & Training"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                    Course Title (English)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tactical Field Operations & Cyber Security"
                    value={courseTitleEn}
                    onChange={(e) => setCourseTitleEn(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                    Course Title (Bangla - Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="ট্যাকটিক্যাল ফিল্ড অপারেশন ও সাইবার নিরাপত্তা কোর্স"
                    value={courseTitleBn}
                    onChange={(e) => setCourseTitleBn(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                    Assign Multiple Instructors to This Course
                  </label>
                  <div className="max-h-44 overflow-y-auto rounded-2xl border border-border bg-background p-2.5 space-y-1.5">
                    {users
                      .filter((u) => u.role === "instructor" || u.role === "admin")
                      .map((inst) => {
                        const checked = selectedCourseInstructors.includes(inst.id);
                        return (
                          <label
                            key={inst.id}
                            className={`flex items-center justify-between rounded-xl p-2 text-xs cursor-pointer transition ${
                              checked
                                ? "bg-primary/10 border border-primary/30 font-bold text-foreground"
                                : "hover:bg-muted/60 text-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setSelectedCourseInstructors((prev) =>
                                    prev.includes(inst.id)
                                      ? prev.filter((id) => id !== inst.id)
                                      : [...prev, inst.id],
                                  );
                                }}
                                className="rounded border-border text-primary focus:ring-primary"
                              />
                              <div className="truncate">
                                <div className="text-foreground font-bold truncate">
                                  {inst.name}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {inst.email} · {inst.designation || inst.role}
                                </div>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                </div>

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    {editingCourseId ? "Save Course Changes" : "Create Course & Assign Instructors"}
                  </span>
                </button>
              </form>
            </div>

            {/* Right Column: Course Hierarchy & Sequential Quizzes (Quiz 1, Quiz 2, Quiz 3...) */}
            <div className="lg:col-span-8 space-y-4">
              {courses.map((course) => {
                const courseQuizzes = quizzes
                  .filter((q) => q.courseId === course.id)
                  .sort((a, b) => (a.quizNumber || 99) - (b.quizNumber || 99));

                return (
                  <div
                    key={course.id}
                    className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 pb-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-primary/15 px-2.5 py-0.5 font-mono text-xs font-black text-primary">
                            {course.code}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {course.categoryEn}
                          </span>
                        </div>
                        <h3 className="font-display text-xl font-black text-foreground">
                          {course.icon} {course.titleEn}
                        </h3>
                        <p className="text-xs text-muted-foreground">{course.titleBn}</p>

                        {/* Assigned Multiple Instructors Pills */}
                        <div className="pt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold text-muted-foreground mr-1">
                            Assigned Instructors ({course.instructorNames?.length || 0}):
                          </span>
                          {(course.instructorNames || []).map((name, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300"
                            >
                              <UserCheck className="h-3 w-3" />
                              <span>{name}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openAddSequentialQuiz(course)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Quiz #{courseQuizzes.length + 1}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditCourse(course)}
                          className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-accent"
                        >
                          Edit Course
                        </button>
                        {!course.id.startsWith("course-bcs-") &&
                          !course.id.startsWith("course-bank-") &&
                          !course.id.startsWith("course-varsity-") &&
                          !course.id.startsWith("course-cyber-") && (
                            <button
                              type="button"
                              onClick={() => {
                                db.deleteCourse(course.id);
                                refreshAll();
                                showNotice(`Deleted course "${course.titleEn}".`);
                              }}
                              className="rounded-xl border border-destructive/30 bg-destructive/10 p-2 text-destructive hover:bg-destructive/20"
                              title="Delete custom course"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                      </div>
                    </div>

                    {/* Sequential Quizzes List under this Course */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <span>
                          Sequential Quizzes under {course.code} ({courseQuizzes.length})
                        </span>
                        <Link
                          to="/dashboard"
                          search={{ tab: "ai_creator", courseId: course.id } as any}
                          className="text-[11px] text-primary hover:underline font-bold"
                        >
                          Open Question Builder in Studio →
                        </Link>
                      </div>

                      {courseQuizzes.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                          No quizzes added to this course yet. Click <strong>Add Quiz #1</strong>{" "}
                          above to create the first quiz.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {courseQuizzes.map((q, idx) => (
                            <div
                              key={q.id}
                              className="flex flex-col justify-between rounded-2xl border border-border bg-background p-4 hover:border-primary/40 transition"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-mono text-[10px] font-black text-amber-600 dark:text-amber-400">
                                    QUIZ #{q.quizNumber || idx + 1}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[11px] text-muted-foreground">
                                      {q.questions.length} Questions
                                    </span>
                                    {!q.isTemplate && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          db.deleteCustomQuiz(q.id);
                                          refreshAll();
                                          showNotice(`Deleted quiz "${q.titleEn}".`);
                                        }}
                                        className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                                        title="Delete Quiz"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <h4 className="mt-2 font-display text-sm font-bold text-foreground">
                                  {q.titleEn}
                                </h4>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Faculty: {q.instructorName || "Assigned Instructor"}
                                </p>
                              </div>

                              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleHostQuizNow(q)}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition"
                                >
                                  <Play className="h-3 w-3 fill-current" />
                                  <span>Host Live Exam</span>
                                </button>
                                <Link
                                  to="/dashboard"
                                  search={{ tab: "ai_creator", editQuizId: q.id } as any}
                                  className="text-[11px] font-bold text-primary hover:underline"
                                >
                                  Edit Questions →
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal for Adding Sequential Quiz (Quiz 1, Quiz 2, Quiz 3...) under a Course */}
        {addingQuizForCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase text-primary">
                    {addingQuizForCourse.code} · Sequential Assessment
                  </span>
                  <h3 className="font-display text-lg font-black text-foreground">
                    Add Quiz #{newQuizNumber} to Course
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAddingQuizForCourse(null)}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSequentialQuiz} className="space-y-3.5">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                      Quiz Number
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newQuizNumber}
                      onChange={(e) => setNewQuizNumber(parseInt(e.target.value, 10) || 1)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs font-bold text-foreground"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                      Lead Instructor
                    </label>
                    <select
                      value={newQuizInstructorId}
                      onChange={(e) => setNewQuizInstructorId(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                    >
                      {users
                        .filter((u) => u.role === "instructor" || u.role === "admin")
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                    Quiz Title (English)
                  </label>
                  <input
                    type="text"
                    required
                    value={newQuizTitleEn}
                    onChange={(e) => setNewQuizTitleEn(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                    Quiz Title (Bangla)
                  </label>
                  <input
                    type="text"
                    value={newQuizTitleBn}
                    onChange={(e) => setNewQuizTitleBn(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddingQuizForCourse(null)}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-primary px-5 py-2 text-xs font-extrabold text-primary-foreground"
                  >
                    Create Quiz #{newQuizNumber}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: MULTIPLE INSTRUCTORS & USER ACCOUNTS                         */}
        {/* =================================================================== */}
        {activeTab === "instructors" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Add New Instructor / Admin Account */}
            <div className="lg:col-span-4 rounded-3xl border border-border bg-card p-6 space-y-4 h-fit">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-black text-foreground">
                  Add Instructor or Co-Admin
                </h2>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                    Full Name &amp; Rank/Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Capt. Mahmudul Hasan"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                      Login Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="mahmud@onnesha.app"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                      Initial Password
                    </label>
                    <input
                      type="text"
                      required
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs font-bold text-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                      Portal Role
                    </label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as "instructor" | "admin")}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground"
                    >
                      <option value="instructor">Instructor (/dashboard)</option>
                      <option value="admin">Super Admin (/admin)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={newUserDesignation}
                      onChange={(e) => setNewUserDesignation(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                    Assign to Courses (Multi-Select)
                  </label>
                  <div className="max-h-36 overflow-y-auto rounded-2xl border border-border bg-background p-2 space-y-1">
                    {courses.map((c) => {
                      const checked = newUserCourses.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 rounded-lg p-1.5 text-xs cursor-pointer hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setNewUserCourses((prev) =>
                                prev.includes(c.id)
                                  ? prev.filter((id) => id !== c.id)
                                  : [...prev, c.id],
                              )
                            }
                          />
                          <span className="font-mono font-bold text-primary">{c.code}</span>
                          <span className="truncate text-foreground">{c.titleEn}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Create Account &amp; Sync to Server DB</span>
                </button>
              </form>
            </div>

            {/* Right: Directory of All Instructors & Super Admins */}
            <div className="lg:col-span-8 rounded-3xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-black text-foreground">
                    Registered Faculty Instructors &amp; Administrators ({users.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    All accounts are persisted in the server database and work across any device.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {users.map((u) => {
                  const assignedCourseObjs = courses.filter(
                    (c) =>
                      (u.assignedCourseIds || []).includes(c.id) ||
                      (c.instructorIds || []).includes(u.id),
                  );
                  return (
                    <div
                      key={u.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-sm font-black text-foreground">
                            {u.name}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-black uppercase ${
                              u.role === "admin"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                : "bg-primary/15 text-primary border border-primary/30"
                            }`}
                          >
                            {u.role}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                              u.status === "suspended"
                                ? "bg-destructive/15 text-destructive"
                                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {u.status}
                          </span>
                        </div>

                        <div className="font-mono text-xs text-muted-foreground">
                          Email: <strong className="text-foreground">{u.email}</strong> · Password:{" "}
                          <code className="rounded bg-muted px-1.5 py-0.5 text-primary font-bold">
                            Protected (scrypt)
                          </code>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-muted-foreground">
                            Assigned Courses:
                          </span>
                          {assignedCourseObjs.length === 0 ? (
                            <span className="text-[10px] text-muted-foreground italic">
                              None assigned
                            </span>
                          ) : (
                            assignedCourseObjs.map((c) => (
                              <span
                                key={c.id}
                                className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] font-bold text-foreground"
                              >
                                {c.code}: {c.titleEn}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditUser(u)}
                          className="inline-flex items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20"
                          title="Edit instructor details, courses, or reset password"
                        >
                          <UserCog className="h-3.5 w-3.5" />
                          <span>Edit / Reset Pass</span>
                        </button>
                        {u.email !== "admin@onnesha.app" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(u)}
                              className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-accent"
                            >
                              {u.status === "active" ? "Suspend" : "Activate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                db.deleteUser(u.id);
                                refreshAll();
                              }}
                              className="rounded-xl border border-destructive/30 bg-destructive/10 p-2 text-destructive hover:bg-destructive/20"
                              title="Delete User"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: REGIONS & 500+ TRAINEE ROSTER MANAGEMENT                     */}
        {/* =================================================================== */}
        {activeTab === "roster" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Add Region & Add Trainee */}
            <div className="lg:col-span-4 space-y-6">
              <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
                <h3 className="font-display text-base font-black text-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>Add Regional Command Range</span>
                </h3>
                <form onSubmit={handleAddRegion} className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Code (DHK)"
                      value={newRegCode}
                      onChange={(e) => setNewRegCode(e.target.value)}
                      className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs font-bold uppercase"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Range Name (EN)"
                      value={newRegNameEn}
                      onChange={(e) => setNewRegNameEn(e.target.value)}
                      className="col-span-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="HQ / Center Name (Optional)"
                    value={newRegCenter}
                    onChange={(e) => setNewRegCenter(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground"
                  >
                    + Add Region Range
                  </button>
                </form>

                <div className="max-h-40 overflow-y-auto divide-y divide-border/60 text-xs">
                  {regions.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-2">
                      <div>
                        <span className="font-mono font-bold text-primary mr-2">{r.code}</span>
                        <span className="font-bold text-foreground">{r.nameEn}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          db.deleteRegion(r.id);
                          refreshAll();
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
                <h3 className="font-display text-base font-black text-foreground flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" />
                  <span>Enroll Trainee to Roster</span>
                </h3>
                <form onSubmit={handleAddStudent} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Roll / ID (2026-115)"
                      value={stdRoll}
                      onChange={(e) => setStdRoll(e.target.value)}
                      className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs font-bold"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="Mobile (017XXXXXXXX)"
                      value={stdPhone}
                      onChange={(e) => setStdPhone(e.target.value)}
                      className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs font-bold"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Candidate Full Name"
                    value={stdName}
                    onChange={(e) => setStdName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
                  />
                  <select
                    value={stdRegionId}
                    onChange={(e) => setStdRegionId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
                  >
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nameEn} ({r.code})
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground"
                  >
                    + Enroll Candidate
                  </button>
                </form>
              </div>
            </div>

            {/* Right: Master Candidate Roster Table */}
            <div className="lg:col-span-8 rounded-3xl border border-border bg-card p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-lg font-black text-foreground">
                  Master Candidate Roster ({filteredRoster.length})
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={rosterRegionFilter}
                    onChange={(e) => setRosterRegionFilter(e.target.value)}
                    className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold"
                  >
                    <option value="all">All Regions ({roster.length})</option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nameEn}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Search Roll, Name or Phone..."
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 text-[11px] font-bold uppercase text-muted-foreground sticky top-0">
                    <tr>
                      <th className="p-3">Roll ID</th>
                      <th className="p-3">Candidate Name</th>
                      <th className="p-3">Mobile Number</th>
                      <th className="p-3">Region Range</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredRoster.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="p-3 font-mono font-bold text-primary">{s.rollNumber}</td>
                        <td className="p-3 font-bold text-foreground">{s.name}</td>
                        <td className="p-3 font-mono text-muted-foreground">
                          {s.phone || s.guardianPhone || "—"}
                        </td>
                        <td className="p-3">
                          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                            {s.regionName || "Dhaka Range"}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              db.removeStudentFromRoster(s.id);
                              refreshAll();
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: CERTIFICATE DESIGNER, ANTI-CHEAT LOCK & FULL DATABASE BACKUP */}
        {/* =================================================================== */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <CertificateDesignerStudio
              branding={branding}
              onChange={setBranding}
              onSave={() => {
                db.saveBranding(branding);
                showNotice(
                  "Saved Certificate Theme, Logos, Partners, Signatories & Policy to Server.",
                );
              }}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleSaveBrandingAndSecurity}
                className="lg:col-span-7 rounded-3xl border border-border bg-card p-6 space-y-5"
              >
                <h3 className="font-display text-lg font-black text-foreground flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  <span>Global Anti-Cheat Screen Lock Policy</span>
                </h3>

                {/* Anti-Cheat Controls */}
                <div className="rounded-2xl border border-border bg-background p-4 space-y-4">
                  <div className="text-xs font-black uppercase tracking-wider text-primary">
                    Proctoring &amp; Screen-Switch Prevention
                  </div>

                  <label className="flex items-start justify-between gap-4 cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        Enforce Fullscreen Exam Lock by Default
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Requires examinees to enter Fullscreen mode during active questions and logs
                        a strike if they exit Fullscreen.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!branding.defaultEnforceFullscreen}
                      onChange={(e) =>
                        setBranding({ ...branding, defaultEnforceFullscreen: e.target.checked })
                      }
                      className="mt-1 h-4 w-4 rounded border-border text-primary"
                    />
                  </label>

                  <label className="flex items-start justify-between gap-4 cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        Block Copy/Paste, Right-Click &amp; DevTools Shortcuts
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Prevents copying questions, pasting external answers, right-clicking,
                        PrintScreen, or opening F12 Inspector.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={branding.defaultBlockCopyPaste ?? true}
                      onChange={(e) =>
                        setBranding({ ...branding, defaultBlockCopyPaste: e.target.checked })
                      }
                      className="mt-1 h-4 w-4 rounded border-border text-primary"
                    />
                  </label>

                  <div className="flex items-center justify-between gap-4 pt-2 border-t border-border/60">
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        Automatic Seat Suspension Threshold (Strikes)
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Number of tab-switch / screen-blur violations before the candidate seat is
                        automatically suspended.
                      </div>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={branding.defaultMaxProctorViolations || 3}
                      onChange={(e) =>
                        setBranding({
                          ...branding,
                          defaultMaxProctorViolations: parseInt(e.target.value, 10) || 3,
                        })
                      }
                      className="w-20 rounded-xl border border-border bg-card px-3 py-1.5 font-mono text-xs font-bold text-center"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                >
                  Save Global Security &amp; Branding Settings
                </button>
              </form>

              {/* Right: Database Backup & Restore */}
              <div className="lg:col-span-5 rounded-3xl border border-border bg-card p-6 space-y-5 h-fit">
                <h3 className="font-display text-lg font-black text-foreground">
                  Database Persistence &amp; JSON Snapshot
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All courses, instructors, sequential quizzes, candidate rosters, and exam results
                  are automatically persisted to the server store (
                  <code className="font-mono text-foreground">onnesha-store.json</code>) and client
                  SQLite. You can also export or restore a complete snapshot below.
                </p>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleExportDatabase}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export Full Database Snapshot (.json)</span>
                  </button>

                  <label className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-xs font-bold text-foreground hover:bg-accent transition cursor-pointer">
                    <Upload className="h-4 w-4 text-primary" />
                    <span>Import / Restore Database Snapshot (.json)</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportDatabase}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={async () => {
                      await db.purgeDummyData();
                      refreshAll();
                      showNotice(
                        "Purged pre-seeded dummy roster, bot exam records, and sample certificates.",
                      );
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 py-3 text-xs font-bold text-destructive hover:bg-destructive/20 transition cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Purge Residual Dummy / Test Seed Data</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* =================================================================== */}
        {/* TAB 5: SALES LEADS & BKASH BILLING LEDGER                           */}
        {/* =================================================================== */}
        {activeTab === "sales_billing" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-black text-foreground">
                    Enterprise &amp; Institutional Inquiries ({salesLeads.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Leads submitted via `/contact-sales` persisted on the server disk store.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => db.syncFromServerStore().then(refreshAll)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold hover:bg-accent transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Sync Server</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left font-display">
                      <th className="p-3 font-bold">Date</th>
                      <th className="p-3 font-bold">Organization</th>
                      <th className="p-3 font-bold">Contact</th>
                      <th className="p-3 font-bold">Candidates</th>
                      <th className="p-3 font-bold">Notes</th>
                      <th className="p-3 font-bold text-center">Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {salesLeads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          No enterprise inquiries received yet.
                        </td>
                      </tr>
                    ) : (
                      salesLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-accent/30">
                          <td className="p-3 font-mono text-muted-foreground whitespace-nowrap">
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 font-bold text-foreground">{lead.organization}</td>
                          <td className="p-3">
                            <div className="font-semibold text-foreground">{lead.name}</div>
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {lead.email} {lead.phone ? `· ${lead.phone}` : ""}
                            </div>
                          </td>
                          <td className="p-3 font-mono font-bold text-primary">
                            {lead.studentCount}
                          </td>
                          <td className="p-3 text-muted-foreground max-w-xs truncate">
                            {lead.message || "—"}
                          </td>
                          <td className="p-3 text-center">
                            <select
                              value={lead.status || "new"}
                              onChange={(e) => {
                                db.updateSalesLeadStatus(lead.id, e.target.value);
                                refreshAll();
                                showNotice(
                                  `Lead "${lead.organization}" updated to ${e.target.value}.`,
                                );
                              }}
                              className="rounded-xl border border-border bg-background px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-foreground"
                            >
                              <option value="new">New</option>
                              <option value="contacted">Contacted</option>
                              <option value="qualified">Qualified</option>
                              <option value="closed">Closed</option>
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
              <div>
                <h3 className="font-display text-lg font-black text-foreground">
                  Subscription &amp; bKash Payment Ledger ({transactions.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Review payment submissions from `/pricing` bKash checkout and reconcile
                  verification statuses.
                </p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left font-display">
                      <th className="p-3 font-bold">Date</th>
                      <th className="p-3 font-bold">TrxID</th>
                      <th className="p-3 font-bold">Plan</th>
                      <th className="p-3 font-bold">MSISDN / Method</th>
                      <th className="p-3 font-bold text-right">Amount</th>
                      <th className="p-3 font-bold text-center">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          No bKash or card payment transactions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((trx) => (
                        <tr key={trx.id} className="hover:bg-accent/30">
                          <td className="p-3 font-mono text-muted-foreground whitespace-nowrap">
                            {new Date(trx.date).toLocaleString()}
                          </td>
                          <td className="p-3 font-mono font-bold text-foreground">
                            {trx.trxId || trx.id}
                          </td>
                          <td className="p-3 font-bold uppercase text-primary">{trx.planId}</td>
                          <td className="p-3 font-mono text-muted-foreground">
                            {trx.method?.toUpperCase()} {trx.msisdn ? `· ${trx.msisdn}` : ""}
                          </td>
                          <td className="p-3 font-mono font-bold text-right text-foreground">
                            ৳{Number(trx.amount || 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-center">
                            <select
                              value={trx.status || "completed"}
                              onChange={(e) => {
                                db.updateTransactionStatus(
                                  trx.id,
                                  e.target.value as DbTransaction["status"],
                                );
                                refreshAll();
                                showNotice(
                                  `Transaction ${trx.trxId || trx.id} marked ${e.target.value}.`,
                                );
                              }}
                              className="rounded-xl border border-border bg-background px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-foreground"
                            >
                              <option value="completed">Completed</option>
                              <option value="pending">Pending</option>
                              <option value="failed">Failed</option>
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Edit Instructor / Reset Password Modal */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase text-primary">
                    {editingUser.email}
                  </span>
                  <h3 className="font-display text-lg font-black text-foreground">
                    Edit Account &amp; Course Assignments
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-xl p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEditedUser} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editUserName}
                      onChange={(e) => setEditUserName(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                      Role
                    </label>
                    <select
                      value={editUserRole}
                      disabled={editingUser.email === "admin@onnesha.app"}
                      onChange={(e) => setEditUserRole(e.target.value as "instructor" | "admin")}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground disabled:opacity-60"
                    >
                      <option value="instructor">Faculty Instructor</option>
                      <option value="admin">Super Admin</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={editUserDesignation}
                      onChange={(e) => setEditUserDesignation(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={editUserPhone}
                      onChange={(e) => setEditUserPhone(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs font-semibold text-foreground"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                    Institution / Wing
                  </label>
                  <input
                    type="text"
                    value={editUserInstitution}
                    onChange={(e) => setEditUserInstitution(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                    Reset Password (Optional — leave blank to keep current)
                  </label>
                  <input
                    type="password"
                    minLength={6}
                    value={editUserPassword}
                    onChange={(e) => setEditUserPassword(e.target.value)}
                    placeholder="Enter new password (min 6 chars)"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                    Assigned Courses ({editUserCourses.length})
                  </label>
                  <div className="max-h-36 overflow-y-auto rounded-2xl border border-border bg-background p-2 space-y-1">
                    {courses.map((c) => {
                      const checked = editUserCourses.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 rounded-lg p-1.5 text-xs cursor-pointer hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setEditUserCourses((prev) =>
                                prev.includes(c.id)
                                  ? prev.filter((id) => id !== c.id)
                                  : [...prev, c.id],
                              )
                            }
                          />
                          <span className="font-mono font-bold text-primary">{c.code}</span>
                          <span className="truncate text-foreground">{c.titleEn}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-primary px-5 py-2 text-xs font-extrabold text-primary-foreground hover:bg-primary/90"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
