/**
 * Policy refresh monitoring (v07 EWS) and rules-catalogue helpers. Pure functions.
 * v07 only lists NEW policy documents per pipeline (link + AI summary); there is no
 * comparison with earlier policy text, and nothing here changes rules or assessments.
 */
import type { AppState } from '../store/appState';
import type { MonitoredDocument, PolicyCode, PolicyMonitoring, PolicyRule } from '../types/domain';
import { RULE_FIELD_MAP } from './constants';
import { ref } from './reference';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "17 Oct 2026" → UTC ms (0 when unparseable, so bad dates sort last). Explicit parse: Date() string parsing is engine-specific. */
export function publishedTime(d: Pick<MonitoredDocument, 'published'>): number {
  const m = /^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})$/.exec(d.published.trim()), mon = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  return m && mon >= 0 ? Date.UTC(+m[3], mon, +m[1]) : 0;
}

/** One pipeline's documents, newest first. */
export const documentsForPolicy = (m: PolicyMonitoring, policy: PolicyCode): MonitoredDocument[] =>
  m.documents.filter(d => d.policy === policy).sort((a, b) => publishedTime(b) - publishedTime(a));

export const newDocumentCount = (m: PolicyMonitoring | null) => (m ? m.documents.length : 0);

/** Date part of "27 Oct 2026 · 06:00" (top-bar pill). */
export const lastRefreshDate = (m: PolicyMonitoring | null) => (m?.lastRefresh.split(' · ')[0] || '—');

/** Document links come from pipeline data: only absolute https: URLs are rendered or exported; anything else yields null. */
export function safeDocUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}

/* ---------------- rules catalogue ---------------- */

export const policyRuleById = (id: string | null | undefined): PolicyRule | undefined => (id ? ref().policyRules.find(r => r.id === id) : undefined);

export interface GovernedFieldRow { name: string; source: string; kind: 'red' | 'amber' | 'green'; label: string }

/** Governed Inputs-and-Assumptions fields a rule reads, with their review status. */
export function governedFieldsForRule(s: Pick<AppState, 'fields'>, rule: PolicyRule): GovernedFieldRow[] {
  return [...new Set((rule.inputFields || []).map(key => RULE_FIELD_MAP[key]).filter(Boolean))].map(name => {
    const field = s.fields.find(f => f.field === name), status: string = field ? field.status : 'Not mapped';
    return {
      name,
      source: field ? field.source : 'No governed record yet',
      kind: ['Conflict', 'Missing'].includes(status) ? 'red' : ['Needs review', 'Not mapped'].includes(status) ? 'amber' : 'green',
      label: ['AI-extracted', 'Edited'].includes(status) ? 'Governed' : status
    };
  });
}
