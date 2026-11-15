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
  computeParticipantAccuracyPct,
  computeTotalQuizMarks,
  isPassingScore,
  resolveOrgName,
  resolvePassThresholdPct,
} from "../scoring";
import { DEFAULT_BRANDING_SETTINGS, mergeBrandingSettings } from "../branding";

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

      sqliteEngine.runBatch((run) => {
        if (res.regions?.length) {
          res.regions.forEach((reg) => {
            run(
              "INSERT OR REPLACE INTO regions (id, code, nameEn, nameBn, centerName, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
              [reg.id, reg.code, reg.nameEn, reg.nameBn, reg.centerName || "", reg.createdAt],
            );
          });
        }

        if (res.roster?.length) {
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

        if (res.courses?.length) {
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

        if (res.users?.length) {
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

        if (res.customQuizzes?.length) {
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

        if (res.examSessions?.length) {
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

        if (res.examResults?.length) {
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

        if (mappedTrx.length) {
          mappedTrx.forEach((t) => {
            run(
              "INSERT OR REPLACE INTO transactions (id, planId, amount, msisdn, trxId, method, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [t.id, t.planId, t.amount, t.msisdn, t.trxId, t.method, t.date, t.status],
            );
          });
        }

        if (mappedLeads.length) {
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
      });

      if (res.regions?.length) this.setStorage("regions", res.regions);
      if (res.roster?.length) this.setStorage("roster_students", res.roster);
      if (res.courses?.length) this.setStorage("courses", res.courses);
      if (res.users?.length) this.setStorage("users", res.users);
      if (res.customQuizzes?.length) this.setStorage("custom_quizzes", res.customQuizzes);
      if (res.examSessions?.length) this.setStorage("exam_sessions", res.examSessions);
      if (res.examResults?.length) this.setStorage("exam_results", res.examResults);
      if (res.certificates?.length) this.setStorage("certificates", res.certificates);
      if (mappedTrx.length) this.setStorage("transactions", mappedTrx);
      if (mappedLeads.length) this.setStorage("sales_leads", mappedLeads);

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
        passwordHash: r.passwordHash || "instructor123",
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
    return this.getStorage<ManagedUser[]>("users", DEFAULT_USERS);
  }

  saveUser(user: ManagedUser): ManagedUser {
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
        user.passwordHash || "instructor123",
        user.plan || "institution_max",
        JSON.stringify(user.assignedCourseIds || []),
        user.status || "active",
        user.createdAt || new Date().toISOString(),
      ],
    );

    const users = this.getStorage<ManagedUser[]>("users", [...DEFAULT_USERS]);
    const idx = users.findIndex(
      (u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase(),
    );
    if (idx >= 0) users[idx] = user;
    else users.push(user);
    this.setStorage("users", users);

    serverAdminMutateStore({ data: { action: "save_user", user } }).catch((err) =>
      console.warn("User server sync notice:", err),
    );
    this.notifyListeners();
    return user;
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

    const sqliteRows = sqliteEngine.query<any>("SELECT * FROM quizzes ORDER BY createdAt DESC");
    if (sqliteRows.length > 0) {
      const customQuizzes: Quiz[] = sqliteRows.map(mapRow);
      const customIds = new Set(customQuizzes.map((q) => q.id));
      const remainingPacks = READY_MADE_PACKS.filter((p) => !customIds.has(p.id)).map((p) => ({
        ...p,
        isPrivate: isQuizPrivate(p, courses),
      }));
      return [...customQuizzes, ...remainingPacks];
    }

    const custom = this.getStorage<Quiz[]>("custom_quizzes", []).map((q) => ({
      ...q,
      isPrivate: isQuizPrivate(q, courses),
    }));
    const customIds = new Set(custom.map((q) => q.id));
    const remainingPacks = READY_MADE_PACKS.filter((p) => !customIds.has(p.id)).map((p) => ({
      ...p,
      isPrivate: isQuizPrivate(p, courses),
    }));
    return [...custom, ...remainingPacks];
  }

  getQuizBySlug(slug: string): Quiz | undefined {
    const courses = this.getCourses();
    const row = sqliteEngine.queryOne<any>("SELECT * FROM quizzes WHERE slug = ? OR id = ?", [
      slug,
      slug,
    ]);
    if (row) {
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

    serverAdminMutateStore({ data: { action: "save_quiz", quiz: normalizedQuiz } }).catch((err) =>
      console.warn("Quiz server sync notice:", err),
    );
    this.notifyListeners();
  }

  deleteCustomQuiz(id: string): void {
    sqliteEngine.run("DELETE FROM quizzes WHERE id = ? OR slug = ?", [id, id]);
    const custom = this.getStorage<Quiz[]>("custom_quizzes", []);
    const filtered = custom.filter((q) => q.id !== id);
    this.setStorage("custom_quizzes", filtered);

    serverAdminMutateStore({ data: { action: "delete_quiz", quizId: id } }).catch((err) =>
      console.warn("Quiz delete sync notice:", err),
    );
    this.notifyListeners();
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
    const sessionId = `exam-${session.pin}`;
    const createdAt = new Date().toISOString();
    const participantsList = Object.values(session.participants)
      .filter((p) => !p.isBot)
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.lastActive - b.lastActive));
    const count = participantsList.length;
    if (count === 0) return;

    const totalScore = participantsList.reduce((acc, p) => acc + p.score, 0);
    const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
    const highestScore = participantsList[0]?.score ?? 0;

    // Hoist branding, pass threshold & quiz question lookup outside the participant loop
    const branding = this.getBranding();
    const matchedQuiz = this.getQuizBySlug(session.quizId);
    const matchedCourse = matchedQuiz?.courseId
      ? this.getCourses().find((c) => c.id === matchedQuiz.courseId)
      : undefined;
    const effectivePassThresholdPct = resolvePassThresholdPct({
      sessionThreshold: session.settings?.passThresholdPct,
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

    sqliteEngine.runBatch((run) => {
      run(
        "INSERT OR REPLACE INTO exam_sessions (id, pin, quizId, quizTitleEn, quizTitleBn, hostId, allowedRegionId, allowedRegionName, totalQuestions, participantCount, averageScore, highestScore, passThresholdPct, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          sessionId,
          session.pin,
          session.quizId,
          session.quizTitleEn || "Onnesha Assessment",
          session.quizTitleBn || "অন্বেষা মডেল টেস্ট",
          session.hostId || "host",
          session.settings.allowedRegionId || "all",
          session.settings.allowedRegionName || "All Regions",
          session.totalQuestions,
          count,
          avgScore,
          highestScore,
          effectivePassThresholdPct,
          createdAt,
        ],
      );

      participantsList.forEach((p, idx) => {
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

        const resultId = `res-${session.pin}-${p.id}`;
        run(
          "INSERT OR REPLACE INTO exam_results (id, sessionId, pin, participantId, rollNumber, name, phone, regionId, regionName, score, rank, correctCount, incorrectCount, unattemptedCount, accuracyPct, passed, answersJson, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            resultId,
            sessionId,
            session.pin,
            p.id,
            roll,
            p.nickname || p.name || `Candidate ${humanRank}`,
            p.phone || "",
            p.regionId || "reg-dhaka",
            p.regionName || "Dhaka Range",
            p.score,
            humanRank,
            correctCount,
            incorrectCount,
            unattemptedCount,
            accuracy,
            passed ? 1 : 0,
            JSON.stringify(p.answers || {}),
            createdAt,
          ],
        );

        if (passed) {
          const certNo = formatDeterministicCertNumber(session.pin, roll, humanRank);
          this.issueCertificate(
            {
              certificateNumber: certNo,
              studentName: p.nickname || p.name || `Candidate ${humanRank}`,
              studentRoll: roll,
              regionName: p.regionName || "Dhaka Range",
              quizTitle: session.quizTitleBn || session.quizTitleEn || "Institutional Assessment",
              score: p.score,
              totalPoints: computedTotalPoints,
              rank: humanRank,
              totalParticipants: count,
              accuracyPercent: accuracy,
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

  issueCertificate(
    cert: Omit<CertificateData, "id">,
    options?: { syncToServer?: boolean; skipStorageRefresh?: boolean },
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
      users: this.getUsers(),
      customQuizzes: this.getStorage<Quiz[]>("custom_quizzes", []),
      examSessions: this.getExamSessions(),
      examResults: this.getAllExamResults(),
      certificates: this.getCertificates(),
      branding: this.getBranding(),
    };
    return JSON.stringify(payload, null, 2);
  }

  async importFullBackup(jsonString: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(jsonString);
      await serverAdminMutateStore({
        data: {
          action: "import_store_backup",
          backup: parsed,
        },
      });
      await this.syncFromServerStore();
      return true;
    } catch (err) {
      console.warn("Failed to import backup:", err);
      return false;
    }
  }

  async purgeDummyData(): Promise<void> {
    sqliteEngine.run("DELETE FROM roster_students WHERE email LIKE '%@academy.edu.bd'");
    sqliteEngine.run("DELETE FROM exam_results WHERE participantId LIKE 'bot-%'");
    sqliteEngine.run(
      "DELETE FROM courses WHERE id IN ('course-field-safety', 'course-science-stem')",
    );
    sqliteEngine.run("DELETE FROM users WHERE id IN ('usr-instructor-2', 'usr-instructor-3')");
    sqliteEngine.run(
      "DELETE FROM certificates WHERE UPPER(certificateNumber) IN ('ONN-4821-9982', 'ONN-4634-026104')",
    );
    try {
      await serverAdminMutateStore({ data: { action: "purge_dummy_data" } });
      await this.syncFromServerStore();
    } catch {}
    this.notifyListeners();
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
    }).catch(() => {});
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
