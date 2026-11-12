/**
 * ALL REST endpoints in one place.
 *
 * When the FastAPI backend is ready:
 *   1. set PVO_DATA_SOURCE=api and PVO_API_BASE_URL in .env.local
 *   2. adjust the paths below if the backend uses different ones
 * No page or component changes are needed: every screen goes through src/api/services.
 */
const enc = encodeURIComponent;

export const endpoints = {
  auth: {
    login: '/auth/login',
    /** LOCAL DEVELOPMENT ONLY (FastAPI PVO_DEV_LOGIN=true): email sign-in until Okta is connected. */
    devLogin: '/auth/dev-login',
    logout: '/auth/logout',
    me: '/auth/me'
  },
  reference: '/reference',
  assets: {
    list: '/assets',
    create: '/assets',
    byId: (id: string) => `/assets/${enc(id)}`,
    assessments: (id: string) => `/assets/${enc(id)}/assessments`,
    workspace: (id: string) => `/assets/${enc(id)}/workspace`,
    collaborators: (id: string) => `/assets/${enc(id)}/collaborators`
  },
  documents: {
    list: '/documents',
    forAsset: (assetId: string) => `/assets/${enc(assetId)}/documents`,
    byId: (id: number) => `/documents/${id}`,
    download: (id: number) => `/documents/${id}/download`
  },
  /** Data Submission: the set-up form and every file in one request, then a server extraction job. */
  submissions: {
    create: '/assets/submissions',
    job: (assetId: string, jobId: number) => `/assets/${enc(assetId)}/extract/${jobId}`,
    latest: (assetId: string) => `/assets/${enc(assetId)}/extract/latest`,
    retry: (assetId: string) => `/assets/${enc(assetId)}/extract/retry`
  },
  inputs: {
    fields: '/fields',
    fieldsForAsset: (assetId: string) => `/assets/${enc(assetId)}/fields`,
    field: (id: string) => `/fields/${enc(id)}`,
    questions: '/questions',
    questionsForAsset: (assetId: string) => `/assets/${enc(assetId)}/questions`,
    question: (id: string) => `/questions/${enc(id)}`,
    extract: (assetId: string) => `/assets/${enc(assetId)}/extract`
  },
  assessment: {
    runEligibility: (assetId: string) => `/assets/${enc(assetId)}/eligibility/run`,
    runImpact: (assetId: string) => `/assets/${enc(assetId)}/impact/run`,
    scenarios: (assetId: string) => `/assets/${enc(assetId)}/scenarios`
  },
  users: {
    list: '/users',
    create: '/users',
    byId: (id: number) => `/users/${id}`,
    resendInvite: (id: number) => `/users/${id}/invite`
  },
  governance: {
    policyVersions: '/policy-versions',
    deltas: '/policy-deltas',
    /** Engine rules referenced by decision traces. The read-only rules catalogue comes with /reference. */
    rules: '/rules',
    decisionTraces: '/decision-traces',
    /** Policy refresh monitoring: source pipelines and new policy documents since the baseline (read-only). */
    policyMonitoring: '/policy-monitoring'
  },
  activity: '/activity',
  copilot: {
    ask: '/copilot/ask'
  }
} as const;
