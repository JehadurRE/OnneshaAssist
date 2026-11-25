import { describe, expect, it } from "vitest";
import { buildAiTutorContext, buildDefaultSanjibonLmsContent } from "../lms-content";
import { buildDefaultSanjibonKnowledgeBase, retrieveCourseKnowledgeContext } from "../course-kb";
import {
  buildSanjibonClassRecordings,
  buildSanjibonDriveKnowledgeBase,
  buildSanjibonDriveMaterials,
  SANJIBON_DAY5_ZOOM_RECORDING_URL,
  SANJIBON_DRIVE_FILE_COUNT,
  SANJIBON_DRIVE_ROOT_URL,
} from "../sanjibon-drive-materials";
import { isPracticalWindowOpen } from "../practical-exam";
import type { PracticalExam } from "../types";

describe("LMS seed + Google Drive course materials + AI context", () => {
  it("seeds published Sanjibon materials including all 102 Drive files across 12 session packs", () => {
    const seed = buildDefaultSanjibonLmsContent();
    expect(seed.materials.length).toBeGreaterThanOrEqual(15);
    expect(seed.recordings.length).toBeGreaterThan(0);
    expect(seed.materials.every((m) => m.published)).toBe(true);
    expect(seed.recordings.some((r) => r.url.includes("dQw4w9WgXcQ"))).toBe(false);
    const zoomRec = buildSanjibonClassRecordings().find((r) => r.id === "rec-sanjibon-day5-zoom");
    expect(zoomRec?.provider).toBe("zoom");
    expect(zoomRec?.url).toBe(SANJIBON_DAY5_ZOOM_RECORDING_URL);

    const drivePacks = buildSanjibonDriveMaterials();
    expect(drivePacks.length).toBe(12);
    expect(SANJIBON_DRIVE_FILE_COUNT).toBe(102);

    const driveFileLinks = drivePacks.flatMap((m) =>
      (m.resources || []).filter((r) => r.url.startsWith("https://drive.google.com/file/d/")),
    );
    expect(driveFileLinks.length).toBe(102);
    expect(drivePacks[0]?.url).toBe(SANJIBON_DRIVE_ROOT_URL);

    const ctx = buildAiTutorContext({
      materials: seed.materials,
      courseTitle: "AI-DM-04",
      maxChars: 24000,
    });
    expect(ctx).toContain("AI-DM-04");
    expect(ctx.toLowerCase()).toContain("final");
    expect(ctx).toContain("Session 00");
  });

  it("indexes all Drive session handbooks in the dedicated course Knowledge Base", () => {
    const kb = buildDefaultSanjibonKnowledgeBase();
    const driveKb = buildSanjibonDriveKnowledgeBase();
    expect(driveKb.length).toBe(12);
    expect(kb.length).toBeGreaterThanOrEqual(15);

    const retrieved = retrieveCourseKnowledgeContext({
      kbEntries: kb,
      materials: buildSanjibonDriveMaterials(),
      query: "SLABC product photography formula session 03",
    });
    expect(retrieved.totalIndexedDocs).toBeGreaterThanOrEqual(24);
    expect(retrieved.context.toLowerCase()).toContain("slabc");
    expect(retrieved.sourcesUsed.length).toBeGreaterThan(0);
  });
});

describe("separated quiz vs practical windows", () => {
  const base = {
    opensAt: "2026-01-01T00:00:00.000Z",
    closesAt: "2026-12-31T00:00:00.000Z",
    status: "open" as const,
  };

  it("keeps practical open when quizWindowOpen is false but practicalWindowOpen true", () => {
    const exam = {
      ...base,
      quizWindowOpen: false,
      practicalWindowOpen: true,
    } as Pick<PracticalExam, "opensAt" | "closesAt" | "status" | "quizWindowOpen" | "practicalWindowOpen">;
    expect(isPracticalWindowOpen(exam)).toBe(true);
  });

  it("blocks practical when practicalWindowOpen is false", () => {
    const exam = {
      ...base,
      practicalWindowOpen: false,
    } as Pick<PracticalExam, "opensAt" | "closesAt" | "status" | "quizWindowOpen" | "practicalWindowOpen">;
    expect(isPracticalWindowOpen(exam)).toBe(false);
  });
});
