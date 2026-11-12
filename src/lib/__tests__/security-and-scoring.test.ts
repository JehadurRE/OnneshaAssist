import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  canActorMutateStoreAction,
  hashPasswordScrypt,
  sanitizeUserForClient,
  signSessionToken,
  verifyPasswordScrypt,
  verifySessionToken,
} from '../server-security';
import {
  computeTotalQuizMarks,
  evaluateQuestionAnswer,
  resolveOrgName,
} from '../scoring';
import { ManagedUser, Question } from '../types';

describe('server-security: password hashing & user sanitization', () => {
  it('hashes passwords with unique per-user scrypt salts and verifies cleanly', () => {
    const h1 = hashPasswordScrypt('OnneshaPass!2026');
    const h2 = hashPasswordScrypt('OnneshaPass!2026');

    expect(h1.startsWith('scrypt:')).toBe(true);
    expect(h1).not.toEqual(h2);
    expect(verifyPasswordScrypt('OnneshaPass!2026', h1)).toEqual({
      valid: true,
      needsRehash: false,
    });
    expect(verifyPasswordScrypt('WrongPassword', h1)).toEqual({
      valid: false,
      needsRehash: false,
    });
  });

  it('migrates legacy sha256 or plaintext seed passwords with needsRehash=true', () => {
    const sha = crypto.createHash('sha256').update('legacyPass123').digest('hex');
    expect(verifyPasswordScrypt('legacyPass123', sha)).toEqual({
      valid: true,
      needsRehash: true,
    });
    expect(verifyPasswordScrypt('instructor123', 'instructor123')).toEqual({
      valid: true,
      needsRehash: true,
    });
  });

  it('strips passwordHash from client-visible user payloads', () => {
    const user: ManagedUser = {
      id: 'usr-1',
      name: 'Dr. Rahman',
      email: 'rahman@onnesha.app',
      passwordHash: 'scrypt:abc:def',
      role: 'instructor',
      institution: 'Dhaka Cadet College',
      assignedCourseIds: ['course-1'],
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const safe = sanitizeUserForClient(user);
    expect('passwordHash' in safe).toBe(false);
    expect(safe.institutionName).toBe('Dhaka Cadet College');
  });
});

describe('server-security: signed HTTP-only session tokens & RBAC', () => {
  const secret = 'test-secret-0123456789abcdef0123456789abcdef';

  it('verifies valid tokens and rejects expired or tampered tokens', () => {
    const now = 1_700_000_000_000;
    const token = signSessionToken(
      { uid: 'usr-admin-1', role: 'admin', exp: now + 60_000 },
      secret
    );

    expect(verifySessionToken(token, secret, now + 1_000)).toEqual({
      uid: 'usr-admin-1',
      role: 'admin',
      exp: now + 60_000,
    });

    // Expired
    expect(verifySessionToken(token, secret, now + 60_001)).toBeNull();

    // Tampered signature
    const tampered = `${token.slice(0, -4)}zzzz`;
    expect(verifySessionToken(tampered, secret, now + 1_000)).toBeNull();
  });

  it('enforces RBAC on admin-only, instructor-owned, and unauthenticated mutations', () => {
    expect(canActorMutateStoreAction(null, 'save_quiz').allowed).toBe(false);
    expect(canActorMutateStoreAction({ id: 'stu-1', role: 'candidate' }, 'save_quiz').allowed).toBe(
      false
    );
    expect(
      canActorMutateStoreAction({ id: 'inst-1', role: 'instructor' }, 'save_user').allowed
    ).toBe(false);
    expect(
      canActorMutateStoreAction({ id: 'inst-1', role: 'instructor' }, 'delete_quiz', 'inst-2')
        .allowed
    ).toBe(false);
    expect(
      canActorMutateStoreAction({ id: 'inst-1', role: 'instructor' }, 'delete_quiz', 'inst-1')
        .allowed
    ).toBe(true);
    expect(
      canActorMutateStoreAction({ id: 'adm-1', role: 'admin' }, 'purge_dummy_data').allowed
    ).toBe(true);
  });
});

describe('scoring & certificate metadata helpers', () => {
  const sampleMcq: Question = {
    id: 'q1',
    textEn: 'Capital of Bangladesh?',
    textBn: 'বাংলাদেশের রাজধানী?',
    type: 'single_mcq',
    timeLimitSec: 20,
    points: 1000,
    options: [
      { id: 'a', textEn: 'Dhaka', textBn: 'ঢাকা', isCorrect: true },
      { id: 'b', textEn: 'Sylhet', textBn: 'সিলেট', isCorrect: false },
    ],
    correctOptionIds: ['a'],
  };

  const sampleWritten: Question = {
    id: 'q2',
    textEn: 'Year of Independence?',
    textBn: 'স্বাধীনতার বছর?',
    type: 'written',
    timeLimitSec: 30,
    points: 500,
    options: [],
    correctOptionIds: [],
    acceptedAnswers: ['1971', '১৯৭১'],
  };

  it('computes accurate totalMarks across custom question weights and fallback', () => {
    expect(computeTotalQuizMarks([sampleMcq, sampleWritten], 2)).toBe(1500);
    expect(computeTotalQuizMarks(undefined, 10)).toBe(10000);
  });

  it('resolves partner joint branding organization name', () => {
    expect(
      resolveOrgName({
        showPartnerLogo: true,
        partnerName: 'Mirzapur Cadet College',
        partnerLogoUrl: '',
      })
    ).toBe('Onnesha × Mirzapur Cadet College');
    expect(
      resolveOrgName({
        showPartnerLogo: false,
        partnerName: 'Mirzapur Cadet College',
        partnerLogoUrl: '',
      })
    ).toBe('Onnesha Assessment & Examination Arena');
  });

  it('evaluates MCQ speed/streak bonuses, written normalization, and negative marking', () => {
    const fastCorrect = evaluateQuestionAnswer({
      question: sampleMcq,
      selectedOptionIds: ['a'],
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
      selectedOptionIds: ['b'],
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
      writtenAnswer: '  ১৯৭১ ',
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
});
