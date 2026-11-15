import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  canActorMutateStoreAction,
  getCertificateSigningKeys,
  hashPasswordScrypt,
  sanitizeUserForClient,
  sealCertificateWithLedger,
  signSessionToken,
  verifyCertificateCryptographically,
  verifyPasswordScrypt,
  verifySessionToken,
} from "../server-security";
import {
  clampPassThresholdPct,
  computeParticipantAccuracyPct,
  computeTotalQuizMarks,
  evaluateQuestionAnswer,
  gradeOmrSubmission,
  isPassingScore,
  resolveOrgName,
  resolvePassThresholdPct,
} from "../scoring";
import {
  CERTIFICATE_THEME_PRESETS,
  DEFAULT_BRANDING_SETTINGS,
  mergeBrandingSettings,
  resolveCertificateTheme,
} from "../branding";
import {
  anchorCertificateToRekor,
  anchorDigestToOpenTimestamps,
  buildDidDocument,
  buildRekorHashedRekordPayload,
  buildW3CVerifiableCredential,
  computeZeroPiiRekorReceipt,
  getRekorAnchorKeys,
  inspectOtsProofStatus,
  OTS_BITCOIN_ATTESTATION_TAG,
  verifyW3CVerifiableCredentialProof,
} from "../transparency-anchor";
import {
  CertificateData,
  Course,
  GameSession,
  ManagedUser,
  Question,
  Region,
  RosterStudent,
} from "../types";
import { DEFAULT_COURSES, DEFAULT_REGIONS, READY_MADE_PACKS, SAMPLE_ROSTER } from "../mock-data";
import {
  SANJIBON_COURSE,
  SANJIBON_QUIZZES,
  SANJIBON_REGIONS,
  SANJIBON_ROSTER,
  isCoursePrivate,
  isQuizPrivate,
  normalizeBdPhone,
  normalizeRollToken,
} from "../sanjibon-seed-data";
import { findRosterCandidate, mergeSeededStoreData } from "../server-session";
import { sqliteEngine } from "../db/sqlite-engine";
import { db } from "../db";

describe("server-security: password hashing & user sanitization", () => {
  it("hashes passwords with unique per-user scrypt salts and verifies cleanly", () => {
    const h1 = hashPasswordScrypt("OnneshaPass!2026");
    const h2 = hashPasswordScrypt("OnneshaPass!2026");

    expect(h1.startsWith("scrypt:")).toBe(true);
    expect(h1).not.toEqual(h2);
    expect(verifyPasswordScrypt("OnneshaPass!2026", h1)).toEqual({
      valid: true,
      needsRehash: false,
    });
    expect(verifyPasswordScrypt("WrongPassword", h1)).toEqual({
      valid: false,
      needsRehash: false,
    });
  });

  it("migrates legacy sha256 or plaintext seed passwords with needsRehash=true", () => {
    const sha = crypto.createHash("sha256").update("legacyPass123").digest("hex");
    expect(verifyPasswordScrypt("legacyPass123", sha)).toEqual({
      valid: true,
      needsRehash: true,
    });
    expect(verifyPasswordScrypt("instructor123", "instructor123")).toEqual({
      valid: true,
      needsRehash: true,
    });
  });

  it("strips passwordHash from client-visible user payloads", () => {
    const user: ManagedUser = {
      id: "usr-1",
      name: "Dr. Rahman",
      email: "rahman@onnesha.app",
      passwordHash: "scrypt:abc:def",
      role: "instructor",
      institution: "Dhaka Cadet College",
      assignedCourseIds: ["course-1"],
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const safe = sanitizeUserForClient(user);
    expect("passwordHash" in safe).toBe(false);
    expect(safe.institutionName).toBe("Dhaka Cadet College");
  });
});

describe("server-security: signed HTTP-only session tokens & RBAC", () => {
  const secret = "test-secret-0123456789abcdef0123456789abcdef";

  it("verifies valid tokens and rejects expired or tampered tokens", () => {
    const now = 1_700_000_000_000;
    const token = signSessionToken(
      { uid: "usr-admin-1", role: "admin", exp: now + 60_000 },
      secret,
    );

    expect(verifySessionToken(token, secret, now + 1_000)).toEqual({
      uid: "usr-admin-1",
      role: "admin",
      exp: now + 60_000,
    });

    // Expired
    expect(verifySessionToken(token, secret, now + 60_001)).toBeNull();

    // Tampered signature
    const tampered = `${token.slice(0, -4)}zzzz`;
    expect(verifySessionToken(tampered, secret, now + 1_000)).toBeNull();
  });

  it("enforces RBAC on admin-only, instructor-owned, and unauthenticated mutations", () => {
    expect(canActorMutateStoreAction(null, "save_quiz").allowed).toBe(false);
    expect(canActorMutateStoreAction({ id: "stu-1", role: "candidate" }, "save_quiz").allowed).toBe(
      false,
    );
    expect(
      canActorMutateStoreAction({ id: "inst-1", role: "instructor" }, "save_user").allowed,
    ).toBe(false);
    expect(
      canActorMutateStoreAction({ id: "inst-1", role: "instructor" }, "delete_quiz", "inst-2")
        .allowed,
    ).toBe(false);
    expect(
      canActorMutateStoreAction({ id: "inst-1", role: "instructor" }, "delete_quiz", "inst-1")
        .allowed,
    ).toBe(true);
    expect(
      canActorMutateStoreAction({ id: "inst-1", role: "instructor" }, "save_quiz", "inst-2")
        .allowed,
    ).toBe(false);
    expect(
      canActorMutateStoreAction({ id: "inst-1", role: "instructor" }, "save_quiz", undefined, true)
        .allowed,
    ).toBe(false);
    expect(
      canActorMutateStoreAction({ id: "inst-1", role: "instructor" }, "update_sales_lead").allowed,
    ).toBe(false);
    expect(
      canActorMutateStoreAction({ id: "adm-1", role: "admin" }, "update_sales_lead").allowed,
    ).toBe(true);
    expect(
      canActorMutateStoreAction({ id: "adm-1", role: "admin" }, "purge_dummy_data").allowed,
    ).toBe(true);
  });
});

describe("scoring & certificate metadata helpers", () => {
  const sampleMcq: Question = {
    id: "q1",
    textEn: "Capital of Bangladesh?",
    textBn: "বাংলাদেশের রাজধানী?",
    type: "single_mcq",
    timeLimitSec: 20,
    points: 1000,
    options: [
      { id: "a", textEn: "Dhaka", textBn: "ঢাকা", isCorrect: true },
      { id: "b", textEn: "Sylhet", textBn: "সিলেট", isCorrect: false },
    ],
    correctOptionIds: ["a"],
  };

  const sampleWritten: Question = {
    id: "q2",
    textEn: "Year of Independence?",
    textBn: "স্বাধীনতার বছর?",
    type: "written",
    timeLimitSec: 30,
    points: 500,
    options: [],
    correctOptionIds: [],
    acceptedAnswers: ["1971", "১৯৭১"],
  };

  it("computes accurate totalMarks across custom question weights and fallback", () => {
    expect(computeTotalQuizMarks([sampleMcq, sampleWritten], 2)).toBe(1500);
    expect(computeTotalQuizMarks(undefined, 10)).toBe(10000);
  });

  it("resolves partner joint branding organization name", () => {
    expect(
      resolveOrgName({
        showPartnerLogo: true,
        partnerName: "Mirzapur Cadet College",
        partnerLogoUrl: "",
      }),
    ).toBe("Onnesha × Mirzapur Cadet College");
    expect(
      resolveOrgName({
        showPartnerLogo: false,
        partnerName: "Mirzapur Cadet College",
        partnerLogoUrl: "",
      }),
    ).toBe("Onnesha Assessment & Examination Arena");
  });

  it("evaluates MCQ speed/streak bonuses, written normalization, and negative marking", () => {
    const fastCorrect = evaluateQuestionAnswer({
      question: sampleMcq,
      selectedOptionIds: ["a"],
      currentStreak: 2, // becomes streak 3 -> 1.5x
      timeTakenSec: 1, // ~0.975 speed factor
      speedBonus: true,
      negativeMarking: 0.25,
    });
    expect(fastCorrect.isCorrect).toBe(true);
    expect(fastCorrect.newStreak).toBe(3);
    expect(fastCorrect.pointsAwarded).toBeGreaterThan(1400);

    const wrongPenalty = evaluateQuestionAnswer({
      question: sampleMcq,
      selectedOptionIds: ["b"],
      currentStreak: 2,
      timeTakenSec: 5,
      speedBonus: true,
      negativeMarking: 0.25,
    });
    expect(wrongPenalty).toEqual({
      isCorrect: false,
      pointsAwarded: -250,
      newStreak: 0,
    });

    const writtenOk = evaluateQuestionAnswer({
      question: sampleWritten,
      writtenAnswer: "  ১৯৭১ ",
      currentStreak: 0,
      timeTakenSec: 10,
      speedBonus: false,
      negativeMarking: 0,
    });
    expect(writtenOk).toEqual({
      isCorrect: true,
      pointsAwarded: 500,
      newStreak: 1,
    });
  });

  it("grades OMR sheets using per-question weight, negative mark fraction, and written Pass/Fail verdicts", () => {
    const weightedMcq: Question = {
      ...sampleMcq,
      points: 2000, // 2-mark OMR weight
      negativeMarks: 0.5,
    };
    const omr = gradeOmrSubmission([weightedMcq, sampleWritten], {
      1: "B", // wrong on 2-mark item with 0.5 neg -> -1.0
      2: "PASS", // written item (500pt -> 0.5 mark) verified correct -> +0.5
    });

    expect(omr.attempted).toBe(2);
    expect(omr.correct).toBe(1);
    expect(omr.incorrect).toBe(1);
    expect(omr.rawScore).toBeCloseTo(0.5);
    expect(omr.negativeDeduction).toBeCloseTo(1.0);
    expect(omr.netScore).toBe(0);
    expect(omr.maxPossibleScore).toBeCloseTo(2.5);
  });
});

describe("certificate Ed25519 signing & SHA-256 hash-chain ledger", () => {
  const keys = getCertificateSigningKeys()!;
  const baseCert = (num: string, name: string, score: number): CertificateData => ({
    id: `cert-${num}`,
    certificateNumber: num,
    studentName: name,
    studentRoll: "2026-101",
    quizTitle: "46th BCS Model Test",
    score,
    marksObtained: score,
    totalPoints: 5000,
    totalMarks: 5000,
    rank: 1,
    totalParticipants: 10,
    accuracyPercent: 90,
    issueDate: "2026-11-13",
    verified: true,
  });

  it("seals sequential certificates in a linked SHA-256 + Ed25519 ledger and verifies validly", () => {
    const c1 = sealCertificateWithLedger(
      baseCert("ONN-1001-0101", "Tanvir", 4500),
      [],
      undefined,
      keys,
    );
    const c2 = sealCertificateWithLedger(
      baseCert("ONN-1001-0102", "Nusrat", 4200),
      [c1],
      undefined,
      keys,
    );

    expect(c1.ledgerIndex).toBe(1);
    expect(c1.prevBlockHash).toBe("0".repeat(64));
    expect(c2.ledgerIndex).toBe(2);
    expect(c2.prevBlockHash).toBe(c1.chainHash);

    const r1 = verifyCertificateCryptographically(c1, undefined, [c2, c1], keys);
    const r2 = verifyCertificateCryptographically(c2, undefined, [c2, c1], keys);

    expect(r1.status).toBe("verified_signed");
    expect(r1.signatureValid).toBe(true);
    expect(r1.payloadMatch).toBe(true);
    expect(r1.chainLinkValid).toBe(true);

    expect(r2.status).toBe("verified_signed");
    expect(r2.chainLinkValid).toBe(true);
  });

  it("detects tampered certificate scores, names, or broken chain links", () => {
    const c1 = sealCertificateWithLedger(
      baseCert("ONN-2002-0101", "Sadia", 3000),
      [],
      undefined,
      keys,
    );
    const tamperedScore = { ...c1, score: 5000, marksObtained: 5000 };
    const report = verifyCertificateCryptographically(tamperedScore, undefined, [c1], keys);

    expect(report.status).toBe("tampered");
    expect(report.payloadMatch).toBe(false);

    const forgedSig = { ...c1, cryptoSignature: `${c1.cryptoSignature?.slice(0, -4)}AAAA` };
    expect(verifyCertificateCryptographically(forgedSig, undefined, [c1], keys).status).toBe(
      "tampered",
    );

    const legacy = baseCert("ONN-OLD-0001", "Legacy User", 2500);
    expect(verifyCertificateCryptographically(legacy, undefined, [c1], keys).status).toBe(
      "legacy_unsigned",
    );
  });
});

describe("industrial transparency standards: W3C did:web + Sigstore Rekor + OpenTimestamps", () => {
  const edKeys = (() => {
    const generated = crypto.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    return {
      publicKeyPem: generated.publicKey,
      privateKeyPem: generated.privateKey,
      keyId: "ed-test-key",
    };
  })();

  const p256Keys = getRekorAnchorKeys();

  it("generates W3C did:web document and verifiable credential whose Ed25519 proof validates and rejects tampering", () => {
    const sealed = sealCertificateWithLedger(
      {
        id: "cert-vc-1",
        certificateNumber: "ONN-9001-0101",
        studentName: "Farhana Rahman",
        studentRoll: "2026-888",
        quizTitle: "46th BCS Preliminary Arena",
        score: 4600,
        marksObtained: 4600,
        totalPoints: 5000,
        totalMarks: 5000,
        rank: 1,
        totalParticipants: 40,
        accuracyPercent: 92,
        issueDate: "2026-11-13",
        verified: true,
        rekorStatus: "anchored",
        rekorEntryUuid: "24296fb24b8ad77a1234567890abcdef",
        rekorLogIndex: 98765432,
        rekorExplorerUrl: "https://search.sigstore.dev/?logIndex=98765432",
      },
      [],
      undefined,
      edKeys,
    );

    const didDoc = buildDidDocument("https://exam.onnesha.app", edKeys, p256Keys);
    expect(didDoc.id).toBe("did:web:exam.onnesha.app");
    expect(String(didDoc.verificationMethod[0]?.publicKeyMultibase)).toMatch(/^z6Mk/);

    const vc = buildW3CVerifiableCredential(sealed, edKeys, {
      originUrl: "https://exam.onnesha.app",
    });
    expect(vc.issuer.id).toBe("did:web:exam.onnesha.app");
    expect(verifyW3CVerifiableCredentialProof(vc, edKeys.publicKeyPem)).toBe(true);

    const tamperedVc = {
      ...vc,
      credentialSubject: { ...vc.credentialSubject, scoreObtained: 5000 },
    };
    expect(verifyW3CVerifiableCredentialProof(tamperedVc, edKeys.publicKeyPem)).toBe(false);
  });

  it("constructs zero-PII Rekor hashedrekord ECDSA P-256 payload and handles 201, 409, and offline fallbacks", async () => {
    expect(p256Keys).not.toBeNull();
    const sealed = sealCertificateWithLedger(
      {
        id: "cert-rek-1",
        certificateNumber: "ONN-7777-0101",
        studentName: "Secret Student PII Name",
        studentRoll: "ROLL-SECRET-99",
        quizTitle: "Confidential Exam",
        score: 4100,
        totalPoints: 5000,
        rank: 2,
        totalParticipants: 25,
        issueDate: "2026-11-13",
        verified: true,
      },
      [],
      undefined,
      edKeys,
    );

    const { payload, receiptDigestHex } = buildRekorHashedRekordPayload(
      sealed.chainHash!,
      p256Keys!,
    );
    const serialized = JSON.stringify(payload);
    // Strict privacy check: zero student PII leaves server
    expect(serialized).not.toContain("Secret Student");
    expect(serialized).not.toContain("ROLL-SECRET");
    expect(serialized).not.toContain("Confidential Exam");

    // Verify ECDSA DER signature inside hashedrekord matches the Rekor receipt bytes
    const { receiptText } = computeZeroPiiRekorReceipt(sealed.chainHash!);
    const sigBase64 = (payload["spec"] as { signature: { content: string } }).signature.content;
    const isValidSig = crypto.verify(
      "sha256",
      Buffer.from(receiptText, "utf8"),
      p256Keys!.publicKeyPem,
      Buffer.from(sigBase64, "base64"),
    );
    expect(isValidSig).toBe(true);

    // 1) Normal 201 Created response
    const okFetch = (async () =>
      new Response(
        JSON.stringify({
          uuid123456: {
            logID: "c0d23d6ad406973f9559f3ba2d1ca01f84147d8ffc5b8445c224f98b9591801d",
            logIndex: 145001234,
            integratedTime: 1794510000,
          },
        }),
        { status: 201 },
      )) as unknown as typeof fetch;

    const anchored = await anchorCertificateToRekor(sealed, {
      keysOverride: p256Keys!,
      fetchImpl: okFetch,
    });
    expect(anchored.anchored).toBe(true);
    expect(anchored.fields.rekorStatus).toBe("anchored");
    expect(anchored.fields.rekorLogIndex).toBe(145001234);
    expect(anchored.fields.rekorReceiptDigest).toBe(receiptDigestHex);

    // 2) 409 Conflict -> auto-recovers existing entry via Location/retrieve
    const conflictFetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/log/entries/retrieve")) {
        return new Response(
          JSON.stringify([
            {
              uuidExisting: { logID: "abc", logIndex: 999111, integratedTime: 1794509000 },
            },
          ]),
          { status: 200 },
        );
      }
      return new Response("already exists", { status: 409 });
    }) as unknown as typeof fetch;

    const recovered = await anchorCertificateToRekor(sealed, {
      keysOverride: p256Keys!,
      fetchImpl: conflictFetch,
    });
    expect(recovered.anchored).toBe(true);
    expect(recovered.fields.rekorLogIndex).toBe(999111);

    // 3) Offline network failure -> non-throwing graceful pending_retry fallback
    const offlineFetch = (async () => {
      throw new Error("Network unreachable");
    }) as unknown as typeof fetch;

    const fallback = await anchorCertificateToRekor(sealed, {
      keysOverride: p256Keys!,
      fetchImpl: offlineFetch,
    });
    expect(fallback.anchored).toBe(false);
    expect(fallback.fields.rekorStatus).toBe("pending_retry");
  });

  it("wraps OpenTimestamps binary proofs cleanly and parses pending vs bitcoin-confirmed block heights", async () => {
    const sampleChainHash = crypto
      .createHash("sha256")
      .update("onnesha-tip-block-42")
      .digest("hex");
    // Mock calendar stream (append op + pending attestation tag)
    const mockCalendarProof = Buffer.from(
      "0083dfe30d2ef90c8e1f68747470733a2f2f612e706f6f6c",
      "hex",
    );

    const otsFetch = (async () =>
      new Response(new Uint8Array(mockCalendarProof), {
        status: 200,
      })) as unknown as typeof fetch;

    const res = await anchorDigestToOpenTimestamps(sampleChainHash, {
      calendars: ["https://a.pool.opentimestamps.org"],
      fetchImpl: otsFetch,
    });
    expect(res.success).toBe(true);
    expect(res.status).toBe("pending_bitcoin");
    expect(res.otsProofBase64).toBeTruthy();

    const fileBytes = Buffer.from(res.otsProofBase64!, "base64");
    const inspectedPending = inspectOtsProofStatus(fileBytes);
    expect(inspectedPending.validHeader).toBe(true);
    expect(inspectedPending.status).toBe("pending_bitcoin");

    // Simulate upgraded proof carrying BitcoinBlockHeaderAttestation with varint length=3 & block height 870123 (0xeb, 0xcd, 0x35)
    const btcPayload = Buffer.concat([
      fileBytes.subarray(0, 65),
      OTS_BITCOIN_ATTESTATION_TAG,
      Buffer.from([0x03, 0xeb, 0xcd, 0x35]),
    ]);
    const inspectedBtc = inspectOtsProofStatus(btcPayload);
    expect(inspectedBtc.validHeader).toBe(true);
    expect(inspectedBtc.status).toBe("bitcoin_confirmed");
    expect(inspectedBtc.bitcoinBlockHeight).toBe(
      (0x35 << 14) | ((0xcd & 0x7f) << 7) | (0xeb & 0x7f),
    );
  });
});

describe("certificate designer branding, themes, Bangladesh map & multi-signatories", () => {
  it("merges and clamps BrandingSettings defaults, partner logos, and up to 4 signatories safely", () => {
    const merged = mergeBrandingSettings({
      institutionTitle: "  Dhaka AI Academy ",
      leftLogoUrl: "data:image/png;base64,AAA",
      rightLogoUrl: "https://cdn.example.org/seal.png",
      certThemePreset: "dhaka_ai_navy",
      certShowBangladeshAiMap: true,
      certMapOpacity: 0.99, // clamped to 0.45
      certCustomBgOpacity: 0.01, // clamped to 0.05
      certBgPrimaryColor: "not-a-hex", // sanitized back to default
      partnerLogos: [
        { id: "p1", name: "ICT Division", logoUrl: "data:image/png;base64,P1" },
        { id: "p2", name: "", logoUrl: "" }, // empty item filtered out
      ],
      certSignatories: [
        { id: "s1", name: "Prof. Rahman", title: "VC", signatureStyle: "script" },
        { id: "s2", name: "Dr. Kabir", title: "Controller", signatureStyle: "formal" },
        { id: "s3", name: "A. Hossain", title: "Director", signatureStyle: "mono" },
        { id: "s4", name: "Extra 4", title: "Dean", signatureStyle: "script" },
        { id: "s5", name: "Extra 5 (capped)", title: "Dropped", signatureStyle: "script" },
      ],
    });

    expect(merged.institutionTitle).toBe("Dhaka AI Academy");
    expect(merged.leftLogoUrl).toBe("data:image/png;base64,AAA");
    expect(merged.rightLogoUrl).toBe("https://cdn.example.org/seal.png");
    expect(merged.certThemePreset).toBe("dhaka_ai_navy");
    expect(merged.certShowBangladeshAiMap).toBe(true);
    expect(merged.certMapOpacity).toBe(0.45);
    expect(merged.certCustomBgOpacity).toBe(0.05);
    expect(merged.certBgPrimaryColor).toBe(DEFAULT_BRANDING_SETTINGS.certBgPrimaryColor);
    expect(merged.partnerLogos).toHaveLength(1);
    expect(merged.partnerLogos?.[0]?.name).toBe("ICT Division");
    expect(merged.certSignatories).toHaveLength(4);
    expect(merged.certSignatories?.[2]?.signatureStyle).toBe("mono");
  });

  it("resolves preset palettes cleanly and adapts ink contrast automatically for custom dark backgrounds", () => {
    const navyTheme = resolveCertificateTheme({
      ...DEFAULT_BRANDING_SETTINGS,
      certThemePreset: "dhaka_ai_navy",
    });
    expect(navyTheme.isDark).toBe(true);
    expect(navyTheme.bgPrimary).toBe(CERTIFICATE_THEME_PRESETS.dhaka_ai_navy.bgPrimary);

    const customDarkTheme = resolveCertificateTheme({
      ...DEFAULT_BRANDING_SETTINGS,
      certThemePreset: "custom",
      certBgPrimaryColor: "#0b132b",
      certBgSecondaryColor: "#1c2541",
      certAccentColor: "#5bc0be",
      certBorderColor: "#f59e0b",
    });
    expect(customDarkTheme.isDark).toBe(true);
    expect(customDarkTheme.textPrimary).toBe("#f8fafc");
    expect(customDarkTheme.borderOuter).toBe("#f59e0b");
    expect(customDarkTheme.accentColor).toBe("#5bc0be");
  });
});

describe("Sanjibon Batch-04 seed curriculum, 11 quizzes & 228 trainees roster", () => {
  it("seeds the official course, 11 training centres, 11 quizzes (140 questions incl. 20-MCQ baseline), and all 228 enrolled trainees", () => {
    expect(SANJIBON_COURSE.id).toBe("course-sanjibon-ai-dm");
    expect(DEFAULT_COURSES.some((c) => c.id === "course-sanjibon-ai-dm")).toBe(true);

    expect(SANJIBON_REGIONS).toHaveLength(11);
    for (const reg of SANJIBON_REGIONS) {
      expect(DEFAULT_REGIONS.some((r) => r.id === reg.id)).toBe(true);
    }

    expect(SANJIBON_ROSTER).toHaveLength(228);
    expect(SAMPLE_ROSTER.length).toBeGreaterThanOrEqual(228);

    const std11Digits = SANJIBON_ROSTER.filter((s) => /^01\d{9}$/.test(s.phone || ""));
    expect(std11Digits.length).toBeGreaterThanOrEqual(226);

    expect(SANJIBON_QUIZZES).toHaveLength(11);
    let totalQuestions = 0;
    for (const qz of SANJIBON_QUIZZES) {
      expect(qz.courseId).toBe("course-sanjibon-ai-dm");
      expect(READY_MADE_PACKS.some((p) => p.id === qz.id)).toBe(true);
      totalQuestions += qz.questions.length;
      for (const question of qz.questions) {
        expect(question.correctOptionIds.length).toBeGreaterThan(0);
        const corr = question.correctOptionIds[0];
        expect(question.options.some((o) => o.id === corr && o.isCorrect)).toBe(true);
      }
    }
    expect(totalQuestions).toBe(140);
    expect(SANJIBON_QUIZZES[0]?.id).toBe("quiz-sanjibon-s00-baseline");
    expect(SANJIBON_QUIZZES[0]?.quizNumber).toBe(0);
    expect(SANJIBON_QUIZZES[0]?.questions).toHaveLength(20);
    expect(SANJIBON_QUIZZES[10]?.id).toBe("quiz-sanjibon-s10-final");
    expect(SANJIBON_QUIZZES[10]?.questions).toHaveLength(30);
  });

  it("normalizes BD phone formats and resolves candidates by mobile, roll, serial+centre, and email", () => {
    expect(normalizeBdPhone("+888801789121691")).toBe("01789121691");
    expect(normalizeBdPhone("1817512835")).toBe("01817512835");
    expect(normalizeBdPhone("+881961988682")).toBe("01961988682");
    expect(normalizeRollToken("JHN-01")).toBe("jhn01");

    expect(findRosterCandidate(SANJIBON_ROSTER, "01950350417")?.rollNumber).toBe("JHN-01");
    expect(findRosterCandidate(SANJIBON_ROSTER, "+8801950350417")?.rollNumber).toBe("JHN-01");
    expect(findRosterCandidate(SANJIBON_ROSTER, "350417")?.rollNumber).toBe("JHN-01");
    expect(findRosterCandidate(SANJIBON_ROSTER, "JHN-01")?.name).toBe("Al Shahriar Shohan");
    expect(findRosterCandidate(SANJIBON_ROSTER, "jhn01")?.rollNumber).toBe("JHN-01");
    expect(findRosterCandidate(SANJIBON_ROSTER, "01817512835")?.rollNumber).toBe("GZP-01");
    expect(findRosterCandidate(SANJIBON_ROSTER, "1", "reg-jhenaidah")?.rollNumber).toBe("JHN-01");
    expect(findRosterCandidate(SANJIBON_ROSTER, "alshahriarshohan@gmail.com")?.rollNumber).toBe(
      "JHN-01",
    );
  });

  it("idempotently merges missing centres, course, and trainees into an existing store without duplicating or wiping custom items", () => {
    const customStudent: RosterStudent = {
      id: "std-custom-999",
      rollNumber: "CUSTOM-99",
      name: "Custom Trainee",
      phone: "01700000999",
      regionId: "reg-dhaka",
      regionName: "Dhaka Range",
    };
    const legacySylhet: Region = {
      id: "reg-sylhet",
      code: "SYL",
      nameEn: "Sylhet Range",
      nameBn: "সিলেট রেঞ্জ",
      createdAt: "2026-01-01T00:00:00Z",
    };
    const emptyCourses: Course[] = [];
    const mergedOnce = mergeSeededStoreData({
      regions: [legacySylhet],
      courses: emptyCourses,
      roster: [customStudent],
    });

    expect(mergedOnce.courses.some((c) => c.id === "course-sanjibon-ai-dm")).toBe(true);
    expect(mergedOnce.regions.find((r) => r.id === "reg-sylhet")?.nameEn).toBe(
      "Sylhet Training Centre",
    );
    expect(mergedOnce.roster.some((s) => s.id === "std-custom-999")).toBe(true);
    expect(mergedOnce.roster.length).toBe(229);

    const mergedTwice = mergeSeededStoreData(mergedOnce);
    expect(mergedTwice.roster.length).toBe(229);
    expect(mergedTwice.courses.length).toBe(mergedOnce.courses.length);
  });
});

describe("SQLite batch persistence & post-exam session recording performance", () => {
  it("batches 260+ inserts in under 250ms with single debounced localStorage persist and records exam session cleanly", async () => {
    const storageMap = new Map<string, string>();
    let setItemCalls = 0;
    const origWindow = (globalThis as Record<string, unknown>)["window"];
    const origLocalStorage = (globalThis as Record<string, unknown>)["localStorage"];

    const mockLocalStorage = {
      getItem: (k: string) => storageMap.get(k) ?? null,
      setItem: (k: string, v: string) => {
        setItemCalls += 1;
        storageMap.set(k, String(v));
      },
      removeItem: (k: string) => {
        storageMap.delete(k);
      },
      clear: () => {
        storageMap.clear();
      },
      key: (idx: number) => Array.from(storageMap.keys())[idx] ?? null,
      get length() {
        return storageMap.size;
      },
    };

    try {
      (globalThis as Record<string, unknown>)["window"] = globalThis;
      (globalThis as Record<string, unknown>)["localStorage"] = mockLocalStorage;

      await sqliteEngine.init();
      setItemCalls = 0;

      const t0 = performance.now();
      sqliteEngine.runBatch((run) => {
        for (let i = 0; i < 260; i++) {
          run(
            "INSERT OR REPLACE INTO roster_students (id, rollNumber, name, phone, regionId, regionName, section, batch, guardianPhone, email, passcode, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              `batch-std-${i}`,
              `B-${1000 + i}`,
              `Trainee ${i}`,
              `0170000${String(i).padStart(4, "0")}`,
              "reg-gazipur",
              "Gazipur Training Centre",
              "A",
              "Batch-04",
              "",
              `t${i}@example.com`,
              "",
              "2026-11-15T00:00:00Z",
            ],
          );
        }
      });
      const elapsedMs = performance.now() - t0;

      expect(elapsedMs).toBeLessThan(250);
      // Debounced persist must not synchronously export per row inside runBatch
      expect(setItemCalls).toBe(0);

      sqliteEngine.persist();
      expect(setItemCalls).toBe(1);
      expect(storageMap.has("onnesha_sqlite_db_bin")).toBe(true);

      const mockSession: GameSession = {
        pin: "789012",
        quizId: "quiz-sanjibon-s00-baseline",
        quizTitleEn: "Baseline Assessment (Pre-Test)",
        quizTitleBn: "প্রারম্ভিক মূল্যায়ন কুইজ (Pre-Test)",
        hostId: "usr-instructor-1",
        phase: "podium",
        currentQuestionIndex: 19,
        questionStartTime: Date.now() - 20000,
        questionEndTime: Date.now(),
        settings: {
          speedBonus: true,
          negativeMarking: 0.25,
          shuffleQuestions: false,
          shuffleOptions: false,
          soundEnabled: true,
          musicEnabled: true,
          isFormalAssessment: true,
          requireRollNumber: true,
          allowedRegionId: "all",
          allowedRegionName: "All Regions",
        },
        participants: {
          "p-test-1": {
            id: "p-test-1",
            name: "Al Shahriar Shohan",
            nickname: "Al Shahriar Shohan",
            avatarEmoji: "🎯",
            avatarBg: "#10b981",
            rollNumber: "JHN-01",
            phone: "01950350417",
            regionId: "reg-jhenaidah",
            regionName: "Jhenaidah Training Centre",
            score: 14250,
            streak: 4,
            rank: 1,
            isBot: false,
            answers: {
              "sj-s00-q01": {
                questionId: "sj-s00-q01",
                selectedOptionIds: ["o-sj-s00-q01-3"],
                isCorrect: true,
                timeTakenSec: 3,
                pointsAwarded: 950,
                streakCount: 1,
                answeredAt: Date.now(),
              },
            },
            connected: true,
            lastActive: Date.now(),
          },
        },
        totalQuestions: 20,
        createdAt: Date.now() - 60000,
        updatedAt: Date.now(),
      };

      db.recordExamSession(mockSession, { syncToServer: false });

      const sessions = db.getExamSessions();
      expect(sessions.some((s) => s.pin === "789012")).toBe(true);
      const results = db.getExamResults("789012");
      expect(results).toHaveLength(1);
      expect(results[0]?.rollNumber).toBe("JHN-01");
      const certs = db.getCertificates();
      expect(certs.some((c) => c.certificateNumber === "ONN-7890-JHN01")).toBe(true);

      // Flush scheduled persist timer before restoring global window/localStorage
      sqliteEngine.persist();
    } finally {
      if (origWindow === undefined) {
        delete (globalThis as Record<string, unknown>)["window"];
      } else {
        (globalThis as Record<string, unknown>)["window"] = origWindow;
      }
      if (origLocalStorage === undefined) {
        delete (globalThis as Record<string, unknown>)["localStorage"];
      } else {
        (globalThis as Record<string, unknown>)["localStorage"] = origLocalStorage;
      }
    }
  });
});

describe("course & quiz privacy access control helpers", () => {
  it("marks Sanjibon course and all 11 Sanjibon quizzes private while keeping public demo course open", () => {
    expect(isCoursePrivate(SANJIBON_COURSE)).toBe(true);
    expect(SANJIBON_QUIZZES.length).toBe(11);
    expect(SANJIBON_QUIZZES.every((q) => isQuizPrivate(q, DEFAULT_COURSES))).toBe(true);

    const demoCourse = DEFAULT_COURSES.find((c) => c.id === "course-bcs-foundation");
    expect(isCoursePrivate(demoCourse)).toBe(false);
    const demoPack = READY_MADE_PACKS.find((q) => q.id === "pack-bcs-gk")!;
    expect(isQuizPrivate(demoPack, DEFAULT_COURSES)).toBe(false);
  });

  it("propagates course isPrivate toggles immediately to all child quizzes", () => {
    const toggledPublicCourses: Course[] = DEFAULT_COURSES.map((c) =>
      c.id === "course-sanjibon-ai-dm" ? { ...c, isPrivate: false } : c,
    );
    expect(SANJIBON_QUIZZES.every((q) => !isQuizPrivate(q, toggledPublicCourses))).toBe(true);

    const toggledPrivateCourses: Course[] = DEFAULT_COURSES.map((c) =>
      c.id === "course-bcs-foundation" ? { ...c, isPrivate: true } : c,
    );
    const demoPack = READY_MADE_PACKS.find((q) => q.id === "pack-bcs-gk")!;
    expect(isQuizPrivate(demoPack, toggledPrivateCourses)).toBe(true);
  });
});

describe("minimum passing threshold & certificate issuance gating", () => {
  it("resolves passing threshold in priority order (session > course > global > default 50%)", () => {
    expect(clampPassThresholdPct(-10)).toBe(0);
    expect(clampPassThresholdPct(150)).toBe(100);
    expect(clampPassThresholdPct(undefined)).toBe(50);

    expect(resolvePassThresholdPct({})).toBe(50);
    expect(resolvePassThresholdPct({ brandingDefaultThreshold: 60 })).toBe(60);
    expect(
      resolvePassThresholdPct({
        courseThreshold: 75,
        brandingDefaultThreshold: 60,
      }),
    ).toBe(75);
    expect(
      resolvePassThresholdPct({
        sessionThreshold: 80,
        courseThreshold: 75,
        brandingDefaultThreshold: 60,
      }),
    ).toBe(80);
  });

  it("evaluates pass/fail and computes real accuracy over totalQuestions", () => {
    expect(isPassingScore(50, 50)).toBe(true);
    expect(isPassingScore(49, 50)).toBe(false);
    expect(isPassingScore(69, 70)).toBe(false);
    expect(isPassingScore(70, 70)).toBe(true);

    // Answering only 1 out of 20 correctly must equal 5%, not 100%
    const oneOfTwenty = computeParticipantAccuracyPct({
      answers: [{ isCorrect: true }],
      totalQuestions: 20,
      score: 950,
      totalMarks: 20000,
    });
    expect(oneOfTwenty).toBe(5);
    expect(isPassingScore(oneOfTwenty, 50)).toBe(false);
  });

  it("issues certificates only to candidates meeting the threshold and blocks revoked fallback reconstruction", async () => {
    const storageMap = new Map<string, string>();
    const origWindow = (globalThis as Record<string, unknown>)["window"];
    const origLocalStorage = (globalThis as Record<string, unknown>)["localStorage"];

    const mockLocalStorage = {
      getItem: (k: string) => storageMap.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storageMap.set(k, String(v));
      },
      removeItem: (k: string) => {
        storageMap.delete(k);
      },
      clear: () => {
        storageMap.clear();
      },
      key: (idx: number) => Array.from(storageMap.keys())[idx] ?? null,
      get length() {
        return storageMap.size;
      },
    };

    try {
      (globalThis as Record<string, unknown>)["window"] = globalThis;
      (globalThis as Record<string, unknown>)["localStorage"] = mockLocalStorage;

      await sqliteEngine.init();

      const customCourse: Course = {
        id: "course-threshold-test",
        code: "THR-70",
        titleEn: "Threshold Policy Course",
        titleBn: "Threshold Policy Course",
        descriptionEn: "Requires 70% to earn certificate",
        descriptionBn: "Requires 70%",
        categoryEn: "Test",
        categoryBn: "Test",
        icon: "🎯",
        color: "from-emerald-500/20 to-teal-500/20",
        instructorIds: ["usr-instructor-1"],
        instructorNames: ["Instructor"],
        isPrivate: true,
        passThresholdPct: 70,
        status: "active",
        createdAt: "2026-11-15T00:00:00Z",
      };
      db.saveCourse(customCourse);
      const loadedCourse = db.getCourses().find((c) => c.id === "course-threshold-test");
      expect(loadedCourse?.passThresholdPct).toBe(70);

      const sessionWithThreshold: GameSession = {
        pin: "445566",
        quizId: "quiz-threshold-test",
        quizTitleEn: "Threshold Gate Exam",
        quizTitleBn: "Threshold Gate Exam",
        hostId: "usr-instructor-1",
        phase: "podium",
        currentQuestionIndex: 9,
        questionStartTime: Date.now() - 20000,
        questionEndTime: Date.now(),
        settings: {
          speedBonus: true,
          negativeMarking: 0,
          shuffleQuestions: false,
          shuffleOptions: false,
          soundEnabled: true,
          musicEnabled: true,
          isFormalAssessment: true,
          requireRollNumber: true,
          allowedRegionId: "all",
          allowedRegionName: "All Regions",
          passThresholdPct: 70,
        },
        participants: {
          "p-pass": {
            id: "p-pass",
            name: "Qualified Student",
            nickname: "Qualified Student",
            avatarEmoji: "🎯",
            avatarBg: "#10b981",
            rollNumber: "PASS-01",
            regionId: "reg-dhaka",
            regionName: "Dhaka Range",
            score: 7600,
            streak: 3,
            rank: 1,
            isBot: false,
            answers: Object.fromEntries(
              Array.from({ length: 10 }, (_, idx) => [
                `q-${idx}`,
                {
                  questionId: `q-${idx}`,
                  selectedOptionIds: ["o1"],
                  isCorrect: idx < 8,
                  timeTakenSec: 5,
                  pointsAwarded: idx < 8 ? 950 : 0,
                  streakCount: 1,
                  answeredAt: Date.now(),
                },
              ]),
            ),
            connected: true,
            lastActive: Date.now(),
          },
          "p-fail": {
            id: "p-fail",
            name: "Below Threshold Student",
            nickname: "Below Threshold Student",
            avatarEmoji: "📝",
            avatarBg: "#ef4444",
            rollNumber: "FAIL-02",
            regionId: "reg-dhaka",
            regionName: "Dhaka Range",
            score: 1900,
            streak: 0,
            rank: 2,
            isBot: false,
            answers: {
              "q-0": {
                questionId: "q-0",
                selectedOptionIds: ["o1"],
                isCorrect: true,
                timeTakenSec: 5,
                pointsAwarded: 950,
                streakCount: 1,
                answeredAt: Date.now(),
              },
              "q-1": {
                questionId: "q-1",
                selectedOptionIds: ["o1"],
                isCorrect: true,
                timeTakenSec: 5,
                pointsAwarded: 950,
                streakCount: 1,
                answeredAt: Date.now(),
              },
            },
            connected: true,
            lastActive: Date.now(),
          },
        },
        totalQuestions: 10,
        createdAt: Date.now() - 60000,
        updatedAt: Date.now(),
      };

      db.recordExamSession(sessionWithThreshold, { syncToServer: false });

      const recordedSession = db.getExamSessions().find((s) => s.pin === "445566");
      expect(recordedSession?.passThresholdPct).toBe(70);

      const results = db.getExamResults("445566");
      const passRes = results.find((r) => r.rollNumber === "PASS-01");
      const failRes = results.find((r) => r.rollNumber === "FAIL-02");
      expect(passRes?.accuracyPct).toBe(80);
      expect(passRes?.passed).toBe(true);
      expect(failRes?.accuracyPct).toBe(20);
      expect(failRes?.passed).toBe(false);

      const certs = db.getCertificates();
      expect(certs.some((c) => c.certificateNumber === "ONN-4455-PASS01")).toBe(true);
      expect(certs.some((c) => c.certificateNumber === "ONN-4455-FAIL02")).toBe(false);
      expect(db.getCertificateById("ONN-4455-PASS01")?.studentName).toBe("Qualified Student");
      expect(db.getCertificateById("ONN-4455-FAIL02")).toBeUndefined();

      // Revoking an issued certificate must remove it and prevent deterministic resurrection
      db.deleteCertificate("ONN-4455-PASS01", { syncToServer: false });
      expect(db.getCertificates().some((c) => c.certificateNumber === "ONN-4455-PASS01")).toBe(
        false,
      );
      expect(db.getCertificateById("ONN-4455-PASS01")).toBeUndefined();

      sqliteEngine.persist();
    } finally {
      if (origWindow === undefined) {
        delete (globalThis as Record<string, unknown>)["window"];
      } else {
        (globalThis as Record<string, unknown>)["window"] = origWindow;
      }
      if (origLocalStorage === undefined) {
        delete (globalThis as Record<string, unknown>)["localStorage"];
      } else {
        (globalThis as Record<string, unknown>)["localStorage"] = origLocalStorage;
      }
    }
  });

  it("isolates bots from saved human rank, skips self-practice persistence, preserves ledger proofs, and resolves passing PIN prefix collisions", async () => {
    const storageMap = new Map<string, string>();
    const origWindow = (globalThis as Record<string, unknown>)["window"];
    const origLocalStorage = (globalThis as Record<string, unknown>)["localStorage"];

    const mockLocalStorage = {
      getItem: (k: string) => storageMap.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storageMap.set(k, String(v));
      },
      removeItem: (k: string) => {
        storageMap.delete(k);
      },
      clear: () => {
        storageMap.clear();
      },
      key: (idx: number) => Array.from(storageMap.keys())[idx] ?? null,
      get length() {
        return storageMap.size;
      },
    };

    try {
      (globalThis as Record<string, unknown>)["window"] = globalThis;
      (globalThis as Record<string, unknown>)["localStorage"] = mockLocalStorage;

      await sqliteEngine.init();

      const makeAnswers = (correct: number, total: number) =>
        Object.fromEntries(
          Array.from({ length: total }, (_, idx) => [
            `q-${idx}`,
            {
              questionId: `q-${idx}`,
              selectedOptionIds: ["o1"],
              isCorrect: idx < correct,
              timeTakenSec: 4,
              pointsAwarded: idx < correct ? 1000 : 0,
              streakCount: 1,
              answeredAt: 1000,
            },
          ]),
        );

      // Bot has rank 1 and higher score than human; human's saved rank in official results MUST be 1
      db.recordExamSession(
        {
          pin: "778811",
          quizId: "quiz-bot-isolation",
          quizTitleEn: "Bot Isolation Exam",
          quizTitleBn: "Bot Isolation Exam",
          hostId: "usr-instructor-1",
          phase: "podium",
          currentQuestionIndex: 4,
          questionStartTime: 1000,
          questionEndTime: 2000,
          settings: {
            speedBonus: true,
            negativeMarking: 0,
            shuffleQuestions: false,
            shuffleOptions: false,
            soundEnabled: true,
            musicEnabled: true,
            isFormalAssessment: true,
            requireRollNumber: true,
            allowedRegionId: "all",
            allowedRegionName: "All Regions",
            passThresholdPct: 50,
          },
          participants: {
            "bot-1": {
              id: "bot-1",
              name: "Cadet Bot",
              nickname: "Cadet Bot",
              avatarEmoji: "🤖",
              avatarBg: "#000000",
              rollNumber: "BOT-01",
              score: 5000,
              streak: 5,
              rank: 1,
              isBot: true,
              answers: makeAnswers(5, 5),
              connected: true,
              lastActive: 1000,
            },
            "hum-1": {
              id: "hum-1",
              name: "Rashedul Islam",
              nickname: "Rashedul Islam",
              avatarEmoji: "🎯",
              avatarBg: "#10b981",
              rollNumber: "HUM-01",
              score: 4000,
              streak: 4,
              rank: 2, // Skewed live by bot ahead of human
              isBot: false,
              answers: makeAnswers(4, 5),
              connected: true,
              lastActive: 1200,
            },
          },
          totalQuestions: 5,
          createdAt: 1000,
          updatedAt: 2000,
        },
        { syncToServer: false },
      );

      const savedHumanResult = db.getExamResults("778811").find((r) => r.rollNumber === "HUM-01");
      expect(savedHumanResult?.rank).toBe(1);
      expect(db.getExamSessions().find((s) => s.pin === "778811")?.participantCount).toBe(1);

      // Re-issuing / caching an unsigned update for an already signed certificate preserves ledger proofs
      db.issueCertificate(
        {
          certificateNumber: "ONN-7788-HUM01",
          studentName: "Rashedul Islam",
          studentRoll: "HUM-01",
          quizTitle: "Bot Isolation Exam",
          score: 4000,
          totalPoints: 5000,
          rank: 1,
          totalParticipants: 1,
          accuracyPercent: 80,
          issueDate: "2026-11-15",
          verified: true,
          ledgerIndex: 42,
          chainHash: "chain-abc-42",
          cryptoSignature: "sig-ed25519-xyz",
          signerKeyId: "ed-key-1",
          rekorStatus: "anchored",
          rekorEntryUuid: "rekor-uuid-42",
        },
        { syncToServer: false },
      );
      db.issueCertificate(
        {
          certificateNumber: "ONN-7788-HUM01",
          studentName: "Rashedul Islam",
          studentRoll: "HUM-01",
          quizTitle: "Bot Isolation Exam",
          score: 4000,
          totalPoints: 5000,
          rank: 1,
          totalParticipants: 1,
          accuracyPercent: 80,
          issueDate: "2026-11-15",
          verified: true,
        },
        { syncToServer: false },
      );
      const preservedCert = db.getCertificateById("ONN-7788-HUM01");
      expect(preservedCert?.cryptoSignature).toBe("sig-ed25519-xyz");
      expect(preservedCert?.chainHash).toBe("chain-abc-42");
      expect(preservedCert?.ledgerIndex).toBe(42);
      expect(preservedCert?.rekorEntryUuid).toBe("rekor-uuid-42");

      // Self-practice session must NOT create official exam sessions, results, or certificates
      db.recordExamSession(
        {
          pin: "665544",
          quizId: "quiz-practice",
          quizTitleEn: "Practice Quiz",
          quizTitleBn: "Practice Quiz",
          hostId: "guest",
          isSelfPractice: true,
          phase: "podium",
          currentQuestionIndex: 4,
          questionStartTime: 1000,
          questionEndTime: 2000,
          settings: {
            speedBonus: true,
            negativeMarking: 0,
            shuffleQuestions: false,
            shuffleOptions: false,
            soundEnabled: true,
            musicEnabled: true,
            isFormalAssessment: false,
            requireRollNumber: false,
            allowedRegionId: "all",
            allowedRegionName: "All Regions",
          },
          participants: {
            "prac-1": {
              id: "prac-1",
              name: "Practice Learner",
              nickname: "Practice Learner",
              avatarEmoji: "📚",
              avatarBg: "#0284c7",
              rollNumber: "PRAC-99",
              score: 5000,
              streak: 5,
              rank: 1,
              isBot: false,
              answers: makeAnswers(5, 5),
              connected: true,
              lastActive: 1000,
            },
          },
          totalQuestions: 5,
          createdAt: 1000,
          updatedAt: 2000,
        },
        { syncToServer: false },
      );
      expect(db.getExamSessions().some((s) => s.pin === "665544")).toBe(false);
      expect(db.getCertificateById("ONN-6655-PRAC99")).toBeUndefined();

      // 4-digit PIN prefix collision: failed attempt must not hide passing session with same 4-digit prefix
      db.recordExamSession(
        {
          pin: "881101",
          quizId: "quiz-prefix-1",
          quizTitleEn: "Attempt 1",
          quizTitleBn: "Attempt 1",
          hostId: "usr-instructor-1",
          phase: "podium",
          currentQuestionIndex: 4,
          questionStartTime: 1000,
          questionEndTime: 2000,
          settings: {
            speedBonus: true,
            negativeMarking: 0,
            shuffleQuestions: false,
            shuffleOptions: false,
            soundEnabled: true,
            musicEnabled: true,
            isFormalAssessment: true,
            requireRollNumber: true,
            allowedRegionId: "all",
            allowedRegionName: "All Regions",
            passThresholdPct: 60,
          },
          participants: {
            "stu-fail": {
              id: "stu-fail",
              name: "Same Student",
              nickname: "Same Student",
              avatarEmoji: "🎯",
              avatarBg: "#000000",
              rollNumber: "COLL-09",
              score: 1000,
              streak: 1,
              rank: 1,
              isBot: false,
              answers: makeAnswers(1, 5),
              connected: true,
              lastActive: 1000,
            },
          },
          totalQuestions: 5,
          createdAt: 1000,
          updatedAt: 2000,
        },
        { syncToServer: false },
      );
      db.recordExamSession(
        {
          pin: "881199",
          quizId: "quiz-prefix-2",
          quizTitleEn: "Attempt 2",
          quizTitleBn: "Attempt 2",
          hostId: "usr-instructor-1",
          phase: "podium",
          currentQuestionIndex: 4,
          questionStartTime: 1000,
          questionEndTime: 2000,
          settings: {
            speedBonus: true,
            negativeMarking: 0,
            shuffleQuestions: false,
            shuffleOptions: false,
            soundEnabled: true,
            musicEnabled: true,
            isFormalAssessment: true,
            requireRollNumber: true,
            allowedRegionId: "all",
            allowedRegionName: "All Regions",
            passThresholdPct: 60,
          },
          participants: {
            "stu-pass": {
              id: "stu-pass",
              name: "Same Student",
              nickname: "Same Student",
              avatarEmoji: "🎯",
              avatarBg: "#000000",
              rollNumber: "COLL-09",
              score: 4000,
              streak: 4,
              rank: 1,
              isBot: false,
              answers: makeAnswers(4, 5),
              connected: true,
              lastActive: 1000,
            },
          },
          totalQuestions: 5,
          createdAt: 1000,
          updatedAt: 2000,
        },
        { syncToServer: false },
      );
      // Clear certificates table to verify deterministic PIN-prefix fallback resolves the PASSING attempt
      sqliteEngine.run("DELETE FROM certificates WHERE LOWER(certificateNumber) = LOWER(?)", [
        "ONN-8811-COLL09",
      ]);
      const resolvedPrefixCert = db.getCertificateById("ONN-8811-COLL09");
      expect(resolvedPrefixCert?.score).toBe(4000);
    } finally {
      if (origWindow === undefined) {
        delete (globalThis as Record<string, unknown>)["window"];
      } else {
        (globalThis as Record<string, unknown>)["window"] = origWindow;
      }
      if (origLocalStorage === undefined) {
        delete (globalThis as Record<string, unknown>)["localStorage"];
      } else {
        (globalThis as Record<string, unknown>)["localStorage"] = origLocalStorage;
      }
    }
  });
});

describe("proctorEngine sustained window_blur grace period", () => {
  it("ignores transient <1500ms focus blips and triggers only on sustained focus loss", async () => {
    vi.useFakeTimers();
    const g = globalThis as Record<string, unknown>;
    const origWindow = g["window"];
    const origDocument = g["document"];
    const windowHandlers: Record<string, EventListenerOrEventListenerObject> = {};
    const docHandlers: Record<string, EventListenerOrEventListenerObject> = {};
    let focused = false;

    try {
      g["window"] = {
        addEventListener: (ev: string, fn: EventListenerOrEventListenerObject) => {
          windowHandlers[ev] = fn;
        },
        removeEventListener: (ev: string) => {
          delete windowHandlers[ev];
        },
      };
      g["document"] = {
        hidden: false,
        fullscreenEnabled: false,
        fullscreenElement: null,
        addEventListener: (ev: string, fn: EventListenerOrEventListenerObject) => {
          docHandlers[ev] = fn;
        },
        removeEventListener: (ev: string) => {
          delete docHandlers[ev];
        },
        hasFocus: () => focused,
      };

      const { proctorEngine } = await import("../proctor-engine");
      const incidents: string[] = [];
      proctorEngine.start("cand-1", "Test Candidate", (inc) => {
        incidents.push(inc.type);
      });

      // Transient 500ms blur (e.g. mobile notification / keyboard) followed by refocus
      focused = false;
      (windowHandlers["blur"] as () => void)?.();
      await vi.advanceTimersByTimeAsync(500);
      focused = true;
      (windowHandlers["focus"] as () => void)?.();
      await vi.advanceTimersByTimeAsync(2000);
      expect(incidents).toHaveLength(0);

      // Sustained blur >1500ms must record one window_blur violation
      focused = false;
      (windowHandlers["blur"] as () => void)?.();
      await vi.advanceTimersByTimeAsync(1600);
      expect(incidents).toEqual(["window_blur"]);

      proctorEngine.stop();
    } finally {
      vi.useRealTimers();
      if (origWindow === undefined) delete g["window"];
      else g["window"] = origWindow;
      if (origDocument === undefined) delete g["document"];
      else g["document"] = origDocument;
    }
  });
});
