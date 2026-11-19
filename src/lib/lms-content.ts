/**
 * LMS learning content — materials, recordings, announcements + Sanjibon seed.
 */
import type {
  CourseAnnouncement,
  CourseMaterial,
  CourseRecording,
} from "./types";
import { SANJIBON_COURSE } from "./sanjibon-seed-data";

const now = "2026-11-01T00:00:00.000Z";

export function newLmsId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Default learning pack for AI-DM-04 so portal is never empty after deploy. */
export function buildDefaultSanjibonLmsContent(): {
  materials: CourseMaterial[];
  recordings: CourseRecording[];
  announcements: CourseAnnouncement[];
} {
  const courseId = SANJIBON_COURSE.id;
  const materials: CourseMaterial[] = [
    {
      id: "mat-sanjibon-overview",
      courseId,
      sessionLabel: "Session 01",
      titleEn: "Course overview — AI for Digital Marketing freelancers",
      titleBn: "কোর্স ওভারভিউ — ডিজিটাল মার্কেটিং ফ্রিল্যান্সারদের জন্য AI",
      descriptionEn: "Learning outcomes, assessment (30+40=70), and workflow map.",
      descriptionBn: "লার্নিং আউটকাম, মূল্যায়ন (৩০+৪০=৭০) এবং ওয়ার্কফ্লো ম্যাপ।",
      type: "note",
      bodyEn:
        "AI-DM-04 teaches applied AI workflows for freelancers: research, brand kits, Meta creatives, ad scripts, short video, and landing pages. Final Exam = 30-mark timed MCQ (overall timer) + 40-mark capstone package. Use the Student Portal for materials, recordings, AI tutor, and practical upload.",
      bodyBn:
        "AI-DM-04 ফ্রিল্যান্সারদের জন্য প্রয়োগযোগ্য AI ওয়ার্কফ্লো শেখায়: রিসার্চ, ব্র্যান্ড কিট, Meta ক্রিয়েটিভ, অ্যাড স্ক্রিপ্ট, শর্ট ভিডিও ও ল্যান্ডিং পেজ। ফাইনাল = ৩০ নম্বরের টাইমড MCQ (মোট টাইমার) + ৪০ নম্বরের ক্যাপস্টোন। ম্যাটেরিয়াল, রেকর্ডিং, AI টিউটর ও প্রায়োগিক জমার জন্য স্টুডেন্ট পোর্টাল ব্যবহার করুন।",
      sortOrder: 1,
      published: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "mat-sanjibon-final-brief",
      courseId,
      sessionLabel: "Final",
      titleEn: "Final Exam brief — quiz + capstone checklist",
      titleBn: "ফাইনাল পরীক্ষার ব্রিফ — কুইজ + ক্যাপস্টোন চেকলিস্ট",
      type: "note",
      bodyEn:
        "Part A: Join /final-exam with shared PIN, search mobile, complete MCQ before overall countdown ends. Part B: Submit brand, research, 2 FB creatives, ad script, ~10s video, landing+URL on /portal. AI assistant use is a bonus task when listed.",
      bodyBn:
        "অংশ ক: /final-exam এ PIN দিয়ে যোগ দিন, মোবাইল সার্চ করুন, মোট কাউন্টডাউনের আগে MCQ শেষ করুন। অংশ খ: /portal এ ব্র্যান্ড, রিসার্চ, ২টি FB ক্রিয়েটিভ, অ্যাড স্ক্রিপ্ট, ~১০ সেকেন্ড ভিডিও, ল্যান্ডিং+URL জমা দিন।",
      sortOrder: 2,
      published: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "mat-sanjibon-tools",
      courseId,
      sessionLabel: "Toolkit",
      titleEn: "Recommended tools stack (links)",
      titleBn: "প্রস্তাবিত টুল স্ট্যাক (লিংক)",
      type: "link",
      url: "https://arena.onnesha.courses/portal",
      descriptionEn: "Keep your tool list here — replace URL with your shared Drive/Notion toolkit.",
      descriptionBn: "টুল তালিকা এখানে রাখুন — URL আপনার Drive/Notion টুলকিট দিয়ে বদলান।",
      sortOrder: 3,
      published: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const recordings: CourseRecording[] = [
    {
      id: "rec-sanjibon-welcome",
      courseId,
      sessionLabel: "Session 01",
      titleEn: "Welcome & course walkthrough (replace with your recording)",
      titleBn: "স্বাগতম ও কোর্স ওয়াকথ্রু (আপনার রেকর্ডিং দিয়ে বদলান)",
      descriptionEn: "Paste your YouTube/Drive class recording URL in Admin → Learning Content.",
      descriptionBn: "Admin → Learning Content এ YouTube/Drive ক্লাস রেকর্ডিং URL দিন।",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      provider: "youtube",
      durationMin: 15,
      sortOrder: 1,
      published: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const announcements: CourseAnnouncement[] = [
    {
      id: "ann-sanjibon-portal",
      courseId,
      titleEn: "Student Learning Portal is live",
      titleBn: "স্টুডেন্ট লার্নিং পোর্টাল চালু",
      bodyEn:
        "Use Materials, Recordings, and AI Tutor here. Final Exam desk: /final-exam. Capstone upload stays on this portal.",
      bodyBn:
        "এখানে Materials, Recordings ও AI Tutor ব্যবহার করুন। ফাইনাল ডেস্ক: /final-exam। ক্যাপস্টোন আপলোড এই পোর্টালেই।",
      published: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return { materials, recordings, announcements };
}

export function buildAiTutorContext(params: {
  materials: CourseMaterial[];
  courseTitle?: string | undefined;
  maxChars?: number | undefined;
}): string {
  const max = params.maxChars ?? 12000;
  const chunks: string[] = [];
  if (params.courseTitle) chunks.push(`Course: ${params.courseTitle}`);
  for (const m of params.materials.filter((x) => x.published)) {
    const body = [m.titleEn, m.titleBn, m.descriptionEn, m.bodyEn, m.bodyBn, m.url]
      .filter(Boolean)
      .join("\n");
    chunks.push(`### ${m.sessionLabel || "Material"} — ${m.titleEn}\n${body}`);
  }
  const joined = chunks.join("\n\n");
  return joined.length > max ? `${joined.slice(0, max)}\n…[truncated]` : joined;
}
