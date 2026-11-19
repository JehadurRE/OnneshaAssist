import { describe, expect, it } from "vitest";
import { buildAiTutorContext, buildDefaultSanjibonLmsContent } from "../lms-content";
import { isPracticalWindowOpen } from "../practical-exam";
import type { PracticalExam } from "../types";

describe("LMS seed + AI context", () => {
  it("seeds published Sanjibon materials and recordings", () => {
    const seed = buildDefaultSanjibonLmsContent();
    expect(seed.materials.length).toBeGreaterThan(0);
    expect(seed.recordings.length).toBeGreaterThan(0);
    expect(seed.materials.every((m) => m.published)).toBe(true);
    const ctx = buildAiTutorContext({
      materials: seed.materials,
      courseTitle: "AI-DM-04",
    });
    expect(ctx).toContain("AI-DM-04");
    expect(ctx.toLowerCase()).toContain("final");
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
