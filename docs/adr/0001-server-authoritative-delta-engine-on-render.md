# Server-Authoritative Delta Engine and Persistent Disk Store on Render

Onnesha Arena must support 500+ concurrent Candidates joining from mobile devices across multiple Regions without data loss, impersonation, or client-side answer key exposure. Previously, the app stored SQLite in each browser's `localStorage` and synced multi-device state by having clients POST their entire local `GameSession` object (`serverSyncSession`) and poll the full session every 600ms—causing full-state overwrite races, 250 MB/s bandwidth spikes at 500 users, and unshared rosters across devices.

We decided to move all authoritative state (Regions, Candidate Roster, Quizzes, Active Exam Sessions, Proctor Incidents, Exam Results, and Certificates) to the Node/Nitro server backed by atomic disk persistence (`DATA_DIR` on a Render Persistent Disk at `/var/data`), and to replace full-session sync with atomic mutation RPCs (`serverJoinSession`, `serverSubmitAnswer`, `serverReportProctorIncident`) and a lightweight (<1 KB) role-filtered delta poll (`serverPollSession`) that strips answer keys during active questions and enforces a cryptographic Single-Seat Lock (`seatToken`) per Candidate.

