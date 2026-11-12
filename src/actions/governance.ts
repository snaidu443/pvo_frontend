/** Policy refresh monitoring and rules-engine actions (both read-only). */
import { policyRuleById, safeDocUrl } from '../engine/monitoring';
import { canManage } from '../engine/permissions';
import { downloadCsv } from '../pages/asset/impact/csv';
import { rulesPolicyChanged } from '../store/slices/uiSlice';
import { dispatch, getState } from '../store/store';
import type { PolicyCode } from '../types/domain';

/* ---------------- policy refresh monitoring ---------------- */

/** "Export documents (CSV)": every new document in data order (as v07). Non-https links are left blank. */
export function exportDocuments() {
  const s = getState(), m = s.monitoring;
  if (!m || !canManage(s.role)) return; // Admin-only page; re-checked here so the export cannot run for other roles
  downloadCsv('pvo-new-policy-documents.csv', [
    ['Policy', 'Publish date', 'Document title', 'Summary', 'Link'],
    ...m.documents.map(d => [d.policy, d.published, d.title, d.summary, safeDocUrl(d.url) ?? ''])
  ]);
}

/* ---------------- rules engine ---------------- */

export const setRulesPolicy = (policy: PolicyCode) => dispatch(rulesPolicyChanged({ policy }));

/**
 * Go to the Rules engine for a rule. A catalogue id shows that rule's policy;
 * an engine rule id (from a decision trace) shows its policy's rule list.
 * Returns true when the id is a catalogue rule (the caller opens its drawer).
 */
export function showRuleInCatalogue(id: string): boolean {
  const s = getState(), rule = policyRuleById(id), policy = rule?.policy || s.rules.find(r => r.id === id)?.policy;
  if (!policy) return false;
  dispatch(rulesPolicyChanged({ policy, open: true }));
  return !!rule;
}
