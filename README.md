# OnneshaAssist (Onnesha Assessment Arena)

An institutional **live examination**, regional roster, and merit-evaluation platform for academies, training centres, and competitive exam cohorts.

This repository previously shipped the default Lovable README (“Welcome to your Lovable project”). This file describes what is actually in the tree as of November 2026. The app is under active development — treat it as a work in progress, not a finished public product.

## What it is

From the project’s own `GLOSSARY.md`, Onnesha Assessment Arena is built around institutional language, not “game” language:

- **Region** — a command or administrative area (for example a range or district centre) used to segment sessions and merit lists.
- **Candidate** — an enrolled examinee with a verified name, unique **Roll Number**, and registered mobile number.
- **Exam Session** — a live, PIN-gated room created from a quiz, moving through lobby, countdown, question, chart, leaderboard, and podium phases.
- **Host** — the instructor or invigilator who starts a session, watches **Proctor Pulse**, controls question progression, and publishes the **Merit Gazette**.
- **Seat Lock** — a `seatToken` that binds a candidate to one active device for the session.
- **Proctor Incident** — a timestamped event when a candidate switches tabs or loses window focus; repeated incidents can suspend the candidate.
- **Merit Gazette** — official ranking (overall and by region), accuracy, negative marking, qualification status.
- **Verifiable Certificate** — a digital credential with a deterministic certificate number (`ONN-<PIN>-<ROLL>`), meant to be checked via URL or QR.

The route map in `src/routes/` matches that picture: `play`, `host.$quizId`, `final-exam`, `final-exam-live`, `portal`, `admin`, `dashboard`, `verify.$certId`, `vault`, `timer`, plus auth (`login`, `signup`, `forgot-password`), `pricing`, `security`, `contact-sales`, and `developers`.

A later LMS-shaped **student portal** (materials, recordings, quizzes, practicals, an AI tutor grounded in published materials) is documented in `production_gap_analysis.md` and `docs/industrial-lms-exam-plan.md`. Do not assume every portal tab is finished just because the route exists — check the code for the feature you need.

There is **no verified public production URL** in this repository. `render.yaml` describes a Render web service named `onnesha-exam-platform` (Singapore, Node, a persistent disk for practical uploads). Publish a homepage in the GitHub “About” box only after that service (or another host) is actually live.

## Stack (from `package.json`)

- **TypeScript**, **React 19**, **Vite**
- **TanStack Start** / **TanStack Router** / **TanStack Query**
- **Tailwind CSS**, **Radix UI**, **Zod**, **React Hook Form**
- **sql.js** (SQLite compiled to WebAssembly — `public/sql-wasm.wasm` is in the repo)
- **Vitest**, ESLint, Prettier
- Package name in `package.json` is still the template id `tanstack_start_ts` (private). The Render service name is `onnesha-exam-platform`.
- The project was started with [Lovable](https://lovable.dev); later work lives in this GitHub repo.

A seed script, `scripts/seed-sanjibon-data.mjs` (`npm run seed`), loads sample / academy data used in development.

## Development

You need Node.js (and optionally Bun — the repo also has `bun.lock` / `bunfig.toml`).

```bash
git clone https://github.com/JehadurRE/OnneshaAssist.git
cd OnneshaAssist
npm install
npm run dev
```

Other scripts from `package.json`:

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (TanStack Start) |
| `npm run seed` | Seed Sanjibon / course data |
| `npm test` | Vitest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Typecheck + Vite production build |
| `npm start` | `node .output/server/index.mjs` |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## Status and contributing

- Public repo, **no license file** at the time this README was written. Add one (MIT is a reasonable default) before you invite external use.
- Please open issues for exam-flow bugs (join, seat lock, submit, resume, certificate verification) with steps to reproduce.
- If this work is useful to your academy or training desk, a [star](https://github.com/JehadurRE/OnneshaAssist) helps people find it. Stars are not a substitute for a license or a production README, but they do help discovery.

## Author

[Jehadur Rahman Emran](https://github.com/JehadurRE) · [jehadurre.me](https://jehadurre.me)
