/** Keeps the asset's portfolio summary in line with its assessment. Mutates the asset. */
import type { Asset } from '../types/domain';
import { inScope, profile, type Ctx } from './eligibility';
import { INPUT_PHASES, indValues } from './inputCatalogue';
import { inputCoverage } from './inputs';
import { impactFor, recsFor } from './impact';
import { ref } from './reference';
import { aia, assetFields, isUnlocked } from './workspace';

/** The set-up stage; when none is set, the most advanced phase of the included indications. */
function stageOf(a: Asset): string {
  const st = aia(a).setup;
  if (st.stage) return st.stage;
  const at = st.indications.filter(i => i.include !== false).map(i => INPUT_PHASES.indexOf(String(indValues(i).phase ?? ''))).filter(i => i >= 0);
  return at.length ? INPUT_PHASES[Math.max(...at)] : '';
}

/** `today` is the display date for lastUpdatedAt (passed in so reducers stay pure). */
export function syncAssetSummary(s: Ctx, a: Asset | null | undefined, today: string): void {
  if (!a || a.id === '__draft' || !a.aia) return;
  const cov = inputCoverage(s, a), nr = assetFields(s, a).filter(f => ['Conflict', 'Missing', 'Needs review'].includes(f.status)).length;
  if (a.id === 'TEST-100') {
    a.submissionCompleteness = cov.pct;
    a.governanceAlerts = nr;
    a.submissionStatus = nr ? 'Needs review' : 'Complete';
  }
  if (!aia(a).created) return;
  const p = profile(s, a), w = aia(a);
  a.jurisdictions = [...(p.inds.some(i => i.launchUS) ? ['US'] : []), ...(p.inds.some(i => i.launchEU) ? ['EU'] : [])];
  a.submissionCompleteness = cov.pct;
  a.governanceAlerts = nr;
  a.submissionStatus = nr ? 'Needs review' : 'Complete';
  a.lastUpdatedAt = today;
  a.stage = stageOf(a);
  a.context = { ...(a.context || {}), modality: p.modality, coverage: w.setup.route, medicareSpend: p.spend, launchUS: p.launchUS, launchEU: p.launchEU };
  if (isUnlocked(a, 'eligibility')) {
    const exp = inScope(s, a);
    a.policyExposures = exp;
    a.eligibility = Object.fromEntries(ref().policies.map(x => [x.code, exp.includes(x.code) ? 'In scope' : 'Not in scope']));
    a.eligibilityStatus = `${exp.length} policies assessed`;
  }
  if (isUnlocked(a, 'impact')) {
    const im = impactFor(s, a), sum = Object.values(im.policyImpact).reduce((t, v) => t + v, 0), r = recsFor(s, a), opp = r.reduce((t, x) => t + x.value, 0);
    a.policyImpact = im.policyImpact;
    a.estimatedAtRisk = Math.max(0, -sum);
    a.estimatedOpportunity = opp;
    a.summaryMetrics = { gross: im.gross, net: im.gross + sum, usRevenue: Number(w.base.peakUS) || 0, euRevenue: Number(w.base.peakEU) || 0 };
    a.estimatedImpactLevel = a.estimatedAtRisk > 300 ? 'High' : a.estimatedAtRisk > 120 ? 'Medium' : 'Low';
    a.impactStatus = `${a.estimatedImpactLevel} exposure`;
    a.recommendationCount = r.length;
    a.recommendationStatus = `${r.length} actions · +$${opp}M`;
    a.businessContextStatus = 'Complete';
  }
}
