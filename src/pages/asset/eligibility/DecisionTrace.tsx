/** Decision-trace drawer (v05 renderPolicyTrace / renderDecisionTrace / policyOfLog). */
import { subjectOf } from '../../../actions/core';
import { checkDetail, eligibilityRules, evaluate } from '../../../engine/eligibility';
import { ref } from '../../../engine/reference';
import type { AppState } from '../../../store/appState';
import { useAppState } from '../../../store/store';
import type { DecisionTrace, PolicyCode } from '../../../types/domain';
import { closeDrawer, openDrawer } from '../../../ui/overlay';
import { openRuleDrawer } from '../../settings/RuleDrawer';

export const policyOfLog = (text: string): PolicyCode | null => {
  const m = /^(IRA|MFN|JCA|EU-GPL):/.exec(String(text));
  return m ? (m[1] as PolicyCode) : null;
};

const versionOf = (s: AppState, id: string | undefined) => (id ? s.policyVersions.find(v => v.id === id) : undefined);

/** The asset's decision trace (falls back to the reference trace, as v03 fell back to state.decisionTrace). */
export const traceOf = (s: AppState, assetId: string): DecisionTrace => s.decisionTraces[assetId] ?? ref().initialDecisionTrace;

/** Rule buttons in the trace open that policy's rules in the Rules engine. */
const openRule = (id: string) => openRuleDrawer(id);

function PolicyTrace({ code }: { code: PolicyCode }) {
  const s = useAppState(), a = subjectOf(s);
  if (!a?.aia) return null;
  const t = traceOf(s, a.id), pol = ref().policies.find(p => p.code === code), r = evaluate(s, a), res = r[code], ver = versionOf(s, t.activePolicyVersions?.[code]);
  const inPolicy = (id: string) => s.rules.find(x => x.id === id)?.policy === code;
  const traced = s.rules.filter(x => x.policy === code && t.firedRules.includes(x.id));
  const fired = res.verdict === 'pass' ? (traced.length ? traced : eligibilityRules(s, code)) : [];
  const skipped = t.skippedRules.filter(inPolicy), failed = t.failedRules.filter(inPolicy);
  const verdict = res.verdict === 'pass' ? 'In scope' : res.verdict === 'fail' ? `Not in scope${res.chip ? ' · ' + res.chip : ''}` : (res.chip || 'Pending');
  const jcaSource = 'Inputs confirmed on Inputs and Assumptions';
  const checks = code === 'JCA'
    ? (r.JCA.triggers[a.aia.jcaInd] || r.JCA.triggers[0] || []).map((x, i) => (
      <div key={i} className="timeline-item"><div>{x[0]}: <strong>{x[1] ? 'Triggers' : 'Not triggered'}</strong><span>Source: {jcaSource}</span></div></div>
    ))
    : r[code].steps.map((st, i) => {
      const det = checkDetail(s, a, r, `${code}-${i}`);
      return (
        <div key={i} className="timeline-item">
          <div>
            {st.label}: {st.value} · <strong>{st.state === 'pass' ? 'Met' : st.state === 'fail' ? 'Not met' : (code === 'EU-GPL' ? 'Not triggered' : 'Not evaluated')}</strong>
            <span>Source: {det?.source || 'Inputs confirmed on Inputs and Assumptions'}</span>
          </div>
        </div>
      );
    });
  const log = t.explanationLog.filter(x => policyOfLog(x) === code).map(x => x.replace(/^[A-Z-]+:\s*/, ''));
  return (
    <>
      <div className="banner info">
        <span className="status blue">{code}</span>
        <div>
          <strong>{pol?.name} · {t.assetId}</strong><br />
          Result: {verdict}<br />
          Policy version: {ver?.versionLabel || 'Pending'} · Rules fired: {fired.length} · Skipped: {skipped.length} · Failed: {failed.length}
        </div>
      </div>
      <div className="detail-section">
        <h3>{code} eligibility checks &amp; evidence</h3>
        <div className="timeline">{checks.length ? checks : <div className="small muted">No checks evaluated.</div>}</div>
      </div>
      <div className="detail-section">
        <h3>{code} rule trace</h3>
        <div className="trace-list">
          {fired.map(x => <button key={x.id} className="trace-item" data-open-rule={x.id} onClick={() => openRule(x.id)}>Rule fired · {x.code}</button>)}
          {skipped.map(id => <span key={id} className="trace-item">Rule skipped · {id}</span>)}
          {failed.map(id => <span key={id} className="trace-item">Rule failed · {id}</span>)}
          {fired.length + skipped.length + failed.length ? null : <span className="small muted">No rules recorded for this policy.</span>}
        </div>
      </div>
      <div className="detail-section">
        <h3>{code} explanation log</h3>
        {log.length ? log.map((x, i) => <div key={i} className="timeline-item"><div>{x}</div></div>) : <div className="small muted">No policy-specific log entries.</div>}
      </div>
    </>
  );
}

function FullTrace() {
  const s = useAppState(), a = subjectOf(s);
  if (!a) return null;
  const t = traceOf(s, a.id);
  const versions = Object.entries(t.activePolicyVersions).map(([policy, id]) => `${policy} ${versionOf(s, id)?.versionLabel?.split(' ').slice(-1)[0] || 'current'}`).join(' · ');
  return (
    <>
      <div className="banner info">
        <span className="status blue">Deterministic output</span>
        <div>
          <strong>Decision trace · {t.assetId}</strong><br />
          Policy versions: {versions} · Fired: {t.firedRules.length} · Skipped: {t.skippedRules.length} · Failed: {t.failedRules.length}
          <div style={{ marginTop: 5 }}>{t.outputSummary}</div>
        </div>
      </div>
      <div className="detail-section">
        <h3>Rule trace</h3>
        <div className="trace-list">
          {t.firedRules.map(id => <button key={id} className="trace-item" data-open-rule={id} onClick={() => openRule(id)}>Rule fired · {id}</button>)}
          {t.skippedRules.map(id => <span key={id} className="trace-item">Rule skipped · {id}</span>)}
          {t.failedRules.map(id => <span key={id} className="trace-item">Rule failed · {id}</span>)}
        </div>
      </div>
      <div className="detail-section">
        <h3>Explanation log</h3>
        {t.explanationLog.map((x, i) => <div key={i} className="timeline-item"><div>{x}</div></div>)}
      </div>
    </>
  );
}

/** "Trace & evidence" (policy given) or "Decision trace" (no policy). */
export function openDecisionTrace(code?: string) {
  const pc = code && ref().policies.some(p => p.code === code) ? (code as PolicyCode) : null;
  openDrawer({
    title: pc ? `${pc} · Trace & evidence` : 'Decision trace',
    body: pc ? <PolicyTrace code={pc} /> : <FullTrace />,
    footer: <button className="button" onClick={closeDrawer}>Close</button>
  });
}
