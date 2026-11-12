# API integration guide

The front end runs on JSON mock data today. When the FastAPI backend is ready, you connect it **without changing any page or component**. Only configuration and, if the backend paths differ, `src/api/endpoints.ts` change.

## 1. Switch the data source

Create `.env.local` in the project root:

```
PVO_DATA_SOURCE=api
PVO_API_BASE_URL=https://<your-api-host>/api/v1
```

- `https://` is required. `http://localhost` is allowed for local development. The app refuses to start with any other URL (fail closed).
- Never put secrets in `.env*` files: everything prefixed `PVO_` is bundled into the browser build by webpack.
- Restart `npm run dev` (or rebuild with `npm run build`) after changing env files; values are fixed at build time.

## 2. How a call flows

```
Page / component  ──►  action (src/actions/*)  ──►  Redux slice (src/store/slices/*)
                               │                        updates the UI immediately
                               └──────────────────►  service (src/api/services/*)  ──►  mock DB  |  REST API
                                                        isMock() ? mockDb : http
```

- **Pages** never call `fetch`. They call **actions**.
- **Actions** dispatch a Redux slice action right away, then write through to a **service**. On failure the user sees a toast with the server's message.
- **Services** are the only place that knows mock versus API. Every service method has both branches.
- `src/api/httpClient.ts` adds `Authorization: Bearer <token>` when a token is set, and sends cookies (`credentials: 'include'`). A `401` signs the user out. Error bodies of the FastAPI form `{"detail": "..."}` are shown to the user; other bodies are never echoed.

## 3. Endpoints the backend must provide

All paths are relative to `PVO_API_BASE_URL` and defined in `src/api/endpoints.ts`. Request and response bodies use the TypeScript types in `src/types/domain.ts`; the JSON files in `src/mocks/data/` are working examples of every shape.

| Area | Method and path | Body / response |
|---|---|---|
| Auth | `POST /auth/login` | `{username, password}` → `{access_token?, user: {name, role}}` (or replace with the SSO redirect) |
| | `POST /auth/logout` | – |
| Reference | `GET /reference` | `ReferenceData` (policies, recommendation catalogue, tour, Co-Pilot KB, model constants); see `reference.json`, `policies.json`, `recommendations.json`, `tour.json`, `copilot.json` |
| Workspace | `GET /assets` | `Asset[]`, **only assets the caller may access** |
| | `GET /documents` | `SourceDocument[]` |
| | `GET /fields`, `GET /questions` | `ExtractedField[]`, `JudgmentQuestion[]` |
| | `GET /users` | `User[]` (Admin and Editor only) |
| | `GET /policy-sources`, `/policy-versions`, `/policy-deltas`, `/approvals`, `/rules` | governance collections |
| | `GET /decision-traces` | `Record<assetId, DecisionTrace>` |
| | `GET /activity`, `POST /activity` | `ActivityEntry[]` / `ActivityEntry` |
| Assets | `POST /assets` | `{asset, fields, questions, trace}` → `Asset` |
| | `PUT /assets/{id}` | `Asset` (includes `aia` workspace and `assessments`) |
| | `DELETE /assets/{id}` | – |
| Documents | `POST /assets/{id}/documents` | multipart: `metadata` (JSON `SourceDocument`) + `file` → `SourceDocument` |
| | `PATCH /documents/{id}`, `DELETE /documents/{id}` | |
| Inputs | `PUT /assets/{id}/fields`, `PATCH /fields/{id}` | `ExtractedField[]` / `ExtractedField` |
| | `PUT /assets/{id}/questions`, `PATCH /questions/{id}` | `JudgmentQuestion[]` / `JudgmentQuestion` |
| | `POST /assets/{id}/extract` | starts AI extraction |
| Assessment | `POST /assets/{id}/eligibility/run`, `POST /assets/{id}/impact/run` | runs the Python engines |
| | `POST /assets/{id}/scenarios` | `SavedScenario` |
| Users | `POST /users`, `PUT /users/{id}`, `DELETE /users/{id}`, `POST /users/{id}/invite` | `User` |
| Governance | `PATCH /policy-sources/{id}`, `POST /policy-sources/{id}/check`, `POST /policy-sources/check` | |
| | `PATCH /policy-versions/{id}`, `PATCH /policy-deltas/{id}` | |
| | `POST /approvals`, `PUT /approvals/{id}` | `ApprovalItem` |
| | `POST /rules`, `PUT /rules/{id}` | `Rule` |
| | `PUT /decision-traces` | `Record<assetId, DecisionTrace>` |
| Co-Pilot | `POST /copilot/ask` | `{question, assetId}` → `{text, citations?}` |

## 4. Where the numbers are computed

| Today (mock) | With the API |
|---|---|
| Eligibility, impact, recommendations and scenarios are computed in the browser by `src/engine/*` (a faithful TypeScript port of the v03 logic). | The Python engines on EKS compute and store the authoritative results when `.../eligibility/run` and `.../impact/run` are called. |
| Extraction is simulated: starter fields come from `engine/workspace.ts → generateFields`. | `POST /assets/{id}/extract` returns real extracted fields; `ensureAia` only fills gaps when the API returns none. |
| PolicyPilot answers from `engine/copilot.ts`. | `POST /copilot/ask` (AgentCore orchestrator, guardrails, summarizer with citations). |

`tests/engine.test.ts` pins the current engine results. Run the same cases against the Python engine to confirm both give identical answers before switching.

## 5. Backend requirements (security)

The UI hides buttons by role, but that is a convenience only. The backend must:

1. **Authorize every request per object.** Check that the caller may access the specific asset, user or approval, not just that they are signed in. Viewers are read-only; only Admin may publish, activate or retire rules, and manage users.
2. **Fail closed.** If auth, validation or a permission check errors, deny the request.
3. **Validate all input** against the schemas in `src/types/domain.ts` (type, length, allowed values). Reject malformed input.
4. **Uploads:** re-check extension and size (the UI allows pdf, doc, docx, xls, xlsx, xlsm, ppt, pptx, csv up to 50 MB), virus-scan, store in S3 with KMS, and **never execute macros** (xlsm).
5. **Parameterize all SQL** (SQLAlchemy), and log without personal data.
6. **Co-Pilot:** treat retrieved document text as data, never as instructions; return citations.

## 6. Checklist for going live

- [ ] Backend endpoints return the shapes in `src/mocks/data/*.json`
- [ ] `.env.local` set to `api` and an `https://` base URL
- [ ] SSO wired in `authService.login` (or redirect flow) and the demo role picker hidden (it already hides when `PVO_DATA_SOURCE=api`)
- [ ] `npm run typecheck`, `npm test`, `npm run build` pass
- [ ] SAST, dependency scanning (`npm audit`), DAST and a human security review completed
