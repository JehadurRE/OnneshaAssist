import {
  BrandingSettings,
  CertificateData,
  Course,
  ExamResultRecord,
  ExamSessionRecord,
  GameSession,
  ManagedUser,
  Quiz,
  Region,
  RosterStudent,
} from "../types";
import {
  DEFAULT_COURSES,
  DEFAULT_REGIONS,
  DEFAULT_USERS,
  READY_MADE_PACKS,
  SAMPLE_ROSTER,
} from "../mock-data";
import type { SqlValue } from "sql.js";
import { sqliteEngine } from "./sqlite-engine";
import { serverAdminMutateStore, serverGetBootstrapData } from "../server-session";
import { isCoursePrivate, isQuizPrivate } from "../sanjibon-seed-data";
import {
  compareParticipantsByMerit,
  computeParticipantAccuracyPct,
  computeTotalQuizMarks,
  isPassingScore,
  resolveOrgName,
  resolvePassThresholdPct,
} from "../scoring";
import { mergeRetakeExamResults, normalizeMatchRoll } from "../retake-utils";
import { DEFAULT_BRANDING_SETTINGS, mergeBrandingSettings } from "../branding";
import { purgeUnderThresholdExamsInStore, type PurgeExamSummary } from "../exam-purge";

export { isCoursePrivate, isQuizPrivate };

export interface DbTransaction {
  id: string;
  planId: string;
  amount: number;
  msisdn: string;
  trxId: string;
  method: "bkash" | "nagad" | "card" | "bank_po";
  date: string;
  status: "completed" | "pending" | "failed";
}

export interface DbSalesLead {
  id: string;
  name: string;
  organization: string;
  email: string;
  phone: string;
  studentCount: string;
  message: string;
  status?: string | undefined;
  createdAt: string;
}

export interface DbSmsLog {
  id: string;
  recipientPhone: string;
  studentName: string;
  rollNumber: string;
  quizTitle: string;
  score: number;
  rank: number;
  messageText: string;
  status: "delivered" | "queued" | "failed";
  timestamp: string;
}

export function formatDeterministicCertNumber(
  pin: string,
  rollNumber?: string,
  fallbackIdx = 1,
): string {
  const cleanRoll = (rollNumber || `${100 + fallbackIdx}`)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(-6)
    .padStart(4, "0");
  return `ONN-${pin.slice(0, 4)}-${cleanRoll}`;
}

class OnneshaDatabase {
  private listeners: (() => void)[] = [];
  private syncInFlight: Promise<void> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      sqliteEngine.ready().then(() => {
        this.seedInitialDataIfEmpty();
        this.syncFromServerStore();
      });
    }
  }

  public subscribe(cb: () => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => cb());
  }

  public syncFromServerStore(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    if (this.syncInFlight) return this.syncInFlight;
    this.syncInFlight = this._executeServerStoreSync().finally(() => {
      this.syncInFlight = null;
    });
    return this.syncInFlight;
  }

  private upsertSingleCertificateLocal(
    cert: CertificateData,
    runFn: (sql: string, params?: SqlValue[]) => void = (sql, params = []) =>
      sqliteEngine.run(sql, params),
  ): void {
    runFn(
      "INSERT OR REPLACE INTO certificates (id, certificateNumber, studentName, studentRoll, regionName, quizTitle, score, totalPoints, rank, totalParticipants, accuracyPercent, issueDate, organizationName, institutionName, instructorName, verificationUrl, signatureUrl, verified, payloadHash, prevBlockHash, ledgerIndex, chainHash, cryptoSignature, signerKeyId, signedAt, rekorEntryUuid, rekorLogIndex, rekorIntegratedTime, rekorLogId, rekorStatus, rekorReceiptDigest, rekorPublicKeyId, rekorExplorerUrl, otsStatus, otsProofBase64, otsChainHash, otsLedgerIndex, otsCalendarUrl, otsSubmittedAt, otsBitcoinBlockHeight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        cert.id,
        cert.certificateNumber,
        cert.studentName,
        cert.studentRoll || "",
        cert.regionName || "Dhaka Range",
        cert.quizTitle,
        cert.score || cert.marksObtained || 0,
        cert.totalPoints || cert.totalMarks || 100,
        cert.rank,
        cert.totalParticipants,
        cert.accuracyPercent || cert.scorePct || 0,
        cert.issueDate,
        cert.organizationName || "Onnesha Assessment",
        cert.institutionName || "Onnesha Assessment Arena",
        cert.instructorName || "Chief Assessment Officer",
        cert.verificationUrl || "",
        cert.signatureUrl || "",
        cert.verified ? 1 : 0,
        cert.payloadHash || "",
        cert.prevBlockHash || "",
        cert.ledgerIndex ?? null,
        cert.chainHash || "",
        cert.cryptoSignature || "",
        cert.signerKeyId || "",
        cert.signedAt || "",
        cert.rekorEntryUuid || "",
        cert.rekorLogIndex ?? null,
        cert.rekorIntegratedTime ?? null,
        cert.rekorLogId || "",
        cert.rekorStatus || "",
        cert.rekorReceiptDigest || "",
        cert.rekorPublicKeyId || "",
        cert.rekorExplorerUrl || "",
        cert.otsStatus || "",
        cert.otsProofBase64 || "",
        cert.otsChainHash || "",
        cert.otsLedgerIndex ?? null,
        cert.otsCalendarUrl || "",
        cert.otsSubmittedAt || "",
        cert.otsBitcoinBlockHeight ?? null,
      ],
    );
  }

  private async _executeServerStoreSync(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      await sqliteEngine.ready();
      const res = await serverGetBootstrapData();
      if (!res.success) return;

      const mappedTrx: DbTransaction[] = res.transactions?.length
        ? res.transactions.map((t) => ({
            id: t.id,
            planId: t.planId,
            amount: t.amount,
            msisdn: t.msisdn,
            trxId: t.trxId,
            method: (t.method as DbTransaction["method"]) || "bkash",
            date: t.createdAt,
            status: (t.status as DbTransaction["status"]) || "completed",
          }))
        : [];

      const mappedLeads: DbSalesLead[] = res.salesLeads?.length
        ? res.salesLeads.map((l) => ({
            id: l.id,
            name: l.name,
            organization: l.organization,
            email: l.email,
            phone: l.phone,
            studentCount: l.studentCount,
            message: l.message,
            status: l.status || "new",
            createdAt: l.createdAt,
          }))
        : [];

      const rawSmsLogs = (res as { smsLogs?: Array<{
        id: string;
        recipientPhone: string;
        studentName: string;
        rollNumber: string;
        quizTitle: string;
        score: number;
        rank: number;
        messageText: string;
        status: "delivered" | "queued" | "failed";
        createdAt: string;
      }> }).smsLogs;
      const mappedSmsLogs: DbSmsLog[] | undefined = Array.isArray(rawSmsLogs)
        ? rawSmsLogs.map((s) => ({
            id: s.id,
            recipientPhone: s.recipientPhone,
            studentName: s.studentName,
            rollNumber: s.rollNumber,
            quizTitle: s.quizTitle,
            score: s.score,
            rank: s.rank,
            messageText: s.messageText,
            status: s.status || "delivered",
            timestamp: s.createdAt,
          }))
        : undefined;

      sqliteEngine.runBatch((run) => {
        if (Array.isArray(res.regions)) {
          run("DELETE FROM regions");
          res.regions.forEach((reg) => {
            run(
              "INSERT OR REPLACE INTO regions (id, code, nameEn, nameBn, centerName, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
              [reg.id, reg.code, reg.nameEn, reg.nameBn, reg.centerName || "", reg.createdAt],
            );
          });
        }

        if (Array.isArray(res.roster)) {
          run("DELETE FROM roster_students");
          res.roster.forEach((s) => {
            run(
              "INSERT OR REPLACE INTO roster_students (id, rollNumber, name, phone, regionId, regionName, section, batch, guardianPhone, email, passcode, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                s.id,
                s.rollNumber,
                s.name,
                s.phone || s.guardianPhone || "",
                s.regionId || "reg-dhaka",
                s.regionName || "Dhaka Range",
                s.section || "A",
                s.batch || "46th BCS & Cadet Batch",
                s.guardianPhone || s.phone || "",
                s.email || `${s.rollNumber}@academy.edu.bd`,
                s.passcode || "",
                s.createdAt || new Date().toISOString(),
              ],
            );
          });
        }

        if (Array.isArray(res.courses)) {
          run("DELETE FROM courses");
          res.courses.forEach((c) => {
            const privFlag =
              typeof c.isPrivate === "boolean"
                ? c.isPrivate
                  ? 1
                  : 0
                : isCoursePrivate(c)
                  ? 1
                  : 0;
            const thresholdVal =
              typeof c.passThresholdPct === "number" && Number.isFinite(c.passThresholdPct)
                ? c.passThresholdPct
                : null;
            run(
              "INSERT OR REPLACE INTO courses (id, code, titleEn, titleBn, descriptionEn, descriptionBn, categoryEn, categoryBn, icon, color, instructorIdsJson, instructorNamesJson, isPrivate, passThresholdPct, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                c.id,
                c.code,
                c.titleEn,
                c.titleBn,
                c.descriptionEn,
                c.descriptionBn,
                c.categoryEn || "",
                c.categoryBn || "",
                c.icon || "📚",
                c.color || "from-emerald-500/20 to-teal-500/20",
                JSON.stringify(c.instructorIds || []),
                JSON.stringify(c.instructorNames || []),
                privFlag,
                thresholdVal,
                c.status || "active",
                c.createdAt || new Date().toISOString(),
              ],
            );
          });
        }

        if (Array.isArray(res.users)) {
          run("DELETE FROM users");
          res.users.forEach((u) => {
            run(
              "INSERT OR REPLACE INTO users (id, email, name, role, institution, designation, phone, passwordHash, plan, assignedCourseIdsJson, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                u.id,
                u.email,
                u.name,
                u.role,
                u.institution || "",
                u.designation || "",
                u.phone || "",
                u.passwordHash || "",
                u.plan || "institution_max",
                JSON.stringify(u.assignedCourseIds || []),
                u.status || "active",
                u.createdAt || new Date().toISOString(),
              ],
            );
          });
        }

        if (Array.isArray(res.customQuizzes)) {
          run("DELETE FROM quizzes WHERE isTemplate = 0");
          res.customQuizzes.forEach((quiz) => {
            const quizPrivFlag =
              typeof quiz.isPrivate === "boolean"
                ? quiz.isPrivate
                  ? 1
                  : 0
                : isQuizPrivate(quiz, res.courses)
                  ? 1
                  : 0;
            run(
              "INSERT OR REPLACE INTO quizzes (id, slug, courseId, courseTitle, quizNumber, instructorId, instructorName, titleEn, titleBn, descriptionEn, descriptionBn, categoryEn, categoryBn, icon, questionsJson, isTemplate, isPrivate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                quiz.id,
                quiz.slug,
                quiz.courseId || "",
                quiz.courseTitle || "",
                quiz.quizNumber || 1,
                quiz.instructorId || "",
                quiz.instructorName || "",
                quiz.titleEn,
                quiz.titleBn,
                quiz.descriptionEn,
                quiz.descriptionBn,
                quiz.categoryEn,
                quiz.categoryBn,
                quiz.icon,
                JSON.stringify(quiz.questions),
                quiz.isTemplate ? 1 : 0,
                quizPrivFlag,
                quiz.createdAt || new Date().toISOString(),
              ],
            );
          });
        }

        if (Array.isArray(res.examSessions)) {
          run("DELETE FROM exam_sessions");
          res.examSessions.forEach((es) => {
            const thresholdVal =
              typeof es.passThresholdPct === "number" && Number.isFinite(es.passThresholdPct)
                ? es.passThresholdPct
                : null;
            run(
              "INSERT OR REPLACE INTO exam_sessions (id, pin, quizId, quizTitleEn, quizTitleBn, hostId, allowedRegionId, allowedRegionName, totalQuestions, participantCount, averageScore, highestScore, passThresholdPct, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                es.id,
                es.pin,
                es.quizId,
                es.quizTitleEn,
                es.quizTitleBn,
                es.hostId,
                es.allowedRegionId || "all",
                es.allowedRegionName || "All Regions",
                es.totalQuestions,
                es.participantCount,
                es.averageScore,
                es.highestScore,
                thresholdVal,
                es.createdAt,
              ],
            );
          });
        }

        if (Array.isArray(res.examResults)) {
          run("DELETE FROM exam_results");
          res.examResults.forEach((er) => {
            const passedVal = typeof er.passed === "boolean" ? (er.passed ? 1 : 0) : null;
            run(
              "INSERT OR REPLACE INTO exam_results (id, sessionId, pin, participantId, rollNumber, name, phone, regionId, regionName, score, rank, correctCount, incorrectCount, unattemptedCount, accuracyPct, passed, answersJson, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                er.id,
                er.sessionId,
                er.pin,
                er.participantId,
                er.rollNumber,
                er.name,
                er.phone || "",
                er.regionId || "reg-dhaka",
                er.regionName || "Dhaka Range",
                er.score,
                er.rank,
                er.correctCount,
                er.incorrectCount,
                er.unattemptedCount,
                er.accuracyPct,
                passedVal,
                er.answersJson || "{}",
                er.createdAt,
              ],
            );
          });
        }

        if (Array.isArray(res.certificates)) {
          run("DELETE FROM certificates");
          res.certificates.forEach((cert) => {
            this.upsertSingleCertificateLocal(cert, run);
          });
        }

        if (Array.isArray((res as { revokedCertificates?: string[] }).revokedCertificates)) {
          this.setStorage(
            "revoked_certificates",
            (res as { revokedCertificates: string[] }).revokedCertificates,
          );
        }

        if (Array.isArray(res.transactions)) {
          run("DELETE FROM transactions");
          mappedTrx.forEach((t) => {
            run(
              "INSERT OR REPLACE INTO transactions (id, planId, amount, msisdn, trxId, method, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [t.id, t.planId, t.amount, t.msisdn, t.trxId, t.method, t.date, t.status],
            );
          });
        }

        if (Array.isArray(res.salesLeads)) {
          run("DELETE FROM sales_leads");
          mappedLeads.forEach((l) => {
            run(
              "INSERT OR REPLACE INTO sales_leads (id, name, organization, email, phone, studentCount, message, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                l.id,
                l.name,
                l.organization,
                l.email,
                l.phone,
                l.studentCount,
                l.message,
                l.status || "new",
                l.createdAt,
              ],
            );
          });
        }

        if (mappedSmsLogs) {
          run("DELETE FROM sms_logs");
          mappedSmsLogs.forEach((s) => {
            run(
              "INSERT OR REPLACE INTO sms_logs (id, recipientPhone, studentName, rollNumber, quizTitle, score, rank, messageText, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                s.id,
                s.recipientPhone,
                s.studentName,
                s.rollNumber,
                s.quizTitle,
                s.score,
                s.rank,
                s.messageText,
                s.status,
                s.timestamp,
              ],
            );
          });
        }
      });

      if (Array.isArray(res.regions)) this.setStorage("regions", res.regions);
      if (Array.isArray(res.roster)) this.setStorage("roster_students", res.roster);
      if (Array.isArray(res.courses)) this.setStorage("courses", res.courses);
      if (Array.isArray(res.users)) this.setStorage("users", res.users);
      if (Array.isArray(res.customQuizzes)) this.setStorage("custom_quizzes", res.customQuizzes);
      if (Array.isArray(res.deletedQuizIds)) this.setStorage("deleted_quiz_ids", res.deletedQuizIds);
      if (typeof res.hasServerGeminiKey === "boolean") {
        this.setStorage("has_server_gemini_key", res.hasServerGeminiKey);
      }
      if (Array.isArray(res.examSessions)) this.setStorage("exam_sessions", res.examSessions);
      if (Array.isArray(res.examResults)) this.setStorage("exam_results", res.examResults);
      if (Array.isArray(res.certificates)) this.setStorage("certificates", res.certificates);
      if (Array.isArray(res.transactions)) this.setStorage("transactions", mappedTrx);
      if (Array.isArray(res.salesLeads)) this.setStorage("sales_leads", mappedLeads);
      if (mappedSmsLogs) this.setStorage("sms_logs", mappedSmsLogs);

      if (res.branding) {
        const mergedBranding = mergeBrandingSettings(res.branding, DEFAULT_BRANDING_SETTINGS);
        this.setStorage("branding_settings", mergedBranding);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("onnesha-branding-updated", { detail: mergedBranding }),
          );
        }
      }

      this.notifyListeners();
    } catch (err) {
      console.warn("Server store bootstrap notice:", err);
    }
  }

  private seedInitialDataIfEmpty() {
    // Idempotently seed missing Regions, Courses & Sanjibon Trainees in one transaction
    const existingRegions = sqliteEngine.query<Region>("SELECT * FROM regions");
    const existingRegMap = new Map(existingRegions.map((r) => [r.id, r]));
    const existingCourses = sqliteEngine.query<{ id: string }>("SELECT id FROM courses");
    const existingCourseIds = new Set(existingCourses.map((c) => c.id));
    const existingRoster = sqliteEngine.query<RosterStudent>("SELECT * FROM roster_students");
    const existingStudentIds = new Set(existingRoster.map((s) => s.id));
    const existingStudentRolls = new Set(
      existingRoster.map((s) =>
        (s.rollNumber || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ""),
      ),
    );

    sqliteEngine.runBatch((run) => {
      DEFAULT_REGIONS.forEach((reg) => {
        const prev = existingRegMap.get(reg.id);
        if (!prev) {
          run(
            "INSERT OR IGNORE INTO regions (id, code, nameEn, nameBn, centerName, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
            [reg.id, reg.code, reg.nameEn, reg.nameBn, reg.centerName || "", reg.createdAt],
          );
        } else if (
          (reg.id === "reg-sylhet" && prev.nameEn === "Sylhet Range") ||
          (reg.id === "reg-barishal" && prev.nameEn === "Barishal Range")
        ) {
          run("UPDATE regions SET code = ?, nameEn = ?, nameBn = ?, centerName = ? WHERE id = ?", [
            reg.code,
            reg.nameEn,
            reg.nameBn,
            reg.centerName || "",
            reg.id,
          ]);
        }
      });

      DEFAULT_COURSES.forEach((c) => {
        if (!existingCourseIds.has(c.id)) {
          const privFlag =
            typeof c.isPrivate === "boolean"
              ? c.isPrivate
                ? 1
                : 0
              : isCoursePrivate(c)
                ? 1
                : 0;
          const thresholdVal =
            typeof c.passThresholdPct === "number" && Number.isFinite(c.passThresholdPct)
              ? c.passThresholdPct
              : null;
          run(
            "INSERT OR IGNORE INTO courses (id, code, titleEn, titleBn, descriptionEn, descriptionBn, categoryEn, categoryBn, icon, color, instructorIdsJson, instructorNamesJson, isPrivate, passThresholdPct, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              c.id,
              c.code,
              c.titleEn,
              c.titleBn,
              c.descriptionEn,
              c.descriptionBn,
              c.categoryEn || "",
              c.categoryBn || "",
              c.icon || "📚",
              c.color || "from-emerald-500/20 to-teal-500/20",
              JSON.stringify(c.instructorIds || []),
              JSON.stringify(c.instructorNames || []),
              privFlag,
              thresholdVal,
              c.status || "active",
              c.createdAt || new Date().toISOString(),
            ],
          );
        }
      });

      SAMPLE_ROSTER.forEach((s) => {
        const cleanRoll = (s.rollNumber || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        if (!existingStudentIds.has(s.id) && (!cleanRoll || !existingStudentRolls.has(cleanRoll))) {
          run(
            "INSERT OR IGNORE INTO roster_students (id, rollNumber, name, phone, regionId, regionName, section, batch, guardianPhone, email, passcode, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              s.id,
              s.rollNumber,
              s.name,
              s.phone || s.guardianPhone || "",
              s.regionId || "reg-dhaka",
              s.regionName || "Dhaka Range",
              s.section || "",
              s.batch || "Ansar VDP Digital Marketing Batch -04",
              s.guardianPhone || s.phone || "",
              s.email || `${s.rollNumber}@sanjibon.onnesha.courses`,
              s.passcode || "",
              s.createdAt || new Date().toISOString(),
            ],
          );
          existingStudentIds.add(s.id);
          if (cleanRoll) existingStudentRolls.add(cleanRoll);
        }
      });

      // Backfill any older custom rows missing regionId or phone
      existingRoster.forEach((s, idx) => {
        if (!s.regionId || !s.phone) {
          const fallbackReg = DEFAULT_REGIONS[idx % DEFAULT_REGIONS.length] || DEFAULT_REGIONS[0];
          run("UPDATE roster_students SET regionId = ?, regionName = ?, phone = ? WHERE id = ?", [
            s.regionId || fallbackReg?.id || "reg-dhaka",
            s.regionName || fallbackReg?.nameEn || "Dhaka Range",
            s.phone || s.guardianPhone || `01711000${101 + idx}`,
            s.id,
          ]);
        }
      });
    });
  }

  private getStorage<T>(key: string, defaultVal: T): T {
    if (typeof window === "undefined") return defaultVal;
    try {
      const stored = localStorage.getItem(`onnesha_db_${key}`);
      return stored ? JSON.parse(stored) : defaultVal;
    } catch {
      return defaultVal;
    }
  }

  private setStorage<T>(key: string, value: T): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(`onnesha_db_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn("LocalStorage quota or serialization error:", e);
    }
  }

  // ---------------- REGIONS REPOSITORY ----------------
  getRegions(): Region[] {
    const rows = sqliteEngine.query<Region>("SELECT * FROM regions ORDER BY nameEn ASC");
    if (rows.length > 0) return rows;
    return this.getStorage<Region[]>("regions", DEFAULT_REGIONS);
  }

  addRegion(regionInput: {
    code: string;
    nameEn: string;
    nameBn: string;
    centerName?: string;
  }): Region {
    const cleanCode = regionInput.code.trim().toUpperCase();
    const id = `reg-${cleanCode.toLowerCase()}-${Date.now().toString(36).slice(-4)}`;
    const createdAt = new Date().toISOString();
    const newRegion: Region = {
      id,
      code: cleanCode,
      nameEn: regionInput.nameEn.trim(),
      nameBn: (regionInput.nameBn || regionInput.nameEn).trim(),
      centerName: regionInput.centerName?.trim() || "",
      createdAt,
    };

    sqliteEngine.run(
      "INSERT OR REPLACE INTO regions (id, code, nameEn, nameBn, centerName, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      [
        newRegion.id,
        newRegion.code,
        newRegion.nameEn,
        newRegion.nameBn,
        newRegion.centerName || "",
        newRegion.createdAt,
      ],
    );

    const regions = this.getRegions();
    this.setStorage("regions", regions);

    serverAdminMutateStore({ data: { action: "add_region", region: newRegion } }).catch((err) =>
      console.warn("Region server sync notice:", err),
    );

    this.notifyListeners();
    return newRegion;
  }

  deleteRegion(id: string): void {
    sqliteEngine.run("DELETE FROM regions WHERE id = ?", [id]);
    const regions = this.getRegions().filter((r) => r.id !== id);
    this.setStorage("regions", regions);

    serverAdminMutateStore({ data: { action: "delete_region", regionId: id } }).catch((err) =>
      console.warn("Region delete sync notice:", err),
    );
    this.notifyListeners();
  }

  // ---------------- COURSES & MULTI-INSTRUCTOR REPOSITORY ----------------
  getCourses(): Course[] {
    const rows = sqliteEngine.query<any>("SELECT * FROM courses ORDER BY createdAt ASC");
    if (rows.length > 0) {
      return rows.map((r) => {
        const baseCourse: Course = {
          id: r.id,
          code: r.code,
          titleEn: r.titleEn,
          titleBn: r.titleBn,
          descriptionEn: r.descriptionEn,
          descriptionBn: r.descriptionBn,
          categoryEn: r.categoryEn,
          categoryBn: r.categoryBn,
          icon: r.icon || "📚",
          color: r.color || "from-emerald-500/20 to-teal-500/20",
          instructorIds: r.instructorIdsJson ? JSON.parse(r.instructorIdsJson) : [],
          instructorNames: r.instructorNamesJson ? JSON.parse(r.instructorNamesJson) : [],
          status: (r.status as "active" | "archived") || "active",
          createdAt: r.createdAt,
        };
        const resolvedPrivate =
          typeof r.isPrivate === "number" ? r.isPrivate !== 0 : isCoursePrivate(baseCourse);
        return {
          ...baseCourse,
          isPrivate: resolvedPrivate,
          passThresholdPct:
            typeof r.passThresholdPct === "number" ? r.passThresholdPct : undefined,
        };
      });
    }
    return this.getStorage<Course[]>("courses", DEFAULT_COURSES).map((c) => ({
      ...c,
      isPrivate: isCoursePrivate(c),
    }));
  }

  saveCourse(course: Course): Course {
    const resolvedPrivate = isCoursePrivate(course);
    const resolvedThreshold =
      typeof course.passThresholdPct === "number" && Number.isFinite(course.passThresholdPct)
        ? Math.max(0, Math.min(100, Math.round(course.passThresholdPct)))
        : undefined;
    const normalizedCourse: Course = {
      ...course,
      isPrivate: resolvedPrivate,
      passThresholdPct: resolvedThreshold,
    };

    sqliteEngine.run(
      "INSERT OR REPLACE INTO courses (id, code, titleEn, titleBn, descriptionEn, descriptionBn, categoryEn, categoryBn, icon, color, instructorIdsJson, instructorNamesJson, isPrivate, passThresholdPct, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        normalizedCourse.id,
        normalizedCourse.code,
        normalizedCourse.titleEn,
        normalizedCourse.titleBn,
        normalizedCourse.descriptionEn,
        normalizedCourse.descriptionBn,
        normalizedCourse.categoryEn || "",
        normalizedCourse.categoryBn || "",
        normalizedCourse.icon || "📚",
        normalizedCourse.color || "from-emerald-500/20 to-teal-500/20",
        JSON.stringify(normalizedCourse.instructorIds || []),
        JSON.stringify(normalizedCourse.instructorNames || []),
        resolvedPrivate ? 1 : 0,
        resolvedThreshold ?? null,
        normalizedCourse.status || "active",
        normalizedCourse.createdAt || new Date().toISOString(),
      ],
    );

    const courses = this.getStorage<Course[]>("courses", [...DEFAULT_COURSES]);
    const idx = courses.findIndex((c) => c.id === normalizedCourse.id);
    if (idx >= 0) courses[idx] = normalizedCourse;
    else courses.unshift(normalizedCourse);
    this.setStorage("courses", courses);

    if (Array.isArray(normalizedCourse.instructorIds)) {
      const assignedSet = new Set(normalizedCourse.instructorIds);
      const updatedUsers = this.getUsers().map((u) => {
        const curr = new Set(u.assignedCourseIds || []);
        if (assignedSet.has(u.id)) curr.add(normalizedCourse.id);
        else curr.delete(normalizedCourse.id);
        return { ...u, assignedCourseIds: Array.from(curr) };
      });
      sqliteEngine.runBatch((run) => {
        updatedUsers.forEach((u) => {
          run("UPDATE users SET assignedCourseIdsJson = ? WHERE id = ?", [
            JSON.stringify(u.assignedCourseIds || []),
            u.id,
          ]);
        });
      });
      this.setStorage("users", updatedUsers);
    }

    serverAdminMutateStore({ data: { action: "save_course", course: normalizedCourse } }).catch((err) =>
      console.warn("Course server sync notice:", err),
    );
    this.notifyListeners();
    return normalizedCourse;
  }

  deleteCourse(id: string): void {
    sqliteEngine.run("DELETE FROM courses WHERE id = ?", [id]);
    const courses = this.getCourses().filter((c) => c.id !== id);
    this.setStorage("courses", courses);

    const updatedUsers = this.getUsers().map((u) => ({
      ...u,
      assignedCourseIds: (u.assignedCourseIds || []).filter((cid) => cid !== id),
    }));
    sqliteEngine.runBatch((run) => {
      updatedUsers.forEach((u) => {
        run("UPDATE users SET assignedCourseIdsJson = ? WHERE id = ?", [
          JSON.stringify(u.assignedCourseIds || []),
          u.id,
        ]);
      });
    });
    this.setStorage("users", updatedUsers);

    serverAdminMutateStore({ data: { action: "delete_course", courseId: id } }).catch((err) =>
      console.warn("Course delete sync notice:", err),
    );
    this.notifyListeners();
  }

  // ---------------- USERS & INSTRUCTORS REPOSITORY ----------------
  getUsers(): ManagedUser[] {
    const rows = sqliteEngine.query<any>("SELECT * FROM users ORDER BY createdAt ASC");
    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        passwordHash: r.passwordHash || "",
        role: (r.role as "admin" | "instructor") || "instructor",
        institution: r.institution || "Onnesha Academic Wing",
        designation: r.designation || "Faculty Instructor",
        phone: r.phone || "",
        plan: (r.plan as any) || "institution_max",
        assignedCourseIds: r.assignedCourseIdsJson ? JSON.parse(r.assignedCourseIdsJson) : [],
        status: (r.status as "active" | "suspended") || "active",
        createdAt: r.createdAt || new Date().toISOString(),
      }));
    }
    return this.getStorage<ManagedUser[]>("users", DEFAULT_USERS).map((u) => ({
      ...u,
      passwordHash: "",
    }));
  }

  saveUser(user: ManagedUser): ManagedUser {
    const cleanPass =
      user.passwordHash && user.passwordHash !== "instructor123" ? user.passwordHash : "";
    sqliteEngine.run(
      "INSERT OR REPLACE INTO users (id, email, name, role, institution, designation, phone, passwordHash, plan, assignedCourseIdsJson, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        user.id,
        user.email,
        user.name,
        user.role,
        user.institution || "",
        user.designation || "",
        user.phone || "",
        cleanPass,
        user.plan || "institution_max",
        JSON.stringify(user.assignedCourseIds || []),
        user.status || "active",
        user.createdAt || new Date().toISOString(),
      ],
    );

    const safeLocalUser: ManagedUser = { ...user, passwordHash: cleanPass };
    const users = this.getStorage<ManagedUser[]>("users", [...DEFAULT_USERS]);
    const idx = users.findIndex(
      (u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase(),
    );
    if (idx >= 0) users[idx] = safeLocalUser;
    else users.push(safeLocalUser);
    this.setStorage("users", users);

    const { passwordHash: _ph, ...userWithoutPass } = user;
    const serverPayload: ManagedUser = cleanPass
      ? { ...userWithoutPass, passwordHash: cleanPass }
      : { ...userWithoutPass, passwordHash: "" };
    serverAdminMutateStore({ data: { action: "save_user", user: serverPayload } }).catch((err) =>
      console.warn("User server sync notice:", err),
    );
    this.notifyListeners();
    return safeLocalUser;
  }

  deleteUser(id: string): void {
    sqliteEngine.run("DELETE FROM users WHERE id = ?", [id]);
    const users = this.getUsers().filter((u) => u.id !== id);
    this.setStorage("users", users);

    serverAdminMutateStore({ data: { action: "delete_user", userId: id } }).catch((err) =>
      console.warn("User delete sync notice:", err),
    );
    this.notifyListeners();
  }

  // ---------------- QUIZZES REPOSITORY (SQLite + Server) ----------------
  getQuizzes(): Quiz[] {
    const courses = this.getCourses();
    const mapRow = (r: any): Quiz => {
      const baseQuiz: Quiz = {
        id: r.id,
        slug: r.slug,
        courseId: r.courseId || undefined,
        courseTitle: r.courseTitle || undefined,
        quizNumber: r.quizNumber || undefined,
        instructorId: r.instructorId || undefined,
        instructorName: r.instructorName || undefined,
        titleEn: r.titleEn,
        titleBn: r.titleBn,
        descriptionEn: r.descriptionEn,
        descriptionBn: r.descriptionBn,
        categoryEn: r.categoryEn,
        categoryBn: r.categoryBn,
        icon: r.icon || "🎯",
        questions: r.questionsJson ? JSON.parse(r.questionsJson) : [],
        isTemplate: !!r.isTemplate,
        isPrivate: typeof r.isPrivate === "number" ? r.isPrivate !== 0 : undefined,
        createdAt: r.createdAt,
      };
      return {
        ...baseQuiz,
        isPrivate: isQuizPrivate(baseQuiz, courses),
      };
    };

    const deletedSet = this.getDeletedQuizIds();
    const isNotDeleted = (q: Pick<Quiz, "id" | "slug">) =>
      !deletedSet.has(q.id) && (!q.slug || !deletedSet.has(q.slug));

    const sqliteRows = sqliteEngine.query<any>("SELECT * FROM quizzes ORDER BY createdAt DESC");
    if (sqliteRows.length > 0) {
      const customQuizzes: Quiz[] = sqliteRows.map(mapRow).filter(isNotDeleted);
      const customIds = new Set(customQuizzes.map((q) => q.id));
      const remainingPacks = READY_MADE_PACKS.filter(
        (p) => !customIds.has(p.id) && isNotDeleted(p),
      ).map((p) => ({
        ...p,
        isPrivate: isQuizPrivate(p, courses),
      }));
      return [...customQuizzes, ...remainingPacks];
    }

    const custom = this.getStorage<Quiz[]>("custom_quizzes", [])
      .filter(isNotDeleted)
      .map((q) => ({
        ...q,
        isPrivate: isQuizPrivate(q, courses),
      }));
    const customIds = new Set(custom.map((q) => q.id));
    const remainingPacks = READY_MADE_PACKS.filter(
      (p) => !customIds.has(p.id) && isNotDeleted(p),
    ).map((p) => ({
      ...p,
      isPrivate: isQuizPrivate(p, courses),
    }));
    return [...custom, ...remainingPacks];
  }

  getDeletedQuizIds(): Set<string> {
    return new Set(this.getStorage<string[]>("deleted_quiz_ids", []));
  }

  hasServerGeminiKey(): boolean {
    return Boolean(this.getStorage<boolean>("has_server_gemini_key", false));
  }

  async saveServerAiKey(geminiApiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await serverAdminMutateStore({
        data: { action: "update_ai_settings", geminiApiKey },
      });
      if (!res?.success) {
        return { success: false, error: res?.error || "Failed to save Gemini API key." };
      }
      if (typeof res.hasServerGeminiKey === "boolean") {
        this.setStorage("has_server_gemini_key", res.hasServerGeminiKey);
      }
      this.notifyListeners();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to save AI configuration.",
      };
    }
  }

  getQuizBySlug(slug: string): Quiz | undefined {
    const courses = this.getCourses();
    const deletedSet = this.getDeletedQuizIds();
    const row = sqliteEngine.queryOne<any>("SELECT * FROM quizzes WHERE slug = ? OR id = ?", [
      slug,
      slug,
    ]);
    if (row && !deletedSet.has(row.id) && (!row.slug || !deletedSet.has(row.slug))) {
      const baseQuiz: Quiz = {
        id: row.id,
        slug: row.slug,
        courseId: row.courseId || undefined,
        courseTitle: row.courseTitle || undefined,
        quizNumber: row.quizNumber || undefined,
        instructorId: row.instructorId || undefined,
        instructorName: row.instructorName || undefined,
        titleEn: row.titleEn,
        titleBn: row.titleBn,
        descriptionEn: row.descriptionEn,
        descriptionBn: row.descriptionBn,
        categoryEn: row.categoryEn,
        categoryBn: row.categoryBn,
        icon: row.icon || "🎯",
        questions: row.questionsJson ? JSON.parse(row.questionsJson) : [],
        isTemplate: !!row.isTemplate,
        isPrivate: typeof row.isPrivate === "number" ? row.isPrivate !== 0 : undefined,
        createdAt: row.createdAt,
      };
      return {
        ...baseQuiz,
        isPrivate: isQuizPrivate(baseQuiz, courses),
      };
    }
    return this.getQuizzes().find((q) => q.slug === slug || q.id === slug);
  }

  saveCustomQuiz(quiz: Quiz): void {
    const courses = this.getCourses();
    const resolvedPrivate = isQuizPrivate(quiz, courses);
    const normalizedQuiz: Quiz = {
      ...quiz,
      isPrivate: resolvedPrivate,
    };

    const nextDeleted = Array.from(this.getDeletedQuizIds()).filter(
      (tok) => tok !== normalizedQuiz.id && (!normalizedQuiz.slug || tok !== normalizedQuiz.slug),
    );
    this.setStorage("deleted_quiz_ids", nextDeleted);

    sqliteEngine.run(
      "INSERT OR REPLACE INTO quizzes (id, slug, courseId, courseTitle, quizNumber, instructorId, instructorName, titleEn, titleBn, descriptionEn, descriptionBn, categoryEn, categoryBn, icon, questionsJson, isTemplate, isPrivate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        normalizedQuiz.id,
        normalizedQuiz.slug,
        normalizedQuiz.courseId || "",
        normalizedQuiz.courseTitle || "",
        normalizedQuiz.quizNumber || 1,
        normalizedQuiz.instructorId || "",
        normalizedQuiz.instructorName || "",
        normalizedQuiz.titleEn,
        normalizedQuiz.titleBn,
        normalizedQuiz.descriptionEn,
        normalizedQuiz.descriptionBn,
        normalizedQuiz.categoryEn,
        normalizedQuiz.categoryBn,
        normalizedQuiz.icon,
        JSON.stringify(normalizedQuiz.questions),
        normalizedQuiz.isTemplate ? 1 : 0,
        resolvedPrivate ? 1 : 0,
        normalizedQuiz.createdAt || new Date().toISOString(),
      ],
    );

    const custom = this.getStorage<Quiz[]>("custom_quizzes", []);
    const existingIndex = custom.findIndex(
      (q) => q.id === normalizedQuiz.id || q.slug === normalizedQuiz.slug,
    );
    if (existingIndex >= 0) {
      custom[existingIndex] = normalizedQuiz;
    } else {
      custom.unshift(normalizedQuiz);
    }
    this.setStorage("custom_quizzes", custom);

    serverAdminMutateStore({ data: { action: "save_quiz", quiz: normalizedQuiz } })
      .then((res) => {
        if (res?.success && Array.isArray(res.deletedQuizIds)) {
          this.setStorage("deleted_quiz_ids", res.deletedQuizIds);
          this.notifyListeners();
        }
      })
      .catch((err) => console.warn("Quiz server sync notice:", err));
    this.notifyListeners();
  }

  async deleteCustomQuiz(id: string): Promise<{ success: boolean; error?: string }> {
    const cleanId = (id || "").trim();
    if (!cleanId) return { success: false, error: "Quiz ID is missing." };

    const prevCustom = this.getStorage<Quiz[]>("custom_quizzes", []);
    const prevDeleted = this.getStorage<string[]>("deleted_quiz_ids", []);
    const prevSqliteRow = sqliteEngine.queryOne<any>("SELECT * FROM quizzes WHERE id = ? OR slug = ?", [
      cleanId,
      cleanId,
    ]);

    const tokens = new Set<string>([cleanId]);
    const matchedCustom = prevCustom.find((q) => q.id === cleanId || q.slug === cleanId);
    if (matchedCustom) {
      tokens.add(matchedCustom.id);
      if (matchedCustom.slug) tokens.add(matchedCustom.slug);
    }
    const matchedPack = READY_MADE_PACKS.find((q) => q.id === cleanId || q.slug === cleanId);
    if (matchedPack) {
      tokens.add(matchedPack.id);
      if (matchedPack.slug) tokens.add(matchedPack.slug);
    }

    const nextDeletedSet = new Set(prevDeleted);
    for (const tok of tokens) {
      if (READY_MADE_PACKS.some((p) => p.id === tok || p.slug === tok)) {
        nextDeletedSet.add(tok);
      }
    }

    sqliteEngine.run("DELETE FROM quizzes WHERE id = ? OR slug = ?", [cleanId, cleanId]);
    const filteredCustom = prevCustom.filter(
      (q) => !tokens.has(q.id) && (!q.slug || !tokens.has(q.slug)),
    );
    this.setStorage("custom_quizzes", filteredCustom);
    this.setStorage("deleted_quiz_ids", Array.from(nextDeletedSet));
    this.notifyListeners();

    try {
      const res = await serverAdminMutateStore({ data: { action: "delete_quiz", quizId: cleanId } });
      if (res && !res.success) {
        // Revert optimistic deletion if server denied permission
        this.setStorage("custom_quizzes", prevCustom);
        this.setStorage("deleted_quiz_ids", prevDeleted);
        if (prevSqliteRow) {
          sqliteEngine.run(
            "INSERT OR REPLACE INTO quizzes (id, slug, courseId, courseTitle, quizNumber, instructorId, instructorName, titleEn, titleBn, descriptionEn, descriptionBn, categoryEn, categoryBn, icon, questionsJson, isTemplate, isPrivate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              prevSqliteRow.id,
              prevSqliteRow.slug,
              prevSqliteRow.courseId || "",
              prevSqliteRow.courseTitle || "",
              prevSqliteRow.quizNumber || 1,
              prevSqliteRow.instructorId || "",
              prevSqliteRow.instructorName || "",
              prevSqliteRow.titleEn,
              prevSqliteRow.titleBn,
              prevSqliteRow.descriptionEn,
              prevSqliteRow.descriptionBn,
              prevSqliteRow.categoryEn,
              prevSqliteRow.categoryBn,
              prevSqliteRow.icon || "🎯",
              prevSqliteRow.questionsJson || "[]",
              prevSqliteRow.isTemplate ? 1 : 0,
              prevSqliteRow.isPrivate ? 1 : 0,
              prevSqliteRow.createdAt || new Date().toISOString(),
            ],
          );
        }
        this.notifyListeners();
        return { success: false, error: res.error || "Could not delete quiz from server." };
      }
      if (res?.success) {
        if (Array.isArray(res.customQuizzes)) {
          this.setStorage("custom_quizzes", res.customQuizzes);
        }
        if (Array.isArray(res.deletedQuizIds)) {
          this.setStorage("deleted_quiz_ids", res.deletedQuizIds);
        }
        this.notifyListeners();
      }
      return { success: true };
    } catch (err) {
      console.warn("Quiz delete sync notice:", err);
      return { success: true };
    }
  }

  // ---------------- ROSTER & STUDENTS REPOSITORY (SQLite + Server) ----------------
  getRoster(regionId?: string): RosterStudent[] {
    let rows = sqliteEngine.query<RosterStudent>(
      "SELECT * FROM roster_students ORDER BY rollNumber ASC",
    );
    if (rows.length === 0) {
      rows = this.getStorage<RosterStudent[]>("roster_students", SAMPLE_ROSTER);
    }
    if (regionId && regionId !== "all") {
      return rows.filter((r) => r.regionId === regionId);
    }
    return rows;
  }

  addStudentToRoster(
    student: Omit<RosterStudent, "id" | "createdAt">,
    skipServerSync = false,
  ): RosterStudent {
    const id = `std-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = new Date().toISOString();
    const regions = this.getRegions();
    const matchedReg =
      regions.find((r) => r.id === student.regionId) ||
      regions.find((r) => r.nameEn.toLowerCase() === (student.regionName || "").toLowerCase()) ||
      regions[0] ||
      DEFAULT_REGIONS[0];

    const newStudent: RosterStudent = {
      ...student,
      id,
      phone: student.phone || student.guardianPhone || "",
      regionId: matchedReg?.id || "reg-dhaka",
      regionName: matchedReg?.nameEn || "Dhaka Range",
      guardianPhone: student.guardianPhone || student.phone || "",
      createdAt,
    };

    sqliteEngine.run(
      "INSERT OR REPLACE INTO roster_students (id, rollNumber, name, phone, regionId, regionName, section, batch, guardianPhone, email, passcode, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        newStudent.rollNumber,
        newStudent.name,
        newStudent.phone || "",
        newStudent.regionId || "reg-dhaka",
        newStudent.regionName || "Dhaka Range",
        newStudent.section || "A",
        newStudent.batch || "46th BCS & Cadet Batch",
        newStudent.guardianPhone || "",
        newStudent.email || "",
        newStudent.passcode || "",
        createdAt,
      ],
    );

    const roster = this.getRoster();
    this.setStorage("roster_students", roster);

    if (!skipServerSync) {
      serverAdminMutateStore({ data: { action: "add_student", student: newStudent } }).catch(
        (err) => console.warn("Student server sync notice:", err),
      );
      this.notifyListeners();
    }

    return newStudent;
  }

  bulkAddStudentsToRoster(
    studentsInput: Omit<RosterStudent, "id" | "createdAt">[],
  ): RosterStudent[] {
    let added: RosterStudent[] = [];
    sqliteEngine.runBatch(() => {
      added = studentsInput.map((s) => this.addStudentToRoster(s, true));
    });
    serverAdminMutateStore({ data: { action: "bulk_add_students", students: added } }).catch(
      (err) => console.warn("Bulk student server sync notice:", err),
    );
    this.notifyListeners();
    return added;
  }

  removeStudentFromRoster(id: string): void {
    sqliteEngine.run("DELETE FROM roster_students WHERE id = ?", [id]);
    const roster = this.getRoster();
    const filtered = roster.filter((s) => s.id !== id);
    this.setStorage("roster_students", filtered);

    serverAdminMutateStore({ data: { action: "delete_student", studentId: id } }).catch((err) =>
      console.warn("Student delete server sync notice:", err),
    );
    this.notifyListeners();
  }

  // ---------------- EXAM SESSIONS & RESULTS REPOSITORY ----------------
  recordExamSession(session: GameSession, options?: { syncToServer?: boolean }): void {
    if (session.isSelfPractice) return;
    const retakeOrigSession = session.settings?.retakeForSessionId
      ? this.getExamSessions().find(
          (s) =>
            s.id === session.settings.retakeForSessionId ||
            (!!session.settings.retakeOriginPin && s.pin === session.settings.retakeOriginPin),
        )
      : undefined;

    const targetSessionId = retakeOrigSession ? retakeOrigSession.id : `exam-${session.pin}`;
    const targetPin = retakeOrigSession ? retakeOrigSession.pin : session.pin;
    const createdAt = new Date().toISOString();
    const participantsList = Object.values(session.participants)
      .filter((p) => !p.isBot)
      .sort(compareParticipantsByMerit);
    const count = participantsList.length;
    if (count === 0) return;

    // Hoist branding, pass threshold & quiz question lookup outside the participant loop
    const branding = this.getBranding();
    const matchedQuiz = this.getQuizBySlug(session.quizId);
    const matchedCourse = matchedQuiz?.courseId
      ? this.getCourses().find((c) => c.id === matchedQuiz.courseId)
      : undefined;
    const effectivePassThresholdPct = resolvePassThresholdPct({
      sessionThreshold: retakeOrigSession?.passThresholdPct ?? session.settings?.passThresholdPct,
      courseThreshold: matchedCourse?.passThresholdPct,
      brandingDefaultThreshold: branding.defaultPassThresholdPct,
    });
    const quizQuestions =
      session.completedQuestions && session.completedQuestions.length >= session.totalQuestions
        ? session.completedQuestions
        : matchedQuiz?.questions || [];
    const computedTotalPoints = computeTotalQuizMarks(quizQuestions, session.totalQuestions);
    const orgName = resolveOrgName(branding);
    const instTitle = branding.institutionTitle || "Onnesha Assessment Arena";
    const verifyOrigin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://arena.onnesha.courses";
    const shouldSyncCerts = options?.syncToServer ?? false;

    const builtResults: ExamResultRecord[] = participantsList.map((p, idx) => {
      const answersList = Object.values(p.answers || {});
      const correctCount = answersList.filter((a) => a.isCorrect).length;
      const incorrectCount = answersList.filter(
        (a) => !a.isCorrect && (a.selectedOptionIds?.length > 0 || !!a.writtenAnswer),
      ).length;
      const unattemptedCount = Math.max(0, session.totalQuestions - answersList.length);
      const accuracy = computeParticipantAccuracyPct({
        answers: answersList,
        correctCount,
        totalQuestions: session.totalQuestions,
        score: p.score,
        totalMarks: computedTotalPoints,
      });
      const passed = isPassingScore(accuracy, effectivePassThresholdPct);
      const roll = p.rollNumber || `2026-${100 + idx + 1}`;
      const humanRank = idx + 1;

      return {
        id: retakeOrigSession
          ? `res-${targetPin}-${normalizeMatchRoll(roll) || p.id}`
          : `res-${session.pin}-${p.id}`,
        sessionId: targetSessionId,
        pin: targetPin,
        participantId: p.id,
        rollNumber: roll,
        name: p.nickname || p.name || `Candidate ${humanRank}`,
        phone: p.phone || "",
        regionId: p.regionId || "reg-dhaka",
        regionName: p.regionName || "Dhaka Range",
        score: p.score,
        rank: humanRank,
        correctCount,
        incorrectCount,
        unattemptedCount,
        accuracyPct: accuracy,
        passed,
        answersJson: JSON.stringify(p.answers || {}),
        createdAt,
      };
    });

    let finalSessionRecord: ExamSessionRecord;
    let finalResults: ExamResultRecord[];

    if (retakeOrigSession) {
      const merged = mergeRetakeExamResults({
        origSession: retakeOrigSession,
        existingResults: this.getAllExamResults(),
        makeupResults: builtResults,
        nowIso: createdAt,
      });
      finalSessionRecord = merged.updatedSession;
      finalResults = merged.mergedResults;
    } else {
      const totalScore = participantsList.reduce((acc, p) => acc + p.score, 0);
      const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
      const highestScore = participantsList[0]?.score ?? 0;
      finalSessionRecord = {
        id: targetSessionId,
        pin: targetPin,
        quizId: session.quizId,
        quizTitleEn: session.quizTitleEn || "Onnesha Assessment",
        quizTitleBn: session.quizTitleBn || "অন্বেষা মডেল টেস্ট",
        hostId: session.hostId || "host",
        allowedRegionId: session.settings.allowedRegionId || "all",
        allowedRegionName: session.settings.allowedRegionName || "All Regions",
        totalQuestions: session.totalQuestions,
        participantCount: count,
        averageScore: avgScore,
        highestScore,
        passThresholdPct: effectivePassThresholdPct,
        createdAt,
      };
      finalResults = builtResults;
    }

    const existingCertsUpper = new Set(
      this.getCertificates().map((c) => c.certificateNumber.toUpperCase()),
    );

    sqliteEngine.runBatch((run) => {
      run(
        "INSERT OR REPLACE INTO exam_sessions (id, pin, quizId, quizTitleEn, quizTitleBn, hostId, allowedRegionId, allowedRegionName, totalQuestions, participantCount, averageScore, highestScore, passThresholdPct, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          finalSessionRecord.id,
          finalSessionRecord.pin,
          finalSessionRecord.quizId,
          finalSessionRecord.quizTitleEn,
          finalSessionRecord.quizTitleBn,
          finalSessionRecord.hostId,
          finalSessionRecord.allowedRegionId || "all",
          finalSessionRecord.allowedRegionName || "All Regions",
          finalSessionRecord.totalQuestions,
          finalSessionRecord.participantCount,
          finalSessionRecord.averageScore,
          finalSessionRecord.highestScore,
          effectivePassThresholdPct,
          finalSessionRecord.createdAt,
        ],
      );

      if (retakeOrigSession) {
        run("DELETE FROM exam_results WHERE sessionId = ? OR pin = ?", [
          targetSessionId,
          targetPin,
        ]);
      }

      finalResults.forEach((r) => {
        run(
          "INSERT OR REPLACE INTO exam_results (id, sessionId, pin, participantId, rollNumber, name, phone, regionId, regionName, score, rank, correctCount, incorrectCount, unattemptedCount, accuracyPct, passed, answersJson, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            r.id,
            r.sessionId,
            r.pin,
            r.participantId,
            r.rollNumber,
            r.name,
            r.phone || "",
            r.regionId || "reg-dhaka",
            r.regionName || "Dhaka Range",
            r.score,
            r.rank,
            r.correctCount,
            r.incorrectCount,
            r.unattemptedCount,
            r.accuracyPct,
            r.passed ? 1 : 0,
            r.answersJson || "{}",
            r.createdAt,
          ],
        );

        if (r.passed) {
          const certNo = formatDeterministicCertNumber(targetPin, r.rollNumber, r.rank);
          if (retakeOrigSession && existingCertsUpper.has(certNo.toUpperCase())) {
            return;
          }
          this.issueCertificate(
            {
              certificateNumber: certNo,
              studentName: r.name,
              studentRoll: r.rollNumber,
              regionName: r.regionName || "Dhaka Range",
              quizTitle: session.quizTitleBn || session.quizTitleEn || "Institutional Assessment",
              score: r.score,
              totalPoints: computedTotalPoints,
              rank: r.rank,
              totalParticipants: finalResults.length,
              accuracyPercent: r.accuracyPct,
              issueDate: createdAt.slice(0, 10),
              organizationName: orgName,
              institutionName: instTitle,
              instructorName: "Chief Assessment Officer",
              verificationUrl: `${verifyOrigin}/verify/${certNo}`,
              verified: true,
            },
            { syncToServer: shouldSyncCerts, skipStorageRefresh: true },
          );
        }
      });
    });

    this.setStorage("certificates", this.getCertificates());
    this.setStorage("exam_sessions", this.getExamSessions());
    this.setStorage("exam_results", this.getAllExamResults());
    this.notifyListeners();
  }

  getExamSessions(): ExamSessionRecord[] {
    const rows = sqliteEngine.query<any>("SELECT * FROM exam_sessions ORDER BY createdAt DESC");
    if (rows.length > 0) {
      return rows.map((r) => ({
        ...r,
        passThresholdPct:
          typeof r.passThresholdPct === "number" ? r.passThresholdPct : undefined,
      }));
    }
    return this.getStorage<ExamSessionRecord[]>("exam_sessions", []);
  }

  private normalizeExamResultRow(r: any): ExamResultRecord {
    return {
      ...r,
      passed:
        typeof r.passed === "number"
          ? r.passed !== 0
          : typeof r.passed === "boolean"
            ? r.passed
            : undefined,
    };
  }

  getExamResults(sessionId?: string): ExamResultRecord[] {
    if (sessionId) {
      return sqliteEngine
        .query<any>(
          "SELECT * FROM exam_results WHERE sessionId = ? OR pin = ? ORDER BY rank ASC",
          [sessionId, sessionId],
        )
        .map((r) => this.normalizeExamResultRow(r));
    }
    return sqliteEngine
      .query<any>("SELECT * FROM exam_results ORDER BY createdAt DESC, rank ASC")
      .map((r) => this.normalizeExamResultRow(r));
  }

  getAllExamResults(): ExamResultRecord[] {
    const rows = sqliteEngine.query<any>(
      "SELECT * FROM exam_results ORDER BY createdAt DESC, rank ASC",
    );
    if (rows.length > 0) return rows.map((r) => this.normalizeExamResultRow(r));
    return this.getStorage<ExamResultRecord[]>("exam_results", []);
  }

  // ---------------- VERIFIABLE CERTIFICATES ----------------
  getCertificates(): CertificateData[] {
    const rows = sqliteEngine.query<any>("SELECT * FROM certificates ORDER BY issueDate DESC");
    if (rows.length > 0) {
      return rows.map((r) => ({
        ...r,
        verified: !!r.verified,
      }));
    }
    return this.getStorage<CertificateData[]>("certificates", []);
  }

  getCertificateById(certNo: string): CertificateData | undefined {
    const row = sqliteEngine.queryOne<any>(
      "SELECT * FROM certificates WHERE LOWER(certificateNumber) = LOWER(?)",
      [certNo],
    );
    if (row) {
      return {
        ...row,
        verified: !!row.verified,
      };
    }

    const certs = this.getCertificates();
    const matched = certs.find((c) => c.certificateNumber.toLowerCase() === certNo.toLowerCase());
    if (matched) return matched;

    const revokedSet = new Set(
      this.getStorage<string[]>("revoked_certificates", []).map((c) => c.toUpperCase()),
    );
    const certNoUpper = certNo.trim().toUpperCase();

    // Deterministic resolution ONLY when backed by a passing examResult record and not revoked
    const match = certNoUpper.match(/^ONN-([A-Z0-9]{4})-([A-Z0-9]{4,6})$/);
    if (!revokedSet.has(certNoUpper) && match && match[1] && match[2]) {
      const pinPrefix = match[1];
      const rollSuffix = match[2];
      const results = this.getAllExamResults();
      const matchingResults = results.filter((r) => {
        const cleanRoll = (r.rollNumber || "")
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase()
          .slice(-6)
          .padStart(4, "0");
        return r.pin.startsWith(pinPrefix) && cleanRoll === rollSuffix;
      });
      matchingResults.sort((a, b) => {
        const aPass = a.passed ? 1 : 0;
        const bPass = b.passed ? 1 : 0;
        if (bPass !== aPass) return bPass - aPass;
        return b.createdAt.localeCompare(a.createdAt);
      });
      const matchedResult = matchingResults[0];

      if (matchedResult) {
        const matchedSession = this.getExamSessions().find(
          (s) => s.id === matchedResult.sessionId || s.pin === matchedResult.pin,
        );
        const matchedQuiz = matchedSession ? this.getQuizBySlug(matchedSession.quizId) : undefined;
        const matchedCourse = matchedQuiz?.courseId
          ? this.getCourses().find((c) => c.id === matchedQuiz.courseId)
          : undefined;
        const branding = this.getBranding();
        const threshold = resolvePassThresholdPct({
          sessionThreshold: matchedSession?.passThresholdPct,
          courseThreshold: matchedCourse?.passThresholdPct,
          brandingDefaultThreshold: branding.defaultPassThresholdPct,
        });
        const didPass =
          typeof matchedResult.passed === "boolean"
            ? matchedResult.passed
            : isPassingScore(matchedResult.accuracyPct, threshold);

        if (!didPass) {
          return undefined;
        }

        const totalMarks = computeTotalQuizMarks(
          matchedQuiz?.questions,
          matchedSession?.totalQuestions || 5,
        );
        return {
          id: `cert-${certNoUpper.toLowerCase()}`,
          certificateNumber: certNoUpper,
          studentName: matchedResult.name,
          studentRoll: matchedResult.rollNumber,
          regionName: matchedResult.regionName || "Dhaka Range",
          quizTitle:
            matchedSession?.quizTitleBn ||
            matchedSession?.quizTitleEn ||
            "Onnesha Assessment Evaluation",
          score: matchedResult.score,
          marksObtained: matchedResult.score,
          totalPoints: totalMarks,
          totalMarks,
          rank: matchedResult.rank,
          totalParticipants: matchedSession?.participantCount || 1,
          accuracyPercent: matchedResult.accuracyPct,
          scorePct: matchedResult.accuracyPct,
          issueDate: (matchedResult.createdAt || new Date().toISOString()).slice(0, 10),
          organizationName:
            branding.showPartnerLogo && branding.partnerName
              ? `Onnesha × ${branding.partnerName}`
              : "Onnesha Assessment & Examination Arena",
          institutionName: branding.institutionTitle || "Onnesha Assessment Arena",
          instructorName: "Chief Assessment Officer",
          verificationUrl: `/verify/${certNoUpper}`,
          verified: true,
        };
      }
    }

    return undefined;
  }

  private prepareCertificateLocal(
    cert: Omit<CertificateData, "id">,
    options?: { skipStorageRefresh?: boolean },
  ): CertificateData {
    const existingRow = sqliteEngine.queryOne<any>(
      "SELECT * FROM certificates WHERE LOWER(certificateNumber) = LOWER(?)",
      [cert.certificateNumber],
    );
    const existing: CertificateData | undefined = existingRow
      ? { ...existingRow, verified: !!existingRow.verified }
      : this.getStorage<CertificateData[]>("certificates", []).find(
          (c) => c.certificateNumber.toLowerCase() === cert.certificateNumber.toLowerCase(),
        );
    const preserveProofs =
      existing &&
      existing.certificateNumber.toLowerCase() === cert.certificateNumber.toLowerCase() &&
      existing.score === cert.score &&
      (existing.studentRoll || "") === (cert.studentRoll || "");

    const id = (preserveProofs && existing?.id) || `cert-${cert.certificateNumber.toLowerCase()}`;
    const newCert: CertificateData = {
      ...(preserveProofs ? existing : {}),
      ...cert,
      id,
      ...(preserveProofs
        ? {
            payloadHash: cert.payloadHash || existing?.payloadHash,
            prevBlockHash: cert.prevBlockHash || existing?.prevBlockHash,
            ledgerIndex: cert.ledgerIndex ?? existing?.ledgerIndex,
            chainHash: cert.chainHash || existing?.chainHash,
            cryptoSignature: cert.cryptoSignature || existing?.cryptoSignature,
            signerKeyId: cert.signerKeyId || existing?.signerKeyId,
            signedAt: cert.signedAt || existing?.signedAt,
            rekorEntryUuid: cert.rekorEntryUuid || existing?.rekorEntryUuid,
            rekorLogIndex: cert.rekorLogIndex ?? existing?.rekorLogIndex,
            rekorIntegratedTime: cert.rekorIntegratedTime ?? existing?.rekorIntegratedTime,
            rekorLogId: cert.rekorLogId || existing?.rekorLogId,
            rekorStatus: cert.rekorStatus || existing?.rekorStatus,
            rekorReceiptDigest: cert.rekorReceiptDigest || existing?.rekorReceiptDigest,
            rekorPublicKeyId: cert.rekorPublicKeyId || existing?.rekorPublicKeyId,
            rekorExplorerUrl: cert.rekorExplorerUrl || existing?.rekorExplorerUrl,
            otsStatus: cert.otsStatus || existing?.otsStatus,
            otsProofBase64: cert.otsProofBase64 || existing?.otsProofBase64,
            otsChainHash: cert.otsChainHash || existing?.otsChainHash,
            otsLedgerIndex: cert.otsLedgerIndex ?? existing?.otsLedgerIndex,
            otsCalendarUrl: cert.otsCalendarUrl || existing?.otsCalendarUrl,
            otsSubmittedAt: cert.otsSubmittedAt || existing?.otsSubmittedAt,
            otsBitcoinBlockHeight: cert.otsBitcoinBlockHeight ?? existing?.otsBitcoinBlockHeight,
          }
        : {}),
    };

    this.upsertSingleCertificateLocal(newCert);

    if (!options?.skipStorageRefresh) {
      const certs = this.getCertificates();
      this.setStorage("certificates", certs);
    }

    return newCert;
  }

  issueCertificate(
    cert: Omit<CertificateData, "id">,
    options?: { syncToServer?: boolean; skipStorageRefresh?: boolean },
  ): CertificateData {
    const newCert = this.prepareCertificateLocal(cert, options);

    const syncToServer = options?.syncToServer ?? true;
    if (syncToServer) {
      serverAdminMutateStore({ data: { action: "issue_certificate", certificate: newCert } })
        .then((res) => {
          if (res.success && (res as { certificate?: CertificateData }).certificate) {
            this.upsertSingleCertificateLocal(
              (res as { certificate: CertificateData }).certificate,
            );
            this.setStorage("certificates", this.getCertificates());
            this.notifyListeners();
          }
        })
        .catch(() => {});
    }
    return newCert;
  }

  async issueCertificateAsync(
    cert: Omit<CertificateData, "id">,
    options?: { syncToServer?: boolean; skipStorageRefresh?: boolean },
  ): Promise<{ success: boolean; certificate?: CertificateData; error?: string }> {
    const newCert = this.prepareCertificateLocal(cert, options);
    const syncToServer = options?.syncToServer ?? true;
    if (!syncToServer) {
      return { success: true, certificate: newCert };
    }
    try {
      const res = await serverAdminMutateStore({
        data: { action: "issue_certificate", certificate: newCert },
      });
      if (res.success && (res as { certificate?: CertificateData }).certificate) {
        const sealed = (res as { certificate: CertificateData }).certificate;
        this.upsertSingleCertificateLocal(sealed);
        this.setStorage("certificates", this.getCertificates());
        this.notifyListeners();
        return { success: true, certificate: sealed };
      }
      if (!res.success) {
        return { success: false, error: res.error || "Server rejected certificate issuance." };
      }
      return { success: true, certificate: newCert };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error while sealing certificate on server.",
      };
    }
  }

  deleteCertificate(certificateNumber: string, options?: { syncToServer?: boolean }): void {
    const normalized = certificateNumber.trim().toUpperCase();
    if (!normalized) return;

    sqliteEngine.run("DELETE FROM certificates WHERE LOWER(certificateNumber) = LOWER(?)", [
      normalized,
    ]);

    const revoked = new Set(
      this.getStorage<string[]>("revoked_certificates", []).map((c) => c.trim().toUpperCase()),
    );
    revoked.add(normalized);
    this.setStorage("revoked_certificates", [...revoked]);

    const remaining = this.getCertificates().filter(
      (c) => c.certificateNumber.trim().toUpperCase() !== normalized,
    );
    this.setStorage("certificates", remaining);

    if (options?.syncToServer ?? true) {
      serverAdminMutateStore({
        data: { action: "delete_certificate", certificateNumber: normalized },
      }).catch((err) => console.warn("Certificate revoke sync notice:", err));
    }

    this.notifyListeners();
  }

  getRevokedCertificates(): string[] {
    return this.getStorage<string[]>("revoked_certificates", []).map((c) => c.trim().toUpperCase());
  }

  async restoreCertificate(certificateNumber: string): Promise<boolean> {
    const normalized = certificateNumber.trim().toUpperCase();
    if (!normalized) return false;
    try {
      const res = await serverAdminMutateStore({
        data: { action: "restore_certificate", certificateNumber: normalized },
      });
      if (!res.success) return false;
      const nextRevoked = this.getStorage<string[]>("revoked_certificates", []).filter(
        (c) => c.trim().toUpperCase() !== normalized,
      );
      this.setStorage("revoked_certificates", nextRevoked);
      await this.syncFromServerStore();
      return true;
    } catch (err) {
      console.warn("Certificate restore notice:", err);
      return false;
    }
  }

  // ---------------- BRANDING & JOINT PARTNER LOGO ----------------
  getBranding(): BrandingSettings {
    const stored = this.getStorage<BrandingSettings>(
      "branding_settings",
      DEFAULT_BRANDING_SETTINGS,
    );
    return mergeBrandingSettings(stored, DEFAULT_BRANDING_SETTINGS);
  }

  saveBranding(branding: BrandingSettings): BrandingSettings {
    const current = this.getBranding();
    const updated: BrandingSettings = mergeBrandingSettings(
      { ...branding, updatedAt: Date.now() },
      current,
    );
    this.setStorage("branding_settings", updated);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("onnesha-branding-updated", { detail: updated }));
    }
    this.notifyListeners();
    serverAdminMutateStore({ data: { action: "update_branding", branding: updated } }).catch(
      () => {},
    );
    return updated;
  }

  // ---------------- FULL DATABASE BACKUP & RESTORE ----------------
  exportFullBackup(): string {
    const payload = {
      exportedAt: new Date().toISOString(),
      regions: this.getRegions(),
      roster: this.getRoster(),
      courses: this.getCourses(),
      users: this.getUsers().map(({ passwordHash: _ph, ...u }) => u),
      customQuizzes: this.getStorage<Quiz[]>("custom_quizzes", []),
      examSessions: this.getExamSessions(),
      examResults: this.getAllExamResults(),
      certificates: this.getCertificates(),
      revokedCertificates: this.getStorage<string[]>("revoked_certificates", []),
      branding: this.getBranding(),
    };
    return JSON.stringify(payload, null, 2);
  }

  async importFullBackup(jsonString: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(jsonString);
      const res = await serverAdminMutateStore({
        data: {
          action: "import_store_backup",
          backup: parsed,
        },
      });
      if (!res.success) return false;
      await this.syncFromServerStore();
      return true;
    } catch (err) {
      console.warn("Failed to import backup:", err);
      return false;
    }
  }

  async purgeDummyData(): Promise<void> {
    sqliteEngine.run(
      "DELETE FROM roster_students WHERE id IN ('st-1','st-2','st-3','st-4','st-5','st-6','st-7','st-8','st-9','st-10') AND email LIKE '%@academy.edu.bd'",
    );
    sqliteEngine.run("DELETE FROM exam_results WHERE participantId LIKE 'bot-%'");
    sqliteEngine.run(
      "DELETE FROM courses WHERE id IN ('course-field-safety', 'course-science-stem')",
    );
    sqliteEngine.run("DELETE FROM users WHERE id IN ('usr-instructor-2', 'usr-instructor-3')");
    sqliteEngine.run(
      "DELETE FROM certificates WHERE UPPER(certificateNumber) IN ('ONN-4821-9982', 'ONN-4634-026104')",
    );
    this.setStorage(
      "roster_students",
      this.getRoster().filter(
        (s) => !(/^st-([1-9]|10)$/.test(s.id) && s.email?.endsWith("@academy.edu.bd")),
      ),
    );
    this.setStorage(
      "exam_results",
      this.getAllExamResults().filter((r) => !(r.participantId || "").startsWith("bot-")),
    );
    this.setStorage(
      "courses",
      this.getCourses().filter(
        (c) => !["course-field-safety", "course-science-stem"].includes(c.id),
      ),
    );
    this.setStorage(
      "users",
      this.getUsers().filter((u) => !["usr-instructor-2", "usr-instructor-3"].includes(u.id)),
    );
    this.setStorage(
      "certificates",
      this.getCertificates().filter(
        (c) => !["ONN-4821-9982", "ONN-4634-026104"].includes(c.certificateNumber.toUpperCase()),
      ),
    );
    try {
      await serverAdminMutateStore({ data: { action: "purge_dummy_data" } });
      await this.syncFromServerStore();
    } catch {}
    this.notifyListeners();
  }

  async purgeUnderMinExaminees(
    minExaminees = 50,
  ): Promise<PurgeExamSummary & { error?: string | undefined }> {
    const localStore = {
      examSessions: this.getExamSessions(),
      examResults: this.getAllExamResults(),
      certificates: this.getCertificates(),
      revokedCertificates: this.getStorage<string[]>("revoked_certificates", []),
      smsLogs: this.getSmsLogs(),
    };
    const beforeSessionIds = new Set(localStore.examSessions.map((s) => s.id));
    const beforeResultIds = new Set(localStore.examResults.map((r) => r.id));
    const beforeCertIds = new Set(localStore.certificates.map((c) => c.id));
    const beforeSmsIds = new Set(localStore.smsLogs.map((s) => s.id));

    const localSummary = purgeUnderThresholdExamsInStore(localStore, minExaminees);

    const keptSessionIds = new Set(localStore.examSessions.map((s) => s.id));
    const keptResultIds = new Set(localStore.examResults.map((r) => r.id));
    const keptCertIds = new Set(localStore.certificates.map((c) => c.id));
    const keptSmsIds = new Set(localStore.smsLogs.map((s) => s.id));

    sqliteEngine.runBatch((run) => {
      for (const id of beforeSessionIds) {
        if (!keptSessionIds.has(id)) run("DELETE FROM exam_sessions WHERE id = ?", [id]);
      }
      for (const id of beforeResultIds) {
        if (!keptResultIds.has(id)) run("DELETE FROM exam_results WHERE id = ?", [id]);
      }
      for (const id of beforeCertIds) {
        if (!keptCertIds.has(id)) run("DELETE FROM certificates WHERE id = ?", [id]);
      }
      for (const id of beforeSmsIds) {
        if (!keptSmsIds.has(id)) run("DELETE FROM sms_logs WHERE id = ?", [id]);
      }
    });

    this.setStorage("exam_sessions", localStore.examSessions);
    this.setStorage("exam_results", localStore.examResults);
    this.setStorage("certificates", localStore.certificates);
    this.setStorage("revoked_certificates", localStore.revokedCertificates);
    this.setStorage("sms_logs", localStore.smsLogs);

    let serverSummary: PurgeExamSummary | undefined;
    let serverError: string | undefined;
    try {
      const res = (await serverAdminMutateStore({
        data: { action: "purge_under_50_sessions", minExaminees },
      })) as {
        success: boolean;
        error?: string | undefined;
        purgeSummary?: PurgeExamSummary | undefined;
      };
      if (res.success) {
        serverSummary = res.purgeSummary;
      } else {
        serverError = res.error || "Permission denied";
      }
      await this.syncFromServerStore();
    } catch {}

    this.notifyListeners();
    return serverError
      ? { ...(serverSummary || localSummary), error: serverError }
      : serverSummary || localSummary;
  }

  // ---------------- TRANSACTIONS ----------------
  getTransactions(): DbTransaction[] {
    const rows = sqliteEngine.query<DbTransaction>("SELECT * FROM transactions ORDER BY date DESC");
    if (rows.length > 0) {
      return rows;
    }
    return this.getStorage<DbTransaction[]>("transactions", []);
  }

  recordTransaction(trx: Omit<DbTransaction, "id" | "date">): DbTransaction {
    const id = `trx-${Date.now()}`;
    const date = new Date().toISOString();
    const newTrx: DbTransaction = {
      ...trx,
      id,
      date,
    };

    sqliteEngine.run(
      "INSERT INTO transactions (id, planId, amount, msisdn, trxId, method, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, trx.planId, trx.amount, trx.msisdn, trx.trxId, trx.method, date, trx.status],
    );

    const trxs = this.getTransactions();
    this.setStorage("transactions", trxs);
    return newTrx;
  }

  updateTransactionStatus(trxId: string, status: DbTransaction["status"]): void {
    sqliteEngine.run("UPDATE transactions SET status = ? WHERE id = ? OR trxId = ?", [
      status,
      trxId,
      trxId,
    ]);
    const updated = this.getTransactions().map((t) =>
      t.id === trxId || t.trxId === trxId ? { ...t, status } : t,
    );
    this.setStorage("transactions", updated);
    this.notifyListeners();
    serverAdminMutateStore({
      data: { action: "update_transaction", trxId, trxStatus: status },
    })
      .then((res) => {
        if (res.success) {
          return this.syncFromServerStore();
        }
        return undefined;
      })
      .catch(() => {});
  }

  // ---------------- SMS LOGS ----------------
  getSmsLogs(): DbSmsLog[] {
    const rows = sqliteEngine.query<DbSmsLog>("SELECT * FROM sms_logs ORDER BY timestamp DESC");
    if (rows.length > 0) {
      return rows;
    }
    return this.getStorage<DbSmsLog[]>("sms_logs", []);
  }

  logSms(sms: Omit<DbSmsLog, "id" | "timestamp">): DbSmsLog {
    const id = `sms-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const timestamp = new Date().toISOString();
    const newLog: DbSmsLog = {
      ...sms,
      id,
      timestamp,
    };

    sqliteEngine.run(
      "INSERT INTO sms_logs (id, recipientPhone, studentName, rollNumber, quizTitle, score, rank, messageText, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        sms.recipientPhone,
        sms.studentName,
        sms.rollNumber,
        sms.quizTitle,
        sms.score,
        sms.rank,
        sms.messageText,
        sms.status,
        timestamp,
      ],
    );

    const logs = this.getSmsLogs();
    this.setStorage("sms_logs", logs);
    return newLog;
  }

  // ---------------- SALES LEADS ----------------
  getSalesLeads(): DbSalesLead[] {
    const rows = sqliteEngine.query<DbSalesLead>(
      "SELECT * FROM sales_leads ORDER BY createdAt DESC",
    );
    if (rows.length > 0) return rows;
    return this.getStorage<DbSalesLead[]>("sales_leads", []);
  }

  recordSalesLead(lead: {
    name: string;
    organization: string;
    email: string;
    phone: string;
    studentCount: string;
    message?: string;
  }): DbSalesLead {
    const id = `lead-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const newLead: DbSalesLead = {
      ...lead,
      message: lead.message || "",
      status: "new",
      id,
      createdAt,
    };

    sqliteEngine.run(
      "INSERT INTO sales_leads (id, name, organization, email, phone, studentCount, message, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        lead.name,
        lead.organization,
        lead.email,
        lead.phone,
        lead.studentCount,
        lead.message || "",
        "new",
        createdAt,
      ],
    );

    const leads = this.getSalesLeads();
    this.setStorage("sales_leads", leads);
    return newLead;
  }

  updateSalesLeadStatus(leadId: string, status: string): void {
    sqliteEngine.run("UPDATE sales_leads SET status = ? WHERE id = ?", [status, leadId]);
    const updated = this.getSalesLeads().map((l) => (l.id === leadId ? { ...l, status } : l));
    this.setStorage("sales_leads", updated);
    this.notifyListeners();
    serverAdminMutateStore({
      data: { action: "update_sales_lead", leadId, leadStatus: status },
    }).catch(() => {});
  }
}

export const db = new OnneshaDatabase();
