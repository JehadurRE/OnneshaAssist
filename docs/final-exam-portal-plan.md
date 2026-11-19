# Final Exam + Student Portal — Gap Plan

**Status:** Plan only (no implementation in this pass)  
**Date:** 2026-11-20 (Asia/Dhaka)  
**Trigger:** Live Final Exam issues — quiz submit failures, practical not on live host, portal gaps (materials/recordings)

---

## 1. What exists today (baseline)

```text
Student
  /final-exam     PIN → mobile search → lobby → timed MCQ (30) → link to /portal
  /portal         roll+phone unlock → practical package (40) → course cert

Staff
  /admin → Final Exam Desk   open/close PIN window, grade practical, certs
  /final-exam-live           projector questions + quiz attempt monitor
```

**Marks model:** 30 quiz + 40 practical = 70 (`src/lib/practical-exam.ts`)

**Key files:**  
`src/routes/final-exam.tsx` · `src/routes/final-exam-live.tsx` · `src/routes/portal.tsx` · `src/components/admin/AdminPracticalPanel.tsx` · `src/lib/server-session.ts` (Final Exam RPCs)

---

## 2. Confirmed live problems (why students failed)

| # | Problem | Root cause (code) | Impact |
|---|---------|-------------------|--------|
| 1 | Submit pressed but quiz not submitted | Submit errors shown only at **page top** (hidden under sticky quiz chrome); no `catch` on network failure; timeout auto-submit **does not retry** | Looks like dead Submit button |
| 2 | Refresh mid-quiz loses answers | Answers only saved on final submit; resume returns empty `answers`; lobby ignores `inProgressAttempt` | Students restart / empty paper |
| 3 | Second attempt possible after timer | Expired `in_progress` allows a **new** attempt instead of finalizing | Integrity / confusion |
| 4 | Closing exam window kills practical too | One `PracticalExam.status` for quiz **and** practical | Part B locked after Close |
| 5 | Live host shows quiz only | `/final-exam-live` never renders `exam.tasks` | Assignment invisible while screen-sharing |
| 6 | Quiz → practical re-auth | Final desk uses mobile search; portal demands roll+phone again | Friction / drop-off |

---

## 3. Missing pages / features vs a standard Final Exam product

### A. Exam reliability (must for next live sitting)
- [ ] Visible inline submit errors + toast next to Submit
- [ ] Autosave answers + restore on resume
- [ ] Auto-reenter quiz from `inProgressAttempt` after rejoin
- [ ] Server: finalize expired attempts; **no duplicate** attempts
- [ ] Decouple **quiz window** vs **practical window** (close quiz ≠ close practical)
- [ ] Confirm dialog before Submit; clear “Submitted ✓” state

### B. Live host (`/final-exam-live`) completeness
- [ ] **Part B / Practical board** on projector (task titles, marks, “submit on portal”)
- [ ] Combined monitor: quiz status **+** practical submitted/graded per roll
- [ ] Multi-course selector (today hardcoded `course-sanjibon-ai-dm`)
- [ ] Fix copy (still says Roll+Mobile; student UX is mobile search)
- [ ] Big “window open / closes in” + join QR optional

### C. One continuous student journey
- [ ] After quiz: stay on Final Exam desk for practical **or** portal SSO handoff (no re-enter roll)
- [ ] Combined running total (quiz marks / 30 + practical pending)
- [ ] BN/EN friendly empty states and error copy throughout

### D. Student Portal as course hub (requested)
- [ ] **Courses** list / switcher (not single hardcoded course only)
- [ ] **Course materials** (PDFs, slides, session notes) — model + admin upload + portal browse
- [ ] **Recordings** library (session video links / embeds)
- [ ] Progress: quizzes + final exam + practical + materials completion
- [ ] Safer file upload for video task (not huge base64 in one POST)

### E. Admin polish gaps
- [ ] Final Exam Desk nav already renamed; ensure Practical grading + live attempts always visible after Open (no blank loading)
- [ ] Per-student time extension
- [ ] Export attempts CSV

---

## 4. Recommended implementation waves

### Wave 0 — P0 Live exam fix (do first, before next sitting)
**Goal:** Every student can finish and submit the MCQ reliably; staff see practical on live screen.

1. Submit UX + retry + visible errors (`final-exam.tsx` + submit RPC)
2. Answer autosave + resume into quiz phase
3. Block duplicate attempts; auto-finalize expired
4. Separate quiz window close from practical deadline
5. Show practical package on `/final-exam-live` projector + monitor columns

### Wave 1 — P1 Continuous journey
6. Post-quiz practical without re-auth (same desk or portal handoff cookie)
7. Admin/live monitor: quiz + practical status per student
8. File upload reliability for capstone video

### Wave 2 — P2 Student Portal LMS
9. Data model: `CourseMaterial`, `CourseRecording` (or equivalent)
10. Admin: upload/link materials & recordings per course/session
11. Portal UI: Courses → Materials → Recordings → Final Exam CTA
12. Multi-course live host + light proctoring signals (optional)

---

## 5. Out of scope for Wave 0 (explicitly deferred)
- Full LMS (forums, assignments beyond final package)
- Heavy proctoring (tab focus, webcam)
- Redesign of all marketing pages

---

## 6. Acceptance checks (Wave 0)

- [ ] Student can submit MCQ; failure shows message **next to** Submit; retry works
- [ ] Refresh mid-quiz restores answers and remaining timer
- [ ] Second full attempt impossible for same PIN/exam
- [ ] Staff Close quiz window does **not** block practical submit
- [ ] `/final-exam-live` shows Part B task list with marks while projecting
- [ ] Live monitor lists who finished quiz and who still needs practical

---

## 7. Decision needed before Wave 2 build

1. Materials/recordings: **links only** (Drive/YouTube) vs **hosted file upload** on Render disk?  
2. Practical after quiz: **same `/final-exam` page** vs **portal with SSO**?  
3. Next live sitting date — Wave 0 must land before that.
