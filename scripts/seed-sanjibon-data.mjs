import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const seedJsonPath = path.join(repoRoot, "src", "lib", "sanjibon-seed.json");

const seed = JSON.parse(fs.readFileSync(seedJsonPath, "utf8"));

const dataDir = (process.env.DATA_DIR || path.join(repoRoot, ".data")).replace(/[\\/]+$/, "");
const storeFile = path.join(dataDir, "onnesha-store.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let existing = {};
if (fs.existsSync(storeFile)) {
  try {
    existing = JSON.parse(fs.readFileSync(storeFile, "utf8"));
  } catch {
    existing = {};
  }
}

const normalizeRoll = (val) =>
  String(val || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// 1. Upsert all 11 Sanjibon Training Centres into regions
const regions = Array.isArray(existing.regions) ? [...existing.regions] : [];
for (const reg of seed.regions) {
  const idx = regions.findIndex((r) => r.id === reg.id);
  if (idx === -1) {
    regions.push(reg);
  } else {
    regions[idx] = { ...regions[idx], ...reg };
  }
}

// 2. Upsert the Sanjibon Batch-04 Course at the top of courses
const courses = Array.isArray(existing.courses) ? [...existing.courses] : [];
const cIdx = courses.findIndex((c) => c.id === seed.course.id);
if (cIdx === -1) {
  courses.unshift(seed.course);
} else {
  courses[cIdx] = { ...courses[cIdx], ...seed.course };
}

// 3. Upsert all 228 Sanjibon students cleanly without wiping existing entries
const roster = Array.isArray(existing.roster) ? [...existing.roster] : [];
const rosterIdxById = new Map(roster.map((s, i) => [s.id, i]));
const rosterIdxByRoll = new Map(roster.map((s, i) => [normalizeRoll(s.rollNumber), i]));

let addedStudents = 0;
let updatedStudents = 0;
for (const student of seed.roster) {
  const rollKey = normalizeRoll(student.rollNumber);
  const existingIdx = rosterIdxById.get(student.id) ?? rosterIdxByRoll.get(rollKey);
  if (existingIdx === undefined) {
    roster.push(student);
    const nextIdx = roster.length - 1;
    rosterIdxById.set(student.id, nextIdx);
    rosterIdxByRoll.set(rollKey, nextIdx);
    addedStudents++;
  } else {
    roster[existingIdx] = { ...roster[existingIdx], ...student };
    updatedStudents++;
  }
}

// 4. Upsert the 10 Sanjibon quizzes in customQuizzes for persistent disk inspection & editing
const customQuizzes = Array.isArray(existing.customQuizzes) ? [...existing.customQuizzes] : [];
for (const quiz of [...seed.quizzes].reverse()) {
  const qIdx = customQuizzes.findIndex((q) => q.id === quiz.id);
  if (qIdx === -1) {
    customQuizzes.unshift(quiz);
  } else {
    customQuizzes[qIdx] = quiz;
  }
}

// 5. Ensure default staff accounts include course-sanjibon-ai-dm assignment
const users = Array.isArray(existing.users) ? [...existing.users] : [];
for (const u of users) {
  if (u.id === "usr-super-admin" || u.id === "usr-instructor-1") {
    const prev = Array.isArray(u.assignedCourseIds) ? u.assignedCourseIds : [];
    if (!prev.includes(seed.course.id)) {
      u.assignedCourseIds = [seed.course.id, ...prev];
    }
  }
}

const nextStore = {
  regions,
  roster,
  courses,
  users,
  customQuizzes,
  examSessions: Array.isArray(existing.examSessions) ? existing.examSessions : [],
  examResults: Array.isArray(existing.examResults) ? existing.examResults : [],
  certificates: Array.isArray(existing.certificates) ? existing.certificates : [],
  ledgerCheckpoints: Array.isArray(existing.ledgerCheckpoints) ? existing.ledgerCheckpoints : [],
  transactions: Array.isArray(existing.transactions) ? existing.transactions : [],
  smsLogs: Array.isArray(existing.smsLogs) ? existing.smsLogs : [],
  salesLeads: Array.isArray(existing.salesLeads) ? existing.salesLeads : [],
  ...(existing.branding ? { branding: existing.branding } : {}),
  updatedAt: Date.now(),
};

const tmpFile = `${storeFile}.tmp`;
fs.writeFileSync(tmpFile, JSON.stringify(nextStore, null, 2), "utf8");
fs.renameSync(tmpFile, storeFile);

// Summary Breakdown Table
const countsByRegion = seed.regions.map((reg) => ({
  Code: reg.code,
  Centre: reg.nameEn,
  Students: seed.roster.filter((s) => s.regionId === reg.id).length,
}));
const totalQuestions = seed.quizzes.reduce((sum, qz) => sum + qz.questions.length, 0);

console.log("\n=== Onnesha Arena · Sanjibon Batch-04 Seed Complete ===");
console.log(`Store File : ${storeFile}`);
console.log(`Course     : [${seed.course.code}] ${seed.course.titleEn}`);
console.log(`Quizzes    : ${seed.quizzes.length} quizzes (${totalQuestions} bilingual questions)`);
console.log(
  `Students   : ${seed.roster.length} enrolled (${addedStudents} added, ${updatedStudents} refreshed)\n`,
);
console.table(countsByRegion);
