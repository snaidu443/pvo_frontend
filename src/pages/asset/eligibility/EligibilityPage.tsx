/** Eligibility tab (v03 renderAiaEligibility). */
import { runImpact, selectCheck, setJcaIndication } from '../../../actions/assessment';
import { InfoButton } from '../../../components/common/Common';
import { Icon } from '../../../components/common/Icon';
import { eligibilityRules, evaluate, linkedRuleCount, profile, type EligibilityResult, type PolicyResult } from '../../../engine/eligibility';
import { num } from '../../../engine/format';
import { ref } from '../../../engine/reference';
import { aia, displayName } from '../../../engine/workspace';
import { useAppState } from '../../../store/store';
import type { Asset, PolicyCode } from '../../../types/domain';
import { AssetPageHeading, AssetSubNav } from '../AssetFrame';
import { openCheckDrawer } from './CheckDrawer';
import { openDecisionTrace, traceOf } from './DecisionTrace';

type StepCode = 'IRA' | 'MFN' | 'EU-GPL';

const onCheck = (key: string) => {
  selectCheck(key);
  openCheckDrawer(key);
};

const stepLabel = (st: string) => (st === 'pass' ? 'Pass' : st === 'fail' ? 'Not met' : '—');

export function Eligibility({ asset }: { asset: Asset }) {
  const s = useAppState();
  const r = evaluate(s, asset), name = displayName(asset), v = aia(asset), p = profile(s, asset), trace = traceOf(s, asset.id);
  const policies = ref().policies;

  const since = (code: PolicyCode) => {
    const y = code === 'IRA' || code === 'MFN' ? (p.launchUS ? p.launchUS + 4 : null) : code === 'JCA' ? (num(p.inds[r.JCA.firstInd]?.launchEU) ?? p.launchEU) : p.launchEU;
    return y ? ` since ${y}` : '';
  };
  const chip = (x: Pick<PolicyResult, 'verdict' | 'chip' | 'tier'>, code: PolicyCode) => {
    if (x.verdict === 'pass') {
      const partial = code === 'EU-GPL' && x.tier === 'partial';
      return <span className={`status ${partial ? 'amber' : 'red'}`}>✓ Pass — {code === 'EU-GPL' ? (partial ? 'partially in scope' : 'fully in scope') : 'in scope'}{since(code)}</span>;
    }
    if (x.verdict === 'fail') return <><span className="status green">Did not pass</span>{x.chip && <span className="status">{x.chip}</span>}</>;
    return <span className="status amber">{x.chip}</span>;
  };
  const foot = (code: PolicyCode) => {
    const traced = s.rules.filter(x => x.policy === code && trace.firedRules?.includes(x.id)), rules = traced.length ? traced : eligibilityRules(s, code);
    const fired = r[code].verdict === 'pass' ? rules.map(x => x.code).join(', ') : '';
    const ver = s.policyVersions.find(x => x.id === trace.activePolicyVersions?.[code]);
    return (
      <div className="logic-foot">
        <span className="small muted">Rules fired: {fired || 'No linked rule fired'} · Policy version {ver?.versionLabel || 'Pending'}</span>
        <button className="link-button" data-action="view-trace" data-policy={code} onClick={() => openDecisionTrace(code)}>Trace &amp; evidence <Icon name="chevronRight" size={12} /></button>
      </div>
    );
  };
  const head = (code: PolicyCode) => {
    const pol = policies.find(x => x.code === code);
    return (
      <div className="logic-summary" style={{ cursor: 'default' }}>
        <div>
          <h3><span className="policy-code" style={{ marginRight: 7 }}>{code}</span>{pol?.name} <InfoButton label={code} text={pol?.summary || ''} /></h3>
          <div className="logic-subtitle">{pol?.region} · {r[code].verdict === 'pass' ? 'Applicable to selected asset' : 'Not applicable to selected asset'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{chip(r[code], code)}</div>
      </div>
    );
  };
  const stepCard = (code: StepCode) => {
    const steps = (r as EligibilityResult)[code].steps;
    return (
      <section className="panel logic-policy x-logic" style={{ marginBottom: 9 }}>
        {head(code)}
        <div className="logic-body">
          <div className="logic-flow" style={{ gridTemplateColumns: `repeat(${Math.max(steps.length, 5)},minmax(0,1fr))` }}>
            {steps.map((st, i) => {
              const key = `${code}-${i}`;
              return (
                <button key={key} type="button" className={`logic-step ${st.state === 'grey' ? 'locked' : st.state} ${v.check === key ? 'sel' : ''}`} data-elig-check={key} onClick={() => onCheck(key)}>
                  <div className="logic-step-number">{String(i + 1).padStart(2, '0')} · {stepLabel(st.state)}</div>
                  <div className="logic-step-label">{st.label}</div>
                  <div className="logic-step-value">{st.value}</div>
                </button>
              );
            })}
          </div>
          {foot(code)}
        </div>
      </section>
    );
  };

  const trig = r.JCA.triggers[v.jcaInd] || r.JCA.triggers[0] || [];
  const jca = (
    <section className="panel logic-policy x-logic" style={{ marginBottom: 9 }}>
      {head('JCA')}
      <div className="logic-body">
        <div className="x-jca-row" style={{ marginTop: 0 }}>
          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <b>Indication</b>
            <select className="select" data-jca-ind value={v.jcaInd} onChange={e => setJcaIndication(Number(e.target.value))}>
              {p.inds.map((ind, i) => <option key={ind.id ?? i} value={i}>{i + 1} · {ind.name || 'New indication'}</option>)}
            </select>
          </label>
          <span className="small" style={{ fontWeight: 700 }}>Any one = in scope <InfoButton label="JCA scope" text="Any one trigger brings the indication into JCA scope." /></span>
        </div>
        <div className="logic-flow">
          {trig.map((t, i) => {
            const key = `JCA-${i}`;
            return (
              <button key={key} type="button" className={`logic-step ${t[1] ? 'pass' : ''} ${v.check === key ? 'sel' : ''}`} data-elig-check={key} onClick={() => onCheck(key)}>
                <div className="logic-step-number">{String(i + 1).padStart(2, '0')} · {t[1] ? 'Triggers' : '—'}</div>
                <div className="logic-step-label">{t[0]}</div>
              </button>
            );
          })}
        </div>
        {foot('JCA')}
      </div>
    </section>
  );

  const exp = policies.map(x => x.code).filter(c => r[c].verdict === 'pass');
  const scope = (
    <section className="panel pad x-scope-bar">
      <div>
        <h3 style={{ margin: '0 0 8px', fontSize: 13 }}><Icon name="check" size={15} /> {name} is in scope for:</h3>
        <div className="chips">
          {exp.length
            ? exp.map(c => <span key={c} className="chip">{c === 'JCA' ? `JCA (Indication ${r.JCA.firstInd + 1})` : c === 'EU-GPL' && r['EU-GPL'].tier === 'partial' ? 'EU-GPL (partially)' : c}</span>)
            : <span className="small muted">—</span>}
        </div>
      </div>
      <div className="x-legend" style={{ margin: 0 }}>
        <b>How to read the checks</b>
        <span><span className="lg lg-pass">Pass</span> the asset meets this check</span>
        <span><span className="lg lg-fail">Not met</span> the asset does not meet it, so the policy does not apply</span>
        <span><span className="lg lg-grey">Not evaluated</span> skipped because an earlier check was not met</span>
        <span className="muted" style={{ width: '100%' }}>A policy is in scope only when all its checks pass. For JCA and EU-GPL, any one trigger is enough.</span>
      </div>
    </section>
  );

  return (
    <>
      <AssetPageHeading
        asset={asset}
        title={`Is ${name} in scope?`}
        description="Select a check for detail."
        actions={<span className="status blue">{linkedRuleCount(s, asset)} linked rules</span>}
        icon="eligibility"
      />
      <AssetSubNav asset={asset} />
      <div className="banner info" style={{ marginBottom: 11 }}>
        <Icon name="info" />
        <div><strong>Deterministic eligibility.</strong> A failed prerequisite blocks downstream logic; pending evidence remains a human-review decision.</div>
      </div>
      {scope}
      {stepCard('IRA')}
      {stepCard('MFN')}
      {jca}
      {stepCard('EU-GPL')}
      <div className="x-foot"><span></span><button className="button primary x-cta" data-aia="run-impact" onClick={() => { void runImpact(); }}>Run impact analysis →</button></div>
    </>
  );
}
