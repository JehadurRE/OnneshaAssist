import React, { useEffect, useMemo, useState } from "react";
import {
  serverBulkIssueCourseCertificates,
  serverGetBootstrapData,
  serverGradePracticalSubmission,
  serverIssueCourseCertificate,
  serverReturnPracticalForResubmit,
  serverSaveCourseRequirement,
  serverSavePracticalExam,
  serverSetAutoIssueQuizCertificates,
} from "@/lib/server-session";
import type {
  Course,
  CourseCompletionRequirement,
  PracticalExam,
  PracticalExamStatus,
  PracticalSubmission,
  PracticalTask,
  Quiz,
} from "@/lib/types";
import { buildDefaultCourseRequirement, buildDefaultFinalPracticalExam } from "@/lib/practical-exam";
import {
  Award,
  ClipboardCheck,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";

export function AdminPracticalPanel(props: {
  courses: Course[];
  quizzes: Quiz[];
  initialCourseId?: string | undefined;
}) {
  const [courseId, setCourseId] = useState(
    props.initialCourseId || props.courses[0]?.id || "course-sanjibon-ai-dm",
  );
  const [exams, setExams] = useState<PracticalExam[]>([]);
  const [subs, setSubs] = useState<PracticalSubmission[]>([]);
  const [requirements, setRequirements] = useState<CourseCompletionRequirement[]>([]);
  const [autoIssue, setAutoIssue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [marksBySubTask, setMarksBySubTask] = useState<Record<string, string>>({});
  const [feedbackBySub, setFeedbackBySub] = useState<Record<string, string>>({});

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
    () => props.quizzes.filter((q) => q.courseId === courseId),
    [props.quizzes, courseId],
  );

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await serverGetBootstrapData();
      if (res.success) {
        setExams((res.practicalExams as PracticalExam[]) || []);
        setSubs((res.practicalSubmissions as PracticalSubmission[]) || []);
        setRequirements((res.courseRequirements as CourseCompletionRequirement[]) || []);
        setAutoIssue(!!res.autoIssueQuizCertificates);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (props.initialCourseId) setCourseId(props.initialCourseId);
  }, [props.initialCourseId]);

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

  const courseSubs = subs
    .filter((s) => s.courseId === courseId)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  const markKey = (subId: string, taskId: string) => `${subId}::${taskId}`;

  const gradeOne = async (sub: PracticalSubmission) => {
    if (!exam?.tasks.length) return;
    const grades = exam.tasks.map((task) => {
      const raw =
        marksBySubTask[markKey(sub.id, task.id)] ??
        String(sub.grades?.find((g) => g.taskId === task.id)?.marks ?? "");
      const marks = Number(raw);
      return {
        taskId: task.id,
        marks: Number.isFinite(marks) ? marks : 0,
        maxMarks: task.maxMarks,
        comment: feedbackBySub[sub.id] || "",
      };
    });
    if (grades.some((g) => !Number.isFinite(g.marks) || g.marks < 0)) {
      setNotice("Enter valid marks for every task.");
      return;
    }
    setBusyId(sub.id);
    setNotice(null);
    try {
      const res = await serverGradePracticalSubmission({
        data: {
          submissionId: sub.id,
          grades,
          instructorFeedback: feedbackBySub[sub.id] || "",
        },
      });
      setNotice(res.success ? `Graded ${sub.rollNumber}.` : res.error || "Grade failed.");
      await refresh();
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
        data: { courseId: course.id, rollNumber: roll },
      });
      setNotice(
        res.success
          ? `Issued ${res.certificate?.certificateNumber}`
          : res.error || "Issue failed.",
      );
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const bulkIssue = async () => {
    if (!course) return;
    setBusyId("bulk");
    try {
      const res = await serverBulkIssueCourseCertificates({ data: { courseId: course.id } });
      setNotice(
        res.success
          ? `Bulk issued ${res.issuedCount} course certificate(s). Skipped ${res.skipped?.length || 0}.`
          : res.error || "Bulk issue failed.",
      );
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading practical exam desk…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Final Practical & Course Certificates</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Configure status, deadlines, tasks, and course-completion policy. Quiz-wise auto
            certificates stay off unless you explicitly enable them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            type="button"
            onClick={() => void bulkIssue()}
            disabled={busyId === "bulk" || !course}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
          >
            <Award className="h-3.5 w-3.5" /> Bulk issue eligible
          </button>
        </div>
      </div>

      <label className="block text-xs font-semibold max-w-md">
        Course
        <select
          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          {props.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.titleEn}
            </option>
          ))}
        </select>
      </label>

      {notice && (
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">{notice}</div>
      )}

      <div className="rounded-2xl border border-border p-4 space-y-3">
        <div className="text-sm font-bold">Quiz auto-certificates (legacy)</div>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={autoIssue}
            disabled={busyId === "auto"}
            onChange={(e) => void toggleAutoIssue(e.target.checked)}
          />
          Enable automatic quiz-session certificates (default: off — use course certificates)
        </label>
      </div>

      {!exam ? (
        <div className="rounded-2xl border border-dashed border-border p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            No practical exam for this course yet.
          </p>
          <button
            type="button"
            onClick={() => {
              const created = ensureExamLocal();
              if (created) void saveExamMeta(created);
            }}
            className="inline-flex items-center gap-1 rounded-xl bg-foreground px-3 py-2 text-xs font-bold text-background"
          >
            <Plus className="h-3.5 w-3.5" /> Create default Final Practical
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border p-4 space-y-4">
          <div className="text-sm font-bold">{exam.titleEn}</div>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <label className="font-semibold">
              Title (EN)
              <input
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                value={exam.titleEn}
                onChange={(e) => patchExam({ titleEn: e.target.value })}
              />
            </label>
            <label className="font-semibold">
              Title (BN)
              <input
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                value={exam.titleBn}
                onChange={(e) => patchExam({ titleBn: e.target.value })}
              />
            </label>
            <label className="font-semibold sm:col-span-2">
              Description (EN)
              <textarea
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                rows={2}
                value={exam.descriptionEn || ""}
                onChange={(e) => patchExam({ descriptionEn: e.target.value })}
              />
            </label>
            <label className="font-semibold">
              Status
              <select
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
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
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
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
              Opens at (ISO / local datetime)
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                value={toLocalInput(exam.opensAt)}
                onChange={(e) => patchExam({ opensAt: fromLocalInput(e.target.value) })}
              />
            </label>
            <label className="font-semibold">
              Closes at (late after this; status still open)
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                value={toLocalInput(exam.closesAt)}
                onChange={(e) => patchExam({ closesAt: fromLocalInput(e.target.value) })}
              />
            </label>
            <label className="font-semibold">
              Quiz weight %
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                value={exam.quizWeightPct ?? 40}
                onChange={(e) => patchExam({ quizWeightPct: Number(e.target.value) })}
              />
            </label>
            <label className="font-semibold">
              Practical weight %
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                value={exam.practicalWeightPct ?? 60}
                onChange={(e) => patchExam({ practicalWeightPct: Number(e.target.value) })}
              />
            </label>
            <label className="font-semibold">
              Pass threshold %
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                value={exam.passThresholdPct ?? 50}
                onChange={(e) => patchExam({ passThresholdPct: Number(e.target.value) })}
              />
            </label>
            <label className="font-semibold">
              Max file MB
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                value={Math.round((exam.maxFileBytes || 10 * 1024 * 1024) / (1024 * 1024))}
                onChange={(e) =>
                  patchExam({ maxFileBytes: Math.max(1, Number(e.target.value) || 10) * 1024 * 1024 })
                }
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Tasks ({exam.tasks.length})
              </div>
              <button
                type="button"
                onClick={addTask}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-bold"
              >
                <Plus className="h-3 w-3" /> Add task
              </button>
            </div>
            {exam.tasks.map((task) => (
              <div key={task.id} className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2">
                <div className="flex flex-wrap gap-2 items-start">
                  <label className="text-[11px] font-semibold flex-1 min-w-[140px]">
                    Title EN
                    <input
                      className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1"
                      value={task.titleEn}
                      onChange={(e) => updateTask(task.id, { titleEn: e.target.value })}
                    />
                  </label>
                  <label className="text-[11px] font-semibold flex-1 min-w-[140px]">
                    Title BN
                    <input
                      className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1"
                      value={task.titleBn}
                      onChange={(e) => updateTask(task.id, { titleBn: e.target.value })}
                    />
                  </label>
                  <label className="text-[11px] font-semibold w-24">
                    Max marks
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1"
                      value={task.maxMarks}
                      onChange={(e) => updateTask(task.id, { maxMarks: Number(e.target.value) })}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    className="mt-5 rounded-lg border border-destructive/40 px-2 py-1 text-destructive"
                    title="Remove task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <label className="block text-[11px] font-semibold">
                  Prompt EN
                  <textarea
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1"
                    rows={2}
                    value={task.promptEn}
                    onChange={(e) => updateTask(task.id, { promptEn: e.target.value })}
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
          </div>

          <button
            type="button"
            onClick={() => void saveExamMeta()}
            disabled={busyId === "exam"}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold"
          >
            <Save className="h-3.5 w-3.5" /> Save exam settings
          </button>
        </div>
      )}

      {requirement && course && (
        <div className="rounded-2xl border border-border p-4 space-y-3">
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
          <label className="block text-xs font-semibold">
            Required quiz IDs (comma-separated)
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-[11px]"
              value={(requirement.requiredQuizIds || []).join(", ")}
              onChange={(e) =>
                patchRequirement({
                  requiredQuizIds: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <label className="font-semibold">
              Certificate title (EN)
              <input
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                value={requirement.certificateTitleEn || ""}
                onChange={(e) => patchRequirement({ certificateTitleEn: e.target.value })}
              />
            </label>
            <label className="font-semibold">
              Certificate title (BN)
              <input
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                value={requirement.certificateTitleBn || ""}
                onChange={(e) => patchRequirement({ certificateTitleBn: e.target.value })}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void saveRequirement()}
            disabled={busyId === "req"}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold"
          >
            <Save className="h-3.5 w-3.5" /> Save certificate policy
          </button>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <ClipboardCheck className="h-4 w-4" />
          Submissions ({courseSubs.length})
        </div>
        {courseSubs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No practical submissions yet. Candidates submit via /portal.
          </div>
        ) : (
          courseSubs.map((sub) => (
            <div key={sub.id} className="rounded-2xl border border-border p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-sm">
                    {sub.studentName}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      {sub.rollNumber}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sub.regionName || "—"} · {sub.status}
                    {typeof sub.combinedPct === "number" ? ` · combined ${sub.combinedPct}%` : ""}
                    {typeof sub.quizAccuracyPct === "number"
                      ? ` · quiz ${sub.quizAccuracyPct}%`
                      : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sub.status === "graded" && (
                    <button
                      type="button"
                      onClick={() => void returnOne(sub)}
                      disabled={busyId === `return-${sub.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold"
                    >
                      <RotateCcw className="h-3 w-3" /> Return for resubmit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void issueOne(sub.rollNumber)}
                    disabled={busyId === `issue-${sub.rollNumber}`}
                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700"
                  >
                    Issue course cert
                  </button>
                </div>
              </div>
              <div className="text-xs space-y-1">
                {sub.answers.map((a) => {
                  const task = exam?.tasks.find((t) => t.id === a.taskId);
                  return (
                    <div key={a.taskId} className="rounded-xl bg-muted/40 px-3 py-2 space-y-1">
                      <div className="font-semibold">{task?.titleEn || a.taskId}</div>
                      <div>{a.textAnswer || "—"}</div>
                      {a.linkUrl && (
                        <a
                          href={a.linkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 font-semibold hover:underline break-all"
                        >
                          {a.linkUrl}
                        </a>
                      )}
                      {a.fileName && (
                        <div className="font-mono text-[10px] text-muted-foreground">
                          file: {a.fileName} ({a.fileSizeBytes || 0} bytes)
                          {a.fileRelPath ? ` · ${a.fileRelPath}` : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {exam && (
                <div className="space-y-2">
                  {exam.tasks.map((task) => (
                    <label key={task.id} className="text-xs font-semibold block">
                      Marks / {task.maxMarks} — {task.titleEn}
                      <input
                        className="mt-1 block w-28 rounded-lg border border-border bg-background px-2 py-1.5"
                        value={
                          marksBySubTask[markKey(sub.id, task.id)] ??
                          String(sub.grades?.find((g) => g.taskId === task.id)?.marks ?? "")
                        }
                        onChange={(e) =>
                          setMarksBySubTask((m) => ({
                            ...m,
                            [markKey(sub.id, task.id)]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                  <label className="text-xs font-semibold flex-1 min-w-[180px] block">
                    Feedback
                    <input
                      className="mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1.5"
                      value={feedbackBySub[sub.id] ?? sub.instructorFeedback ?? ""}
                      onChange={(e) =>
                        setFeedbackBySub((m) => ({ ...m, [sub.id]: e.target.value }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void gradeOne(sub)}
                    disabled={busyId === sub.id}
                    className="rounded-xl bg-foreground px-3 py-2 text-xs font-bold text-background"
                  >
                    {busyId === sub.id ? "Saving…" : sub.status === "graded" ? "Update grade" : "Save grade"}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
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
