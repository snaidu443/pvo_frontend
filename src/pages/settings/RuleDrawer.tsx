/** Rules engine detail drawer (v05 openRuleDrawer): rule text, citations and governed fields. Read-only. */
import { showRuleInCatalogue } from '../../actions/governance';
import { goPage } from '../../actions/navigation';
import { Icon } from '../../components/common/Icon';
import { governedFieldsForRule, policyRuleById } from '../../engine/monitoring';
import { useAppState } from '../../store/store';
import type { PolicyRule } from '../../types/domain';
import { closeDrawer, openDrawer } from '../../ui/overlay';

/** External link to the official document. Only https URLs from the reference data are rendered. */
function SourceLink({ url }: { url: string }) {
  if (!/^https:\/\//i.test(url)) return null;
  return <a className="link-button" href={url} target="_blank" rel="noopener noreferrer">Open official document <Icon name="chevronRight" size={12} /></a>;
}

function Citations({ rule }: { rule: PolicyRule }) {
  if (!rule.citations.length) {
    return (
      <div className="detail-copy">
        {rule.noCitation === 'NA'
          ? 'Not applicable. This rule is based on business knowledge rather than policy text, so there is no citation.'
          : 'Citation pending.'}
      </div>
    );
  }
  return (
    <>
      {rule.citations.map(c => (
        <div key={c.id} className="compare-value" style={{ marginBottom: 8 }}>
          {c.illustrative && <label>ILLUSTRATIVE</label>}
          <div className="rule-quote">{c.quote}</div>
          <div className="table-secondary" style={{ marginTop: 6 }}>
            {c.doc} <span className="policy-tag">{c.docType}</span> · <SourceLink url={c.url} />
          </div>
        </div>
      ))}
    </>
  );
}

function GovernedFields({ rule }: { rule: PolicyRule }) {
  const s = useAppState(), rows = governedFieldsForRule(s, rule);
  const openGovernance = () => { closeDrawer(); goPage('governance'); };
  return (
    <div className="detail-section">
      <h3>Governed fields used · Source of truth: Inputs and Assumptions</h3>
      <div className="gov-field-list">
        {rows.length ? rows.map(row => (
          <div key={row.name} className="gov-field-row">
            <div className="gov-field-name">{row.name}<span className="gov-field-src">{row.source}</span></div>
            <span className={`status ${row.kind}`}>{row.label}</span>
          </div>
        )) : <div className="gov-field-row"><span className="small muted">No governed fields mapped for this rule.</span></div>}
      </div>
      <div className="action-wrap" style={{ marginTop: 9 }}>
        <button className="button" data-open-governance={rule.policy} onClick={openGovernance}><Icon name="governance" /> Open governed fields</button>
      </div>
    </div>
  );
}

function RuleDrawerBody({ rule }: { rule: PolicyRule }) {
  return (
    <>
      <div className="action-wrap" style={{ marginBottom: 12 }}>
        <span className="policy-tag">{rule.policy}</span>
        <span className="status">{rule.category}</span>
      </div>
      <div className="detail-section" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
        <h3>Rule</h3>
        <div className="detail-copy rule-text">{rule.text}</div>
      </div>
      <div className="detail-section">
        <h3>Citation{rule.citations.length > 1 ? 's' : ''}</h3>
        <Citations rule={rule} />
      </div>
      {rule.inputFields && <GovernedFields rule={rule} />}
    </>
  );
}

/**
 * Open a rule from anywhere. A catalogue rule opens on the Rules engine with its drawer;
 * an engine rule id (e.g. from a decision trace) opens that policy's rule list.
 */
export function openRuleDrawer(id: string): void {
  if (!showRuleInCatalogue(id)) { closeDrawer(); return; }
  const rule = policyRuleById(id)!;
  openDrawer({
    title: rule.name === rule.text ? rule.id : `${rule.id} · ${rule.name}`,
    body: <RuleDrawerBody rule={rule} />,
    footer: (
      <>
        <span className="muted small" style={{ marginRight: 'auto' }}>Read-only. Rules are maintained offline.</span>
        <button className="button" onClick={closeDrawer}>Close</button>
      </>
    ),
    wide: true
  });
}
