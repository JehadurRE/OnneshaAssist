import initSqlJs, { Database, SqlJsStatic, SqlValue } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";

class SQLiteEngine {
  private SQL: SqlJsStatic | null = null;
  private db: Database | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private inBatch = false;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private hasPendingPersist = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.initPromise = this.init();
      const flushOnUnload = () => {
        if (this.hasPendingPersist || this.persistTimer) {
          this.persist();
        }
      };
      window.addEventListener("beforeunload", flushOnUnload);
      window.addEventListener("pagehide", flushOnUnload);
    }
  }

  private restoreFromStorageOrBlank(): Database {
    if (!this.SQL) {
      throw new Error("SQL.js not initialized");
    }
    const savedDbBase64 =
      typeof window !== "undefined" ? localStorage.getItem("onnesha_sqlite_db_bin") : null;
    if (savedDbBase64) {
      try {
        const raw = atob(savedDbBase64);
        const len = raw.length;
        const binary = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          binary[i] = raw.charCodeAt(i);
        }
        return new this.SQL.Database(binary);
      } catch (e) {
        console.warn("Failed to load saved SQLite binary, creating fresh DB:", e);
      }
    }
    return new this.SQL.Database();
  }

  public async init(): Promise<void> {
    if (this.isInitialized && this.db) return;

    try {
      const isNodeRuntime = typeof process !== "undefined" && Boolean(process.versions?.node);
      this.SQL = await initSqlJs(
        isNodeRuntime
          ? { locateFile: (file) => `${process.cwd()}/node_modules/sql.js/dist/${file}` }
          : { locateFile: () => sqlWasmUrl || "/sql-wasm.wasm" },
      );

      this.db = this.restoreFromStorageOrBlank();
      this.createTables();
      this.isInitialized = true;
    } catch (err) {
      console.warn("SQLite Engine local wasm notice, attempting CDN fallback:", err);
      try {
        this.SQL = await initSqlJs({
          locateFile: () => "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm",
        });
        this.db = this.restoreFromStorageOrBlank();
        this.createTables();
        this.isInitialized = true;
      } catch (fallbackErr) {
        console.warn("SQLite Engine fallback notice:", fallbackErr);
      }
    }
  }

  public async ready(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private createTables() {
    if (!this.db) return;

    const schema = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        name TEXT,
        role TEXT,
        institution TEXT,
        designation TEXT,
        phone TEXT,
        passwordHash TEXT,
        plan TEXT,
        assignedCourseIdsJson TEXT,
        status TEXT,
        aiCredits INTEGER,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        code TEXT,
        titleEn TEXT,
        titleBn TEXT,
        descriptionEn TEXT,
        descriptionBn TEXT,
        categoryEn TEXT,
        categoryBn TEXT,
        icon TEXT,
        color TEXT,
        instructorIdsJson TEXT,
        instructorNamesJson TEXT,
        isPrivate INTEGER DEFAULT 1,
        passThresholdPct INTEGER,
        status TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS regions (
        id TEXT PRIMARY KEY,
        code TEXT,
        nameEn TEXT,
        nameBn TEXT,
        centerName TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS quizzes (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE,
        courseId TEXT,
        courseTitle TEXT,
        quizNumber INTEGER,
        instructorId TEXT,
        instructorName TEXT,
        titleEn TEXT,
        titleBn TEXT,
        descriptionEn TEXT,
        descriptionBn TEXT,
        categoryEn TEXT,
        categoryBn TEXT,
        icon TEXT,
        questionsJson TEXT,
        isTemplate INTEGER DEFAULT 0,
        isPrivate INTEGER DEFAULT 1,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS roster_students (
        id TEXT PRIMARY KEY,
        rollNumber TEXT,
        name TEXT,
        phone TEXT,
        regionId TEXT,
        regionName TEXT,
        section TEXT,
        batch TEXT,
        guardianPhone TEXT,
        email TEXT,
        username TEXT,
        hasPassword INTEGER DEFAULT 0,
        mustChangePassword INTEGER DEFAULT 0,
        credentialsEmailedAt TEXT,
        passwordUpdatedAt TEXT,
        passcode TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        certificateNumber TEXT UNIQUE,
        studentName TEXT,
        studentRoll TEXT,
        regionName TEXT,
        quizTitle TEXT,
        score INTEGER,
        totalPoints INTEGER,
        rank INTEGER,
        totalParticipants INTEGER,
        accuracyPercent REAL,
        issueDate TEXT,
        organizationName TEXT,
        institutionName TEXT,
        instructorName TEXT,
        verificationUrl TEXT,
        signatureUrl TEXT,
        verified INTEGER DEFAULT 1,
        payloadHash TEXT,
        prevBlockHash TEXT,
        ledgerIndex INTEGER,
        chainHash TEXT,
        cryptoSignature TEXT,
        signerKeyId TEXT,
        signedAt TEXT,
        rekorEntryUuid TEXT,
        rekorLogIndex INTEGER,
        rekorIntegratedTime INTEGER,
        rekorLogId TEXT,
        rekorStatus TEXT,
        rekorReceiptDigest TEXT,
        rekorPublicKeyId TEXT,
        rekorExplorerUrl TEXT,
        otsStatus TEXT,
        otsProofBase64 TEXT,
        otsChainHash TEXT,
        otsLedgerIndex INTEGER,
        otsCalendarUrl TEXT,
        otsSubmittedAt TEXT,
        otsBitcoinBlockHeight INTEGER
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        planId TEXT,
        amount REAL,
        msisdn TEXT,
        trxId TEXT UNIQUE,
        method TEXT,
        date TEXT,
        status TEXT
      );

      CREATE TABLE IF NOT EXISTS sms_logs (
        id TEXT PRIMARY KEY,
        recipientPhone TEXT,
        studentName TEXT,
        rollNumber TEXT,
        quizTitle TEXT,
        score REAL,
        rank INTEGER,
        messageText TEXT,
        status TEXT,
        timestamp TEXT
      );

      CREATE TABLE IF NOT EXISTS sales_leads (
        id TEXT PRIMARY KEY,
        name TEXT,
        organization TEXT,
        email TEXT,
        phone TEXT,
        studentCount TEXT,
        message TEXT,
        status TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS exam_sessions (
        id TEXT PRIMARY KEY,
        pin TEXT,
        quizId TEXT,
        quizTitleEn TEXT,
        quizTitleBn TEXT,
        hostId TEXT,
        allowedRegionId TEXT,
        allowedRegionName TEXT,
        totalQuestions INTEGER,
        participantCount INTEGER,
        averageScore REAL,
        highestScore REAL,
        passThresholdPct INTEGER,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS exam_results (
        id TEXT PRIMARY KEY,
        sessionId TEXT,
        pin TEXT,
        participantId TEXT,
        rollNumber TEXT,
        name TEXT,
        phone TEXT,
        regionId TEXT,
        regionName TEXT,
        score REAL,
        rank INTEGER,
        correctCount INTEGER,
        incorrectCount INTEGER,
        unattemptedCount INTEGER,
        accuracyPct REAL,
        passed INTEGER,
        answersJson TEXT,
        createdAt TEXT
      );
    `;

    this.db.run(schema);

    // Safe column migrations for any pre-existing local DBs
    const migrations = [
      "ALTER TABLE roster_students ADD COLUMN phone TEXT",
      "ALTER TABLE roster_students ADD COLUMN regionId TEXT",
      "ALTER TABLE roster_students ADD COLUMN regionName TEXT",
      "ALTER TABLE roster_students ADD COLUMN passcode TEXT",
      "ALTER TABLE roster_students ADD COLUMN username TEXT",
      "ALTER TABLE roster_students ADD COLUMN hasPassword INTEGER DEFAULT 0",
      "ALTER TABLE roster_students ADD COLUMN mustChangePassword INTEGER DEFAULT 0",
      "ALTER TABLE roster_students ADD COLUMN credentialsEmailedAt TEXT",
      "ALTER TABLE roster_students ADD COLUMN passwordUpdatedAt TEXT",
      "ALTER TABLE certificates ADD COLUMN regionName TEXT",
      "ALTER TABLE exam_sessions ADD COLUMN allowedRegionId TEXT",
      "ALTER TABLE exam_sessions ADD COLUMN allowedRegionName TEXT",
      "ALTER TABLE exam_results ADD COLUMN phone TEXT",
      "ALTER TABLE exam_results ADD COLUMN regionId TEXT",
      "ALTER TABLE exam_results ADD COLUMN regionName TEXT",
      "ALTER TABLE quizzes ADD COLUMN courseId TEXT",
      "ALTER TABLE quizzes ADD COLUMN courseTitle TEXT",
      "ALTER TABLE quizzes ADD COLUMN quizNumber INTEGER",
      "ALTER TABLE quizzes ADD COLUMN instructorId TEXT",
      "ALTER TABLE quizzes ADD COLUMN instructorName TEXT",
      "ALTER TABLE quizzes ADD COLUMN isPrivate INTEGER",
      "ALTER TABLE courses ADD COLUMN isPrivate INTEGER",
      "ALTER TABLE courses ADD COLUMN passThresholdPct INTEGER",
      "ALTER TABLE exam_sessions ADD COLUMN passThresholdPct INTEGER",
      "ALTER TABLE exam_results ADD COLUMN passed INTEGER",
      "ALTER TABLE users ADD COLUMN institution TEXT",
      "ALTER TABLE users ADD COLUMN designation TEXT",
      "ALTER TABLE users ADD COLUMN plan TEXT",
      "ALTER TABLE users ADD COLUMN assignedCourseIdsJson TEXT",
      "ALTER TABLE users ADD COLUMN status TEXT",
      "ALTER TABLE users ADD COLUMN aiCredits INTEGER",
      "ALTER TABLE sales_leads ADD COLUMN status TEXT",
      "ALTER TABLE certificates ADD COLUMN payloadHash TEXT",
      "ALTER TABLE certificates ADD COLUMN prevBlockHash TEXT",
      "ALTER TABLE certificates ADD COLUMN ledgerIndex INTEGER",
      "ALTER TABLE certificates ADD COLUMN chainHash TEXT",
      "ALTER TABLE certificates ADD COLUMN cryptoSignature TEXT",
      "ALTER TABLE certificates ADD COLUMN signerKeyId TEXT",
      "ALTER TABLE certificates ADD COLUMN signedAt TEXT",
      "ALTER TABLE certificates ADD COLUMN rekorEntryUuid TEXT",
      "ALTER TABLE certificates ADD COLUMN rekorLogIndex INTEGER",
      "ALTER TABLE certificates ADD COLUMN rekorIntegratedTime INTEGER",
      "ALTER TABLE certificates ADD COLUMN rekorLogId TEXT",
      "ALTER TABLE certificates ADD COLUMN rekorStatus TEXT",
      "ALTER TABLE certificates ADD COLUMN rekorReceiptDigest TEXT",
      "ALTER TABLE certificates ADD COLUMN rekorPublicKeyId TEXT",
      "ALTER TABLE certificates ADD COLUMN rekorExplorerUrl TEXT",
      "ALTER TABLE certificates ADD COLUMN otsStatus TEXT",
      "ALTER TABLE certificates ADD COLUMN otsProofBase64 TEXT",
      "ALTER TABLE certificates ADD COLUMN otsChainHash TEXT",
      "ALTER TABLE certificates ADD COLUMN otsLedgerIndex INTEGER",
      "ALTER TABLE certificates ADD COLUMN otsCalendarUrl TEXT",
      "ALTER TABLE certificates ADD COLUMN otsSubmittedAt TEXT",
      "ALTER TABLE certificates ADD COLUMN otsBitcoinBlockHeight INTEGER",
      "ALTER TABLE certificates ADD COLUMN kind TEXT",
      "ALTER TABLE certificates ADD COLUMN courseId TEXT",
      "ALTER TABLE certificates ADD COLUMN courseCode TEXT",
      "ALTER TABLE certificates ADD COLUMN courseTitle TEXT",
      "ALTER TABLE certificates ADD COLUMN quizAccuracyPct REAL",
      "ALTER TABLE certificates ADD COLUMN practicalScorePct REAL",
      "ALTER TABLE certificates ADD COLUMN combinedScorePct REAL",
      "ALTER TABLE certificates ADD COLUMN credentialStatementEn TEXT",
      "ALTER TABLE certificates ADD COLUMN credentialStatementBn TEXT",
    ];
    for (const sql of migrations) {
      try {
        this.db.run(sql);
      } catch {
        // column already exists
      }
    }

    this.persist();
  }

  public schedulePersist(delayMs = 120): void {
    this.hasPendingPersist = true;
    if (typeof window === "undefined" || !this.db) return;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persist();
    }, delayMs);
  }

  public persist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.hasPendingPersist = false;
    if (!this.db || typeof window === "undefined") return;
    try {
      const data = this.db.export();
      // Guard against 5MB localStorage overflow on huge datasets
      if (data.byteLength > 3_500_000) return;
      const chunkSize = 8192;
      const chunks: string[] = [];
      for (let i = 0; i < data.byteLength; i += chunkSize) {
        const sub = data.subarray(i, i + chunkSize);
        chunks.push(String.fromCharCode(...sub));
      }
      const base64 = btoa(chunks.join(""));
      localStorage.setItem("onnesha_sqlite_db_bin", base64);
    } catch (e) {
      console.warn("SQLite persistence error:", e);
    }
  }

  public run(sql: string, params: SqlValue[] = []): void {
    if (!this.db) return;
    this.db.run(sql, params);
    if (!this.inBatch) {
      this.schedulePersist();
    }
  }

  public runBatch(fn: (run: (sql: string, params?: SqlValue[]) => void) => void): void {
    if (!this.db) return;
    const wasInBatch = this.inBatch;
    this.inBatch = true;
    if (!wasInBatch) {
      this.db.run("BEGIN TRANSACTION");
    }
    try {
      fn((sql, params = []) => {
        this.db?.run(sql, params);
      });
      if (!wasInBatch) {
        this.db.run("COMMIT");
      }
    } catch (e) {
      if (!wasInBatch) {
        try {
          this.db.run("ROLLBACK");
        } catch {
          // ignore rollback error if transaction already closed
        }
      }
      console.warn("SQLite batch execution warning:", e);
      throw e;
    } finally {
      this.inBatch = wasInBatch;
      if (!wasInBatch) {
        this.schedulePersist();
      }
    }
  }

  public query<T = unknown>(sql: string, params: SqlValue[] = []): T[] {
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return results;
    } catch (e) {
      console.warn("SQLite query error:", sql, e);
      return [];
    }
  }

  public queryOne<T = unknown>(sql: string, params: SqlValue[] = []): T | null {
    const res = this.query<T>(sql, params);
    return res[0] ?? null;
  }
}

export const sqliteEngine = new SQLiteEngine();
