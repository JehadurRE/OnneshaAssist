# Onnesha Arena — Comprehensive Production Gap & Readiness Analysis Report

> **Audit Date**: August 2026  
> **Target Standard**: 100% Full-Fledged Production Ready, Zero Mock/Fabricated Data, Real Multiplayer ("Play From Anywhere"), Verifiable Digital Integrity.  
> **Status**: Comprehensive Codebase Audit Completed across all routes, components, state machines, and database adapters.

---

## Executive Summary

An exhaustive file-by-file audit of the entire Onnesha Assessment Arena codebase (`src/routes`, `src/components`, `src/lib`, and database schemas) was conducted. While the application possesses a functional client SQLite WASM engine, Web Audio synthesis, anti-cheat proctoring, and TanStack Start server session synchronization, there are **30 concrete architectural, data integrity, security, and feature gaps** that must be resolved for a true institutional deployment.

---

## 1. 🔴 Critical Gaps (Data Integrity & Persistence Blockers)

### 1.1 GAP-01: Fabricated Scores in Dashboard Results Tab
* **Location**: `src/routes/dashboard.tsx` (Lines ~823–826)
* **Description**: The results table calculates student performance using a synthetic index formula:
  ```ts
  const correctCount = Math.max(3, 15 - idx);
  const incorrectCount = Math.min(3, idx % 3);
  const finalScore = Math.max(120, Math.round(correctCount * 120 - incorrectCount * 30));
  ```
* **Impact**: Instructors do not see real candidates' performance; results are statically calculated from their position in the array.
* **Resolution**: Create an `exam_results` and `exam_sessions` table in SQLite; store actual participant submissions from completed live games and query real scores.

### 1.2 GAP-02: Merit Gazette Generates Statically Computed Rankings
* **Location**: `src/routes/dashboard.tsx` (Lines ~1117–1131)
* **Description**: The Printable Merit Gazette modal passes the same deterministic mathematical formula (`Math.max(120, Math.round((15 - idx) * 120 - (idx % 3) * 30))`) to `MeritGazetteView`.
* **Impact**: Printed official gazettes contain fabricated test scores instead of authentic assessment data.
* **Resolution**: Bind `MeritGazetteView` directly to saved session logs in the SQLite database.

### 1.3 GAP-03: Guardian SMS Dispatch Sends Fabricated Performance Data
* **Location**: `src/routes/dashboard.tsx` (Lines ~237–246)
* **Description**: When triggering bulk SMS scorecards to guardians, payloads are generated with `score: 1800 - idx * 60` rather than pulling from verified exam attempts.
* **Impact**: Guardians receive fabricated grades via GreenWeb SMS Gateway.
* **Resolution**: Select completed exam sessions from SQLite to populate real scores, accuracy percentages, and ranks before triggering `SmsGateway.sendBulkGuardianScorecards`.

### 1.4 GAP-04: Missing Historical Exam Session Persistence
* **Location**: `src/lib/db/index.ts`, `src/lib/game-engine.ts`
* **Description**: When a live assessment completes at the `podium` phase, the participant state lives only transiently in `localStorage` (`onnesha_session_<PIN>`). There is no persistent SQL schema for historical game sessions and individual participant answers.
* **Impact**: Root cause of GAPs 01, 02, and 03. Once a browser tab closes or cache clears, all session history is lost.
* **Resolution**: Add `INSERT INTO exam_history` and `INSERT INTO exam_submission_records` inside `gameEngine.endGame()` or `db.recordSessionCompletion()`.

### 1.5 GAP-05: Missing Route Protection / Auth Guard on Dashboard
* **Location**: `src/routes/dashboard.tsx`
* **Description**: `DashboardPage` reads `useAuth()`, but does not enforce authentication. Unauthenticated guests can directly access `/dashboard` and interact with candidate rosters, billing, and settings.
* **Impact**: Unauthorized access to institutional roster data and API configurations.
* **Resolution**: Add a TanStack Router `beforeLoad` check or a redirect component to `/auth/login` when `!isAuthenticated`.

---

## 2. 🟠 High Severity Gaps (Simulations & Mock Fallbacks)

### 2.1 GAP-06: bKash Payment Flow is Simulated
* **Location**: `src/components/dashboard/BkashModal.tsx` (Lines ~38–65)
* **Description**: Payment steps use `setTimeout` with dummy pre-filled inputs (`01711223344`, `12345`, `482910`) and generate random client-side transaction IDs (`9K...P`).
* **Resolution**: Clear demo defaults, implement tokenized bKash PGW API calls or manual MFS Merchant TrxID verification against SQLite transaction tables.

### 2.2 GAP-07: Unimplemented Password Reset Pipeline
* **Location**: `src/routes/auth/forgot-password.tsx` (Lines ~27–32)
* **Description**: `handleSubmit` only toggles a UI state (`submitted = true`) without sending an email token or writing a reset secret to SQLite.
* **Resolution**: Implement real OTP/token generation linked with user records in database.

### 2.3 GAP-08: Auth Phone OTP Self-Fulfills Without Dispatch
* **Location**: `src/lib/auth-context.tsx` (Lines ~140–156)
* **Description**: `requestPhoneOtp` generates a code and passes it back to the client return object (pre-populating the UI) rather than solely dispatching it via SMS.
* **Resolution**: Dispatch OTP through `SmsGateway` (GreenWeb API) and require the user to manually enter the SMS code received on their phone.

### 2.4 GAP-09: Hardcoded Fallback for Specific Certificate Numbers
* **Location**: `src/lib/db/index.ts` (Lines ~216–235)
* **Description**: `getCertificateById` contains hardcoded mock data for `ONN-4821-9982` and `ONN-2026-BCS-01` if not found in SQLite.
* **Resolution**: Remove hardcoded fallbacks; return 404 / `undefined` when the certificate record does not exist in SQLite.

### 2.5 GAP-10: In-Memory Only Server Session Sync
* **Location**: `src/lib/server-session.ts` (Line ~5)
* **Description**: `serverLiveSessions` is held in Node/Worker global memory. Server restart or edge worker lifecycle recreation loses active session states.
* **Resolution**: Store live session state in persistent key-value store or Cloudflare Durable Objects / D1.

### 2.6 GAP-11: Empty Certificates Tab Displays Hardcoded Card
* **Location**: `src/routes/dashboard.tsx` (Lines ~887–903)
* **Description**: When SQLite has 0 issued certificates, a hardcoded "Cadet Tanvir Hossain / ONN-4821-9982" card is shown.
* **Resolution**: Replace with an authentic empty state illustration & action to issue certificates from completed exams.

---

## 3. 🟡 Medium Severity Gaps (Feature Gaps & Workflow Incompleteness)

| Gap ID | Component / File | Issue Description | Required Fix |
|---|---|---|---|
| **GAP-12** | `src/routes/auth/login.tsx` | Pre-filled demo credentials (`instructor@onnesha.app`) | Set initial state to empty string `""` |
| **GAP-13** | `src/routes/dashboard.tsx` | Pre-filled guardian phone (`01711000000`) in Add Student form | Clear default phone input |
| **GAP-14** | `src/routes/host.$quizId.tsx` | `onToggleSound={() => {}}` is an empty callback | Hook to `audioEngine.toggleMute()` |
| **GAP-15** | `src/lib/auth-context.tsx` | No password modification endpoint in profile settings | Add `changePassword(old, new)` logic |
| **GAP-16** | `src/routes/contact-sales.tsx` | Sales inquiries recorded only in SQLite without email/webhook alerts | Connect to webhook/mailer dispatch |
| **GAP-17** | `src/lib/sms-gateway.ts` | Network catch block defaults to `status = 'delivered'` | Mark `status = 'failed'` on error |
| **GAP-18** | `src/routes/dashboard.tsx` | Hardcoded exam title in results tab SMS broadcast | Allow dynamic selection of any completed quiz |
| **GAP-19** | `src/routes/developers.tsx` | API sandbox mocks REST calls via local queries | Connect to real Nitro API server handlers |
| **GAP-20** | `src/lib/auth-context.tsx` | Unrestricted password retry attempts without rate limiting | Add progressive cooldown lockout |
| **GAP-21** | `src/lib/types.ts` | Absence of schema definition for `ExamHistorySession` | Add explicit type interfaces |

---

## 4. 🔵 Low Severity Gaps (Polish, Performance & Naming)

* **GAP-22**: `src/lib/mock-data.ts` should be renamed to `src/lib/curriculum-bank.ts` since it serves as the official question bank rather than disposable mock data.
* **GAP-23**: `src/components/common/LiveLeaderboardMock.tsx` should be renamed to `LiveLeaderboardHero.tsx`.
* **GAP-24**: `db.getRoster()` falls back to `SAMPLE_ROSTER` when database is completely empty. Should return empty array `[]` on fresh production installs.
* **GAP-25**: Absence of automated cleanup (TTL) for stale `onnesha_session_*` keys in client localStorage.
* **GAP-26**: Missing Content-Security-Policy (CSP) and HSTS header declarations in Nitro configuration.
* **GAP-27**: Service Worker / PWA manifest missing for offline offline classroom connectivity.
* **GAP-28**: Roster CSV Export lacks UTF-8 BOM encoding for Bengali character display in Excel.
* **GAP-29**: Missing print CSS stylesheets for A4 landscape merit certificates.
* **GAP-30**: Missing audio volume slider control on the host controller projector screen.

---

## 5. Prioritized Implementation Roadmap

```
Phase 1: Persistence & Truthful Data (GAPs 01, 02, 03, 04, 11)
  └── Create SQLite exam_history & exam_results tables
  └── Bind Dashboard Results, Gazette, and SMS to real session records
  └── Remove all hardcoded certificate fallbacks

Phase 2: Authentication & Security (GAPs 05, 08, 09, 12, 13, 15, 20)
  └── Add router auth guards for /dashboard
  └── Require real SMS OTP entry
  └── Clear all pre-filled login/roster credentials

Phase 3: Multiplayer Server Hardening (GAP 10, 14, 17, 18)
  └── Durable server-side multiplayer session storage
  └── Dynamic quiz selection for notifications & gazettes
  └── Connect host sound toggles to Web Audio engine

Phase 4: Institutional Polish & Naming (GAPs 16, 19, 22, 23, 24, 28, 29)
  └── Rename legacy mock files to curriculum banks
  └── CSV Bengali encoding & Print stylesheet optimizations
```

---
*Report stored in repository at `production_gap_analysis.md`.*
