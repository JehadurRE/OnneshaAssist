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
} from '../types';
import { DEFAULT_COURSES, DEFAULT_REGIONS, DEFAULT_USERS, READY_MADE_PACKS, SAMPLE_ROSTER } from '../mock-data';
import { sqliteEngine } from './sqlite-engine';
import { serverAdminMutateStore, serverGetBootstrapData } from '../server-session';

export interface DbTransaction {
  id: string;
  planId: string;
  amount: number;
  msisdn: string;
  trxId: string;
  method: 'bkash' | 'nagad' | 'card' | 'bank_po';
  date: string;
  status: 'completed' | 'pending' | 'failed';
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
  status: 'delivered' | 'queued' | 'failed';
  timestamp: string;
}

export function formatDeterministicCertNumber(pin: string, rollNumber?: string, fallbackIdx = 1): string {
  const cleanRoll = (rollNumber || `${100 + fallbackIdx}`)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(-6)
    .padStart(4, '0');
  return `ONN-${pin.slice(0, 4)}-${cleanRoll}`;
}

class OnneshaDatabase {
  private listeners: (() => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
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

  public async syncFromServerStore(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const res = await serverGetBootstrapData();
      if (!res.success) return;

      if (res.regions?.length) {
        res.regions.forEach((reg) => {
          sqliteEngine.run(
            'INSERT OR REPLACE INTO regions (id, code, nameEn, nameBn, centerName, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
            [reg.id, reg.code, reg.nameEn, reg.nameBn, reg.centerName || '', reg.createdAt]
          );
        });
        this.setStorage('regions', res.regions);
      }

      if (res.roster?.length) {
        res.roster.forEach((s) => {
          sqliteEngine.run(
            'INSERT OR REPLACE INTO roster_students (id, rollNumber, name, phone, regionId, regionName, section, batch, guardianPhone, email, passcode, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              s.id,
              s.rollNumber,
              s.name,
              s.phone || s.guardianPhone || '',
              s.regionId || 'reg-dhaka',
              s.regionName || 'Dhaka Range',
              s.section || 'A',
              s.batch || '46th BCS & Cadet Batch',
              s.guardianPhone || s.phone || '',
              s.email || `${s.rollNumber}@academy.edu.bd`,
              s.passcode || '',
              s.createdAt || new Date().toISOString(),
            ]
          );
        });
        this.setStorage('roster_students', res.roster);
      }

      if (res.courses?.length) {
        res.courses.forEach((c) => {
          sqliteEngine.run(
            'INSERT OR REPLACE INTO courses (id, code, titleEn, titleBn, descriptionEn, descriptionBn, categoryEn, categoryBn, icon, color, instructorIdsJson, instructorNamesJson, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              c.id,
              c.code,
              c.titleEn,
              c.titleBn,
              c.descriptionEn,
              c.descriptionBn,
              c.categoryEn,
              c.categoryBn,
              c.icon || '📚',
              c.color || 'from-emerald-500/20 to-teal-500/20',
              JSON.stringify(c.instructorIds || []),
              JSON.stringify(c.instructorNames || []),
              c.status || 'active',
              c.createdAt || new Date().toISOString(),
            ]
          );
        });
        this.setStorage('courses', res.courses);
      }

      if (res.users?.length) {
        res.users.forEach((u) => {
          sqliteEngine.run(
            'INSERT OR REPLACE INTO users (id, email, name, role, institution, designation, phone, passwordHash, plan, assignedCourseIdsJson, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              u.id,
              u.email,
              u.name,
              u.role,
              u.institution || '',
              u.designation || '',
              u.phone || '',
              u.passwordHash || '',
              u.plan || 'institution_max',
              JSON.stringify(u.assignedCourseIds || []),
              u.status || 'active',
              u.createdAt || new Date().toISOString(),
            ]
          );
        });
        this.setStorage('users', res.users);
      }

      if (res.customQuizzes?.length) {
        res.customQuizzes.forEach((quiz) => {
          sqliteEngine.run(
            'INSERT OR REPLACE INTO quizzes (id, slug, courseId, courseTitle, quizNumber, instructorId, instructorName, titleEn, titleBn, descriptionEn, descriptionBn, categoryEn, categoryBn, icon, questionsJson, isTemplate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              quiz.id,
              quiz.slug,
              quiz.courseId || '',
              quiz.courseTitle || '',
              quiz.quizNumber || 1,
              quiz.instructorId || '',
              quiz.instructorName || '',
              quiz.titleEn,
              quiz.titleBn,
              quiz.descriptionEn,
              quiz.descriptionBn,
              quiz.categoryEn,
              quiz.categoryBn,
              quiz.icon,
              JSON.stringify(quiz.questions),
              quiz.isTemplate ? 1 : 0,
              quiz.createdAt || new Date().toISOString(),
            ]
          );
        });
        this.setStorage('custom_quizzes', res.customQuizzes);
      }

      if (res.examSessions?.length) {
        res.examSessions.forEach((es) => {
          sqliteEngine.run(
            'INSERT OR REPLACE INTO exam_sessions (id, pin, quizId, quizTitleEn, quizTitleBn, hostId, allowedRegionId, allowedRegionName, totalQuestions, participantCount, averageScore, highestScore, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              es.id,
              es.pin,
              es.quizId,
              es.quizTitleEn,
              es.quizTitleBn,
              es.hostId,
              es.allowedRegionId || 'all',
              es.allowedRegionName || 'All Regions',
              es.totalQuestions,
              es.participantCount,
              es.averageScore,
              es.highestScore,
              es.createdAt,
            ]
          );
        });
        this.setStorage('exam_sessions', res.examSessions);
      }

      if (res.examResults?.length) {
        res.examResults.forEach((er) => {
          sqliteEngine.run(
            'INSERT OR REPLACE INTO exam_results (id, sessionId, pin, participantId, rollNumber, name, phone, regionId, regionName, score, rank, correctCount, incorrectCount, unattemptedCount, accuracyPct, answersJson, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              er.id,
              er.sessionId,
              er.pin,
              er.participantId,
              er.rollNumber,
              er.name,
              er.phone || '',
              er.regionId || 'reg-dhaka',
              er.regionName || 'Dhaka Range',
              er.score,
              er.rank,
              er.correctCount,
              er.incorrectCount,
              er.unattemptedCount,
              er.accuracyPct,
              er.answersJson || '{}',
              er.createdAt,
            ]
          );
        });
        this.setStorage('exam_results', res.examResults);
      }

      if (res.certificates?.length) {
        res.certificates.forEach((cert) => {
          sqliteEngine.run(
            'INSERT OR REPLACE INTO certificates (id, certificateNumber, studentName, studentRoll, regionName, quizTitle, score, totalPoints, rank, totalParticipants, accuracyPercent, issueDate, organizationName, institutionName, instructorName, verificationUrl, signatureUrl, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              cert.id,
              cert.certificateNumber,
              cert.studentName,
              cert.studentRoll || '',
              cert.regionName || 'Dhaka Range',
              cert.quizTitle,
              cert.score || cert.marksObtained || 0,
              cert.totalPoints || cert.totalMarks || 100,
              cert.rank,
              cert.totalParticipants,
              cert.accuracyPercent || cert.scorePct || 0,
              cert.issueDate,
              cert.organizationName || 'Onnesha Assessment',
              cert.institutionName || 'Onnesha Assessment Arena',
              cert.instructorName || 'Chief Assessment Officer',
              cert.verificationUrl || '',
              cert.signatureUrl || '',
              cert.verified ? 1 : 0,
            ]
          );
        });
        this.setStorage('certificates', res.certificates);
      }

      if (res.branding) {
        this.setStorage('branding_settings', res.branding);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('onnesha-branding-updated', { detail: res.branding }));
        }
      }

      this.notifyListeners();
    } catch (err) {
      console.warn('Server store bootstrap notice:', err);
    }
  }

  private seedInitialDataIfEmpty() {
    // Seed default Regions
    const regCount = sqliteEngine.queryOne<{ count: number }>('SELECT count(*) as count FROM regions');
    if (!regCount || regCount.count === 0) {
      DEFAULT_REGIONS.forEach((reg) => {
        sqliteEngine.run(
          'INSERT OR IGNORE INTO regions (id, code, nameEn, nameBn, centerName, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
          [reg.id, reg.code, reg.nameEn, reg.nameBn, reg.centerName || '', reg.createdAt]
        );
      });
    }

    // Seed sample Roster with Regions & Phone Numbers
    const countRow = sqliteEngine.queryOne<{ count: number }>('SELECT count(*) as count FROM roster_students');
    if (!countRow || countRow.count === 0) {
      SAMPLE_ROSTER.forEach((s) => {
        sqliteEngine.run(
          'INSERT OR IGNORE INTO roster_students (id, rollNumber, name, phone, regionId, regionName, section, batch, guardianPhone, email, passcode, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            s.id,
            s.rollNumber,
            s.name,
            s.phone || s.guardianPhone || '01711000101',
            s.regionId || 'reg-dhaka',
            s.regionName || 'Dhaka Range',
            s.section || 'A',
            s.batch || '46th BCS & Cadet Batch',
            s.guardianPhone || '01711000001',
            s.email || `${s.rollNumber}@academy.edu.bd`,
            s.passcode || '',
            new Date().toISOString(),
          ]
        );
      });
    } else {
      // Backfill any older rows missing regionId or phone
      const existing = sqliteEngine.query<RosterStudent>('SELECT * FROM roster_students');
      existing.forEach((s, idx) => {
        if (!s.regionId || !s.phone) {
          const fallbackReg = DEFAULT_REGIONS[idx % DEFAULT_REGIONS.length];
          sqliteEngine.run(
            'UPDATE roster_students SET regionId = ?, regionName = ?, phone = ? WHERE id = ?',
            [
              s.regionId || fallbackReg.id,
              s.regionName || fallbackReg.nameEn,
              s.phone || s.guardianPhone || `01711000${101 + idx}`,
              s.id,
            ]
          );
        }
      });
    }
  }

  private getStorage<T>(key: string, defaultVal: T): T {
    if (typeof window === 'undefined') return defaultVal;
    try {
      const stored = localStorage.getItem(`onnesha_db_${key}`);
      return stored ? JSON.parse(stored) : defaultVal;
    } catch {
      return defaultVal;
    }
  }

  private setStorage<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`onnesha_db_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage quota or serialization error:', e);
    }
  }

  // ---------------- REGIONS REPOSITORY ----------------
  getRegions(): Region[] {
    const rows = sqliteEngine.query<Region>('SELECT * FROM regions ORDER BY nameEn ASC');
    if (rows.length > 0) return rows;
    return this.getStorage<Region[]>('regions', DEFAULT_REGIONS);
  }

  addRegion(regionInput: { code: string; nameEn: string; nameBn: string; centerName?: string }): Region {
    const cleanCode = regionInput.code.trim().toUpperCase();
    const id = `reg-${cleanCode.toLowerCase()}-${Date.now().toString(36).slice(-4)}`;
    const createdAt = new Date().toISOString();
    const newRegion: Region = {
      id,
      code: cleanCode,
      nameEn: regionInput.nameEn.trim(),
      nameBn: (regionInput.nameBn || regionInput.nameEn).trim(),
      centerName: regionInput.centerName?.trim() || '',
      createdAt,
    };

    sqliteEngine.run(
      'INSERT OR REPLACE INTO regions (id, code, nameEn, nameBn, centerName, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [newRegion.id, newRegion.code, newRegion.nameEn, newRegion.nameBn, newRegion.centerName || '', newRegion.createdAt]
    );

    const regions = this.getRegions();
    this.setStorage('regions', regions);

    serverAdminMutateStore({ data: { action: 'add_region', region: newRegion } }).catch((err) =>
      console.warn('Region server sync notice:', err)
    );

    this.notifyListeners();
    return newRegion;
  }

  deleteRegion(id: string): void {
    sqliteEngine.run('DELETE FROM regions WHERE id = ?', [id]);
    const regions = this.getRegions().filter((r) => r.id !== id);
    this.setStorage('regions', regions);

    serverAdminMutateStore({ data: { action: 'delete_region', regionId: id } }).catch((err) =>
      console.warn('Region delete sync notice:', err)
    );
    this.notifyListeners();
  }

  // ---------------- COURSES & MULTI-INSTRUCTOR REPOSITORY ----------------
  getCourses(): Course[] {
    const rows = sqliteEngine.query<any>('SELECT * FROM courses ORDER BY createdAt ASC');
    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        titleEn: r.titleEn,
        titleBn: r.titleBn,
        descriptionEn: r.descriptionEn,
        descriptionBn: r.descriptionBn,
        categoryEn: r.categoryEn,
        categoryBn: r.categoryBn,
        icon: r.icon || '📚',
        color: r.color || 'from-emerald-500/20 to-teal-500/20',
        instructorIds: r.instructorIdsJson ? JSON.parse(r.instructorIdsJson) : [],
        instructorNames: r.instructorNamesJson ? JSON.parse(r.instructorNamesJson) : [],
        status: (r.status as 'active' | 'archived') || 'active',
        createdAt: r.createdAt,
      }));
    }
    return this.getStorage<Course[]>('courses', DEFAULT_COURSES);
  }

  saveCourse(course: Course): Course {
    sqliteEngine.run(
      'INSERT OR REPLACE INTO courses (id, code, titleEn, titleBn, descriptionEn, descriptionBn, categoryEn, categoryBn, icon, color, instructorIdsJson, instructorNamesJson, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        course.id,
        course.code,
        course.titleEn,
        course.titleBn,
        course.descriptionEn,
        course.descriptionBn,
        course.categoryEn,
        course.categoryBn,
        course.icon || '📚',
        course.color || 'from-emerald-500/20 to-teal-500/20',
        JSON.stringify(course.instructorIds || []),
        JSON.stringify(course.instructorNames || []),
        course.status || 'active',
        course.createdAt || new Date().toISOString(),
      ]
    );

    const courses = this.getStorage<Course[]>('courses', [...DEFAULT_COURSES]);
    const idx = courses.findIndex((c) => c.id === course.id);
    if (idx >= 0) courses[idx] = course;
    else courses.unshift(course);
    this.setStorage('courses', courses);

    serverAdminMutateStore({ data: { action: 'save_course', course } }).catch((err) =>
      console.warn('Course server sync notice:', err)
    );
    this.notifyListeners();
    return course;
  }

  deleteCourse(id: string): void {
    sqliteEngine.run('DELETE FROM courses WHERE id = ?', [id]);
    const courses = this.getCourses().filter((c) => c.id !== id);
    this.setStorage('courses', courses);

    serverAdminMutateStore({ data: { action: 'delete_course', courseId: id } }).catch((err) =>
      console.warn('Course delete sync notice:', err)
    );
    this.notifyListeners();
  }

  // ---------------- USERS & INSTRUCTORS REPOSITORY ----------------
  getUsers(): ManagedUser[] {
    const rows = sqliteEngine.query<any>('SELECT * FROM users ORDER BY createdAt ASC');
    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        passwordHash: r.passwordHash || 'instructor123',
        role: (r.role as 'admin' | 'instructor') || 'instructor',
        institution: r.institution || 'Onnesha Academic Wing',
        designation: r.designation || 'Faculty Instructor',
        phone: r.phone || '',
        plan: (r.plan as any) || 'institution_max',
        assignedCourseIds: r.assignedCourseIdsJson ? JSON.parse(r.assignedCourseIdsJson) : [],
        status: (r.status as 'active' | 'suspended') || 'active',
        createdAt: r.createdAt || new Date().toISOString(),
      }));
    }
    return this.getStorage<ManagedUser[]>('users', DEFAULT_USERS);
  }

  saveUser(user: ManagedUser): ManagedUser {
    sqliteEngine.run(
      'INSERT OR REPLACE INTO users (id, email, name, role, institution, designation, phone, passwordHash, plan, assignedCourseIdsJson, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        user.id,
        user.email,
        user.name,
        user.role,
        user.institution || '',
        user.designation || '',
        user.phone || '',
        user.passwordHash || 'instructor123',
        user.plan || 'institution_max',
        JSON.stringify(user.assignedCourseIds || []),
        user.status || 'active',
        user.createdAt || new Date().toISOString(),
      ]
    );

    const users = this.getStorage<ManagedUser[]>('users', [...DEFAULT_USERS]);
    const idx = users.findIndex((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
    if (idx >= 0) users[idx] = user;
    else users.push(user);
    this.setStorage('users', users);

    serverAdminMutateStore({ data: { action: 'save_user', user } }).catch((err) =>
      console.warn('User server sync notice:', err)
    );
    this.notifyListeners();
    return user;
  }

  deleteUser(id: string): void {
    sqliteEngine.run('DELETE FROM users WHERE id = ?', [id]);
    const users = this.getUsers().filter((u) => u.id !== id);
    this.setStorage('users', users);

    serverAdminMutateStore({ data: { action: 'delete_user', userId: id } }).catch((err) =>
      console.warn('User delete sync notice:', err)
    );
    this.notifyListeners();
  }

  // ---------------- QUIZZES REPOSITORY (SQLite + Server) ----------------
  getQuizzes(): Quiz[] {
    const sqliteRows = sqliteEngine.query<any>('SELECT * FROM quizzes ORDER BY createdAt DESC');
    if (sqliteRows.length > 0) {
      const customQuizzes: Quiz[] = sqliteRows.map((r) => ({
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
        icon: r.icon || '🎯',
        questions: r.questionsJson ? JSON.parse(r.questionsJson) : [],
        isTemplate: !!r.isTemplate,
        createdAt: r.createdAt,
      }));
      const customIds = new Set(customQuizzes.map((q) => q.id));
      return [...customQuizzes, ...READY_MADE_PACKS.filter((p) => !customIds.has(p.id))];
    }

    const custom = this.getStorage<Quiz[]>('custom_quizzes', []);
    const customIds = new Set(custom.map((q) => q.id));
    return [...custom, ...READY_MADE_PACKS.filter((p) => !customIds.has(p.id))];
  }

  getQuizBySlug(slug: string): Quiz | undefined {
    const row = sqliteEngine.queryOne<any>('SELECT * FROM quizzes WHERE slug = ? OR id = ?', [slug, slug]);
    if (row) {
      return {
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
        icon: row.icon || '🎯',
        questions: row.questionsJson ? JSON.parse(row.questionsJson) : [],
        isTemplate: !!row.isTemplate,
        createdAt: row.createdAt,
      };
    }
    return this.getQuizzes().find((q) => q.slug === slug || q.id === slug);
  }

  saveCustomQuiz(quiz: Quiz): void {
    sqliteEngine.run(
      'INSERT OR REPLACE INTO quizzes (id, slug, courseId, courseTitle, quizNumber, instructorId, instructorName, titleEn, titleBn, descriptionEn, descriptionBn, categoryEn, categoryBn, icon, questionsJson, isTemplate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        quiz.id,
        quiz.slug,
        quiz.courseId || '',
        quiz.courseTitle || '',
        quiz.quizNumber || 1,
        quiz.instructorId || '',
        quiz.instructorName || '',
        quiz.titleEn,
        quiz.titleBn,
        quiz.descriptionEn,
        quiz.descriptionBn,
        quiz.categoryEn,
        quiz.categoryBn,
        quiz.icon,
        JSON.stringify(quiz.questions),
        quiz.isTemplate ? 1 : 0,
        quiz.createdAt || new Date().toISOString(),
      ]
    );

    const custom = this.getStorage<Quiz[]>('custom_quizzes', []);
    const existingIndex = custom.findIndex((q) => q.id === quiz.id || q.slug === quiz.slug);
    if (existingIndex >= 0) {
      custom[existingIndex] = quiz;
    } else {
      custom.unshift(quiz);
    }
    this.setStorage('custom_quizzes', custom);

    serverAdminMutateStore({ data: { action: 'save_quiz', quiz } }).catch((err) =>
      console.warn('Quiz server sync notice:', err)
    );
    this.notifyListeners();
  }

  deleteCustomQuiz(id: string): void {
    sqliteEngine.run('DELETE FROM quizzes WHERE id = ? OR slug = ?', [id, id]);
    const custom = this.getStorage<Quiz[]>('custom_quizzes', []);
    const filtered = custom.filter((q) => q.id !== id);
    this.setStorage('custom_quizzes', filtered);

    serverAdminMutateStore({ data: { action: 'delete_quiz', quizId: id } }).catch((err) =>
      console.warn('Quiz delete sync notice:', err)
    );
    this.notifyListeners();
  }

  // ---------------- ROSTER & STUDENTS REPOSITORY (SQLite + Server) ----------------
  getRoster(regionId?: string): RosterStudent[] {
    let rows = sqliteEngine.query<RosterStudent>('SELECT * FROM roster_students ORDER BY rollNumber ASC');
    if (rows.length === 0) {
      rows = this.getStorage<RosterStudent[]>('roster_students', SAMPLE_ROSTER);
    }
    if (regionId && regionId !== 'all') {
      return rows.filter((r) => r.regionId === regionId);
    }
    return rows;
  }

  addStudentToRoster(student: Omit<RosterStudent, 'id' | 'createdAt'>, skipServerSync = false): RosterStudent {
    const id = `std-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = new Date().toISOString();
    const regions = this.getRegions();
    const matchedReg =
      regions.find((r) => r.id === student.regionId) ||
      regions.find((r) => r.nameEn.toLowerCase() === (student.regionName || '').toLowerCase()) ||
      regions[0] ||
      DEFAULT_REGIONS[0];

    const newStudent: RosterStudent = {
      ...student,
      id,
      phone: student.phone || student.guardianPhone || '',
      regionId: matchedReg.id,
      regionName: matchedReg.nameEn,
      guardianPhone: student.guardianPhone || student.phone || '',
      createdAt,
    };

    sqliteEngine.run(
      'INSERT OR REPLACE INTO roster_students (id, rollNumber, name, phone, regionId, regionName, section, batch, guardianPhone, email, passcode, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        newStudent.rollNumber,
        newStudent.name,
        newStudent.phone || '',
        newStudent.regionId || 'reg-dhaka',
        newStudent.regionName || 'Dhaka Range',
        newStudent.section || 'A',
        newStudent.batch || '46th BCS & Cadet Batch',
        newStudent.guardianPhone || '',
        newStudent.email || '',
        newStudent.passcode || '',
        createdAt,
      ]
    );

    const roster = this.getRoster();
    this.setStorage('roster_students', roster);

    if (!skipServerSync) {
      serverAdminMutateStore({ data: { action: 'add_student', student: newStudent } }).catch((err) =>
        console.warn('Student server sync notice:', err)
      );
      this.notifyListeners();
    }

    return newStudent;
  }

  bulkAddStudentsToRoster(studentsInput: Omit<RosterStudent, 'id' | 'createdAt'>[]): RosterStudent[] {
    const added = studentsInput.map((s) => this.addStudentToRoster(s, true));
    serverAdminMutateStore({ data: { action: 'bulk_add_students', students: added } }).catch((err) =>
      console.warn('Bulk student server sync notice:', err)
    );
    this.notifyListeners();
    return added;
  }

  removeStudentFromRoster(id: string): void {
    sqliteEngine.run('DELETE FROM roster_students WHERE id = ?', [id]);
    const roster = this.getRoster();
    const filtered = roster.filter((s) => s.id !== id);
    this.setStorage('roster_students', filtered);

    serverAdminMutateStore({ data: { action: 'delete_student', studentId: id } }).catch((err) =>
      console.warn('Student delete server sync notice:', err)
    );
    this.notifyListeners();
  }

  // ---------------- EXAM SESSIONS & RESULTS REPOSITORY ----------------
  recordExamSession(session: GameSession): void {
    const sessionId = `exam-${session.pin}`;
    const createdAt = new Date().toISOString();
    const participantsList = Object.values(session.participants).sort((a, b) => b.score - a.score);
    const count = participantsList.length;

    const totalScore = participantsList.reduce((acc, p) => acc + p.score, 0);
    const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
    const highestScore = count > 0 ? participantsList[0].score : 0;

    sqliteEngine.run(
      'INSERT OR REPLACE INTO exam_sessions (id, pin, quizId, quizTitleEn, quizTitleBn, hostId, allowedRegionId, allowedRegionName, totalQuestions, participantCount, averageScore, highestScore, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        sessionId,
        session.pin,
        session.quizId,
        session.quizTitleEn || 'Onnesha Assessment',
        session.quizTitleBn || 'অন্বেষা মডেল টেস্ট',
        session.hostId || 'host',
        session.settings.allowedRegionId || 'all',
        session.settings.allowedRegionName || 'All Regions',
        session.totalQuestions,
        count,
        avgScore,
        highestScore,
        createdAt,
      ]
    );

    participantsList.forEach((p, idx) => {
      const answersList = Object.values(p.answers || {});
      const correctCount = answersList.filter((a) => a.isCorrect).length;
      const incorrectCount = answersList.filter(
        (a) => !a.isCorrect && (a.selectedOptionIds?.length > 0 || !!a.writtenAnswer)
      ).length;
      const unattemptedCount = Math.max(0, session.totalQuestions - answersList.length);
      const totalAnswers = answersList.length;
      const accuracy = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0;
      const roll = p.rollNumber || `2026-${100 + idx + 1}`;

      const resultId = `res-${session.pin}-${p.id}`;
      sqliteEngine.run(
        'INSERT OR REPLACE INTO exam_results (id, sessionId, pin, participantId, rollNumber, name, phone, regionId, regionName, score, rank, correctCount, incorrectCount, unattemptedCount, accuracyPct, answersJson, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          resultId,
          sessionId,
          session.pin,
          p.id,
          roll,
          p.nickname || p.name || `Candidate ${idx + 1}`,
          p.phone || '',
          p.regionId || 'reg-dhaka',
          p.regionName || 'Dhaka Range',
          p.score,
          p.rank || idx + 1,
          correctCount,
          incorrectCount,
          unattemptedCount,
          accuracy,
          JSON.stringify(p.answers || {}),
          createdAt,
        ]
      );

      const branding = this.getBranding();
      const certNo = formatDeterministicCertNumber(session.pin, roll, idx + 1);
      this.issueCertificate({
        certificateNumber: certNo,
        studentName: p.nickname || p.name || `Candidate ${idx + 1}`,
        studentRoll: roll,
        regionName: p.regionName || 'Dhaka Range',
        quizTitle: session.quizTitleBn || session.quizTitleEn || 'Institutional Assessment',
        score: p.score,
        totalPoints: session.totalQuestions * 1000,
        rank: p.rank || idx + 1,
        totalParticipants: count,
        accuracyPercent: accuracy,
        issueDate: createdAt.slice(0, 10),
        organizationName:
          branding.showPartnerLogo && branding.partnerName
            ? `Onnesha × ${branding.partnerName}`
            : 'Onnesha Assessment & Examination Arena',
        institutionName: branding.institutionTitle || 'Onnesha Assessment Arena',
        instructorName: 'Chief Assessment Officer',
        verificationUrl:
          typeof window !== 'undefined'
            ? `${window.location.origin}/verify/${certNo}`
            : `https://onnesha.app/verify/${certNo}`,
        verified: true,
      });
    });

    const sessions = this.getExamSessions();
    this.setStorage('exam_sessions', sessions);
    this.notifyListeners();
  }

  getExamSessions(): ExamSessionRecord[] {
    const rows = sqliteEngine.query<ExamSessionRecord>('SELECT * FROM exam_sessions ORDER BY createdAt DESC');
    if (rows.length > 0) return rows;
    return this.getStorage<ExamSessionRecord[]>('exam_sessions', []);
  }

  getExamResults(sessionId?: string): ExamResultRecord[] {
    if (sessionId) {
      return sqliteEngine.query<ExamResultRecord>(
        'SELECT * FROM exam_results WHERE sessionId = ? OR pin = ? ORDER BY rank ASC',
        [sessionId, sessionId]
      );
    }
    return sqliteEngine.query<ExamResultRecord>('SELECT * FROM exam_results ORDER BY createdAt DESC, rank ASC');
  }

  getAllExamResults(): ExamResultRecord[] {
    const rows = sqliteEngine.query<ExamResultRecord>('SELECT * FROM exam_results ORDER BY createdAt DESC, rank ASC');
    if (rows.length > 0) return rows;
    return this.getStorage<ExamResultRecord[]>('exam_results', []);
  }

  // ---------------- VERIFIABLE CERTIFICATES ----------------
  getCertificates(): CertificateData[] {
    const rows = sqliteEngine.query<any>('SELECT * FROM certificates ORDER BY issueDate DESC');
    if (rows.length > 0) {
      return rows.map((r) => ({
        ...r,
        verified: !!r.verified,
      }));
    }
    return this.getStorage<CertificateData[]>('certificates', []);
  }

  getCertificateById(certNo: string): CertificateData | undefined {
    const row = sqliteEngine.queryOne<any>(
      'SELECT * FROM certificates WHERE LOWER(certificateNumber) = LOWER(?)',
      [certNo]
    );
    if (row) {
      return {
        ...row,
        verified: !!row.verified,
      };
    }

    const certs = this.getCertificates();
    return certs.find((c) => c.certificateNumber.toLowerCase() === certNo.toLowerCase());
  }

  issueCertificate(cert: Omit<CertificateData, 'id'>): CertificateData {
    const id = `cert-${cert.certificateNumber.toLowerCase()}`;
    const newCert: CertificateData = {
      ...cert,
      id,
    };

    sqliteEngine.run(
      'INSERT OR REPLACE INTO certificates (id, certificateNumber, studentName, studentRoll, regionName, quizTitle, score, totalPoints, rank, totalParticipants, accuracyPercent, issueDate, organizationName, institutionName, instructorName, verificationUrl, signatureUrl, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        cert.certificateNumber,
        cert.studentName,
        cert.studentRoll || '',
        cert.regionName || 'Dhaka Range',
        cert.quizTitle,
        cert.score || cert.marksObtained || 0,
        cert.totalPoints || cert.totalMarks || 100,
        cert.rank,
        cert.totalParticipants,
        cert.accuracyPercent || cert.scorePct || 0,
        cert.issueDate,
        cert.organizationName || 'Onnesha Assessment',
        cert.institutionName || 'Onnesha Assessment Arena',
        cert.instructorName || 'Chief Assessment Officer',
        cert.verificationUrl || '',
        cert.signatureUrl || '',
        cert.verified ? 1 : 0,
      ]
    );

    const certs = this.getCertificates();
    this.setStorage('certificates', certs);

    serverAdminMutateStore({ data: { action: 'issue_certificate', certificate: newCert } }).catch(() => {});
    return newCert;
  }

  // ---------------- BRANDING & JOINT PARTNER LOGO ----------------
  getBranding(): BrandingSettings {
    return this.getStorage<BrandingSettings>('branding_settings', {
      showPartnerLogo: false,
      partnerName: '',
      partnerLogoUrl: '',
      institutionTitle: 'Onnesha Assessment Arena',
    });
  }

  saveBranding(branding: BrandingSettings): BrandingSettings {
    const updated: BrandingSettings = {
      showPartnerLogo: !!branding.showPartnerLogo,
      partnerName: (branding.partnerName || '').trim(),
      partnerLogoUrl: (branding.partnerLogoUrl || '').trim(),
      institutionTitle: (branding.institutionTitle || 'Onnesha Assessment Arena').trim(),
      defaultEnforceFullscreen: !!branding.defaultEnforceFullscreen,
      defaultBlockCopyPaste: branding.defaultBlockCopyPaste ?? true,
      defaultMaxProctorViolations: branding.defaultMaxProctorViolations || 3,
      updatedAt: Date.now(),
    };
    this.setStorage('branding_settings', updated);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('onnesha-branding-updated', { detail: updated }));
    }
    this.notifyListeners();
    serverAdminMutateStore({ data: { action: 'update_branding', branding: updated } }).catch(() => {});
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
      customQuizzes: this.getStorage<Quiz[]>('custom_quizzes', []),
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
          action: 'import_store_backup',
          backup: parsed,
        },
      });
      await this.syncFromServerStore();
      return true;
    } catch (err) {
      console.warn('Failed to import backup:', err);
      return false;
    }
  }

  // ---------------- TRANSACTIONS ----------------
  getTransactions(): DbTransaction[] {
    const rows = sqliteEngine.query<DbTransaction>('SELECT * FROM transactions ORDER BY date DESC');
    if (rows.length > 0) {
      return rows;
    }
    return this.getStorage<DbTransaction[]>('transactions', []);
  }

  recordTransaction(trx: Omit<DbTransaction, 'id' | 'date'>): DbTransaction {
    const id = `trx-${Date.now()}`;
    const date = new Date().toISOString();
    const newTrx: DbTransaction = {
      ...trx,
      id,
      date,
    };

    sqliteEngine.run(
      'INSERT INTO transactions (id, planId, amount, msisdn, trxId, method, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, trx.planId, trx.amount, trx.msisdn, trx.trxId, trx.method, date, trx.status]
    );

    const trxs = this.getTransactions();
    this.setStorage('transactions', trxs);
    return newTrx;
  }

  // ---------------- SMS LOGS ----------------
  getSmsLogs(): DbSmsLog[] {
    const rows = sqliteEngine.query<DbSmsLog>('SELECT * FROM sms_logs ORDER BY timestamp DESC');
    if (rows.length > 0) {
      return rows;
    }
    return this.getStorage<DbSmsLog[]>('sms_logs', []);
  }

  logSms(sms: Omit<DbSmsLog, 'id' | 'timestamp'>): DbSmsLog {
    const id = `sms-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const timestamp = new Date().toISOString();
    const newLog: DbSmsLog = {
      ...sms,
      id,
      timestamp,
    };

    sqliteEngine.run(
      'INSERT INTO sms_logs (id, recipientPhone, studentName, rollNumber, quizTitle, score, rank, messageText, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, sms.recipientPhone, sms.studentName, sms.rollNumber, sms.quizTitle, sms.score, sms.rank, sms.messageText, sms.status, timestamp]
    );

    const logs = this.getSmsLogs();
    this.setStorage('sms_logs', logs);
    return newLog;
  }

  // ---------------- SALES LEADS ----------------
  getSalesLeads(): any[] {
    const rows = sqliteEngine.query<any>('SELECT * FROM sales_leads ORDER BY createdAt DESC');
    if (rows.length > 0) return rows;
    return this.getStorage<any[]>('sales_leads', []);
  }

  recordSalesLead(lead: {
    name: string;
    organization: string;
    email: string;
    phone: string;
    studentCount: string;
    message?: string;
  }): any {
    const id = `lead-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const newLead = { ...lead, id, createdAt };

    sqliteEngine.run(
      'INSERT INTO sales_leads (id, name, organization, email, phone, studentCount, message, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, lead.name, lead.organization, lead.email, lead.phone, lead.studentCount, lead.message || '', createdAt]
    );

    const leads = this.getSalesLeads();
    this.setStorage('sales_leads', leads);
    return newLead;
  }
}

export const db = new OnneshaDatabase();
