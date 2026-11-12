/** Settings · Rules engine (v05 renderRulesEngine): read-only catalogue of the current active rules, one policy at a time. */
import type { KeyboardEvent } from 'react';
import { setRulesPolicy } from '../../actions/governance';
import { PageHeading } from '../../components/common/Common';
import { Icon } from '../../components/common/Icon';
import { ref } from '../../engine/reference';
import { useAppState } from '../../store/store';
import type { PolicyRule } from '../../types/domain';
import { openRuleDrawer } from './RuleDrawer';

function CitationStatus({ rule }: { rule: PolicyRule }) {
  const n = rule.citations.length;
  if (n) return <span className="status green">{n} citation{n > 1 ? 's' : ''}</span>;
  return rule.noCitation === 'NA'
    ? <span className="status" title="Based on business knowledge; no policy text to cite">NA</span>
    : <span className="status amber">Pending</span>;
}

export function RulesPage() {
  const s = useAppState(), all = ref().policyRules, monitoring = s.monitoring;
  const rules = all.filter(r => r.policy === s.rulesPolicy);
  const onRowKey = (e: KeyboardEvent, id: string) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); openRuleDrawer(id); }
  };
  return (
    <>
      <PageHeading
        eyebrow="Assets workspace"
        title="Rules engine"
        description="Current active rules from the policy framework, by policy. Select a rule to see its citation and source document."
        icon="eligibility"
      />
      <div className="role-banner">
        <Icon name="eligibility" size={14} />
        <strong>Read-only · current active rules</strong>
        <span className="muted">Rules as of {monitoring?.baselineDate || '—'}, from the policy framework; updated offline. This page never changes the engine.</span>
      </div>
      <div className="compact-kpis">
        {ref().policies.map(p => (
          <button
            key={p.code}
            className={`compact-kpi rules-card ${s.rulesPolicy === p.code ? 'selected' : ''}`}
            data-rules-policy={p.code}
            aria-pressed={s.rulesPolicy === p.code}
            onClick={() => setRulesPolicy(p.code)}
          >
            <span className="kpi-icon"><Icon name="eligibility" /></span>
            <div>
              <div className="kpi-number">{all.filter(r => r.policy === p.code).length}</div>
              <div className="kpi-label">{p.code} · {p.name} rules</div>
            </div>
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="panel-head" style={{ padding: '12px 13px 0', marginBottom: 3 }}>
          <div><h2>{s.rulesPolicy} rules</h2><p>{rules.length} current active rules · select a rule for details</p></div>
        </div>
        <div className="table-wrap">
          <table className="table-compact rules-table">
            <thead><tr><th>Rule ID</th><th>Rule</th><th>Category</th><th>Citations</th></tr></thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} data-rule-row={r.id} tabIndex={0} role="button" aria-label={`Open rule ${r.id}`} onClick={() => openRuleDrawer(r.id)} onKeyDown={e => onRowKey(e, r.id)}>
                  <td><span className="policy-tag">{r.id}</span></td>
                  <td><div className="table-primary">{r.name}</div></td>
                  <td>{r.category}</td>
                  <td><CitationStatus rule={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
