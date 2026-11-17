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
  compareParticipantsByMerit,
  computeParticipantAccuracyPct,
  computeParticipantTotalTimeSec,
  computeSpeedBonusPct,
  computeTotalQuizMarks,
  evaluateQuestionAnswer,
  gradeOmrSubmission,
  isPassingScore,
  mergeSessionSettingsPatch,
  resolveOrgName,
  resolvePassThresholdPct,
  resolveQuestionTimeLimitSec,
  resolveStartCountdownSec,
  splitBetweenQuestionDelays,
} from "../scoring";
import { purgeUnderThresholdExamsInStore } from "../exam-purge";
import {
  buildOriginalCompletionIndex,
  computeSessionRetakeDiagnostics,
  findCompletedMatchInIndex,
  getResultSubmittedAnswersCount,
  hasResultSubmittedAnswers,
  mergeRetakeExamResults,
  resolveRetakeMinCompletedAnswers,
} from "../retake-utils";
import { coercePinSearchParam, coerceSearchString } from "../utils";
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
  ExamResultRecord,
  ExamSessionRecord,
  GameSession,
  ManagedUser,
  Question,
  Quiz,
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
import {
  applyPauseGameToSession,
  applyResumeGameToSession,
  buildJoinDirectoryForSession,
  clearDeletedQuizTokensInStore,
  deleteCertificateInStore,
  deleteQuizInStore,
  filterActiveRoomsFromSessions,
  findRosterCandidate,
  isCertificateRevoked,
  isQuestionSubmissionClosed,
  mergeSeededStoreData,
  migrateSanjibonQ3MergeInStore,
  migrateSanjibonQ5ExactInStore,
  resolveSignupRoleForActor,
  restoreCertificateInStore,
  sanitizeLookupCandidate,
  syncCourseInstructorsInStore,
  syncUserCoursesInStore,
  upsertManagedUserInStore,
} from "../server-session";
import { generateQuizWithAi, getAiCredits } from "../ai-generator";
import { normalizeGeneratedQuizPayload, stripMarkdownJsonFence } from "../ai-quiz-core";
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
    expect(
      canActorMutateStoreAction({ id: "inst-1", role: "instructor" }, "restore_certificate").allowed,
    ).toBe(false);
    expect(
      canActorMutateStoreAction({ id: "adm-1", role: "admin" }, "restore_certificate").allowed,
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

  it("grades multi_mcq questions on exact option-letter sets in OMR mode", () => {
    const multiMcq: Question = {
      id: "q-multi",
      textEn: "Select prime numbers",
      textBn: "মৌলিক সংখ্যা নির্বাচন করুন",
      type: "multi_mcq",
      timeLimitSec: 30,
      points: 1000,
      options: [
        { id: "opt-a", textEn: "2", textBn: "২", isCorrect: true },
        { id: "opt-b", textEn: "4", textBn: "৪", isCorrect: false },
        { id: "opt-c", textEn: "5", textBn: "৫", isCorrect: true },
        { id: "opt-d", textEn: "9", textBn: "৯", isCorrect: false },
      ],
      correctOptionIds: ["opt-a", "opt-c"],
    };

    const exactHit = gradeOmrSubmission([multiMcq], { 1: "A, C" }, 0.25);
    expect(exactHit.correct).toBe(1);
    expect(exactHit.incorrect).toBe(0);
    expect(exactHit.netScore).toBeCloseTo(1.0);

    const partialWrong = gradeOmrSubmission([multiMcq], { 1: "A" }, 0.25);
    expect(partialWrong.correct).toBe(0);
    expect(partialWrong.incorrect).toBe(1);
    expect(partialWrong.negativeDeduction).toBeCloseTo(0.25);
    expect(partialWrong.netScore).toBeCloseTo(0);
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

describe("Sanjibon Batch-04 seed curriculum, 10 quizzes & 228 trainees roster", () => {
  it("seeds the official course, 11 training centres, 10 quizzes (20-Q merged Session 03+04 Quiz 3, Quiz 5-10 intact, 140 Qs total), and all 228 trainees", () => {
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
    expect(totalQuestions).toBe(155);
    expect(SANJIBON_QUIZZES[0]?.id).toBe("quiz-sanjibon-s00-baseline");
    expect(SANJIBON_QUIZZES[0]?.quizNumber).toBe(0);
    expect(SANJIBON_QUIZZES[0]?.questions).toHaveLength(20);
    expect(SANJIBON_QUIZZES[3]?.id).toBe("quiz-sanjibon-s03");
    expect(SANJIBON_QUIZZES[3]?.quizNumber).toBe(3);
    expect(SANJIBON_QUIZZES[3]?.questions).toHaveLength(20);
    const quiz4 = SANJIBON_QUIZZES[4];
    expect(quiz4?.id).toBe("quiz-sanjibon-s04");
    expect(quiz4?.quizNumber).toBe(4);
    expect(quiz4?.questions).toHaveLength(10);
    expect(quiz4?.questions.every((q) => q.difficulty === "hard")).toBe(true);
    const quiz5 = SANJIBON_QUIZZES[5];
    expect(quiz5?.id).toBe("quiz-sanjibon-s05");
    expect(quiz5?.quizNumber).toBe(5);
    expect(quiz5?.questions).toHaveLength(15);
    expect(quiz5?.questions[0]?.textBn).toContain("Google AI Studio");
    expect(quiz5?.questions[14]?.textBn).toContain("AI Video Production Consultant");
    expect(quiz5?.questions.every((q) => q.correctOptionIds[0] === "opt-2")).toBe(true);
    expect(SANJIBON_QUIZZES[10]?.id).toBe("quiz-sanjibon-s10-final");
    expect(SANJIBON_QUIZZES[10]?.quizNumber).toBe(10);
    expect(SANJIBON_QUIZZES[10]?.questions).toHaveLength(30);

    // Ensure one-time server store migrations clear stale s03/s04/s05 overrides while keeping custom quizzes
    const mockStore = {
      courses: [{ ...SANJIBON_COURSE, descriptionEn: "stale desc", descriptionBn: "পুরোনো" }],
      customQuizzes: [
        { id: "quiz-sanjibon-s03" } as Quiz,
        { id: "quiz-sanjibon-s04" } as Quiz,
        { id: "quiz-sanjibon-s05" } as Quiz,
        { id: "custom-org-quiz" } as Quiz,
      ],
      deletedQuizIds: ["quiz-sanjibon-s05"],
    };
    const mig = migrateSanjibonQ3MergeInStore(mockStore);
    expect(mig.removedQuizOverrides).toBe(2);
    expect(mig.updatedCourseDesc).toBe(true);
    const mig5 = migrateSanjibonQ5ExactInStore(mockStore);
    expect(mig5.removedQ5Override).toBe(true);
    expect(mockStore.customQuizzes.map((q) => q.id)).toEqual(["custom-org-quiz"]);
    expect(mockStore.deletedQuizIds).toEqual([]);
    expect(mockStore.courses[0]?.descriptionEn).toBe(SANJIBON_COURSE.descriptionEn);
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

describe("course-instructor bidirectional sync & certificate revocation", () => {
  const mkUser = (id: string, name: string, assignedCourseIds: string[] = []): ManagedUser => ({
    id,
    email: `${id}@onnesha.edu`,
    name,
    role: "instructor",
    assignedCourseIds,
    createdAt: "2026-01-01T00:00:00Z",
  });

  const mkCourse = (
    id: string,
    instructorIds: string[],
    instructorNames: string[],
  ): Course => ({
    id,
    code: id.toUpperCase(),
    titleEn: `Course ${id}`,
    titleBn: `Course ${id}`,
    descriptionEn: "Desc",
    descriptionBn: "Desc",
    icon: "award",
    instructorIds,
    instructorNames,
    createdAt: "2026-01-01T00:00:00Z",
  });

  it("adds and removes assignedCourseIds across users when course instructors change", () => {
    const users = [
      mkUser("u1", "Dr. A", ["c-old", "c-1"]),
      mkUser("u2", "Prof. B", []),
    ];
    const course = mkCourse("c-1", ["u2"], ["Prof. B"]);

    const updatedUsers = syncCourseInstructorsInStore(users, course);
    expect(updatedUsers.find((u) => u.id === "u1")?.assignedCourseIds).toEqual(["c-old"]);
    expect(updatedUsers.find((u) => u.id === "u2")?.assignedCourseIds).toEqual(["c-1"]);
  });

  it("syncs course instructorIds and instructorNames when user assignments change", () => {
    const users = [
      mkUser("u1", "Dr. A", []),
      mkUser("u2", "Prof. B Updated", ["c-1", "c-2"]),
    ];
    const courses = [
      mkCourse("c-1", ["u1", "u2"], ["Dr. A", "Prof. B"]),
      mkCourse("c-2", [], []),
    ];

    const updatedCourses = syncUserCoursesInStore(courses, users, users[1]!);
    // u2 already on c-1 -> unchanged; u2 added to c-2 -> appended
    expect(updatedCourses[0]?.instructorIds).toEqual(["u1", "u2"]);
    expect(updatedCourses[1]?.instructorIds).toEqual(["u2"]);
    expect(updatedCourses[1]?.instructorNames).toEqual(["Prof. B Updated"]);

    // Removing c-1 from u2 strips u2 from c-1
    const afterRemove = syncUserCoursesInStore(
      updatedCourses,
      users,
      mkUser("u2", "Prof. B Updated", ["c-2"]),
    );
    expect(afterRemove[0]?.instructorIds).toEqual(["u1"]);
    expect(afterRemove[0]?.instructorNames).toEqual(["Dr. A"]);
  });

  it("detects revoked certificate numbers case-insensitively", () => {
    const store = { revokedCertificates: ["  ONN-1234-ABCD  ", "ONN-9999-WXYZ"] };
    expect(isCertificateRevoked(store, "onn-1234-abcd")).toBe(true);
    expect(isCertificateRevoked(store, "ONN-9999-WXYZ")).toBe(true);
    expect(isCertificateRevoked(store, "ONN-0000-SAFE")).toBe(false);
    expect(isCertificateRevoked(store, "")).toBe(false);
  });
});

describe("public join directory scoping, phone masking & active rooms filter", () => {
  const baseSettings = {
    speedBonus: true,
    negativeMarking: 0,
    shuffleQuestions: false,
    shuffleOptions: false,
    soundEnabled: true,
    musicEnabled: true,
    isFormalAssessment: true,
    requireRollNumber: true,
  };
  const regions: Region[] = [
    { id: "reg-dhk", code: "DHK", nameEn: "Dhaka", nameBn: "ঢাকা", createdAt: "2026-01-01" },
    { id: "reg-ctg", code: "CTG", nameEn: "Chattogram", nameBn: "চট্টগ্রাম", createdAt: "2026-01-01" },
  ];
  const roster: RosterStudent[] = [
    {
      id: "s1",
      rollNumber: "101",
      name: "Candidate One",
      phone: "01711223344",
      regionId: "reg-dhk",
      regionName: "Dhaka",
    },
    {
      id: "s2",
      rollNumber: "102",
      name: "Candidate Two",
      guardianPhone: "01855667788",
      regionId: "reg-ctg",
      regionName: "Chattogram",
    },
  ];

  it("rejects finished/podium/missing rooms and hides roster on self-practice", () => {
    expect(buildJoinDirectoryForSession({ roster, regions, session: undefined }).success).toBe(false);
    expect(
      buildJoinDirectoryForSession({
        roster,
        regions,
        session: { phase: "finished", settings: baseSettings, participants: {} },
      }).success,
    ).toBe(false);

    const selfPracticeDir = buildJoinDirectoryForSession({
      roster,
      regions,
      session: {
        phase: "lobby",
        isSelfPractice: true,
        settings: { ...baseSettings, allowedRegionId: "all", allowedRegionName: "All Regions" },
        participants: {},
      },
    });
    expect(selfPracticeDir.success).toBe(true);
    expect(selfPracticeDir.candidates).toEqual([]);
  });

  it("scopes candidates by allowedRegionId and never exposes raw phone numbers", () => {
    const dir = buildJoinDirectoryForSession({
      roster,
      regions,
      session: {
        phase: "lobby",
        isSelfPractice: false,
        settings: { ...baseSettings, allowedRegionId: "reg-dhk", allowedRegionName: "Dhaka" },
        participants: {
          p1: {
            id: "p1",
            candidateId: "s1",
            name: "Candidate One",
            nickname: "One",
            avatarEmoji: "🎯",
            avatarBg: "#000",
            rollNumber: "101",
            score: 0,
            streak: 0,
            rank: 1,
            answers: {},
            connected: true,
            lastActive: 1000,
          },
        },
      },
    });
    expect(dir.success).toBe(true);
    expect(dir.candidates).toHaveLength(1);
    expect(dir.candidates[0]?.id).toBe("s1");
    expect(dir.candidates[0]?.isAlreadyJoined).toBe(true);
    expect((dir.candidates[0] as Record<string, unknown>)["phone"]).toBeUndefined();
    expect(dir.candidates[0]?.maskedPhone).not.toContain("01711223344");
    expect(dir.candidates[0]?.maskedPhone.endsWith("44")).toBe(true);

    const lookupSanitized = sanitizeLookupCandidate(roster[1]!, false);
    expect(lookupSanitized.phone).toBe("");
    expect(lookupSanitized.maskedPhone).not.toContain("01855667788");
    expect(lookupSanitized.maskedPhone.endsWith("88")).toBe(true);
    expect(lookupSanitized.isSeatLocked).toBe(false);
  });

  it("excludes finished, podium, self-practice, and stale sessions from active rooms list", () => {
    const now = 10_000_000;
    const cutoff = now - 4 * 3600 * 1000;
    const mkLive = (
      pin: string,
      phase: "lobby" | "question" | "podium" | "finished",
      updatedAt: number,
      isSelfPractice = false,
    ) => ({
      pin,
      quizId: "q1",
      quizTitleEn: `Exam ${pin}`,
      quizTitleBn: `Exam ${pin}`,
      hostId: "host-1",
      phase,
      currentQuestionIndex: 0,
      questionStartTime: 0,
      questionEndTime: 0,
      settings: baseSettings,
      participants: {},
      createdAt: now,
      updatedAt,
      totalQuestions: 10,
      questions: [],
      isSelfPractice,
    });

    const active = filterActiveRoomsFromSessions(
      {
        "100001": mkLive("100001", "lobby", now),
        "100002": mkLive("100002", "question", now - 100),
        "100003": mkLive("100003", "podium", now),
        "100004": mkLive("100004", "finished", now),
        "100005": mkLive("100005", "lobby", now, true),
        "100006": mkLive("100006", "lobby", cutoff - 1),
      },
      cutoff,
    );
    expect(active.map((r) => r.pin)).toEqual(["100001", "100002"]);
  });
});

describe("server-session domain state transitions & safeguards", () => {
  it("resolves signup roles strictly based on caller authority", () => {
    expect(resolveSignupRoleForActor(null, "candidate")).toEqual({
      allowed: true,
      role: "candidate",
    });
    expect(resolveSignupRoleForActor(null, "instructor").allowed).toBe(false);
    expect(resolveSignupRoleForActor(null, "admin").allowed).toBe(false);
    expect(resolveSignupRoleForActor({ role: "instructor" }, "instructor").allowed).toBe(false);
    expect(resolveSignupRoleForActor({ role: "admin" }, "instructor")).toEqual({
      allowed: true,
      role: "instructor",
    });
  });

  it("preserves passwordHash when placeholder or blank is sent on user update and hashes new passwords", () => {
    const existing: ManagedUser = {
      id: "usr-inst-1",
      name: "Instructor One",
      email: "inst1@onnesha.app",
      passwordHash: "scrypt:salt01:hash01",
      role: "instructor",
      institution: "Onnesha Academy",
      assignedCourseIds: [],
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const preservedPlaceholder = upsertManagedUserInStore([existing], {
      ...existing,
      name: "Instructor Updated",
      passwordHash: "instructor123",
    });
    expect(preservedPlaceholder.success).toBe(true);
    expect(preservedPlaceholder.savedUser?.passwordHash).toBe("scrypt:salt01:hash01");
    expect(preservedPlaceholder.savedUser?.name).toBe("Instructor Updated");

    const preservedBlank = upsertManagedUserInStore([existing], {
      ...existing,
      passwordHash: "   ",
    });
    expect(preservedBlank.success).toBe(true);
    expect(preservedBlank.savedUser?.passwordHash).toBe("scrypt:salt01:hash01");

    const rejectedNew = upsertManagedUserInStore([existing], {
      ...existing,
      id: "usr-new",
      email: "new@onnesha.app",
      passwordHash: "",
    });
    expect(rejectedNew.success).toBe(false);

    const createdNew = upsertManagedUserInStore([existing], {
      ...existing,
      id: "usr-new",
      email: "new@onnesha.app",
      passwordHash: "StrongPass!2026",
    });
    expect(createdNew.success).toBe(true);
    expect(createdNew.savedUser?.passwordHash?.startsWith("scrypt:")).toBe(true);
    expect(
      verifyPasswordScrypt("StrongPass!2026", createdNew.savedUser!.passwordHash!).valid,
    ).toBe(true);
  });

  it("archives revoked certificates on delete and restores them cleanly", () => {
    const cert: CertificateData = {
      id: "cert-1",
      certificateNumber: "ONN-2026-0101",
      studentName: "Rafiqul Islam",
      studentRoll: "2026-101",
      quizTitle: "Model Test 1",
      score: 4000,
      marksObtained: 4000,
      totalPoints: 5000,
      totalMarks: 5000,
      rank: 1,
      totalParticipants: 25,
      accuracyPercent: 80,
      issueDate: "2026-11-15",
      verified: true,
    };

    const store: {
      certificates: CertificateData[];
      revokedCertificates: string[];
      revokedCertificateArchive: Record<string, CertificateData>;
    } = {
      certificates: [cert],
      revokedCertificates: [],
      revokedCertificateArchive: {},
    };

    expect(deleteCertificateInStore(store, "onn-2026-0101")).toBe(true);
    expect(store.certificates).toHaveLength(0);
    expect(store.revokedCertificates).toEqual(["ONN-2026-0101"]);
    expect(store.revokedCertificateArchive["ONN-2026-0101"]?.studentName).toBe("Rafiqul Islam");

    expect(restoreCertificateInStore(store, " ONN-2026-0101 ")).toBe(true);
    expect(store.certificates).toHaveLength(1);
    expect(store.certificates[0]?.certificateNumber).toBe("ONN-2026-0101");
    expect(store.revokedCertificates).toEqual([]);
    expect(store.revokedCertificateArchive["ONN-2026-0101"]).toBeUndefined();
  });

  it("enforces question submission lock in chart/leaderboard phases and supports pause/resume timing", () => {
    const currentQ: Question = {
      id: "q-live-1",
      textEn: "Sample Q",
      textBn: "নমুনা প্রশ্ন",
      type: "single_mcq",
      timeLimitSec: 20,
      points: 1000,
      options: [],
      correctOptionIds: [],
    };

    expect(
      isQuestionSubmissionClosed({ phase: "question", currentQuestion: currentQ }, "q-live-1"),
    ).toBe(false);
    expect(
      isQuestionSubmissionClosed({ phase: "chart", currentQuestion: currentQ }, "q-live-1"),
    ).toBe(true);
    expect(
      isQuestionSubmissionClosed(
        { phase: "leaderboard", currentQuestion: currentQ },
        "q-live-1",
      ),
    ).toBe(true);
    expect(
      isQuestionSubmissionClosed({ phase: "chart", currentQuestion: currentQ }, "q-other"),
    ).toBe(false);

    const session: Parameters<typeof applyPauseGameToSession>[0] = {
      pin: "445566",
      quizId: "quiz-1",
      quizTitleEn: "Live Exam",
      quizTitleBn: "লাইভ পরীক্ষা",
      hostId: "host-1",
      phase: "lobby",
      currentQuestionIndex: 0,
      currentQuestion: currentQ,
      questionStartTime: 10_000,
      questionEndTime: 30_000,
      settings: {
        timePerQuestion: 20,
        speedBonus: true,
        negativeMarking: 0.25,
        shuffleQuestions: false,
        shuffleOptions: false,
        soundEnabled: true,
        musicEnabled: true,
        isFormalAssessment: true,
        requireRollNumber: false,
      },
      participants: {},
      createdAt: 5_000,
      updatedAt: 5_000,
      totalQuestions: 1,
    };

    // Cannot pause in lobby phase
    expect(applyPauseGameToSession(session, 12_000)).toBe(false);
    expect(session.pausedAt).toBeUndefined();

    // Pause succeeds in question phase and resume shifts deadline by exact pause duration
    session.phase = "question";
    expect(applyPauseGameToSession(session, 15_000)).toBe(true);
    expect(session.pausedAt).toBe(15_000);
    // Double pause returns false
    expect(applyPauseGameToSession(session, 16_000)).toBe(false);

    expect(applyResumeGameToSession(session, 22_500)).toBe(true);
    expect(session.pausedAt).toBeUndefined();
    expect(session.questionStartTime).toBe(17_500);
    expect(session.questionEndTime).toBe(37_500);
    expect(session.updatedAt).toBe(22_500);
  });

  it("scores sub-second response speed, breaks merit ties by speed, and merges timing settings cleanly", () => {
    const timedQ: Question = {
      id: "q-speed-1",
      textEn: "Speed test question",
      textBn: "গতি পরীক্ষার প্রশ্ন",
      type: "single_mcq",
      timeLimitSec: 20,
      points: 1000,
      options: [
        { id: "a", textEn: "Right", textBn: "সঠিক", isCorrect: true },
        { id: "b", textEn: "Wrong", textBn: "ভুল", isCorrect: false },
      ],
      correctOptionIds: ["a"],
    };

    const ultraFast = evaluateQuestionAnswer({
      question: timedQ,
      selectedOptionIds: ["a"],
      currentStreak: 0,
      timeTakenSec: 0.4,
      speedBonus: true,
      negativeMarking: 0.25,
    });
    const oneSec = evaluateQuestionAnswer({
      question: timedQ,
      selectedOptionIds: ["a"],
      currentStreak: 0,
      timeTakenSec: 1.0,
      speedBonus: true,
      negativeMarking: 0.25,
    });
    const slow = evaluateQuestionAnswer({
      question: timedQ,
      selectedOptionIds: ["a"],
      currentStreak: 0,
      timeTakenSec: 10.0,
      speedBonus: true,
      negativeMarking: 0.25,
    });

    expect(ultraFast.pointsAwarded).toBe(990);
    expect(oneSec.pointsAwarded).toBe(975);
    expect(slow.pointsAwarded).toBe(750);
    expect(ultraFast.pointsAwarded).toBeGreaterThan(oneSec.pointsAwarded);
    expect(oneSec.pointsAwarded).toBeGreaterThan(slow.pointsAwarded);

    const noSpeedA = evaluateQuestionAnswer({
      question: timedQ,
      selectedOptionIds: ["a"],
      currentStreak: 0,
      timeTakenSec: 0.4,
      speedBonus: false,
      negativeMarking: 0,
    });
    const noSpeedB = evaluateQuestionAnswer({
      question: timedQ,
      selectedOptionIds: ["a"],
      currentStreak: 0,
      timeTakenSec: 18,
      speedBonus: false,
      negativeMarking: 0,
    });
    expect(noSpeedA.pointsAwarded).toBe(1000);
    expect(noSpeedB.pointsAwarded).toBe(1000);

    expect(computeSpeedBonusPct(0.4, 20, true)).toBe(99);
    expect(computeSpeedBonusPct(20, 20, true)).toBe(50);
    expect(computeSpeedBonusPct(15, 20, false)).toBe(100);

    // Merit tie-breaking: equal score & accuracy prefers faster cumulative response time
    const slowerSameScore = {
      id: "p-slow",
      score: 1800,
      lastActive: 1000,
      answers: {
        q1: {
          questionId: "q1",
          selectedOptionIds: ["a"],
          isCorrect: true,
          timeTakenSec: 9.2,
          pointsAwarded: 900,
          streakCount: 1,
        },
        q2: {
          questionId: "q2",
          selectedOptionIds: ["a"],
          isCorrect: true,
          timeTakenSec: 8.8,
          pointsAwarded: 900,
          streakCount: 2,
        },
      },
    };
    const fasterSameScore = {
      id: "p-fast",
      score: 1800,
      lastActive: 5000,
      answers: {
        q1: {
          questionId: "q1",
          selectedOptionIds: ["a"],
          isCorrect: true,
          timeTakenSec: 2.1,
          pointsAwarded: 900,
          streakCount: 1,
        },
        q2: {
          questionId: "q2",
          selectedOptionIds: ["a"],
          isCorrect: true,
          timeTakenSec: 3.4,
          pointsAwarded: 900,
          streakCount: 2,
        },
      },
    };
    expect(computeParticipantTotalTimeSec(fasterSameScore)).toBe(5.5);
    expect(computeParticipantTotalTimeSec(slowerSameScore)).toBe(18);
    const ranked = [slowerSameScore, fasterSameScore].sort(compareParticipantsByMerit);
    expect(ranked.map((p) => p.id)).toEqual(["p-fast", "p-slow"]);

    // Timing overrides & settings merge
    expect(resolveQuestionTimeLimitSec(timedQ, { timePerQuestion: 45 })).toBe(45);
    expect(resolveQuestionTimeLimitSec(timedQ, { timePerQuestion: 0 })).toBe(20);
    expect(resolveStartCountdownSec(undefined)).toBe(3);
    expect(resolveStartCountdownSec(0)).toBe(0);
    expect(resolveStartCountdownSec(12)).toBe(12);
    expect(splitBetweenQuestionDelays(0)).toEqual({
      enabled: false,
      totalSec: 0,
      chartSec: 0,
      leaderboardSec: 0,
    });
    expect(splitBetweenQuestionDelays(7)).toEqual({
      enabled: true,
      totalSec: 7,
      chartSec: 4,
      leaderboardSec: 3,
    });

    const patched = mergeSessionSettingsPatch(
      {
        timePerQuestion: 30,
        speedBonus: true,
        negativeMarking: 0,
        shuffleQuestions: false,
        shuffleOptions: false,
        soundEnabled: true,
        musicEnabled: true,
        isFormalAssessment: true,
        requireRollNumber: true,
      },
      {
        negativeMarking: 0.25,
        timePerQuestion: 0,
        betweenQuestionSec: 8,
        startCountdownSec: 5,
        speedBonus: false,
      },
    );
    expect(patched.negativeMarking).toBe(0.25);
    expect(patched.timePerQuestion).toBeUndefined();
    expect(patched.betweenQuestionSec).toBe(8);
    expect(patched.startCountdownSec).toBe(5);
    expect(patched.speedBonus).toBe(false);
  });

  it("purges taken exam sessions with < 50 examinees and all related records while preserving >= 50 sessions and curriculum", () => {
    expect(canActorMutateStoreAction({ id: "usr-super-admin", role: "admin" }, "purge_under_50_sessions").allowed).toBe(true);
    expect(canActorMutateStoreAction({ id: "usr-instructor-1", role: "instructor" }, "purge_under_50_sessions").allowed).toBe(false);
    expect(canActorMutateStoreAction(null, "purge_under_50_sessions").allowed).toBe(false);

    const makeResult = (
      idx: number,
      sessionId: string,
      pin: string,
      prefix = "std",
    ): ExamResultRecord => ({
      id: `res-${sessionId}-${idx}`,
      sessionId,
      pin,
      participantId: `${prefix}-${idx}`,
      rollNumber: `${prefix.toUpperCase()}-${100 + idx}`,
      name: `Candidate ${idx}`,
      phone: `0171000${String(idx).padStart(4, "0")}`,
      regionId: "reg-dhaka",
      regionName: "Dhaka",
      score: 900,
      rank: idx,
      correctCount: 9,
      incorrectCount: 1,
      unattemptedCount: 0,
      accuracyPct: 90,
      passed: true,
      answersJson: "{}",
      createdAt: "2026-11-15T10:00:00.000Z",
    });

    const keptSession: ExamSessionRecord = {
      id: "es-large-1",
      pin: "900111",
      quizId: "quiz-sanjibon-1",
      quizTitleEn: "Sanjibon Mega Exam",
      quizTitleBn: "সঞ্জীবন মেগা পরীক্ষা",
      hostId: "usr-super-admin",
      allowedRegionId: "all",
      allowedRegionName: "All Regions",
      totalQuestions: 10,
      participantCount: 52,
      averageScore: 820,
      highestScore: 980,
      passThresholdPct: 50,
      createdAt: "2026-11-15T09:00:00.000Z",
    };

    const smallRealSession: ExamSessionRecord = {
      id: "es-small-1",
      pin: "445511",
      quizId: "quiz-sanjibon-2",
      quizTitleEn: "Small Trial Quiz",
      quizTitleBn: "ছোট ট্রায়াল",
      hostId: "usr-super-admin",
      allowedRegionId: "all",
      allowedRegionName: "All Regions",
      totalQuestions: 10,
      participantCount: 52, // inflated by bots
      averageScore: 700,
      highestScore: 900,
      passThresholdPct: 50,
      createdAt: "2026-11-15T11:00:00.000Z",
    };

    const legacySmallMetadataOnly: ExamSessionRecord = {
      id: "es-small-legacy",
      pin: "332211",
      quizId: "quiz-sanjibon-3",
      quizTitleEn: "Legacy Tiny Session",
      quizTitleBn: "পুরাতন সেশন",
      hostId: "usr-super-admin",
      allowedRegionId: "all",
      allowedRegionName: "All Regions",
      totalQuestions: 5,
      participantCount: 14,
      averageScore: 400,
      highestScore: 500,
      createdAt: "2026-11-10T10:00:00.000Z",
    };

    const largeResults = Array.from({ length: 52 }, (_, i) =>
      makeResult(i + 1, "es-large-1", "900111", "big"),
    );
    const smallRealResults = Array.from({ length: 12 }, (_, i) =>
      makeResult(i + 1, "es-small-1", "445511", "sml"),
    );
    const smallBotResults = Array.from({ length: 40 }, (_, i) =>
      makeResult(i + 100, "es-small-1", "445511", "bot"),
    );
    const orphanSmallResults = [
      makeResult(1, "es-orphan-pin", "778899", "orp"),
      makeResult(2, "es-orphan-pin", "778899", "orp"),
    ];

    const keptCert: CertificateData = {
      id: "cert-kept",
      certificateNumber: "ONN-9001-BIG101",
      studentName: "Candidate 1",
      studentRoll: "BIG-101",
      quizTitle: "Sanjibon Mega Exam",
      score: 900,
      totalPoints: 1000,
      rank: 1,
      totalParticipants: 52,
      accuracyPercent: 90,
      issueDate: "2026-11-15",
      verified: true,
    };
    const smallCert: CertificateData = {
      id: "cert-small",
      certificateNumber: "ONN-4455-SML101",
      studentName: "Candidate 1",
      studentRoll: "SML-101",
      quizTitle: "Small Trial Quiz",
      score: 900,
      totalPoints: 1000,
      rank: 1,
      totalParticipants: 12,
      accuracyPercent: 90,
      issueDate: "2026-11-15",
      verified: true,
    };
    const smallRevokedCert: CertificateData = {
      id: "cert-small-revoked",
      certificateNumber: "ONN-4455-SML102",
      studentName: "Candidate 2",
      studentRoll: "SML-102",
      quizTitle: "Small Trial Quiz",
      score: 850,
      totalPoints: 1000,
      rank: 2,
      totalParticipants: 12,
      accuracyPercent: 85,
      issueDate: "2026-11-15",
      verified: true,
    };
    const unrelatedManualCert: CertificateData = {
      id: "cert-manual-standalone",
      certificateNumber: "ONN-2026-MANUAL01",
      studentName: "Manual Awardee",
      studentRoll: "EXT-001",
      quizTitle: "Special Annual Olympiad",
      score: 100,
      totalPoints: 100,
      rank: 1,
      totalParticipants: 1,
      accuracyPercent: 100,
      issueDate: "2026-11-01",
      verified: true,
    };

    const store = {
      examSessions: [keptSession, smallRealSession, legacySmallMetadataOnly],
      examResults: [...largeResults, ...smallRealResults, ...smallBotResults, ...orphanSmallResults],
      certificates: [keptCert, smallCert, unrelatedManualCert],
      revokedCertificates: ["ONN-4455-SML102", "ONN-2026-KEPTREV"],
      revokedCertificateArchive: {
        "ONN-4455-SML102": smallRevokedCert,
      } as Record<string, CertificateData>,
      smsLogs: [
        {
          id: "sms-kept",
          recipientPhone: "01710000001",
          studentName: "Candidate 1",
          rollNumber: "BIG-101",
          quizTitle: "Sanjibon Mega Exam",
          score: 900,
          rank: 1,
          messageText: "Congrats",
          status: "delivered",
          createdAt: "2026-11-15T10:05:00.000Z",
        },
        {
          id: "sms-small-1",
          recipientPhone: "01710000001",
          studentName: "Candidate 1",
          rollNumber: "SML-101",
          quizTitle: "Small Trial Quiz",
          score: 900,
          rank: 1,
          messageText: "Result",
          status: "delivered",
          createdAt: "2026-11-15T11:05:00.000Z",
        },
        {
          id: "sms-legacy-small",
          recipientPhone: "01799999999",
          studentName: "Old Student",
          rollNumber: "OLD-01",
          quizTitle: "Legacy Tiny Session",
          score: 400,
          rank: 1,
          messageText: "Result",
          status: "delivered",
          createdAt: "2026-11-10T10:05:00.000Z",
        },
      ],
    };

    const liveSessions: Record<
      string,
      Pick<GameSession, "pin" | "phase" | "participants"> & { id?: string }
    > = {
      "445511": {
        id: "es-small-1",
        pin: "445511",
        phase: "podium",
        participants: {
          "sml-1": { id: "sml-1" } as GameSession["participants"][string],
        },
      },
      "888777": {
        id: "live-active-lobby",
        pin: "888777",
        phase: "lobby",
        participants: {
          "p-1": { id: "p-1" } as GameSession["participants"][string],
        },
      },
    };

    const summary = purgeUnderThresholdExamsInStore(store, 50, liveSessions);

    expect(summary).toEqual({
      minExaminees: 50,
      removedSessions: 2,
      removedResults: 54,
      removedCertificates: 1,
      removedRevokedCerts: 1,
      removedSmsLogs: 2,
      removedLiveSessions: 1,
      keptSessions: 1,
      changed: true,
    });
    expect(store.examSessions.map((s) => s.id)).toEqual(["es-large-1"]);
    expect(store.examResults).toHaveLength(52);
    expect(store.examResults.every((r) => r.sessionId === "es-large-1")).toBe(true);
    expect(store.certificates.map((c) => c.id)).toEqual(["cert-kept", "cert-manual-standalone"]);
    expect(store.revokedCertificates).toEqual(["ONN-2026-KEPTREV"]);
    expect(Object.keys(store.revokedCertificateArchive)).toEqual([]);
    expect(store.smsLogs.map((s) => s.id)).toEqual(["sms-kept"]);
    expect(liveSessions["445511"]).toBeUndefined();
    expect(liveSessions["888777"]).toBeDefined();

    // Idempotent second run changes nothing
    const secondRun = purgeUnderThresholdExamsInStore(store, 50, liveSessions);
    expect(secondRun.changed).toBe(false);
    expect(secondRun.keptSessions).toBe(1);
  });
});

describe("supplementary retake diagnostics, completion exclusion & result merging", () => {
  const regions: Region[] = [
    { id: "reg-dhaka", code: "DHK", nameEn: "Dhaka", nameBn: "ঢাকা", createdAt: "2026-01-01" },
    { id: "reg-sylhet", code: "SYL", nameEn: "Sylhet", nameBn: "সিলেট", createdAt: "2026-01-01" },
    { id: "reg-ctg", code: "CTG", nameEn: "Chattogram", nameBn: "চট্টগ্রাম", createdAt: "2026-01-01" },
  ];

  const roster: RosterStudent[] = [
    {
      id: "st-1",
      rollNumber: "ONN-101",
      name: "Completed Dhaka",
      phone: "01711111111",
      regionId: "reg-dhaka",
      regionName: "Dhaka",
    },
    {
      id: "st-2",
      rollNumber: "ONN-102",
      name: "Zero Attempt Sylhet",
      phone: "01722222222",
      regionId: "reg-sylhet",
      regionName: "Sylhet",
    },
    {
      id: "st-3",
      rollNumber: "ONN-103",
      name: "Missing Roster CTG",
      phone: "01733333333",
      regionId: "reg-ctg",
      regionName: "Chattogram",
    },
  ];

  const origSession: ExamSessionRecord = {
    id: "es-exam2",
    pin: "554433",
    quizId: "quiz-2",
    quizTitleEn: "Second Nationwide Model Exam",
    quizTitleBn: "দ্বিতীয় মডেল পরীক্ষা",
    hostId: "usr-super-admin",
    allowedRegionId: "all",
    allowedRegionName: "All Regions",
    totalQuestions: 10,
    participantCount: 2,
    averageScore: 425,
    highestScore: 850,
    passThresholdPct: 50,
    createdAt: "2026-11-15T10:00:00.000Z",
  };

  const completedDhakaResult: ExamResultRecord = {
    id: "res-554433-ONN101",
    sessionId: "es-exam2",
    pin: "554433",
    participantId: "p-1",
    rollNumber: "ONN-101",
    name: "Completed Dhaka",
    phone: "01711111111",
    regionId: "reg-dhaka",
    regionName: "Dhaka",
    score: 850,
    rank: 1,
    correctCount: 9,
    incorrectCount: 1,
    unattemptedCount: 0,
    accuracyPct: 90,
    passed: true,
    answersJson: JSON.stringify({ q1: { timeTakenSec: 3.5 } }),
    createdAt: "2026-11-15T10:20:00.000Z",
  };

  const zeroAttemptSylhetResult: ExamResultRecord = {
    id: "res-554433-ONN102",
    sessionId: "es-exam2",
    pin: "554433",
    participantId: "p-2",
    rollNumber: "ONN-102",
    name: "Zero Attempt Sylhet",
    phone: "01722222222",
    regionId: "reg-sylhet",
    regionName: "Sylhet",
    score: 0,
    rank: 2,
    correctCount: 0,
    incorrectCount: 0,
    unattemptedCount: 10,
    accuracyPct: 0,
    passed: false,
    answersJson: "{}",
    createdAt: "2026-11-15T10:20:05.000Z",
  };

  it("distinguishes submitted attempts from zero-attempt joins and indexes completed examinees", () => {
    expect(hasResultSubmittedAnswers(completedDhakaResult)).toBe(true);
    expect(hasResultSubmittedAnswers(zeroAttemptSylhetResult)).toBe(false);
    expect(
      hasResultSubmittedAnswers({
        correctCount: 0,
        incorrectCount: 0,
        answersJson: JSON.stringify({ q1: { selected: 0 } }),
      }),
    ).toBe(true);

    const index = buildOriginalCompletionIndex(
      [completedDhakaResult, zeroAttemptSylhetResult],
      origSession.id,
      origSession.pin,
    );
    expect(index.completedCount).toBe(1);
    expect(index.zeroAttemptCount).toBe(1);

    expect(
      findCompletedMatchInIndex(index, { rollNumber: "onn 101" })?.rollNumber,
    ).toBe("ONN-101");
    expect(
      findCompletedMatchInIndex(index, { phone: "+8801711111111" })?.name,
    ).toBe("Completed Dhaka");
    expect(
      findCompletedMatchInIndex(index, {
        rollNumber: "ONN-102",
        phone: "01722222222",
      }),
    ).toBeUndefined();
  });

  it("computes per-region retake diagnostics separating completed, zero-attempt, and missing roster candidates", () => {
    const diag = computeSessionRetakeDiagnostics({
      session: origSession,
      examResults: [completedDhakaResult, zeroAttemptSylhetResult],
      roster,
      regions,
    });

    expect(diag.completedCount).toBe(1);
    expect(diag.zeroAttemptCount).toBe(1);
    expect(diag.missingRosterCount).toBe(1);
    expect(diag.totalEligibleRetakeCount).toBe(2);

    // Region with zero-attempt issues sorts first
    expect(diag.regionBreakdown[0]).toMatchObject({
      regionId: "reg-sylhet",
      completedCount: 0,
      zeroAttemptCount: 1,
      missingRosterCount: 0,
      eligibleRetakeCount: 1,
    });
    const ctg = diag.regionBreakdown.find((r) => r.regionId === "reg-ctg");
    expect(ctg).toMatchObject({
      completedCount: 0,
      zeroAttemptCount: 0,
      missingRosterCount: 1,
      eligibleRetakeCount: 1,
    });
    const dhk = diag.regionBreakdown.find((r) => r.regionId === "reg-dhaka");
    expect(dhk).toMatchObject({
      completedCount: 1,
      zeroAttemptCount: 0,
      missingRosterCount: 0,
      eligibleRetakeCount: 0,
    });
  });

  it("merges supplementary retake marks into original session while keeping Run 1 completed scores intact", () => {
    const makeupSylhetResult: ExamResultRecord = {
      id: "res-998877-ONN102",
      sessionId: "es-makeup-1",
      pin: "998877",
      participantId: "pm-1",
      rollNumber: "ONN-102",
      name: "Zero Attempt Sylhet",
      phone: "01722222222",
      regionId: "reg-sylhet",
      regionName: "Sylhet",
      score: 920,
      rank: 1,
      correctCount: 9,
      incorrectCount: 1,
      unattemptedCount: 0,
      accuracyPct: 90,
      passed: true,
      answersJson: JSON.stringify({ q1: { timeTakenSec: 2.1 } }),
      createdAt: "2026-11-16T05:00:00.000Z",
    };

    const makeupMissingCtgResult: ExamResultRecord = {
      id: "res-998877-ONN103",
      sessionId: "es-makeup-1",
      pin: "998877",
      participantId: "pm-2",
      rollNumber: "ONN-103",
      name: "Missing Roster CTG",
      phone: "01733333333",
      regionId: "reg-ctg",
      regionName: "Chattogram",
      score: 850,
      rank: 2,
      correctCount: 9,
      incorrectCount: 1,
      unattemptedCount: 0,
      accuracyPct: 90,
      passed: true,
      answersJson: JSON.stringify({ q1: { timeTakenSec: 2.0 } }), // faster tie-breaker vs 3.5s
      createdAt: "2026-11-16T05:01:00.000Z",
    };

    const merged = mergeRetakeExamResults({
      origSession,
      existingResults: [completedDhakaResult, zeroAttemptSylhetResult],
      makeupResults: [makeupSylhetResult, makeupMissingCtgResult],
      nowIso: "2026-11-16T05:10:00.000Z",
    });

    expect(merged.updatedSession.id).toBe("es-exam2");
    expect(merged.updatedSession.pin).toBe("554433");
    expect(merged.updatedSession.participantCount).toBe(3);
    expect(merged.updatedSession.highestScore).toBe(920);
    expect(merged.updatedSession.averageScore).toBe(Math.round((920 + 850 + 850) / 3));
    expect(merged.updatedSession.makeupRunsCount).toBe(1);
    expect(merged.updatedSession.lastMakeupAt).toBe("2026-11-16T05:10:00.000Z");

    // Zero-attempt row replaced, Run 1 completed ONN-101 preserved, unified ranks computed
    expect(merged.mergedResults.map((r) => [r.rollNumber, r.score, r.rank, r.sessionId])).toEqual([
      ["ONN-102", 920, 1, "es-exam2"],
      ["ONN-103", 850, 2, "es-exam2"], // faster response time beats ONN-101 at equal 850 score
      ["ONN-101", 850, 3, "es-exam2"],
    ]);
  });

  it("excludes completed original examinees from retake join directory while keeping missed/0-attempt examinees", () => {
    const retakeDirAll = buildJoinDirectoryForSession({
      roster,
      regions,
      examResults: [completedDhakaResult, zeroAttemptSylhetResult],
      session: {
        phase: "lobby",
        isSelfPractice: false,
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
          retakeForSessionId: "es-exam2",
          retakeOriginPin: "554433",
          retakeSkipCompleted: true,
        },
        participants: {},
      },
    });

    expect(retakeDirAll.success).toBe(true);
    expect(retakeDirAll.candidates.map((c) => c.rollNumber)).toEqual(["ONN-102", "ONN-103"]);

    const retakeDirSylhetOnly = buildJoinDirectoryForSession({
      roster,
      regions,
      examResults: [completedDhakaResult, zeroAttemptSylhetResult],
      session: {
        phase: "lobby",
        isSelfPractice: false,
        settings: {
          speedBonus: true,
          negativeMarking: 0,
          shuffleQuestions: false,
          shuffleOptions: false,
          soundEnabled: true,
          musicEnabled: true,
          isFormalAssessment: true,
          requireRollNumber: true,
          allowedRegionId: "reg-sylhet",
          allowedRegionName: "Sylhet",
          retakeForSessionId: "es-exam2",
          retakeOriginPin: "554433",
          retakeSkipCompleted: true,
        },
        participants: {},
      },
    });

    expect(retakeDirSylhetOnly.success).toBe(true);
    expect(retakeDirSylhetOnly.candidates.map((c) => c.rollNumber)).toEqual(["ONN-102"]);
  });

  it("supports configurable minimum submitted answer thresholds (2, 3+) in retake diagnostics & exclusion", () => {
    expect(resolveRetakeMinCompletedAnswers(undefined)).toBe(1);
    expect(resolveRetakeMinCompletedAnswers(0)).toBe(1);
    expect(resolveRetakeMinCompletedAnswers(2)).toBe(2);
    expect(resolveRetakeMinCompletedAnswers(3.6)).toBe(4);

    const partialDhakaResult: ExamResultRecord = {
      id: "res-554433-ONN104",
      sessionId: "es-exam2",
      pin: "554433",
      participantId: "p-4",
      rollNumber: "ONN-104",
      name: "Disconnected After 2 Qs",
      phone: "01744444444",
      regionId: "reg-dhaka",
      regionName: "Dhaka",
      score: 180,
      rank: 3,
      correctCount: 2,
      incorrectCount: 0,
      unattemptedCount: 8,
      accuracyPct: 20,
      passed: false,
      answersJson: "{}",
      createdAt: "2026-11-15T10:21:00.000Z",
    };

    expect(getResultSubmittedAnswersCount(partialDhakaResult)).toBe(2);
    expect(hasResultSubmittedAnswers(partialDhakaResult, 2)).toBe(true);
    expect(hasResultSubmittedAnswers(partialDhakaResult, 3)).toBe(false);

    const extendedRoster: RosterStudent[] = [
      ...roster,
      {
        id: "st-4",
        rollNumber: "ONN-104",
        name: "Disconnected After 2 Qs",
        phone: "01744444444",
        regionId: "reg-dhaka",
        regionName: "Dhaka",
      },
    ];

    // With threshold = 2: ONN-104 (2 answers) and ONN-101 (10 answers) are completed
    const diagMin2 = computeSessionRetakeDiagnostics({
      session: origSession,
      examResults: [completedDhakaResult, zeroAttemptSylhetResult, partialDhakaResult],
      roster: extendedRoster,
      regions,
      minCompletedAnswers: 2,
    });
    expect(diagMin2.minCompletedAnswers).toBe(2);
    expect(diagMin2.completedCount).toBe(2);
    expect(diagMin2.zeroAttemptCount).toBe(1);
    expect(diagMin2.partialBelowThresholdCount).toBe(0);
    expect(diagMin2.missingRosterCount).toBe(1);
    expect(diagMin2.totalEligibleRetakeCount).toBe(2);

    // With threshold = 3: ONN-104 (2 < 3) moves into partialBelowThresholdCount and becomes retake-eligible
    const diagMin3 = computeSessionRetakeDiagnostics({
      session: origSession,
      examResults: [completedDhakaResult, zeroAttemptSylhetResult, partialDhakaResult],
      roster: extendedRoster,
      regions,
      minCompletedAnswers: 3,
    });
    expect(diagMin3.minCompletedAnswers).toBe(3);
    expect(diagMin3.completedCount).toBe(1);
    expect(diagMin3.zeroAttemptCount).toBe(1);
    expect(diagMin3.partialBelowThresholdCount).toBe(1);
    expect(diagMin3.missingRosterCount).toBe(1);
    expect(diagMin3.totalEligibleRetakeCount).toBe(3);

    const dirMin3 = buildJoinDirectoryForSession({
      roster: extendedRoster,
      regions,
      examResults: [completedDhakaResult, zeroAttemptSylhetResult, partialDhakaResult],
      session: {
        phase: "lobby",
        isSelfPractice: false,
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
          retakeForSessionId: "es-exam2",
          retakeOriginPin: "554433",
          retakeSkipCompleted: true,
          retakeMinCompletedAnswers: 3,
        },
        participants: {},
      },
    });
    expect(dirMin3.candidates.map((c) => c.rollNumber)).toEqual(["ONN-102", "ONN-103", "ONN-104"]);

    const patched = mergeSessionSettingsPatch(
      {
        speedBonus: true,
        negativeMarking: 0.25,
        shuffleQuestions: false,
        shuffleOptions: false,
        soundEnabled: true,
        musicEnabled: true,
        isFormalAssessment: true,
        requireRollNumber: true,
      },
      { retakeMinCompletedAnswers: 3 },
    );
    expect(patched.retakeMinCompletedAnswers).toBe(3);
  });
});

describe("URL query search coercion for ?pin= and host retake params", () => {
  it("preserves numeric JSON-parsed PINs like ?pin=408756 and leading-zero string PINs", () => {
    expect(coercePinSearchParam(408756)).toBe("408756");
    expect(coercePinSearchParam("408756")).toBe("408756");
    expect(coercePinSearchParam("048756")).toBe("048756");
    expect(coercePinSearchParam(" 408-756 ")).toBe("408756");
    expect(coercePinSearchParam("")).toBeUndefined();
    expect(coercePinSearchParam("abc")).toBeUndefined();
    expect(coercePinSearchParam(undefined)).toBeUndefined();
  });

  it("preserves numeric/boolean JSON-parsed query params for host settings and practice mode", () => {
    expect(coerceSearchString(3)).toBe("3");
    expect(coerceSearchString(true)).toBe("true");
    expect(coerceSearchString("  sanjibon-q2  ")).toBe("sanjibon-q2");
    expect(coerceSearchString("   ")).toBeUndefined();
    expect(coerceSearchString(undefined)).toBeUndefined();
  });
});

describe("dashboard quiz deletion persistence and real AI generation (no dummy fallback)", () => {
  it("permanently tombstones deleted seeded quizzes on both server store and client db", async () => {
    const builtInTarget = SANJIBON_QUIZZES.find((q) => q.id === "quiz-sanjibon-s05")!;
    const storeState = {
      customQuizzes: [{ ...builtInTarget } as Quiz, { id: "my-custom", slug: "my-custom" } as Quiz],
      deletedQuizIds: [] as string[],
    };

    deleteQuizInStore(storeState, builtInTarget.id, SANJIBON_QUIZZES);
    expect(storeState.customQuizzes.some((q) => q.id === builtInTarget.id)).toBe(false);
    expect(storeState.deletedQuizIds).toContain(builtInTarget.id);
    expect(storeState.deletedQuizIds).toContain(builtInTarget.slug);

    // Re-saving clears tombstone tokens cleanly
    clearDeletedQuizTokensInStore(storeState, builtInTarget);
    expect(storeState.deletedQuizIds).toEqual([]);

    // Client DB deletion keeps built-in READY_MADE_PACKS removed in db.getQuizzes() & db.getQuizBySlug()
    const origWindow = (globalThis as Record<string, unknown>)["window"];
    const origLocalStorage = (globalThis as Record<string, unknown>)["localStorage"];
    const memStorage: Record<string, string> = {};
    const lsMock = {
      getItem: (k: string) => (k in memStorage ? memStorage[k]! : null),
      setItem: (k: string, v: string) => {
        memStorage[k] = String(v);
      },
      removeItem: (k: string) => {
        delete memStorage[k];
      },
    };
    (globalThis as Record<string, unknown>)["window"] = { location: { origin: "http://localhost" } };
    (globalThis as Record<string, unknown>)["localStorage"] = lsMock;

    try {
      await sqliteEngine.ready();
      expect(db.getQuizzes().some((q) => q.id === "quiz-sanjibon-s05")).toBe(true);
      await db.deleteCustomQuiz("quiz-sanjibon-s05");
      expect(db.getQuizzes().some((q) => q.id === "quiz-sanjibon-s05")).toBe(false);
      expect(db.getQuizBySlug("sanjibon-session-05-video-ads")).toBeUndefined();
      // Re-saving restores visibility cleanly
      db.saveCustomQuiz(builtInTarget);
      expect(db.getQuizzes().some((q) => q.id === "quiz-sanjibon-s05")).toBe(true);
    } finally {
      sqliteEngine.run("DELETE FROM quizzes");
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

  it("refuses off-topic dummy generation without a Gemini key and parses fenced AI payloads cleanly", async () => {
    const origWindow = (globalThis as Record<string, unknown>)["window"];
    const origLocalStorage = (globalThis as Record<string, unknown>)["localStorage"];
    const memStorage: Record<string, string> = { onnesha_ai_credits: "50" };
    const lsMock = {
      getItem: (k: string) => (k in memStorage ? memStorage[k]! : null),
      setItem: (k: string, v: string) => {
        memStorage[k] = String(v);
      },
      removeItem: (k: string) => {
        delete memStorage[k];
      },
    };
    (globalThis as Record<string, unknown>)["window"] = {};
    (globalThis as Record<string, unknown>)["localStorage"] = lsMock;

    try {
      await expect(
        generateQuizWithAi({
          topic: "Google Flow Veo 3.1 Lite Video Ads",
          questionCount: 5,
          language: "both",
          difficulty: "hard",
          category: "AI Video",
        }),
      ).rejects.toThrow(/Gemini API key/i);
      // Must NOT charge AI credit when key is missing / generation did not run
      expect(getAiCredits()).toBe(50);

      const fenced = '```json\n{"titleEn":"Flow Test","titleBn":"ফ্লো টেস্ট","questions":[{"type":"single_mcq","textEn":"Start Frame?","textBn":"স্টার্ট ফ্রেম?","options":[{"textEn":"A","textBn":"ক","isCorrect":false},{"textEn":"B","textBn":"খ","isCorrect":true}]}]}\n```';
      const cleaned = stripMarkdownJsonFence(fenced);
      const quiz = normalizeGeneratedQuizPayload(JSON.parse(cleaned), {
        topic: "Google Flow",
        questionCount: 1,
        difficulty: "hard",
        category: "AI Video",
        questionStyleMode: "single_mcq",
      });
      expect(quiz.questions).toHaveLength(1);
      expect(quiz.questions[0]?.correctOptionIds).toEqual([quiz.questions[0]?.options[1]?.id]);
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
