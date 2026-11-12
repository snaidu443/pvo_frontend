# Policy Value Optimizer – React front end

React 19 + TypeScript (strict) + Redux Toolkit version, built with **webpack 5**, of the **Takeda Policy Value Optimizer – Demo UI v03** HTML. Same screens, styling and behaviour. It runs on **JSON mock data** now and switches to the **FastAPI** backend by configuration only (see [docs/API_INTEGRATION.md](docs/API_INTEGRATION.md)).

> Illustrative demo. All data is synthetic sample data; outputs are not forecasts or advice.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Sign in with any user name and password, choose a demo role, then accept the disclaimer.

| Script | What it does |
|---|---|
| `npm run dev` | webpack-dev-server on http://localhost:3000 (reloads the page on save) |
| `npm run build` | Type-check, then webpack production build into `dist/` (deploy this folder) |
| `npm run preview` | Serve a production build on http://localhost:4173 |
| `npm run typecheck` | TypeScript only |
| `npm test` | Engine and Redux store tests (Node built-in test runner, no extra packages) |

Requires Node 22.15 or newer (tested on Node 24).

## Build and deploy

- Build configuration: `webpack.config.mjs` (TypeScript via `ts-loader`, CSS extracted to its own file, separate cacheable `vendor`, `mock-data` and `main` chunks with content hashes).
- Settings come from environment variables prefixed `PVO_` (see `.env.example`), read from the shell or `.env`, `.env.local`, `.env.<mode>`, `.env.<mode>.local`. They are fixed at build time.
- `npm run build` writes static files to `dist/` (`index.html`, `assets/`, logo). Host them on any static web server or S3 + CloudFront; route unknown paths to `index.html`.

## Dependencies

Kept to the minimum: `react`, `react-dom`, `@reduxjs/toolkit`, `react-redux`; dev: `webpack`, `webpack-cli`, `webpack-dev-server`, `ts-loader`, `html-webpack-plugin`, `css-loader`, `mini-css-extract-plugin`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node` (type definitions for the tests; not shipped). No router or test library: navigation lives in the Redux `ui` slice, and tests use Node's built-in runner.

## Project structure

```
src/
├─ api/
│  ├─ endpoints.ts          ALL REST URLs (edit here when the backend paths are known)
│  ├─ httpClient.ts         fetch wrapper: base URL, bearer token, 401 → sign-out, safe errors
│  ├─ mock/mockDb.ts        in-memory mock backend seeded from src/mocks/data
│  ├─ services/             one service per area; each has a mock branch and an API branch
│  └─ index.ts              single import point for the UI
├─ mocks/data/*.json        mock data (exported from the v03 HTML)
├─ types/domain.ts          domain model = API contract
├─ config/env.ts            PVO_DATA_SOURCE / PVO_API_BASE_URL (injected by webpack)
├─ engine/                  deterministic logic ported from v03 (pure, unit-tested)
│  ├─ eligibility.ts        IRA / MFN / JCA / EU-GPL checks, coverage
│  ├─ impact.ts             impact, recommendations, yearly model, scenarios
│  ├─ workspace.ts          assessment workspace, generated fields, questions
│  ├─ summary.ts            keeps portfolio summaries in line
│  ├─ copilot.ts            rule-based PolicyPilot (mock mode)
│  ├─ permissions.ts        role checks (UI convenience; server must enforce)
│  └─ constants.ts, format.ts, reference.ts
├─ store/
│  ├─ store.ts              configureStore, typed hooks (useAppDispatch / useAppSelector), selectApp
│  ├─ appState.ts           slice state types + initial values
│  ├─ sharedActions.ts      cross-slice actions (sign-in/out, asset created/deleted, approvals)
│  └─ slices/               session · ui · assessment · admin (pure reducers)
├─ actions/                 every user action: validate → dispatch → call service
├─ ui/overlay.tsx           modal, drawer, toast, analysis loader
├─ components/              common UI, layout (sidebar/topbar), charts, PolicyPilot, tour
├─ pages/
│  ├─ auth/                 sign-in, disclaimer
│  ├─ overview/             Assets overview + asset modals
│  ├─ asset/                Data Submission, Inputs and Assumptions, Eligibility,
│  │                        Impact & Recommendations, Scenario Analysis
│  └─ settings/             User management, Policy refresh monitoring, Rules engine, Approvals
└─ styles/app.css           v03 stylesheet (unchanged)
tests/                      engine tests + Node resolve hook
docs/API_INTEGRATION.md     how to connect the REST APIs
```

## Conventions

- **Redux Toolkit store** with four slices: `session` (sign-in, role), `ui` (page, tab, selection, filters), `assessment` (assets, draft, documents, fields, answers) and `admin` (users, policy governance, rules, traces, activity). Actions that change several slices are shared `createAction`s handled in each slice's `extraReducers`.
- **Reducers are pure.** Ids are derived from the data; dates and the acting user are passed in the action payload. Redux DevTools works in `npm run dev`.
- **Pages are pure.** They read state with `useAppState()` (memoized flat view of all slices) or `useAppSelector`, and call action functions; they never mutate state or call `fetch`.
- **Actions** (`src/actions`) validate against current state, dispatch slice actions, then write through to a service; failures show a toast. They are pre-bound to the store, so components call them directly (`openAsset(id)`).
- **Services** (`src/api/services`) are the only mock/API switch.
- **Engine** functions and the store are covered by `npm test`.

## Mock data and storage

- `src/mocks/data/*.json` holds the synthetic data from the v03 demo (assets incl. TEST-100, users, rules, policy versions, approvals, Co-Pilot answers).
- Like v03, assets you add and document records are kept in this browser's `localStorage` (file contents are never read or stored). Clear site data to reset.

## Security notes

- The sign-in is a **demo**: nothing is verified and the password is not stored. Do not enter real credentials or data. In API mode the role picker is hidden and the server decides the role.
- Role checks in the UI are for display only; the backend must authorize every request per asset.
- Before production: run SAST, `npm audit`/dependency scanning, DAST, and a human security review.
