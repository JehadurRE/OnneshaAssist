import React, { useEffect, useMemo, useState } from "react";
import {
  serverAiDraftLmsContent,
  serverAiGenerateCourseKbEntry,
  serverDeleteCourseKnowledgeEntry,
  serverDeleteCourseMaterial,
  serverDeleteCourseRecording,
  serverGetBootstrapData,
  serverSaveCourseAnnouncement,
  serverSaveCourseKnowledgeEntry,
  serverSaveCourseMaterial,
  serverSaveCourseRecording,
} from "@/lib/server-session";
import { newLmsId } from "@/lib/lms-content";
import { COURSE_KB_CATEGORIES } from "@/lib/course-kb";
import type {
  Course,
  CourseAnnouncement,
  CourseKnowledgeCategory,
  CourseKnowledgeEntry,
  CourseMaterial,
  CourseMaterialType,
  CourseRecording,
} from "@/lib/types";
import {
  BookOpen,
  Database,
  Film,
  Loader2,
  Megaphone,
  Pencil,
  Pin,
  Plus,
  Power,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";

export function AdminLmsPanel(props: { courses: Course[]; initialCourseId?: string | undefined }) {
  const [courseId, setCourseId] = useState(
    props.initialCourseId || props.courses[0]?.id || "course-sanjibon-ai-dm",
  );
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [recordings, setRecordings] = useState<CourseRecording[]>([]);
  const [announcements, setAnnouncements] = useState<CourseAnnouncement[]>([]);
  const [kbEntries, setKbEntries] = useState<CourseKnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Dedicated Per-Course Knowledge Base Editor State
  const [kbFormOpen, setKbFormOpen] = useState(false);
  const [kbEditId, setKbEditId] = useState<string | undefined>(undefined);
  const [kbTitleEn, setKbTitleEn] = useState("");
  const [kbTitleBn, setKbTitleBn] = useState("");
  const [kbCategory, setKbCategory] = useState<CourseKnowledgeCategory>("syllabus");
  const [kbTagsCsv, setKbTagsCsv] = useState("");
  const [kbContent, setKbContent] = useState("");
  const [kbPinned, setKbPinned] = useState(false);
  const [kbSourceFile, setKbSourceFile] = useState<string | undefined>(undefined);
  const [kbAiBusy, setKbAiBusy] = useState(false);

  const courseKb = useMemo(
    () =>
      kbEntries
        .filter((k) => k.courseId === courseId)
        .sort(
          (a, b) =>
            Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
            (b.updatedAt || "").localeCompare(a.updatedAt || ""),
        ),
    [kbEntries, courseId],
  );
  const totalKbChars = useMemo(
    () => courseKb.filter((k) => k.enabled).reduce((s, k) => s + k.content.length, 0),
    [courseKb],
  );

  const openNewKbForm = () => {
    setKbEditId(undefined);
    setKbTitleEn("");
    setKbTitleBn("");
    setKbCategory("syllabus");
    setKbTagsCsv("");
    setKbContent("");
    setKbPinned(false);
    setKbSourceFile(undefined);
    setKbFormOpen(true);
  };

  const openEditKbForm = (entry: CourseKnowledgeEntry) => {
    setKbEditId(entry.id);
    setKbTitleEn(entry.titleEn);
    setKbTitleBn(entry.titleBn || "");
    setKbCategory(entry.category);
    setKbTagsCsv((entry.tags || []).join(", "));
    setKbContent(entry.content);
    setKbPinned(Boolean(entry.pinned));
    setKbSourceFile(entry.sourceFileName);
    setKbFormOpen(true);
  };

  const handleKbFileUpload = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      if (!text.trim()) {
        setNotice("Uploaded file is empty.");
        return;
      }
      setKbEditId(undefined);
      setKbTitleEn(file.name.replace(/\.[^.]+$/, ""));
      setKbTitleBn("");
      setKbCategory("reference");
      setKbContent(text.slice(0, 60_000));
      setKbSourceFile(file.name);
      setKbFormOpen(true);
      setNotice(`Loaded "${file.name}" (${text.length.toLocaleString()} chars) — click Save KB Document.`);
    } catch {
      setNotice("Could not read text from file. Use .txt, .md, .csv, or .json.");
    }
  };

  const handleSaveKb = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("kb-save");
    setNotice(null);
    try {
      const res = await serverSaveCourseKnowledgeEntry({
        data: {
          id: kbEditId,
          courseId,
          titleEn: kbTitleEn.trim(),
          titleBn: kbTitleBn.trim() || undefined,
          category: kbCategory,
          content: kbContent.trim(),
          tags: kbTagsCsv
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          sourceFileName: kbSourceFile,
          enabled: true,
          pinned: kbPinned,
        },
      });
      if (!res.success) {
        setNotice(res.error || "Could not save KB document.");
        return;
      }
      setKbFormOpen(false);
      setNotice(kbEditId ? "Updated Course Knowledge Base document." : "Added dedicated document to Course Knowledge Base.");
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const handleAiBuildKbDoc = async () => {
    if (!kbTitleEn.trim() || kbAiBusy) {
      setNotice("Enter a topic/title in Title (EN) first to synthesize a Knowledge Base document with AI.");
      return;
    }
    setKbAiBusy(true);
    setNotice(null);
    try {
      const res = await serverAiGenerateCourseKbEntry({
        data: {
          courseId,
          topic: kbTitleEn.trim(),
          category: kbCategory,
          rawNotes: kbContent.trim() || undefined,
          pinned: kbPinned,
        },
      });
      if (!res.success) {
        setNotice(res.error || "AI Knowledge Base generation failed.");
        return;
      }
      setKbFormOpen(false);
      setNotice(`AI synthesized & saved "${res.entry?.titleEn}" into this course's Knowledge Base (${res.provider} · ${res.model}).`);
      await refresh();
    } finally {
      setKbAiBusy(false);
    }
  };

  // AI Bilingual LMS Authoring Copilot
  const [aiKind, setAiKind] = useState<"material" | "announcement">("material");
  const [aiTopic, setAiTopic] = useState("");
  const [aiSessionLabel, setAiSessionLabel] = useState("Session");
  const [aiExtraNotes, setAiExtraNotes] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const handleAiDraftAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopic.trim() || aiBusy) return;
    setAiBusy(true);
    setNotice(null);
    try {
      const res = await serverAiDraftLmsContent({
        data: {
          courseId,
          kind: aiKind,
          topic: aiTopic.trim(),
          sessionLabel: aiKind === "material" ? aiSessionLabel.trim() || "Session" : undefined,
          extraNotes: aiExtraNotes.trim() || undefined,
        },
      });
      if (!res.success || !res.draft) {
        setNotice(res.error || "AI drafting failed. Check Admin → AI Pool.");
        return;
      }
      const now = new Date().toISOString();
      if (aiKind === "material") {
        const mat: CourseMaterial = {
          id: newLmsId("mat"),
          courseId,
          sessionLabel: aiSessionLabel.trim() || "Session",
          titleEn: res.draft.titleEn,
          titleBn: res.draft.titleBn,
          type: "note",
          bodyEn: res.draft.bodyEn,
          bodyBn: res.draft.bodyBn,
          sortOrder: courseMats.length + 1,
          published: true,
          createdAt: now,
          updatedAt: now,
        };
        await serverSaveCourseMaterial({ data: { material: mat } });
      } else {
        const ann: CourseAnnouncement = {
          id: newLmsId("ann"),
          courseId,
          titleEn: res.draft.titleEn,
          titleBn: res.draft.titleBn,
          bodyEn: res.draft.bodyEn,
          bodyBn: res.draft.bodyBn,
          published: true,
          createdAt: now,
          updatedAt: now,
        };
        await serverSaveCourseAnnouncement({ data: { announcement: ann } });
      }
      setAiTopic("");
      setAiExtraNotes("");
      setNotice(
        `AI drafted & published bilingual ${aiKind} via ${res.draft.nodeLabel} (${res.draft.model}, ${res.draft.latencyMs}ms).`,
      );
      await refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "AI LMS authoring failed.");
    } finally {
      setAiBusy(false);
    }
  };

  const courseMats = useMemo(
    () => materials.filter((m) => m.courseId === courseId).sort((a, b) => a.sortOrder - b.sortOrder),
    [materials, courseId],
  );
  const courseRecs = useMemo(
    () =>
      recordings.filter((m) => m.courseId === courseId).sort((a, b) => a.sortOrder - b.sortOrder),
    [recordings, courseId],
  );
  const courseAnns = useMemo(
    () =>
      announcements
        .filter((m) => m.courseId === courseId)
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    [announcements, courseId],
  );

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await serverGetBootstrapData();
      if (res.success) {
        setMaterials((res.courseMaterials as CourseMaterial[]) || []);
        setRecordings((res.courseRecordings as CourseRecording[]) || []);
        setAnnouncements((res.courseAnnouncements as CourseAnnouncement[]) || []);
        setKbEntries((res.courseKnowledgeBase as CourseKnowledgeEntry[]) || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const blankMaterial = (): CourseMaterial => {
    const now = new Date().toISOString();
    return {
      id: newLmsId("mat"),
      courseId,
      sessionLabel: "Session",
      titleEn: "New material",
      titleBn: "নতুন ম্যাটেরিয়াল",
      type: "note",
      bodyEn: "",
      bodyBn: "",
      sortOrder: courseMats.length + 1,
      published: true,
      createdAt: now,
      updatedAt: now,
    };
  };

  const blankRecording = (): CourseRecording => {
    const now = new Date().toISOString();
    return {
      id: newLmsId("rec"),
      courseId,
      sessionLabel: "Session",
      titleEn: "Class recording",
      titleBn: "ক্লাস রেকর্ডিং",
      url: "https://",
      provider: "youtube",
      sortOrder: courseRecs.length + 1,
      published: true,
      createdAt: now,
      updatedAt: now,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading learning content…
      </div>
    );
  }

  return (
    <div className="space-y-6 staff-surface">
      <div className="staff-panel-header !border-0 !pb-0 !mb-0">
        <div>
          <h2 className="staff-panel-title">Learning Content (LMS)</h2>
          <p className="staff-panel-desc">
            Materials, recordings, and announcements for the Student Portal. AI Tutor grounds answers
            in published material notes/bodies.
          </p>
        </div>
      </div>

      <label className="staff-field max-w-xl">
        <span className="staff-label">Course</span>
        <select className="staff-input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
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

      {/* DEDICATED PER-COURSE KNOWLEDGE BASE STUDIO */}
      <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-emerald-500/5 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-black text-foreground">
                  Dedicated Course Knowledge Base
                </h3>
                <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                  {courseKb.filter((k) => k.enabled).length} Active Docs ·{" "}
                  {(totalKbChars / 1000).toFixed(1)}k Chars
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Documents stored here exclusively ground the Student AI Tutor and Floating AI Assist
                widget for this course (alongside published LMS materials &amp; practical rubrics).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer staff-btn-ghost text-xs">
              <Upload className="h-3.5 w-3.5 text-primary" />
              <span>Upload .txt / .md</span>
              <input
                type="file"
                accept=".txt,.md,.markdown,.csv,.json,text/plain,text/markdown"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  void handleKbFileUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={openNewKbForm}
              className="staff-btn-primary text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add KB Document</span>
            </button>
          </div>
        </div>

        {kbFormOpen && (
          <form
            onSubmit={handleSaveKb}
            className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-black uppercase tracking-wider text-primary">
                {kbEditId ? "Edit Knowledge Base Document" : "New Course Knowledge Base Document"}
              </span>
              <button
                type="button"
                onClick={() => setKbFormOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <input
                type="text"
                required
                value={kbTitleEn}
                onChange={(e) => setKbTitleEn(e.target.value)}
                placeholder="Document Title (EN) — e.g. Session 04 Prompting Cheat-Sheet *"
                className="sm:col-span-5 staff-input text-xs font-semibold"
              />
              <input
                type="text"
                value={kbTitleBn}
                onChange={(e) => setKbTitleBn(e.target.value)}
                placeholder="বাংলা শিরোনাম (ঐচ্ছিক)"
                className="sm:col-span-4 staff-input text-xs"
              />
              <select
                value={kbCategory}
                onChange={(e) => setKbCategory(e.target.value as CourseKnowledgeCategory)}
                className="sm:col-span-3 staff-input text-xs font-bold"
              >
                {COURSE_KB_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={6}
              required
              value={kbContent}
              onChange={(e) => setKbContent(e.target.value)}
              placeholder="Paste syllabus details, lecture notes, FAQs, grading rubric, tool workflows, or policies in English and/or Bengali…"
              className="staff-input min-h-[140px] text-xs leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[220px]">
                <input
                  type="text"
                  value={kbTagsCsv}
                  onChange={(e) => setKbTagsCsv(e.target.value)}
                  placeholder="Tags (comma separated, e.g. final exam, video, rubric)"
                  className="staff-input text-xs flex-1 max-w-xs"
                />
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kbPinned}
                    onChange={(e) => setKbPinned(e.target.checked)}
                    className="h-4 w-4 accent-primary rounded"
                  />
                  <span>Pin (Always include in AI context)</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={kbAiBusy || !kbTitleEn.trim()}
                  onClick={() => void handleAiBuildKbDoc()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-500/15 px-3 py-2 text-xs font-extrabold text-violet-700 hover:bg-violet-500/25 transition disabled:opacity-50 dark:text-violet-300"
                  title="Have AI Pool expand Title + rough notes into a complete bilingual KB document"
                >
                  {kbAiBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                  <span>{kbAiBusy ? "Synthesizing…" : "AI Expand & Save"}</span>
                </button>
                <button
                  type="submit"
                  disabled={busy === "kb-save"}
                  className="staff-btn-primary text-xs"
                >
                  {busy === "kb-save" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>Save KB Document</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {courseKb.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-5 text-center text-xs text-muted-foreground">
            No dedicated Knowledge Base documents added for this course yet. Add syllabus guides,
            FAQs, or upload `.txt`/`.md` notes so students get hyper-accurate AI answers for this
            course.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {courseKb.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-2xl border p-3.5 bg-card space-y-2 transition ${
                  entry.enabled ? "border-border shadow-xs" : "border-border/50 opacity-65"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary">
                        {entry.category.replace("_", " ")}
                      </span>
                      {entry.pinned && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          <Pin className="h-2.5 w-2.5" /> Pinned
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {entry.content.length.toLocaleString()} chars
                      </span>
                    </div>
                    <h4 className="font-display text-xs font-extrabold text-foreground truncate">
                      {entry.titleEn}
                    </h4>
                    {entry.titleBn && (
                      <p className="text-[11px] text-muted-foreground truncate">{entry.titleBn}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        setBusy(entry.id);
                        try {
                          await serverSaveCourseKnowledgeEntry({
                            data: {
                              id: entry.id,
                              courseId: entry.courseId,
                              titleEn: entry.titleEn,
                              titleBn: entry.titleBn,
                              category: entry.category,
                              content: entry.content,
                              tags: entry.tags,
                              enabled: !entry.enabled,
                              pinned: entry.pinned,
                            },
                          });
                          await refresh();
                        } finally {
                          setBusy(null);
                        }
                      }}
                      className={`rounded-lg border p-1.5 ${
                        entry.enabled
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                          : "border-border text-muted-foreground"
                      }`}
                      title={entry.enabled ? "Disable from AI context" : "Enable in AI context"}
                    >
                      <Power className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditKbForm(entry)}
                      className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"
                      title="Edit KB document"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Delete KB document "${entry.titleEn}"?`)) return;
                        setBusy(entry.id);
                        try {
                          await serverDeleteCourseKnowledgeEntry({ data: { id: entry.id } });
                          await refresh();
                        } finally {
                          setBusy(null);
                        }
                      }}
                      className="rounded-lg border border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10"
                      title="Delete KB document"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {entry.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* AI Bilingual LMS Authoring Copilot */}
      <form
        onSubmit={handleAiDraftAndSave}
        className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-card to-primary/5 p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-extrabold text-foreground">
                AI Bilingual LMS Authoring Copilot
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Generate structured English + Bengali study notes or notices via the AI Pool (also
                grounds the Student AI Tutor).
              </p>
            </div>
          </div>
          <div className="flex rounded-xl border border-border bg-background p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setAiKind("material")}
              className={`rounded-lg px-2.5 py-1 transition ${
                aiKind === "material"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Study Material
            </button>
            <button
              type="button"
              onClick={() => setAiKind("announcement")}
              className={`rounded-lg px-2.5 py-1 transition ${
                aiKind === "announcement"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Announcement
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          {aiKind === "material" && (
            <input
              type="text"
              value={aiSessionLabel}
              onChange={(e) => setAiSessionLabel(e.target.value)}
              placeholder="Session 06"
              className="sm:col-span-2 staff-input text-xs font-semibold"
            />
          )}
          <input
            type="text"
            required
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder={
              aiKind === "material"
                ? "Topic (e.g. Prompt Engineering Frameworks & Veo Video Ads Workflow)"
                : "Notice subject (e.g. Final Exam Schedule & Capstone Submission Rules)"
            }
            className={`${aiKind === "material" ? "sm:col-span-5" : "sm:col-span-7"} staff-input text-xs`}
          />
          <input
            type="text"
            value={aiExtraNotes}
            onChange={(e) => setAiExtraNotes(e.target.value)}
            placeholder="Optional key points / deadlines…"
            className="sm:col-span-3 staff-input text-xs"
          />
          <button
            type="submit"
            disabled={aiBusy || !aiTopic.trim()}
            className="sm:col-span-2 staff-btn-primary text-xs !justify-center disabled:opacity-50"
          >
            {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            <span>{aiBusy ? "Drafting…" : "AI Draft"}</span>
          </button>
        </div>
      </form>

      <section className="staff-row-card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <BookOpen className="h-4 w-4" /> Materials ({courseMats.length})
          </div>
          <button
            type="button"
            className="staff-btn-ghost"
            onClick={async () => {
              const m = blankMaterial();
              setBusy("mat-new");
              try {
                const res = await serverSaveCourseMaterial({ data: { material: m } });
                setNotice(res.success ? "Material added." : res.error || "Failed");
                await refresh();
              } finally {
                setBusy(null);
              }
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add material
          </button>
        </div>
        {courseMats.map((m) => (
          <MaterialEditor
            key={m.id}
            material={m}
            busy={busy === m.id}
            onChange={(next) =>
              setMaterials((prev) => prev.map((x) => (x.id === next.id ? next : x)))
            }
            onSave={async () => {
              setBusy(m.id);
              try {
                const res = await serverSaveCourseMaterial({ data: { material: m } });
                setNotice(res.success ? "Material saved." : res.error || "Save failed");
                await refresh();
              } finally {
                setBusy(null);
              }
            }}
            onDelete={async () => {
              if (!window.confirm("Delete this material?")) return;
              setBusy(m.id);
              try {
                await serverDeleteCourseMaterial({ data: { id: m.id } });
                await refresh();
              } finally {
                setBusy(null);
              }
            }}
          />
        ))}
      </section>

      <section className="staff-row-card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Film className="h-4 w-4" /> Recordings ({courseRecs.length})
          </div>
          <button
            type="button"
            className="staff-btn-ghost"
            onClick={async () => {
              const r = blankRecording();
              setBusy("rec-new");
              try {
                const res = await serverSaveCourseRecording({ data: { recording: r } });
                setNotice(res.success ? "Recording added." : res.error || "Failed");
                await refresh();
              } finally {
                setBusy(null);
              }
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add recording
          </button>
        </div>
        {courseRecs.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              <label className="font-semibold">
                Title EN
                <input
                  className="mt-1 staff-input"
                  value={r.titleEn}
                  onChange={(e) =>
                    setRecordings((prev) =>
                      prev.map((x) => (x.id === r.id ? { ...x, titleEn: e.target.value } : x)),
                    )
                  }
                />
              </label>
              <label className="font-semibold">
                Title BN
                <input
                  className="mt-1 staff-input"
                  value={r.titleBn}
                  onChange={(e) =>
                    setRecordings((prev) =>
                      prev.map((x) => (x.id === r.id ? { ...x, titleBn: e.target.value } : x)),
                    )
                  }
                />
              </label>
              <label className="font-semibold sm:col-span-2">
                URL (YouTube / Drive)
                <input
                  className="mt-1 staff-input font-mono"
                  value={r.url}
                  onChange={(e) =>
                    setRecordings((prev) =>
                      prev.map((x) => (x.id === r.id ? { ...x, url: e.target.value } : x)),
                    )
                  }
                />
              </label>
              <label className="inline-flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={r.published}
                  onChange={(e) =>
                    setRecordings((prev) =>
                      prev.map((x) => (x.id === r.id ? { ...x, published: e.target.checked } : x)),
                    )
                  }
                />
                Published
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="staff-btn-primary"
                disabled={busy === r.id}
                onClick={async () => {
                  setBusy(r.id);
                  try {
                    const latest = recordings.find((x) => x.id === r.id) || r;
                    const res = await serverSaveCourseRecording({ data: { recording: latest } });
                    setNotice(res.success ? "Recording saved." : res.error || "Save failed");
                    await refresh();
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <Save className="h-3.5 w-3.5" /> Save
              </button>
              <button
                type="button"
                className="staff-btn-ghost text-destructive"
                onClick={async () => {
                  if (!window.confirm("Delete recording?")) return;
                  await serverDeleteCourseRecording({ data: { id: r.id } });
                  await refresh();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="staff-row-card space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Megaphone className="h-4 w-4" /> Announcements
        </div>
        <button
          type="button"
          className="staff-btn-ghost"
          onClick={async () => {
            const now = new Date().toISOString();
            const a: CourseAnnouncement = {
              id: newLmsId("ann"),
              courseId,
              titleEn: "Announcement",
              titleBn: "ঘোষণা",
              bodyEn: "",
              bodyBn: "",
              published: true,
              createdAt: now,
              updatedAt: now,
            };
            await serverSaveCourseAnnouncement({ data: { announcement: a } });
            await refresh();
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Post announcement
        </button>
        {courseAnns.map((a) => (
          <div key={a.id} className="rounded-xl border border-border px-3 py-2 text-xs">
            <div className="font-bold">{a.titleEn}</div>
            <div className="text-muted-foreground">{a.bodyEn || "—"}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

function MaterialEditor(props: {
  material: CourseMaterial;
  busy: boolean;
  onChange: (m: CourseMaterial) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const m = props.material;
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
      <div className="grid sm:grid-cols-2 gap-2 text-xs">
        <label className="font-semibold">
          Title EN
          <input
            className="mt-1 staff-input"
            value={m.titleEn}
            onChange={(e) => props.onChange({ ...m, titleEn: e.target.value })}
          />
        </label>
        <label className="font-semibold">
          Title BN
          <input
            className="mt-1 staff-input"
            value={m.titleBn}
            onChange={(e) => props.onChange({ ...m, titleBn: e.target.value })}
          />
        </label>
        <label className="font-semibold">
          Type
          <select
            className="mt-1 staff-input"
            value={m.type}
            onChange={(e) =>
              props.onChange({ ...m, type: e.target.value as CourseMaterialType })
            }
          >
            {(["note", "pdf", "link", "slide", "other"] as CourseMaterialType[]).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="font-semibold">
          Session
          <input
            className="mt-1 staff-input"
            value={m.sessionLabel || ""}
            onChange={(e) => props.onChange({ ...m, sessionLabel: e.target.value })}
          />
        </label>
        <label className="font-semibold sm:col-span-2">
          URL (optional)
          <input
            className="mt-1 staff-input font-mono"
            value={m.url || ""}
            onChange={(e) => props.onChange({ ...m, url: e.target.value })}
          />
        </label>
        <label className="font-semibold sm:col-span-2">
          Body EN (AI tutor grounding)
          <textarea
            className="mt-1 staff-input"
            rows={3}
            value={m.bodyEn || ""}
            onChange={(e) => props.onChange({ ...m, bodyEn: e.target.value })}
          />
        </label>
        <label className="font-semibold sm:col-span-2">
          Body BN
          <textarea
            className="mt-1 staff-input"
            rows={2}
            value={m.bodyBn || ""}
            onChange={(e) => props.onChange({ ...m, bodyBn: e.target.value })}
          />
        </label>
        <label className="inline-flex items-center gap-2 font-semibold">
          <input
            type="checkbox"
            checked={m.published}
            onChange={(e) => props.onChange({ ...m, published: e.target.checked })}
          />
          Published on portal
        </label>
      </div>
      <div className="flex gap-2">
        <button type="button" className="staff-btn-primary" disabled={props.busy} onClick={props.onSave}>
          <Save className="h-3.5 w-3.5" /> Save
        </button>
        <button type="button" className="staff-btn-ghost text-destructive" onClick={props.onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
