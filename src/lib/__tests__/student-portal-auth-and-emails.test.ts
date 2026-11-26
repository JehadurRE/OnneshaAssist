import { describe, expect, it } from "vitest";
import {
  authenticateRosterStudentPasswordInStore,
  findRosterStudentByIdentifier,
} from "../server-session";
import {
  generateStudentTempPassword,
  hashPasswordScrypt,
  maskEmailAddress,
  maskPhoneNumber,
  sanitizeRosterStudentForClient,
} from "../server-security";
import {
  buildCourseCertificateEmail,
  buildEmailBrandContext,
  buildPasswordChangedEmail,
  buildPasswordResetOtpEmail,
  buildPortalOtpEmail,
  buildQuizCertificateEmail,
  buildSampleEmailTemplate,
  buildStudentCredentialsEmail,
  EMAIL_TEMPLATE_CATALOG,
} from "../email-templates";
import { DEFAULT_BRANDING_SETTINGS, mergeBrandingSettings } from "../branding";
import type { RosterStudent } from "../types";

describe("Student Portal username/email + password authentication", () => {
  const sampleRoster: RosterStudent[] = [
    {
      id: "std-1",
      rollNumber: "GZP-01",
      name: "Md. Sifatul Islam Bhuiya",
      email: "sifat.islam888@gmail.com",
      username: "sifat.gzp01",
      phone: "01817512835",
      regionId: "reg-gazipur",
      regionName: "Gazipur Training Centre",
      passwordHash: hashPasswordScrypt("MySecret#2026"),
      mustChangePassword: false,
    },
    {
      id: "std-2",
      rollNumber: "GZP-02",
      name: "Lemon Kazi",
      email: "limonkaji6@gmail.com",
      phone: "01760024480",
      regionId: "reg-gazipur",
      regionName: "Gazipur Training Centre",
    },
  ];

  it("resolves roster students by email, custom username, roll ID, or BD mobile", () => {
    expect(findRosterStudentByIdentifier(sampleRoster, "SIFAT.ISLAM888@GMAIL.COM")?.id).toBe(
      "std-1",
    );
    expect(findRosterStudentByIdentifier(sampleRoster, "SIFAT.GZP01")?.id).toBe("std-1");
    expect(findRosterStudentByIdentifier(sampleRoster, "gzp01")?.id).toBe("std-1");
    expect(findRosterStudentByIdentifier(sampleRoster, "GZP-01")?.id).toBe("std-1");
    expect(findRosterStudentByIdentifier(sampleRoster, "+8801817512835")?.id).toBe("std-1");
    expect(findRosterStudentByIdentifier(sampleRoster, "unknown-student")).toBeUndefined();
  });

  it("authenticates valid scrypt password and rejects wrong password or unset account cleanly", () => {
    const store = { roster: sampleRoster.map((s) => ({ ...s })) };

    const okByEmail = authenticateRosterStudentPasswordInStore(
      store,
      "sifat.islam888@gmail.com",
      "MySecret#2026",
    );
    expect(okByEmail.success).toBe(true);
    if (okByEmail.success) {
      expect(okByEmail.student.rollNumber).toBe("GZP-01");
      expect(okByEmail.rehashed).toBe(false);
    }

    const okByRoll = authenticateRosterStudentPasswordInStore(store, "gzp-01", "MySecret#2026");
    expect(okByRoll.success).toBe(true);

    const okByUsername = authenticateRosterStudentPasswordInStore(
      store,
      "sifat.gzp01",
      "MySecret#2026",
    );
    expect(okByUsername.success).toBe(true);

    const badPass = authenticateRosterStudentPasswordInStore(store, "GZP-01", "wrong-pass");
    expect(badPass.success).toBe(false);
    if (!badPass.success) {
      expect(badPass.needsPasswordSetup).toBeFalsy();
    }

    const unset = authenticateRosterStudentPasswordInStore(store, "GZP-02", "anything123");
    expect(unset.success).toBe(false);
    if (!unset.success) {
      expect(unset.needsPasswordSetup).toBe(true);
    }
  });

  it("sanitizes passwordHash from roster students before sending to clients", () => {
    const safe1 = sanitizeRosterStudentForClient(sampleRoster[0]!);
    expect("passwordHash" in safe1).toBe(false);
    expect(safe1.hasPassword).toBe(true);

    const safe2 = sanitizeRosterStudentForClient(sampleRoster[1]!);
    expect("passwordHash" in safe2).toBe(false);
    expect(safe2.hasPassword).toBe(false);
  });

  it("generates unambiguous human-typeable temporary passwords and masks contacts", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      const pw = generateStudentTempPassword();
      expect(pw).toMatch(/^ONN-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(pw.slice(4)).not.toMatch(/[01IOl]/);
      seen.add(pw);
    }
    expect(seen.size).toBeGreaterThan(25);

    expect(maskEmailAddress("sifat.islam888@gmail.com")).toBe("si***@gmail.com");
    expect(maskEmailAddress("a@b.co")).toBe("a***@b.co");
    expect(maskPhoneNumber("01817512835")).toBe("018****835");
  });

  it("defaults portalAuthMode to password and persists admin overrides in branding", () => {
    expect(DEFAULT_BRANDING_SETTINGS.portalAuthMode).toBe("password");
    expect(mergeBrandingSettings({}).portalAuthMode).toBe("password");
    expect(mergeBrandingSettings({ portalAuthMode: "password_or_otp" }).portalAuthMode).toBe(
      "password_or_otp",
    );
    expect(mergeBrandingSettings({ portalAuthMode: "otp_only" }).portalAuthMode).toBe("otp_only");
  });
});

describe("Branded transactional HTML email templates", () => {
  const brand = buildEmailBrandContext(DEFAULT_BRANDING_SETTINGS, "https://arena.onnesha.courses");

  it("renders student credentials email with pre-filled portal link, password box, and HTML escaping", () => {
    const res = buildStudentCredentialsEmail({
      studentName: 'Rahim <script>alert("x")</script>',
      rollNumber: "GZP-03",
      username: "rahim.gzp03",
      email: "rahim@example.com",
      temporaryPassword: "ONN-7K4M-9P2R",
      regionName: "Gazipur Training Centre",
      portalUrl: "https://arena.onnesha.courses/portal",
      brand,
    });

    expect(res.subject).toContain("GZP-03");
    expect(res.html).toContain("ONN-7K4M-9P2R");
    expect(res.html).toContain("https://arena.onnesha.courses/portal?id=GZP-03");
    expect(res.html).toContain("rahim.gzp03");
    expect(res.html).not.toContain("<script>");
    expect(res.html).toContain("&lt;script&gt;");
    expect(res.text).toContain("ONN-7K4M-9P2R");
  });

  it("renders course certificate, quiz certificate, login OTP, reset OTP, and password changed templates cleanly", () => {
    const courseCert = buildCourseCertificateEmail({
      studentName: "Sifatul Islam",
      studentRoll: "GZP-01",
      courseTitle: "Applied AI & Autonomous Workflows",
      courseCode: "SANJIBON-AI-DM-04",
      certificateNumber: "ONN-COURSE-001",
      combinedScorePct: 92,
      issueDate: "2026-11-26",
      verifyUrl: "https://arena.onnesha.courses/verify/ONN-COURSE-001",
      portalUrl: "https://arena.onnesha.courses/portal",
      brand,
    });
    expect(courseCert.html).toContain("ONN-COURSE-001");
    expect(courseCert.html).toContain("92%");
    expect(courseCert.html).toContain("Ed25519");

    const quizCert = buildQuizCertificateEmail({
      studentName: "Sifatul Islam",
      quizTitle: "Final AI Quiz",
      certificateNumber: "ONN-QUIZ-002",
      scorePct: 95,
      rank: 2,
      totalParticipants: 228,
      verifyUrl: "https://arena.onnesha.courses/verify/ONN-QUIZ-002",
      portalUrl: "https://arena.onnesha.courses/portal",
      brand,
    });
    expect(quizCert.html).toContain("ONN-QUIZ-002");
    expect(quizCert.html).toContain("#2");
    expect(quizCert.html).toContain("95%");

    const otp = buildPortalOtpEmail({ code: "482917", studentName: "Sifat", brand });
    expect(otp.subject).toContain("482917");
    expect(otp.html).toContain("482&nbsp;&nbsp;917");

    const resetOtp = buildPasswordResetOtpEmail({
      studentName: "Sifat",
      rollNumber: "GZP-01",
      code: "739204",
      brand,
    });
    expect(resetOtp.subject).toContain("739204");
    expect(resetOtp.html).toContain("739&nbsp;&nbsp;204");

    const changed = buildPasswordChangedEmail({
      studentName: "Sifat",
      rollNumber: "GZP-01",
      email: "sifat@example.com",
      portalUrl: "https://arena.onnesha.courses/portal",
      brand,
    });
    expect(changed.subject).toContain("GZP-01");
    expect(changed.html).toContain("Your Password Has Been Updated");

    // Every catalog item renders non-empty subject, text, and full HTML document
    for (const entry of EMAIL_TEMPLATE_CATALOG) {
      const sample = buildSampleEmailTemplate(entry.id, brand);
      expect(sample.subject.length).toBeGreaterThan(5);
      expect(sample.text.length).toBeGreaterThan(20);
      expect(sample.html).toContain("<!DOCTYPE html>");
      expect(sample.html).toContain("</html>");
    }
  });
});
