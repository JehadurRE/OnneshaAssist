# Onnesha Industrial LMS + Dedicated Exam System — A→Z Plan

**Product:** Learning Management System + Dedicated Examination System (classroom / institutional)  
**Locale:** EN + BN · Bangladesh roster · PIN live rooms · Final Exam package  
**Status:** Plan + implementation on branch `cursor/lms-exam-industrial-0b7e`

---

## Vision

One integrated platform where:

1. **Learn** — courses, session materials, recordings, AI tutor grounded in course content  
2. **Practice** — session quizzes / live arenas  
3. **Examine** — timed Final Exam (overall timer), practical/capstone, grading, certificates  
4. **Operate** — admin/instructor desks for roster, content, exam windows, monitoring

---

## Module map (A→Z)

| Module | Student | Staff | Status target |
|--------|---------|-------|---------------|
| **A** Auth & roster identity | Mobile search / portal unlock | Admin roster CRUD | Keep + polish |
| **B** Courses | Course hub on portal | Admin course CRUD | Expand portal |
| **C** Materials | Browse PDFs/links/notes | Admin upload/link | **Build** |
| **D** Recordings | Watch/list sessions | Admin link/embed | **Build** |
| **E** AI Course Tutor | Ask about materials | Gemini key in settings | **Build** |
| **F** Session quizzes | Play / packs | Host live rooms | Keep |
| **G** Final Exam MCQ | `/final-exam` PIN + mobile | Live host + desk | **Fix reliability** |
| **H** Practical / capstone | Portal / same journey | Grade on desk | **Show on live host** |
| **I** Live host projector | — | Questions + practical board + monitor | **Complete** |
| **J** Certificates | Portal view/verify | Issue / bulk | Keep |
| **K** Progress | Quizzes + final + practical + materials | Completion policy | Expand |
| **L** Announcements | Portal feed | Admin post | **Build light** |
| **M** File handling | Practical uploads | Download | Harden |
| **N** Separated windows | Quiz vs practical deadlines | Open/close independently | **Build** |
| **O** Autosave / resume | Mid-exam safe | Monitor in-progress | **Build** |

---

## Implementation waves (this branch)

### Wave 0 — Exam industrial reliability
- Inline submit errors + retry; timeout retry  
- Autosave answers; resume with answers + timer  
- No duplicate attempts; finalize expired  
- Separate quiz join window vs practical window  
- `/final-exam-live`: Part B practical board + practical columns in monitor  
- Post-quiz clear CTA into portal with identity hint  

### Wave 1 — Student Learning Portal (LMS core)
- Portal tabs: Overview · Materials · Recordings · AI Tutor · Quizzes · Final · Practical · Certificate  
- Course materials & recordings model + seed for AI-DM-04  
- Admin **Learning Content** panel (CRUD materials/recordings/announcements)  
- AI tutor: grounded answers from published materials (Gemini)  

### Wave 2 — Continuity & polish (same ship if time)
- Portal unlock via mobile-only (like final exam)  
- Final exam → portal soft handoff (roll prefilled)  
- Safer upload size messaging  

---

## Data model (new)

```text
CourseMaterial { id, courseId, sessionLabel?, titleEn/Bn, type: pdf|link|note|slide,
                 url?, bodyEn/Bn?, sortOrder, published, createdAt, updatedAt }
CourseRecording { id, courseId, sessionLabel?, titleEn/Bn, url, provider?, durationMin?,
                  published, sortOrder, createdAt, updatedAt }
CourseAnnouncement { id, courseId, titleEn/Bn, bodyEn/Bn, published, createdAt }
PracticalExam += quizWindowOpen?, practicalWindowOpen?
FinalExamAttempt.answers autosaved during in_progress
```

---

## Acceptance (industrial bar for this ship)

- [ ] Student can finish Final MCQ after refresh; Submit always shows clear success/error  
- [ ] Live host shows quiz questions **and** practical assignment for screen-share  
- [ ] Portal shows Materials, Recordings, AI Tutor for the course  
- [ ] Admin can add/edit/publish materials & recordings  
- [ ] AI tutor refuses when no materials / no Gemini key; answers cite course context  
- [ ] Closing quiz window does not block practical submit  

---

## Explicitly later (not blocking this ship)

- Full multi-tenant org hierarchy  
- Webcam proctoring / lockdown browser  
- Native video hosting (use YouTube/Drive links)  
- Discussion forums / peer review  
- SCORM / xAPI packages  
