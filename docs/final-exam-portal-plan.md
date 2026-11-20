# Final Exam + Portal Plan — Status

**Status:** Shipped on `main` (industrial LMS + exam + OTP + remaining polish).

See also: [industrial-lms-exam-plan.md](./industrial-lms-exam-plan.md).

## Delivered

- Timed Final Exam (PIN, mobile search, overall timer, autosave/resume)
- Live host (`/final-exam-live`): course select, QR, projector, monitor + practical column, quiz/practical close controls
- Portal OTP (email default / mobile admin toggle); Resend → Brevo fallback
- LMS tabs: Overview · Materials · Recordings · Quizzes · Final · Tutor · Practical · Certificate
- Course switcher when multiple courses; soft handoff + portal cookie after exam join
- Admin desk: CSV export, +5/+10 attempt time extend
- Confirm before manual quiz submit

## Ops

- Render: `RESEND_API_KEY`, `BREVO_API_KEY`, `PORTAL_OTP_FROM_EMAIL`
- DNS: `onnesha.courses` authenticated for Brevo; Resend DKIM + send/rsend CNAMEs
