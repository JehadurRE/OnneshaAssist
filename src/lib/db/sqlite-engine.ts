import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

class SQLiteEngine {
  private SQL: SqlJsStatic | null = null;
  private db: Database | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initPromise = this.init();
    }
  }

  public async init(): Promise<void> {
    if (this.isInitialized && this.db) return;

    try {
      this.SQL = await initSqlJs({
        locateFile: () => sqlWasmUrl || '/sql-wasm.wasm',
      });

      const savedDbBase64 = localStorage.getItem('onnesha_sqlite_db_bin');
      if (savedDbBase64) {
        try {
          const binary = Uint8Array.from(atob(savedDbBase64), (c) => c.charCodeAt(0));
          this.db = new this.SQL.Database(binary);
        } catch (e) {
          console.warn('Failed to load saved SQLite binary, creating fresh DB:', e);
          this.db = new this.SQL.Database();
        }
      } else {
        this.db = new this.SQL.Database();
      }

      this.createTables();
      this.isInitialized = true;
    } catch (err) {
      console.warn('SQLite Engine local wasm notice, attempting CDN fallback:', err);
      try {
        this.SQL = await initSqlJs({
          locateFile: () => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm',
        });
        this.db = new this.SQL.Database();
        this.createTables();
        this.isInitialized = true;
      } catch (fallbackErr) {
        console.warn('SQLite Engine fallback notice:', fallbackErr);
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
        institutionName TEXT,
        phone TEXT,
        passwordHash TEXT,
        avatarUrl TEXT,
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
        titleEn TEXT,
        titleBn TEXT,
        descriptionEn TEXT,
        descriptionBn TEXT,
        categoryEn TEXT,
        categoryBn TEXT,
        icon TEXT,
        questionsJson TEXT,
        isTemplate INTEGER DEFAULT 0,
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
        verified INTEGER DEFAULT 1
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
        answersJson TEXT,
        createdAt TEXT
      );
    `;

    this.db.run(schema);

    // Safe column migrations for any pre-existing local DBs
    const migrations = [
      'ALTER TABLE roster_students ADD COLUMN phone TEXT',
      'ALTER TABLE roster_students ADD COLUMN regionId TEXT',
      'ALTER TABLE roster_students ADD COLUMN regionName TEXT',
      'ALTER TABLE roster_students ADD COLUMN passcode TEXT',
      'ALTER TABLE certificates ADD COLUMN regionName TEXT',
      'ALTER TABLE exam_sessions ADD COLUMN allowedRegionId TEXT',
      'ALTER TABLE exam_sessions ADD COLUMN allowedRegionName TEXT',
      'ALTER TABLE exam_results ADD COLUMN phone TEXT',
      'ALTER TABLE exam_results ADD COLUMN regionId TEXT',
      'ALTER TABLE exam_results ADD COLUMN regionName TEXT',
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

  public persist(): void {
    if (!this.db || typeof window === 'undefined') return;
    try {
      const data = this.db.export();
      // Guard against 5MB localStorage overflow on huge datasets
      if (data.byteLength > 3_500_000) return;
      let binary = '';
      const len = data.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(data[i]);
      }
      const base64 = btoa(binary);
      localStorage.setItem('onnesha_sqlite_db_bin', base64);
    } catch (e) {
      console.warn('SQLite persistence error:', e);
    }
  }

  public run(sql: string, params: any[] = []): void {
    if (!this.db) return;
    this.db.run(sql, params);
    this.persist();
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
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
      console.warn('SQLite query error:', sql, e);
      return [];
    }
  }

  public queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const res = this.query<T>(sql, params);
    return res.length > 0 ? res[0] : null;
  }
}

export const sqliteEngine = new SQLiteEngine();
