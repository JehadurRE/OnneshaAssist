/**
 * LMS learning content — materials, recordings, announcements + Sanjibon seed.
 */
import type {
  CourseAnnouncement,
  CourseMaterial,
  CourseRecording,
} from "./types";
import { SANJIBON_COURSE } from "./sanjibon-seed-data";
import {
  buildSanjibonClassRecordings,
  buildSanjibonDriveMaterials,
  SANJIBON_DRIVE_ROOT_URL,
} from "./sanjibon-drive-materials";

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
  const driveMaterials = buildSanjibonDriveMaterials(courseId);
  const materials: CourseMaterial[] = [
    ...driveMaterials,
    {
      id: "mat-sanjibon-overview",
      courseId,
      sessionLabel: "Overview",
      titleEn: "Course overview — AI for Digital Marketing freelancers",
      titleBn: "কোর্স ওভারভিউ — ডিজিটাল মার্কেটিং ফ্রিল্যান্সারদের জন্য AI",
      descriptionEn: "Learning outcomes, assessment (30+40=70), and workflow map.",
      descriptionBn: "লার্নিং আউটকাম, মূল্যায়ন (৩০+৪০=৭০) এবং ওয়ার্কফ্লো ম্যাপ।",
      type: "note",
      bodyEn:
        "AI-DM-04 teaches applied AI workflows for freelancers: research, brand kits, Meta creatives, ad scripts, short video, and landing pages. Final Exam = 30-mark timed MCQ (overall timer) + 40-mark capstone package. Use the Student Portal for materials, recordings, AI tutor, and practical upload.",
      bodyBn:
        "AI-DM-04 ফ্রিল্যান্সারদের জন্য প্রয়োগযোগ্য AI ওয়ার্কফ্লো শেখায়: রিসার্চ, ব্র্যান্ড কিট, Meta ক্রিয়েটিভ, অ্যাড স্ক্রিপ্ট, শর্ট ভিডিও ও ল্যান্ডিং পেজ। ফাইনাল = ৩০ নম্বরের টাইমড MCQ (মোট টাইমার) + ৪০ নম্বরের ক্যাপস্টোন। ম্যাটেরিয়াল, রেকর্ডিং, AI টিউটর ও প্রায়োগিক জমার জন্য স্টুডেন্ট পোর্টাল ব্যবহার করুন।",
      sortOrder: 12,
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
      sortOrder: 13,
      published: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "mat-sanjibon-tools",
      courseId,
      sessionLabel: "Toolkit",
      titleEn: "Complete Course Google Drive Folder (232 AI Training — All Files)",
      titleBn: "সম্পূর্ণ কোর্স Google Drive ফোল্ডার (২৩২ এআই ট্রেনিং — সকল ফাইল)",
      type: "link",
      url: SANJIBON_DRIVE_ROOT_URL,
      descriptionEn: "Direct access to all 102 course files, slides, handbooks, lesson plans, and visuals on Google Drive.",
      descriptionBn: "Google Drive-এ কোর্সের ১০২টি ফাইল, স্লাইড, হ্যান্ডবুক, লেসন প্ল্যান এবং ভিজ্যুয়াল সরাসরি অ্যাক্সেস করুন।",
      sortOrder: 14,
      published: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const recordings: CourseRecording[] = buildSanjibonClassRecordings(courseId);

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
    const resourceSummary = m.resources?.length
      ? `Resources:\n${m.resources.map((r) => `- ${r.labelEn}: ${r.url}`).join("\n")}`
      : "";
    const body = [m.titleEn, m.titleBn, m.descriptionEn, m.bodyEn, m.bodyBn, m.url, resourceSummary]
      .filter(Boolean)
      .join("\n");
    chunks.push(`### ${m.sessionLabel || "Material"} — ${m.titleEn}\n${body}`);
  }
  const joined = chunks.join("\n\n");
  return joined.length > max ? `${joined.slice(0, max)}\n…[truncated]` : joined;
}
