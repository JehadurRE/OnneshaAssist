import React, { useEffect, useMemo, useState } from "react";
import {
  serverBulkIssueCourseCertificates,
  serverGetBootstrapData,
  serverGradePracticalSubmission,
  serverIssueCourseCertificate,
  serverSavePracticalExam,
} from "@/lib/server-session";
import type { PracticalExam, PracticalSubmission } from "@/lib/types";
import { Award, ClipboardCheck, Loader2, RefreshCw, Save } from "lucide-react";

export function AdminPracticalPanel(props: { courseId: string; courseCode: string }) {
  const [exams, setExams] = useState<PracticalExam[]>([]);
  const [subs, setSubs] = useState<PracticalSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [marksBySub, setMarksBySub] = useState<Record<string, string>>({});
  const [feedbackBySub, setFeedbackBySub] = useState<Record<string, string>>({});

  const exam = useMemo(
    () => exams.find((e) => e.courseId === props.courseId) || exams[0],
    [exams, props.courseId],
  );

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await serverGetBootstrapData();
      if (res.success) {
        setExams((res.practicalExams as PracticalExam[]) || []);
        setSubs((res.practicalSubmissions as PracticalSubmission[]) || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const courseSubs = subs
    .filter((s) => s.courseId === props.courseId)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  const gradeOne = async (sub: PracticalSubmission) => {
    if (!exam?.tasks[0]) return;
    const raw = marksBySub[sub.id] ?? String(sub.grades?.[0]?.marks ?? "");
    const marks = Number(raw);
    if (!Number.isFinite(marks) || marks < 0) {
      setNotice("Enter a valid marks value.");
      return;
    }
    setBusyId(sub.id);
    setNotice(null);
    try {
      const res = await serverGradePracticalSubmission({
        data: {
          submissionId: sub.id,
          grades: [
            {
              taskId: exam.tasks[0].id,
              marks,
              maxMarks: exam.tasks[0].maxMarks,
              comment: feedbackBySub[sub.id] || "",
            },
          ],
          instructorFeedback: feedbackBySub[sub.id] || "",
        },
      });
      setNotice(res.success ? `Graded ${sub.rollNumber}.` : res.error || "Grade failed.");
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const issueOne = async (roll: string) => {
    setBusyId(`issue-${roll}`);
    try {
      const res = await serverIssueCourseCertificate({
        data: { courseId: props.courseId, rollNumber: roll },
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
    setBusyId("bulk");
    try {
      const res = await serverBulkIssueCourseCertificates({ data: { courseId: props.courseId } });
      setNotice(
        res.success
          ? `Bulk issued ${res.issuedCount} course certificate(s).`
          : res.error || "Bulk issue failed.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const saveExamMeta = async () => {
    if (!exam) return;
    setBusyId("exam");
    try {
      const res = await serverSavePracticalExam({
        data: {
          exam: {
            ...exam,
            status: "open",
            quizWeightPct: exam.quizWeightPct ?? 40,
            practicalWeightPct: exam.practicalWeightPct ?? 60,
          },
        },
      });
      setNotice(res.success ? "Practical exam saved." : res.error || "Save failed.");
      await refresh();
    } finally {
      setBusyId(null);
    }
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
            Grade practical submissions for {props.courseCode}. Quiz-wise auto certificates are
            disabled — issue industrial course-completion credentials only.
          </p>
        </div>
        <div className="flex gap-2">
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
            disabled={busyId === "bulk"}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
          >
            <Award className="h-3.5 w-3.5" /> Bulk issue eligible
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">{notice}</div>
      )}

      {exam && (
        <div className="rounded-2xl border border-border p-4 space-y-3">
          <div className="text-sm font-bold">{exam.titleEn}</div>
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <label className="font-semibold">
              Quiz weight %
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                value={exam.quizWeightPct ?? 40}
                onChange={(e) =>
                  setExams((prev) =>
                    prev.map((p) =>
                      p.id === exam.id
                        ? { ...p, quizWeightPct: Number(e.target.value) }
                        : p,
                    ),
                  )
                }
              />
            </label>
            <label className="font-semibold">
              Practical weight %
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                value={exam.practicalWeightPct ?? 60}
                onChange={(e) =>
                  setExams((prev) =>
                    prev.map((p) =>
                      p.id === exam.id
                        ? { ...p, practicalWeightPct: Number(e.target.value) }
                        : p,
                    ),
                  )
                }
              />
            </label>
            <label className="font-semibold">
              Pass threshold %
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                value={exam.passThresholdPct ?? 50}
                onChange={(e) =>
                  setExams((prev) =>
                    prev.map((p) =>
                      p.id === exam.id
                        ? { ...p, passThresholdPct: Number(e.target.value) }
                        : p,
                    ),
                  )
                }
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void saveExamMeta()}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold"
          >
            <Save className="h-3.5 w-3.5" /> Save exam settings
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
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void issueOne(sub.rollNumber)}
                  disabled={busyId === `issue-${sub.rollNumber}`}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700"
                >
                  Issue course cert
                </button>
              </div>
              <div className="text-xs space-y-1">
                {sub.answers.map((a) => (
                  <div key={a.taskId} className="rounded-xl bg-muted/40 px-3 py-2">
                    <div>{a.textAnswer || "—"}</div>
                    {a.linkUrl && (
                      <a
                        href={a.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 font-semibold hover:underline"
                      >
                        {a.linkUrl}
                      </a>
                    )}
                    {a.fileName && (
                      <div className="font-mono text-[10px] text-muted-foreground">
                        file: {a.fileName} ({a.fileSizeBytes || 0} bytes)
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {sub.status !== "graded" || true ? (
                <div className="flex flex-wrap gap-2 items-end">
                  <label className="text-xs font-semibold">
                    Marks / {exam?.tasks[0]?.maxMarks ?? 100}
                    <input
                      className="mt-1 block w-28 rounded-lg border border-border bg-background px-2 py-1.5"
                      value={marksBySub[sub.id] ?? String(sub.grades?.[0]?.marks ?? "")}
                      onChange={(e) =>
                        setMarksBySub((m) => ({ ...m, [sub.id]: e.target.value }))
                      }
                    />
                  </label>
                  <label className="text-xs font-semibold flex-1 min-w-[180px]">
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
                    {busyId === sub.id ? "Saving…" : "Save grade"}
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
