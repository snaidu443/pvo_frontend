# Policy Value Optimizer – REST API specification (for the FastAPI backend)

This lists **every API call the React app makes**, which page and button triggers it, and the request and response payloads.
It was produced from the code: `src/api/endpoints.ts` (URLs), `src/api/services/*` (calls) and `src/actions/*` (triggers).
Field-level types are in `src/types/domain.ts`; full example data for every shape is in `src/mocks/data/*.json`.

## 1. Summary

**44 endpoints are used by the app** (plus 2 defined for completeness). Grouped:

| # | Group | Endpoints | Used by |
|---|---|---|---|
| A | Authentication | 2 (+1 optional) | Sign-in page, top bar |
| B | Reference data | 1 | Loaded once after sign-in |
| C | Workspace load | 12 | Loaded once after sign-in (all pages read from it) |
| D | Assets | 3 | Data Submission, Overview modals, all asset tabs |
| E | Documents | 3 | Data Submission |
| F | Inputs (fields, questions, extraction) | 5 | Data Submission, Inputs and Assumptions |
| G | Assessment runs and scenarios | 3 | Inputs and Assumptions, Eligibility, Scenario Analysis |
| H | Users | 3 (+1 optional) | User Management, Overview "Add User" |
| I | Policy governance (sources, versions, deltas, approvals, rules, traces) | 10 | Monitoring, Rules Engine, Approvals |
| J | Activity log | 1 | Every change (audit trail) |
| K | Co-Pilot | 1 | PolicyPilot (all pages) |
| | **Total** | **44** | |

Not API calls (done in the browser): CSV exports (Inputs › Export, Recommendations › Export), the eligibility/impact/scenario numbers shown on screen in mock mode (see §6).

## 2. Conventions (all endpoints)

| Topic | Rule |
|---|---|
| Base URL | `PVO_API_BASE_URL`, e.g. `https://pvo-api.example.com/api/v1`. HTTPS only. |
| Format | JSON (`Content-Type: application/json`), except document upload (multipart). UTF-8. |
| Auth | `Authorization: Bearer <access_token>` and/or an HttpOnly session cookie (the client sends `credentials: include`). |
| Authorization | **Every request must be checked per object** (can this user see/edit *this* asset?). Admin / Editor / Viewer rules in §7. Deny on any error (fail closed). |
| Errors | Non-2xx with FastAPI body `{"detail": "Human-readable message"}`; the UI shows `detail` in a toast. `401` signs the user out. `403` for permission denied, `404` unknown id, `409` conflicts (e.g. duplicate asset code), `422` validation. |
| Success with no body | `204 No Content`. |
| Ids | Assets: string (`TAK-481`, `NEW-001`). Fields: string (`TAK-481|Key Inputs|Modality`). Questions: string (`TAK-481|Q1`). Documents / users: integer. Approvals: `APR-nnnn`. Rules: `R-IRA-01`. The backend may assign its own ids on create and return them. |
| Dates | Currently display strings (`"14 Oct 2026"`, `"10 Oct, 14:09"`). Recommended: ISO-8601 in the API and format in the UI (small change in `src/engine/format.ts`). |

## 3. APIs by page / component

### 3.1 Sign-in (`pages/auth/LoginPage.tsx`, `Disclaimer.tsx`) and top bar (`components/layout/AppShell.tsx`)

| User action | Action function | API calls |
|---|---|---|
| Click **Sign in** | `signIn()` | **A1** `POST /auth/login` → then **B1** `GET /reference` + **C1–C12** (12 GETs, in parallel) |
| Click **I accept** | `acceptDisclaimer()` | none |
| Click **Sign out** | `signOut()` | **A2** `POST /auth/logout` |
| **View as** role switch | `switchRole()` | none (demo only; in API mode the server-assigned role applies) |
| Header asset picker, sidebar | navigation | none |

### 3.2 Assets overview (`pages/overview/OverviewPage.tsx`, `AssetModals.tsx`)

| User action | Action function | API calls |
|---|---|---|
| Page load, filters, search, open row | – | none (data from C1, C2) |
| **Start New Assessment** › confirm | `startAssessment()` | **D2** `PUT /assets/{id}` · **J1** `POST /activity` |
| **View Past Assessments** | – | none (in `asset.assessments`) |
| **Add User** › submit (existing email) | `addCollaborator()` | **H2** `PUT /users/{id}` · J1 |
| **Add User** › submit (new email) | `addCollaborator()` | **H1** `POST /users` · J1 |
| **Edit** (added assets) › Save | `saveEditedAsset()` | **D2** `PUT /assets/{id}` · H2 for old/new owner (if owner changed) · J1 |
| **Delete** (added assets) › confirm | `deleteAsset()` | **D3** `DELETE /assets/{id}` · J1 |
| **Add New Product** | `startNewAsset()` | none (draft is local until extraction) |

### 3.3 Asset › Data Submission (`pages/asset/submission/DataSubmission.tsx`)

| User action | Action function | API calls |
|---|---|---|
| Edit name / area / stage / modality / route | `updateSetup()` | **D2** `PUT /assets/{id}` (not for a new draft) |
| Upload / drop / "+ Add file" / competitor file | `addFiles()` | **E1** `POST /assets/{id}/documents` (multipart, one per file) · D2 · J1 — *new draft: saved after extraction* |
| Change document Type labels / Scope / Version / Slide | `setDocumentLabel()`, `setDocumentProp()` | **E2** `PATCH /documents/{id}` · J1 |
| Remove document › confirm | `removeDocument()` | **E3** `DELETE /documents/{id}` · J1 |
| **Use slide 13 of uploaded CDP** | `useCdpSlide()` | **E1** (metadata only, `linkedDocId`) · J1 |
| **Extract data with AI →** (new product) | `extractData()` | **D1** `POST /assets` (asset + starter fields + questions + trace) · **E1** for each draft document · J1 |
| **Extract data with AI →** (existing asset) | `extractData()` | **F1** `POST /assets/{id}/extract` · D2 · **F2** `PUT /assets/{id}/fields` |

### 3.4 Asset › Inputs and Assumptions (`pages/asset/inputs/*`)

| User action | Action function | API calls |
|---|---|---|
| **Indications**: add indication | `addIndication()` | D2 · J1 |
| Include / exclude indication | `setIndicationIncluded()` | D2 · J1 |
| Edit name, orphan status, launch years | `updateIndication()` | D2 · **F2** `PUT /assets/{id}/fields` |
| **Next: Inputs →** | `goToFields()` | **F2** (fields for new indications) |
| **Inputs**: edit a value | `editField()` | **F3** `PATCH /fields/{id}` · D2 · J1 |
| Resolve a source conflict (radio or drawer button) | `resolveConflict()` | **F3** · D2 · J1 |
| Filter, search, open source drawer, **Export** | – | none (Export is a CSV in the browser) |
| **Assumptions**: answer a judgment question | `answerQuestion()` | **F5** `PATCH /questions/{id}` · J1 |
| **Confirm & run assessment →** | `runAssessment()` | **G1** `POST /assets/{id}/eligibility/run` · D2 · **F4** `PUT /assets/{id}/questions` · J1 |

### 3.5 Asset › Eligibility (`pages/asset/eligibility/*`)

| User action | Action function | API calls |
|---|---|---|
| Click a check, JCA indication picker, Trace & evidence | – | none (data already loaded) |
| **Run impact analysis →** | `runImpact()` | **G2** `POST /assets/{id}/impact/run` · D2 · J1 |
| "Edit in Inputs and Assumptions" | `editInGovernance()` | none (navigation) |

### 3.6 Asset › Impact & Recommendations (`pages/asset/impact/*`)

All views (Impact by Policy, Asset Value Impact, Recommendations, Tradeoff dialog, pager, policy toggles, Lifetime/By year) – **no API calls**; they read the asset, fields, questions and reference data. **Export to PDF** builds a CSV in the browser.

### 3.7 Asset › Scenario Analysis (`pages/asset/scenario/ScenarioPage.tsx`)

| User action | Action function | API calls |
|---|---|---|
| Change variable / value, add / remove row, Reset | – | none (computed live) |
| **Save scenario** | `saveScenario()` | **G3** `POST /assets/{id}/scenarios` · J1 |

### 3.8 Settings › User Management (`pages/settings/UsersPage.tsx`) – Admin manages, Editor views

| User action | Action function | API calls |
|---|---|---|
| **Add user** › submit | `saveUserForm()` | **H1** `POST /users` · J1 |
| **Edit** / **Assign assets** › Save | `saveUserForm()` | **H2** `PUT /users/{id}` · J1 |
| **Activate / Deactivate** | `toggleUserActive()` | **H2** · J1 |
| **Resend invite** | `resendInvite()` | **H3** `POST /users/{id}/invite` · J1 |

### 3.9 Settings › Policy Refresh Monitoring (`pages/settings/MonitoringPage.tsx`)

| User action | Action function | API calls |
|---|---|---|
| **Check all** | `checkAllSources()` | **I3** `POST /policy-sources/check` · J1 |
| **Check now** (row) | `checkSource()` | **I2** `POST /policy-sources/{id}/check` · J1 |
| **Pause / Resume** (Admin) | `toggleSourceMonitoring()` | **I1** `PATCH /policy-sources/{id}` · J1 |
| **Non-material** | `markDeltaNonMaterial()` | **I5** `PATCH /policy-deltas/{id}` · **I4** `PATCH /policy-versions/{id}` · I1 · J1 |
| **Create approval** / **Promote for review** | `createApprovalFromDelta()` | **I6** `POST /approvals` (new) or **I7** `PUT /approvals/{id}` (promote existing) · I5 · I4 · I1 · J1 |
| History, Latest, Review delta, Version compare | – | none |

### 3.10 Settings › Rules Engine (`pages/settings/RulesPage.tsx`, `RuleDrawer.tsx`)

| User action | Action function | API calls |
|---|---|---|
| **New draft version** | `createRuleDraft()` | **I8** `POST /rules` · J1 |
| **Submit for approval** | `submitRule()` | **I6** `POST /approvals` · **I9** `PUT /rules/{id}` · J1 |
| **Activate approved version** (Admin) | `activateRule()` | **I9** `PUT /rules/{id}` · **I10** `PUT /decision-traces` · J1 |
| **Retire rule** (Admin) › confirm | `retireRule()` | I9 · I10 · J1 |

### 3.11 Settings › Approval Tracking (`pages/settings/ApprovalsPage.tsx`)

| User action | Action function | API calls |
|---|---|---|
| **Add comment** | `addApprovalComment()` | **I7** `PUT /approvals/{id}` · J1 |
| **Approve / Reject / Send back / Submit** | `updateApprovalStatus()` | I7 (+ I9 on approve: related rules → approved) · J1 |
| **Mark ready to publish** (Admin) | `markReadyToPublish()` | I7 · J1 |
| **Publish** (Admin) › confirm | `updateApprovalStatus('published')` | I7, I4, I1, I5, I9, I10 · J1 *(see §6: should become one server call)* |

### 3.12 PolicyPilot (`components/pilot/PolicyPilot.tsx`) – every page

| User action | API calls |
|---|---|
| Send a question / click a suggested question | **K1** `POST /copilot/ask` |

## 4. Endpoint reference

Shapes reference `src/types/domain.ts`. Examples are shortened; see `src/mocks/data/` for complete records.

### A. Authentication

**A1 `POST /auth/login`** – sign in (or replace with the enterprise SSO redirect; then this becomes the token exchange).
```json
// request
{ "username": "jordan.lee", "password": "••••" }
// 200 response
{ "access_token": "<jwt>", "user": { "name": "Jordan Lee", "role": "Editor" } }
```
`role` ∈ `Admin | Editor | Viewer` (decided by the server; the demo role picker is hidden in API mode). `401` on bad credentials.

**A2 `POST /auth/logout`** → `204`.
*(optional)* **`GET /auth/me`** → `{ "name": "...", "role": "..." }` – defined in `endpoints.ts`, not called yet; useful to restore a session on reload.

### B. Reference data

**B1 `GET /reference`** → `ReferenceData` (static catalogues; cacheable). Sources: `policies.json`, `recommendations.json`, `tour.json`, `reference.json`, `copilot.json`.
```json
{
  "policies": [{ "code": "IRA", "name": "Medicare price negotiation", "region": "United States", "color": "#bc303d", "impact": "High impact", "value": "−$353M",
                 "summary": "…", "trigger": ">$200M Medicare spend, non-orphan", "implication": "Shorter full-price runway." }],
  "recommendations": [{ "rank": "A", "title": "Reconsider modality / asset selection", "priority": "Strategic", "rationale": "…", "policies": ["IRA"],
                        "owner": "Takeda", "timing": "Before Phase 3 start", "value": 120, "driver": "IRA price discount", "detail": "…" }],
  "tour": [{ "title": "…", "text": "…", "points": ["…"], "icon": "overview" }],
  "coverageInputs": [{ "name": "Modality", "source": "TPP", "core": true }],
  "judgmentQuestions": [{ "group": "Market factors", "text": "Does the asset fall in an MFN-covered therapeutic class?", "options": ["Yes","No","Unknown"],
                          "ai": "Yes", "evidence": "…", "source": "TPP · p.2", "confidence": "Med", "policies": ["MFN","JCA"] }],
  "judgmentColumns": [["Clinical differentiation & comparator"], ["Regional Value Difference","Endpoints & follow-up"], ["…"]],
  "defaultVariables": [{ "name": "IRA price discount", "policy": "IRA", "low": "25%", "base": "40%", "high": "60%" }],
  "sensitivity": [{ "name": "IRA price discount", "policy": "IRA", "low": -180, "high": 150 }],
  "sampleImpact": { "IRA": -353, "MFN": -210, "JCA": -95, "EU-GPL": 60 },
  "synergies": [{ "kind": "Tradeoff", "text": "…", "policies": ["MFN","EU-GPL"], "rank": "I" }],
  "initialDecisionTrace": { "…": "DecisionTrace" },
  "copilot": { "questionOrder": ["…"], "knowledgeBase": [{ "question": "…", "answer": "…", "pattern": "globe", "flags": "" }] }
}
```

### C. Workspace load (after sign-in; all filtered to what the caller may see)

| # | Method and path | Response | Mock file |
|---|---|---|---|
| C1 | `GET /assets` | `Asset[]` – **only assets the caller can access** | `assets.json` |
| C2 | `GET /documents` | `SourceDocument[]` for those assets | `documents.json` |
| C3 | `GET /fields` | `ExtractedField[]` for those assets | (generated in mock) |
| C4 | `GET /questions` | `JudgmentQuestion[]` for those assets | (generated in mock) |
| C5 | `GET /users` | `User[]` (Admin: all; Editor: users on their assets; Viewer: may return `[]` – in API mode the app takes asset visibility from C1, not from this list) | `users.json` |
| C6 | `GET /policy-sources` | `PolicySource[]` | `policySources.json` |
| C7 | `GET /policy-versions` | `PolicyVersion[]` | `policyVersions.json` |
| C8 | `GET /policy-deltas` | `PolicyDelta[]` | `policyDeltas.json` |
| C9 | `GET /approvals` | `ApprovalItem[]` | `approvals.json` |
| C10 | `GET /rules` | `Rule[]` | `rules.json` |
| C11 | `GET /decision-traces` | `{ [assetId]: DecisionTrace }` | `decisionTraces.json` |
| C12 | `GET /activity` | `ActivityEntry[]` (latest 10) | `activity.json` |

If C3/C4 return nothing for an asset, the app generates starter fields/questions (demo behaviour). Recommended: the backend returns them after extraction.

**Asset** (C1, D1, D2) – abbreviated:
```json
{
  "id": "TEST-100", "assetCode": "TEST-100", "assetName": "TEST-100 Test Asset", "therapeuticArea": "Hematology", "stage": "Phase 3",
  "jurisdictions": ["US","EU"], "policyExposures": ["IRA","MFN","JCA","EU-GPL"],
  "submissionStatus": "In progress", "submissionCompleteness": 55, "eligibilityStatus": "4 policies assessed", "businessContextStatus": "Draft",
  "impactStatus": "High exposure", "owner": "Thomas Weber", "lastUpdatedAt": "21 Oct 2026", "estimatedImpactLevel": "High",
  "estimatedAtRisk": 601, "estimatedOpportunity": 474, "recommendationStatus": "5 actions · +$474M", "governanceAlerts": 5,
  "summaryMetrics": { "gross": 3748, "net": 3236, "usRevenue": 422, "euRevenue": 127 },
  "eligibility": { "IRA": "In scope", "MFN": "In scope", "JCA": "In scope", "EU-GPL": "In scope" },
  "context": { "modality": "Biologic", "coverage": "SC · Part B", "medicareSpend": 295, "launchUS": 2031, "launchEU": 2032, "sequence": "US-first" },
  "policyImpact": { "IRA": -276, "MFN": -187, "JCA": -138, "EU-GPL": 89 },
  "recommendationCount": 5, "approvalCount": 0, "createdByRole": "Admin",
  "assessments": [{ "id": "AS-1", "date": "21 Oct 2026", "by": "Thomas Weber", "status": "Current", "level": "High", "atRisk": 601, "completeness": 55 }],
  "aia": {
    "created": false, "unlocked": ["submission","governance","eligibility","impact","scenario"],
    "setup": { "name": "TEST-100 Test Asset", "area": "Hematology", "stage": "Phase 3", "modality": "Biologic", "route": "SC · Part B", "tclass": "Hematologic",
               "indications": [{ "id": "IND-1", "name": "1L myelofibrosis (combination)", "orphanUS": "Yes", "orphanEU": "Yes", "launchUS": "2031", "launchEU": "2032", "include": true, "source": "TPP · p.1" }] },
    "base": { "peakUS": 422, "peakEU": 127 },
    "variables": [{ "name": "IRA price discount", "policy": "IRA", "low": "25%", "base": "40%", "high": "60%" }],
    "priority": 62, "confirmedBy": "Thomas Weber", "confirmedAt": "21 Oct 2026",
    "savedScenarios": [{ "name": "Scenario 1", "time": "26 Oct, 10:00", "by": "Thomas Weber", "vals": { "gap": 50 }, "delta": -42 }],
    "govView": "fields", "govFilter": "All", "govSearch": "", "govRow": null, "impactView": "policy", "jcaInd": 0, "check": "IRA-3",
    "policiesOn": { "IRA": true, "MFN": true, "JCA": true, "EU-GPL": true }, "scenario": "Base", "applyRecs": true, "openMitigation": "A"
  }
}
```
`aia` = the assessment workspace. **Persist**: `created, unlocked, setup, base, variables, priority, confirmedBy, confirmedAt, savedScenarios`. The remaining `aia` keys (`govView`, `govFilter`, `govSearch`, `govRow`, `impactView`, `policyView`, `valueMode`, `jcaInd`, `check`, `policiesOn`, `scenario`, `applyRecs`, `openMitigation`, `scn`, `scnRows`) are UI view state; the backend may store them per user or ignore them.

### D. Assets

**D1 `POST /assets`** – create from "Add New Product" › Extract (Admin, Editor).
```json
// request
{
  "asset": { "id": "NEW-001", "assetCode": "DEMO-1", "assetName": "DEMO-1 2L solid tumor", "...": "Asset (createdByRole set)" },
  "fields": [{ "id": "NEW-001|Key Inputs|Modality", "assetId": "NEW-001", "group": "Key Inputs", "field": "Modality", "value": "Small molecule",
               "confidence": "High", "source": "TPP · p.1", "feeds": ["IRA","MFN"], "status": "AI-extracted", "gen": true,
               "history": [{ "time": "10 Oct, 14:09", "who": "AI", "text": "Extracted from source document" }] }],
  "questions": [{ "id": "NEW-001|Q1", "assetId": "NEW-001", "group": "…", "text": "…", "ai": "Low", "answer": "Low", "...": "JudgmentQuestion" }],
  "trace": { "assetId": "DEMO-1", "activePolicyVersions": { "IRA": "PV-IRA-32" }, "activeRuleVersions": {}, "firedRules": [], "skippedRules": [],
             "failedRules": [], "outputSummary": "DEMO-1 2L solid tumor · governed inputs pending", "explanationLog": ["…"] }
}
// 201 response: Asset (server may replace "id"; 409 if assetCode exists)
```
**D2 `PUT /assets/{id}`** – save the full asset incl. `aia` and `assessments`. Request and 200 response: `Asset`. Called after most asset-tab changes (debouncing on the client is a possible later optimisation).
**D3 `DELETE /assets/{id}`** – only user-added assets (`createdByRole` set), Admin/Editor. Also deletes its documents, fields, questions, trace and user assignments. `204`.

### E. Documents

**E1 `POST /assets/{id}/documents`** – `multipart/form-data`:
| Part | Content |
|---|---|
| `metadata` | JSON `SourceDocument` (below) |
| `file` | the file (omitted when linking a CDP slide) |
```json
{ "id": 1729931234567, "assetId": "TAK-481", "name": "TPP_v2.pptx", "size": "2.1 MB", "type": "TPP", "types": ["TPP","Regulatory"],
  "scope": "Program-wide", "version": "Latest", "tag": "", "slideRef": "13", "linkedDocId": 2, "competitor": false,
  "pages": "Demo upload", "added": "Just now", "addedStamp": "26 Oct, 10:00" }
```
Response `201`: `SourceDocument` with the server id. **Server must**: allow only `pdf, doc, docx, xls, xlsx, xlsm, ppt, pptx, csv`, max 50 MB, virus-scan, store in S3 (KMS), never execute macros, never trust the client's `size`/`name` beyond display.
**E2 `PATCH /documents/{id}`** – body: `SourceDocument` (changed: `types`, `type`, `scope`, `version`, `slideRef`, `tag`) → `SourceDocument`.
**E3 `DELETE /documents/{id}`** → `204`.

### F. Inputs (extracted fields, judgment questions)

**F1 `POST /assets/{id}/extract`** – start AI extraction of the asset's documents. No body. `202` (async) or `200` with the new fields; the UI then calls F2 with the merged set.
**F2 `PUT /assets/{id}/fields`** – replace all fields of the asset. Body / 200: `ExtractedField[]`.
**F3 `PATCH /fields/{id}`** – one field. Body / 200: `ExtractedField`, e.g.
```json
{ "id": "TAK-481|Indication 1 · 2L solid tumor|EU launch year", "assetId": "TAK-481", "group": "Indication 1 · 2L solid tumor", "field": "EU launch year",
  "value": "2029", "alternate": "", "prev": "2028", "confidence": "High", "source": "TPP · p.4 / Forecast · tab 1", "feeds": ["JCA","EU-GPL"],
  "status": "Edited", "indId": "IND-1",
  "history": [{ "time": "26 Oct, 10:00", "who": "Thomas Weber", "text": "Changed conflict → 2029 (Forecast)" }] }
```
`status` ∈ `AI-extracted | Edited | Conflict | Missing | Needs review`.
**F4 `PUT /assets/{id}/questions`** – replace all questions. Body / 200: `JudgmentQuestion[]`.
**F5 `PATCH /questions/{id}`** – one answer. Body / 200: `JudgmentQuestion`, e.g.
```json
{ "id": "TAK-481|Q2", "assetId": "TAK-481", "group": "Clinical differentiation & comparator", "text": "High unmet need in this indication?",
  "perIndication": true, "ai": "Yes", "answer": "Yes", "answers": { "IND-1": "Yes", "IND-2": "No" }, "confirmedBy": "Thomas Weber",
  "evidence": "…", "source": "TPP · p.2", "confidence": "High", "policies": ["JCA","EU-GPL"] }
```

### G. Assessment runs and scenarios

**G1 `POST /assets/{id}/eligibility/run`** – run the deterministic eligibility engine on the confirmed inputs. No body. Recommended response: the eligibility result per policy (the shape the UI computes today, `EligibilityResult` in `src/engine/eligibility.ts`) plus the updated `DecisionTrace`.
**G2 `POST /assets/{id}/impact/run`** – run impact + recommendations. No body. Recommended response: `{ policyImpact, gross, recommendations }` (see `impactFor` / `recsFor` in `src/engine/impact.ts`).
**G3 `POST /assets/{id}/scenarios`** – save a scenario. Body / 201: `SavedScenario`
```json
{ "name": "Scenario 2", "time": "26 Oct, 10:05", "by": "Thomas Weber", "vals": { "iraDisc": 60, "usL": 2032 }, "delta": -128.4 }
```

### H. Users (Admin; Editor read-only)

**H1 `POST /users`** · **H2 `PUT /users/{id}`** – body / response `User`:
```json
{ "id": 7, "name": "Jordan Lee", "email": "jordan.lee@takeda.example", "role": "Viewer", "roleCode": "viewer", "status": "pending", "active": false,
  "last": "Invite sent · just now", "assetIds": ["TAK-481"], "assignedAssets": ["TAK-481"], "asset": "TAK-481", "permissions": [] }
```
`status` ∈ `active | inactive | pending`. Validate email format, role, and that assigned asset ids exist. Editors may add Editor/Viewer collaborators to their own assets only.
**H3 `POST /users/{id}/invite`** – resend the invitation. `204`.
*(optional)* `DELETE /users/{id}` – defined, not used by the current screens.

### I. Policy governance

| # | Method and path | Body → response |
|---|---|---|
| I1 | `PATCH /policy-sources/{id}` | `PolicySource` → `PolicySource` (e.g. `monitoringEnabled`, `monitoringStatus`) |
| I2 | `POST /policy-sources/{id}/check` | none → `204` (start a refresh of one source) |
| I3 | `POST /policy-sources/check` | none → `204` (refresh all sources) |
| I4 | `PATCH /policy-versions/{id}` | `PolicyVersion` → `PolicyVersion` (status: `draft, submitted, reviewed, published, superseded`) |
| I5 | `PATCH /policy-deltas/{id}` | `PolicyDelta` → `PolicyDelta` (status: `detected, review_needed, approval_pending, non_material, published`) |
| I6 | `POST /approvals` | `ApprovalItem` → `201 ApprovalItem` |
| I7 | `PUT /approvals/{id}` | `ApprovalItem` → `ApprovalItem` |
| I8 | `POST /rules` | `Rule` (new draft version) → `201 Rule` |
| I9 | `PUT /rules/{id}` | `Rule` → `Rule` (status: `draft, submitted, approved, active, retired`) |
| I10 | `PUT /decision-traces` | `{ [assetId]: DecisionTrace }` → `204` |

**ApprovalItem** example:
```json
{ "id": "APR-2604", "type": "rule_change", "title": "EU-GPL member-state supply rule draft", "asset": "Global oncology", "assetId": "ALL",
  "policy": "EU-GPL", "submittedBy": "Thomas Weber", "submittedAt": "13 Oct 2026 · 15:44", "status": "under_review", "riskLevel": "high",
  "currentValue": "…", "proposedValue": "…", "rationale": "…", "evidence": "…", "impactedAreas": ["Eligibility","Impact"], "approver": "Maya Chen",
  "approvedBy": "", "decisionNotes": "", "publishedAt": "", "readyToPublish": false, "relatedRules": ["R-GPL-02"], "policyVersionId": "PV-GPL-13",
  "impactedAssetIds": ["TAK-481","TAK-227"], "comments": [{ "by": "Thomas Weber", "time": "13 Oct 2026 · 15:44", "text": "…" }] }
```
`type` ∈ `field_override, judgment_call, policy_delta, rule_change, scenario_change`; `status` ∈ `draft, submitted, under_review, approved, rejected, published`.
Server rules: only Admin may publish, mark ready, activate or retire rules; Viewers cannot change approvals; publishing requires `status = approved` and `readyToPublish = true`.

**Rule** example (abbreviated): `{ "id": "R-IRA-01", "code": "IRA-ELIG-01", "name": "…", "policy": "IRA", "category": "eligibility", "plainEnglishLogic": "…", "formalLogic": "spend > 200M AND …", "inputFields": ["annual_medicare_spend"], "outputFields": ["ira_eligibility"], "status": "active", "version": "3.2", "effectiveFrom": "01 Sep 2026", "owner": "US Policy", "linkedPolicyVersionIds": ["PV-IRA-32"], "linkedApprovalId": "APR-2601", "testCases": [{ "name": "…", "input": "…", "expected": "In scope", "actual": "In scope", "pass": true }], "impactedAssetIds": ["TAK-481"] }`

### J. Activity log

**J1 `POST /activity`** – body `{ "event": "Updated EU launch year", "user": "Thomas Weber", "time": "Just now" }` → `204`.
Recommended: the server records the audit trail itself from the authenticated user and server time (do not trust `user`/`time` from the client); then J1 can be dropped.

### K. Co-Pilot

**K1 `POST /copilot/ask`**
```json
// request (assetId is null outside an asset page)
{ "question": "Which Medicare Part B drugs are included in the GLOBE Model?", "assetId": "TAK-481" }
// 200 response
{ "text": "The GLOBE Model covers …", "citations": [{ "title": "CMS GLOBE model overview", "url": "https://…" }] }
```
Max question length 300 characters. Server side: guardrails, treat retrieved documents as data (never as instructions), return citations, do not log personal data.

## 5. Role rules the API must enforce

| Capability | Admin | Editor | Viewer |
|---|---|---|---|
| See assets | all | assigned | assigned |
| Edit inputs, documents, answers, run assessment/impact, save scenarios | ✓ | ✓ (assigned) | ✗ |
| Create / edit / delete user-added assets | ✓ | ✓ | ✗ |
| Add collaborator to an asset | any role | Editor/Viewer only | ✗ |
| User management (create, edit, activate, invite) | ✓ | view only | ✗ |
| Approve / reject / send back approvals, create rule drafts, classify deltas | ✓ | ✓ | ✗ |
| Mark ready, publish, activate / retire rules, pause monitoring | ✓ | ✗ | ✗ |

## 6. Recommendations for the backend team

1. **Make publish one transaction.** Today "Publish" sends several updates (I7, I4, I1, I5, I9, I10). Better: `POST /approvals/{id}/publish` that updates version, source, delta, rules and traces atomically server-side; the UI then needs one call. Same idea for `POST /rules/{id}/activate` and `POST /policy-deltas/{id}/approval`.
2. **Optional single load call.** C1–C12 can be combined into `GET /workspace` returning the `WorkspaceData` shape, to reduce round trips.
3. **Engines on the server.** G1/G2 should return the computed results; the TypeScript engine (`src/engine`) and `tests/engine.test.ts` define the expected numbers for the same inputs.
4. **Audit trail server-side** (see J1), with ISO timestamps.
5. **Bulk saves.** D2 is called often (after many edits); the backend should accept it idempotently. Debouncing can be added on the client later without screen changes.

Changing a path only requires editing `src/api/endpoints.ts`; changing a payload shape requires updating `src/types/domain.ts` and, if needed, the service in `src/api/services/`.

Database schema for users, roles, permissions, asset access, invitations and the audit log: `docs/db/user_management.sql`.
