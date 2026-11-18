/**
 * Rule-based PolicyPilot answers used in mock mode (no AI model is called).
 * In API mode the AgentCore Co-Pilot replaces this via copilotService.
 */
import type { Asset } from '../types/domain';
import { exposures, type Ctx } from './eligibility';
import { recsFor } from './impact';
import { ref } from './reference';

export function chatReply(s: Ctx, a: Asset, q: string): string | null {
  const t = q.toLowerCase(), list = recsFor(s, a), total = list.reduce((x, r) => x + r.value, 0);
  const title = (rank: string, fallback: string) => ref().recommendationCards[rank]?.title || fallback;
  const line = (r: (typeof list)[number]) => `${title(r.rank, r.title)}: +$${r.value}M at stake. ${r.rationale}`;
  const letter = (/recommendation\s+([a-z])\b/.exec(t) || /\brec\.?\s+([a-z])\b/.exec(t) || /^\s*([adgbi])\s*[?.]?\s*$/.exec(t) || [])[1];
  let r = letter ? list.find(x => x.rank.toLowerCase() === letter) : undefined;
  if (!r) {
    const kw: [RegExp, string][] = [[/modalit|small molecule|asset selection/, 'A'], [/sequenc|orphan/, 'D'], [/pre-launch|comparative|head-to-head|differentiation|evidence package/, 'G'], [/post-launch|real-world|rwe/, 'B'], [/\bema\b|\bhta\b|jca timeline|planning/, 'I']];
    const hit = kw.find(k => k[0].test(t));
    if (hit) r = list.find(x => x.rank === hit[1]);
  }
  if (r) return `${line(r)}\n${r.detail}`;
  if (/synerg|trade|cross-policy|combine|mitigation/.test(t)) {
    const exp = exposures(s, a), sy = ref().synergies.filter(x => x.policies.every(c => exp.includes(c)));
    return sy.length
      ? sy.map(x => `${x.kind === 'Tradeoff' ? 'Interdependency' : x.kind}: ${x.text} (${title(x.rank, ref().recommendations.find(y => y.rank === x.rank)?.title || '')})`).join('\n')
      : 'No cross-policy strategies apply to the policies in scope for this asset.';
  }
  if (/total|worth|how much|overall/.test(t)) return `Together the ${list.length} recommendation${list.length === 1 ? '' : 's'} are worth about +$${total}M (illustrative).`;
  if (/top|first|priorit|biggest|most/.test(t)) {
    const x = [...list].sort((p, q2) => q2.value - p.value)[0];
    return x ? `The largest is ${line(x)}` : 'No recommendations are available for this asset.';
  }
  const pol = ref().policies.find(x => t.includes(x.code.toLowerCase()) || (x.code === 'EU-GPL' && /gpl/.test(t)));
  if (pol) {
    const rel = list.filter(x => x.policies.includes(pol.code));
    return `${pol.code} (${pol.name}): ${pol.summary} ${rel.length ? 'Related recommendations: ' + rel.map(x => title(x.rank, x.title)).join('; ') + '.' : 'No recommendation addresses it directly.'}`;
  }
  return null;
}

const VALUE_ANSWER = 'For each in-scope policy the tool applies an illustrative effect, for example a price discount on Medicare-exposed revenue after the price-effective year, to a revenue curve built from peak revenue and launch years. Lifetime values are the sum of the yearly effects. All figures are illustrative, not a forecast.';
const INPUTS_ANSWER = 'Documents to upload: Competitive Intelligence, Trial Protocol Concept Sheet, Clinical Development Plan (CDP) and Forecast Assumptions. Enter the therapeutic modality and launch markets, then confirm the indications, phase and timelines, review the inputs and answer the key assumptions. The more you add, the more the tool can pre-fill.';

/** @param ctxAsset the open asset when the user is on an asset page, else null */
export function pilotReply(s: Ctx, ctxAsset: Asset | null, q: string): string {
  const t = q.toLowerCase();
  const topics: [RegExp, string][] = [
    ...ref().copilot.knowledgeBase.map(k => [new RegExp(k.pattern, k.flags), k.answer] as [RegExp, string]),
    [/value at risk|calculate|revenue (at risk|impact)|how does the (policy|tool)/, VALUE_ANSWER],
    [/input|document|upload|need to run|get started/, INPUTS_ANSWER]
  ];
  const hit = topics.find(x => x[0].test(t));
  if (hit) return hit[1];
  if (ctxAsset && /recommend|mitigat|owner|timing|when|top|priorit|worth|synerg|trade|cross-policy|\brec\b|rank/.test(t)) {
    const r = chatReply(s, ctxAsset, q);
    if (r) return r;
  }
  const pol = ref().policies.find(x => new RegExp('\\b' + x.code.toLowerCase().replace('-', '[- ]?') + '\\b').test(t));
  if (pol) return `${pol.code} (${pol.name}), ${pol.region}: ${pol.summary} Key trigger: ${pol.trigger}. Implication: ${pol.implication}`;
  if (ctxAsset) {
    const r = chatReply(s, ctxAsset, q);
    if (r) return r;
  }
  return 'I can explain the four policies (IRA, MFN, JCA, EU-GPL), eligibility and timelines, how value at risk is calculated, and what inputs you need. On an asset\'s page I can also explain its recommendations.';
}

/** Suggested questions shown under the chat (v07 PolicyPilot starter questions, in the client's order). */
export const pilotChips = () => [...ref().copilot.questionOrder];
