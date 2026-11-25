import type {
  Course,
  CourseAnnouncement,
  CourseKnowledgeCategory,
  CourseKnowledgeEntry,
  CourseMaterial,
  CourseRecording,
  PracticalExam,
} from "./types";
import { SANJIBON_COURSE } from "./sanjibon-seed-data";
import { buildSanjibonDriveKnowledgeBase } from "./sanjibon-drive-materials";

export const COURSE_KB_CATEGORIES: Array<{
  id: CourseKnowledgeCategory;
  labelEn: string;
  labelBn: string;
}> = [
  { id: "syllabus", labelEn: "Syllabus & Curriculum", labelBn: "সিলেবাস ও কারিকুলাম" },
  { id: "lecture_notes", labelEn: "Lecture Notes", labelBn: "লেকচার নোট" },
  { id: "practical_rubric", labelEn: "Practical & Capstone Rubric", labelBn: "প্র্যাকটিক্যাল রুব্রিক" },
  { id: "faq", labelEn: "Student FAQ", labelBn: "শিক্ষার্থী প্রশ্নোত্তর (FAQ)" },
  { id: "toolkit", labelEn: "Tools & Workflows", labelBn: "টুলস ও ওয়ার্কফ্লো" },
  { id: "policy", labelEn: "Exam & Grading Policy", labelBn: "পরীক্ষা ও মার্কিং নীতি" },
  { id: "reference", labelEn: "Reference Guide", labelBn: "রেফারেন্স গাইড" },
];

export interface RetrievedKnowledgeSource {
  id: string;
  title: string;
  kind: "kb" | "material" | "practical" | "recording" | "announcement" | "platform";
}

export interface RetrievedKnowledgeContext {
  context: string;
  sourcesUsed: RetrievedKnowledgeSource[];
  totalIndexedDocs: number;
  totalIndexedChars: number;
}

const SEED_TS = "2026-11-01T00:00:00.000Z";

export function buildDefaultSanjibonKnowledgeBase(): CourseKnowledgeEntry[] {
  const courseId = SANJIBON_COURSE.id;
  return [
    {
      id: "kb-sanjibon-assessment-policy",
      courseId,
      titleEn: "AI-DM-04 Assessment & Certification Handbook (30 + 40 = 70)",
      titleBn: "AI-DM-04 মূল্যায়ন ও সার্টিফিকেশন গাইডবুক (৩০ + ৪০ = ৭০)",
      category: "policy",
      pinned: true,
      enabled: true,
      tags: ["final exam", "marks", "certificate", "passing", "grading"],
      content: `Course: ${SANJIBON_COURSE.titleEn} (${SANJIBON_COURSE.code})
Assessment Structure:
- Part A (Final Timed MCQ Quiz): 30 Marks. Students join /final-exam with the shared classroom PIN, verify their mobile/roll number, and complete the entire MCQ paper before the overall countdown expires.
- Part B (Final Practical Capstone Package): 40 Marks. Submitted via the Student Learning Portal (/portal → Practical tab).
- Total Score: 70 Marks (Quiz /30 + Practical /40).
- Certification: Official verifiable course completion certificates (with cryptographic QR seal on /verify) are issued once both Part A and Part B are graded and pass threshold is met.`,
      createdBy: "System Seed",
      createdAt: SEED_TS,
      updatedAt: SEED_TS,
    },
    {
      id: "kb-sanjibon-capstone-rubric",
      courseId,
      titleEn: "Practical Capstone Submission Checklist & Grading Tips",
      titleBn: "প্রায়োগিক ক্যাপস্টোন সাবমিশন চেকলিস্ট ও গ্রেডিং টিপস",
      category: "practical_rubric",
      pinned: true,
      enabled: true,
      tags: ["capstone", "practical", "submission", "video", "landing page", "creatives"],
      content: `Final Practical Capstone Deliverables (Submitted on /portal):
1. Brand Identity & Target Audience Research: Clear niche, ICP persona, tone of voice, and value proposition.
2. Facebook / Meta Ad Creatives (2 visuals): High-contrast, clear Bengali/English hook, clean typography, strong CTA.
3. Ad Copy & Short Video Script: Problem-Agitate-Solve (PAS) or Hook-Body-CTA structure tailored for Bangladeshi buyers.
4. Short Promotional Video (~10s): Product visual consistency using Start Frame / End Frame chaining and accurate Bangla voiceover/phonetic spelling where needed.
5. Landing Page / Live URL: Functional conversion-focused page link (publicly accessible so examiners can verify).
Submission Tip: Always double-check that Google Drive / Canva / live landing URLs are set to "Anyone with the link can view" before submitting.`,
      createdBy: "System Seed",
      createdAt: SEED_TS,
      updatedAt: SEED_TS,
    },
    {
      id: "kb-sanjibon-portal-faq",
      courseId,
      titleEn: "Student Portal Login, OTP & Troubleshooting FAQ",
      titleBn: "স্টুডেন্ট পোর্টাল লগইন, OTP ও সমস্যা সমাধান (FAQ)",
      category: "faq",
      pinned: false,
      enabled: true,
      tags: ["login", "otp", "email", "mobile", "portal", "roll"],
      content: `Frequently Asked Questions:
- How do I log into the Student Portal (/portal)? Enter your registered email address (or mobile number if SMS OTP is enabled by Admin), request a 6-digit OTP, and verify. No password is needed for students.
- Where do I take regular live quizzes? Go to /play and enter the 6-digit Host PIN given by your instructor.
- Where do I take the Final Exam MCQ? Go to /final-exam and enter the shared Final Exam PIN when the exam window is open.
- Where can I verify or download my certificate? Either inside /portal → Certificate tab or publicly at /verify/<certificate-number>.`,
      createdBy: "System Seed",
      createdAt: SEED_TS,
      updatedAt: SEED_TS,
    },
    ...buildSanjibonDriveKnowledgeBase(courseId),
  ];
}

function tokenizeBilingual(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
}

interface SearchableDoc {
  id: string;
  title: string;
  kind: RetrievedKnowledgeSource["kind"];
  text: string;
  pinned?: boolean;
}

function scoreDocAgainstQuery(doc: SearchableDoc, queryTokens: string[]): number {
  if (queryTokens.length === 0) return doc.pinned ? 10 : 1;
  const hayTitle = doc.title.toLowerCase();
  const hayBody = doc.text.toLowerCase();
  let score = doc.pinned ? 6 : 0;
  for (const tok of queryTokens) {
    if (hayTitle.includes(tok)) score += 5;
    if (hayBody.includes(tok)) score += 2;
  }
  return score;
}

/**
 * Dedicated Per-Course RAG Context Retriever.
 * Combines a course's dedicated Knowledge Base entries, published LMS materials,
 * practical exam rubric/tasks, recordings, and announcements, ranking the most
 * relevant sections for the student's question while returning source citations.
 */
export function retrieveCourseKnowledgeContext(params: {
  course?: Course | undefined;
  kbEntries: CourseKnowledgeEntry[];
  materials: CourseMaterial[];
  recordings?: CourseRecording[] | undefined;
  announcements?: CourseAnnouncement[] | undefined;
  practicalExam?: PracticalExam | undefined;
  query: string;
  maxChars?: number | undefined;
}): RetrievedKnowledgeContext {
  const maxChars = params.maxChars ?? 14_000;
  const docs: SearchableDoc[] = [];

  // 1. Dedicated Course Knowledge Base Entries (highest fidelity)
  for (const entry of params.kbEntries) {
    if (!entry.enabled || !entry.content.trim()) continue;
    const tagLine = entry.tags?.length ? `Tags: ${entry.tags.join(", ")}\n` : "";
    const bnLine = entry.titleBn ? ` (${entry.titleBn})` : "";
    docs.push({
      id: entry.id,
      title: entry.titleEn,
      kind: "kb",
      pinned: Boolean(entry.pinned),
      text: `### [Course KB · ${entry.category}] ${entry.titleEn}${bnLine}\n${tagLine}${entry.content.trim()}`,
    });
  }

  // 2. Published LMS Materials
  for (const m of params.materials) {
    if (!m.published) continue;
    const resLine = m.resources?.length
      ? `Attached Files/Links: ${m.resources.map((r) => `${r.labelEn} (${r.url})`).join("; ")}`
      : "";
    const body = [m.titleEn, m.titleBn, m.descriptionEn, m.descriptionBn, m.bodyEn, m.bodyBn, m.url, resLine]
      .filter(Boolean)
      .join("\n");
    if (!body.trim()) continue;
    docs.push({
      id: m.id,
      title: `${m.sessionLabel ? `${m.sessionLabel}: ` : ""}${m.titleEn}`,
      kind: "material",
      text: `### [LMS Material · ${m.sessionLabel || "Session"}] ${m.titleEn}\n${body}`,
    });
  }

  // 3. Practical Exam Rubric & Tasks (if course has one)
  if (params.practicalExam && params.practicalExam.tasks.length > 0) {
    const ex = params.practicalExam;
    const taskLines = ex.tasks
      .map(
        (t, idx) =>
          `${idx + 1}. ${t.titleEn} (${t.maxMarks} marks): ${t.promptEn}${t.promptBn ? ` / ${t.promptBn}` : ""}`,
      )
      .join("\n");
    docs.push({
      id: ex.id,
      title: `Practical Exam: ${ex.titleEn}`,
      kind: "practical",
      pinned: true,
      text: `### [Practical Exam Rubric] ${ex.titleEn}\nStatus: ${ex.status} | Quiz Max: ${ex.quizMaxMarks ?? 30} | Practical Max: ${ex.practicalMaxMarks ?? 40} | Total: ${ex.totalMaxMarks ?? 70}\nTasks:\n${taskLines}`,
    });
  }

  // 4. Published Class Recordings Index
  const pubRecs = (params.recordings || []).filter((r) => r.published);
  if (pubRecs.length > 0) {
    const recLines = pubRecs
      .map(
        (r) =>
          `- ${r.sessionLabel || "Class"}: ${r.titleEn}${r.titleBn ? ` (${r.titleBn})` : ""}${r.durationMin ? ` [${r.durationMin} min]` : ""}${r.url ? ` — ${r.url}` : ""}`,
      )
      .join("\n");
    docs.push({
      id: `recs-${params.course?.id || "course"}`,
      title: "Class Recordings Index",
      kind: "recording",
      text: `### [Published Class Recordings]\n${recLines}`,
    });
  }

  // 5. Recent Published Announcements
  const pubAnns = (params.announcements || []).filter((a) => a.published).slice(0, 5);
  if (pubAnns.length > 0) {
    const annLines = pubAnns
      .map((a) => `- ${a.titleEn}: ${a.bodyEn}${a.bodyBn ? ` | ${a.bodyBn}` : ""}`)
      .join("\n");
    docs.push({
      id: `anns-${params.course?.id || "course"}`,
      title: "Course Announcements",
      kind: "announcement",
      text: `### [Course Announcements]\n${annLines}`,
    });
  }

  const totalIndexedDocs = docs.length;
  const totalIndexedChars = docs.reduce((s, d) => s + d.text.length, 0);

  const queryTokens = tokenizeBilingual(params.query);
  const ranked = [...docs]
    .map((doc) => ({ doc, score: scoreDocAgainstQuery(doc, queryTokens) }))
    .sort((a, b) => b.score - a.score);

  const header = params.course
    ? `COURSE PROFILE:\nCode: ${params.course.code}\nTitle (EN): ${params.course.titleEn}\nTitle (BN): ${params.course.titleBn}\nCategory: ${params.course.categoryEn}\nDescription: ${params.course.descriptionEn || ""}`
    : "";

  const chosenChunks: string[] = header ? [header] : [];
  const sourcesUsed: RetrievedKnowledgeSource[] = [];
  let charBudget = maxChars - header.length;

  for (const { doc } of ranked) {
    if (charBudget <= 250) break;
    const chunk =
      doc.text.length <= charBudget
        ? doc.text
        : `${doc.text.slice(0, Math.max(200, charBudget - 20))}\n…[trimmed]`;
    chosenChunks.push(chunk);
    sourcesUsed.push({ id: doc.id, title: doc.title, kind: doc.kind });
    charBudget -= chunk.length + 2;
  }

  return {
    context: chosenChunks.join("\n\n"),
    sourcesUsed,
    totalIndexedDocs,
    totalIndexedChars,
  };
}

export function buildPlatformSupportContext(courses: Course[]): string {
  const courseList =
    courses.length > 0
      ? courses
          .map((c) => `- [${c.code}] ${c.titleEn} (${c.titleBn}) — ${c.categoryEn}`)
          .join("\n")
      : "- Institutional courses managed by faculty.";

  return `ONNESHA ARENA PLATFORM SUPPORT KNOWLEDGE BASE:
Platform: Onnesha Arena — Institutional AI Examination, Student Portal & Verifiable Certification Engine (English + Bengali).

Key Navigation & Workflows:
1. Join Live Quiz (/play): Students enter the 6-digit Host PIN provided by their instructor, select/search their roll or mobile number, and participate in real-time assessments.
2. Student Learning Portal (/portal): Students sign in with their registered email (or mobile) + 6-digit OTP (no password needed). Inside the portal they access Course Materials, Class Recordings, Dedicated Course AI Tutor, Quiz Progress, Practical Capstone Submission upload, and Course Certificates.
3. Final Examination Desk (/final-exam): Timed Final MCQ exam with shared classroom PIN and overall countdown timer.
4. Public Certificate Verification (/verify/<cert-id>): Anyone (employers, guardians, institutions) can scan the QR code or enter a certificate number to verify authenticity and cryptographic ledger proofs.
5. Knowledge Vault (/vault): Free curated study packs and solution keys for exam preparation.
6. Fullscreen Exam Timer (/timer): Distraction-free classroom countdown clock for offline or hybrid mock halls.
7. Instructor Studio (/dashboard) & Super Admin Console (/admin): Course & Quiz Builder, AI Assessment Generator, Multi-Provider AI Pool (OpenRouter, Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI, Together, Custom/Ollama), Practical Grading Desk, Gradesheet CSV/PDF export, OMR sheet generator, and Certificate Designer.

Available Public Courses on Platform:
${courseList}

Strict Academic Integrity Policy:
- Never provide direct answers to an active live exam question. Always encourage genuine learning and direct students to study materials and revision strategies.`;
}

/**
 * Exam Integrity Guard: Suppresses the floating AI assistant widget on live examination routes
 * so students cannot invoke AI chat while taking a live quiz or timed final MCQ exam.
 */
export function shouldSuppressFloatingAiChat(pathname: string): boolean {
  const clean = (pathname || "/").toLowerCase();
  return (
    clean === "/play" ||
    clean.startsWith("/play/") ||
    clean === "/final-exam" ||
    clean.startsWith("/final-exam/") ||
    clean === "/final-exam-live" ||
    clean.startsWith("/final-exam-live/") ||
    clean.startsWith("/host/")
  );
}
