import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
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
  computeTotalQuizMarks,
  evaluateQuestionAnswer,
  gradeOmrSubmission,
  resolveOrgName,
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
import { CertificateData, ManagedUser, Question } from "../types";

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
