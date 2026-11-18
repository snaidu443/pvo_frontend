/** "Impact by Policy" view (v05 renderAiaPolicy + policyConsiderations + iraConsiderationsTable). */
import type { ReactNode } from 'react';
import { setPolicyView } from '../../../actions/assessment';
import { IraTimeline, IraYearChart } from '../../../components/charts/ImpactCharts';
import { InfoButton } from '../../../components/common/Common';
import { Icon } from '../../../components/common/Icon';
import { LEVER_NAMES, POLICY_ACCENT, POLICY_ICON, QMETA } from '../../../engine/constants';
import { evaluate, exposures, profile, type Ctx } from '../../../engine/eligibility';
import { fmtM } from '../../../engine/format';
import { ansTone, impactFor, iraDates } from '../../../engine/impact';
import { ref } from '../../../engine/reference';
import { aia, assetQuestions, displayName } from '../../../engine/workspace';
import { useAppState } from '../../../store/store';
import type { Asset, Policy, PolicyCode } from '../../../types/domain';

/** Judgment-question considerations for a policy; null when there are none. */
function PolicyConsiderations({ s, asset, code }: { s: Ctx; asset: Asset; code: PolicyCode }) {
  const recs = ref().recommendations;
  const rows = assetQuestions(s, asset).filter(q => (q.policies || []).includes(code));
  if (!rows.length) return null;
  return (
    <>
      <div className="x-sub">Considerations &amp; mitigation strategies</div>
      <div className="x-chart-legend" style={{ margin: '0 0 8px' }}>
        <span><i style={{ background: '#c4161c' }} />Unfavorable for value</span>
        <span><i style={{ background: '#d19520' }} />Partial / Medium</span>
        <span><i style={{ background: '#2f5f8a' }} />Favorable</span>
        <span><i style={{ background: '#8a8f92' }} />Unknown</span>
      </div>
      <table className="x-ctable">
        <thead><tr><th>Consideration</th><th>Answer</th><th>Lever</th><th>Mitigation strategy</th></tr></thead>
        <tbody>
          {rows.map(q => {
            const m = QMETA.find(x => x[0].test(q.text)), rec = m?.[2] ? recs.find(r => r.rank === m[2]) : undefined, ans = q.answer || 'Unknown';
            return (
              <tr key={q.id}>
                <td className="q">{q.text}</td>
                <td><span className={`x-ans-chip ${ansTone(ans, m?.[1] ?? null)}`}>{ans}</span></td>
                <td>{rec ? <span className="x-lever"><b>{rec.rank}</b>{LEVER_NAMES[rec.rank] || rec.title}</span> : <span className="muted">—</span>}</td>
                <td>
                  {rec
                    ? <div className="x-mit"><span className="x-mit-tag">MITIGATION</span><div className="x-mit-t">{rec.title}</div><ul><li>{rec.rationale}</li><li>{rec.detail}</li></ul></div>
                    : <span className="small muted">No mitigation lever applies; this is fixed by the product profile.</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

/** IRA Part II considerations, columns and wording verbatim from the policy framework workbook (feedback slide 10 C2). */
function IraConsiderationsTable() {
  return (
    <table className="x-ctable">
      <thead><tr><th>Question</th><th>Context</th><th>Category Recommendation</th><th>Mitigation Strategy</th></tr></thead>
      <tbody>
        {ref().iraConsiderations.map(q => q.cats.map((c, i) => (
          <tr key={`${q.q}-${i}`}>
            {i === 0 && <><td className="q x-pre" rowSpan={q.cats.length}>{q.q}</td><td className="x-pre" rowSpan={q.cats.length}>{q.context}</td></>}
            <td className="x-pre">{c.cat}</td>
            <td><ul className="x-mit-list">{c.strategies.map((t, k) => <li key={k} className="x-pre">{t}</li>)}</ul></td>
          </tr>
        )))}
      </tbody>
    </table>
  );
}

function TileBottom({ x, val, on }: { x: Policy; val: number; on: boolean }) {
  if (x.code === 'JCA') return on ? <div className="x-tile-bot"><small>AFFECTED BY ASSET</small></div> : null;
  if (x.code === 'EU-GPL') return <div className="x-tile-bot"><small>TOTAL EU-GPL EXCLUSIVITY PERIOD</small><strong>{on ? '11 Years' : '—'}</strong></div>;
  return <div className="x-tile-bot"><small>REVENUE IMPACT</small><strong>{on ? fmtM(val) : '$0M'}</strong></div>;
}

const GPL_PREVIEW = (
  <section className="x-card">
    <h2 style={{ fontSize: 11, letterSpacing: '.04em' }}>EU-GPL PREVIEW <span className="x-tags"><span className="x-tag">ILLUSTRATIVE</span></span></h2>
    <div style={{ fontSize: 15, fontWeight: 800 }}>EU market protection: 11 years</div>
    <div className="x-gpl-bar">
      <span style={{ width: '66.6%', background: 'var(--ink)', justifyContent: 'start', paddingLeft: 9 }}>Baseline 8</span>
      <span style={{ width: '8.3%', background: '#6f7578' }}>+1</span>
      <span style={{ width: '8.3%', background: '#959a9c' }}>+1</span>
      <span style={{ width: '8.3%', background: '#b9bcb9' }}>+1</span>
      <i className="x-gpl-cap" style={{ left: '91.6%' }} />
    </div>
    <div className="x-gpl-labels">
      <span style={{ left: '66.6%' }}>+1 year RMP</span>
      <span style={{ left: '74.9%' }}>+1 year Conditional RMP (Unmet Medical Need)</span>
      <span style={{ left: '83.2%' }}>+1 year Conditional RMP for new indication</span>
    </div>
    <div className="x-gpl-axis"><span>0</span><span>4</span><span>8</span><span>12 yrs</span></div>
  </section>
);

export function PolicyImpact({ asset }: { asset: Asset }) {
  const s = useAppState();
  const im = impactFor(s, asset), exp = exposures(s, asset), name = displayName(asset), p = profile(s, asset), v = aia(asset), d = iraDates(asset, p);
  const policies = ref().policies;
  const pv: PolicyCode = policies.some(x => x.code === v.policyView) && v.policyView ? v.policyView : (exp[0] || 'IRA');
  const drivers = (code: PolicyCode) => v.variables.filter(x => x.policy === code).map(x => x.name).join(' · ');
  const jcaDrivers = [...new Set((evaluate(s, asset).JCA.triggers || []).flat().filter(t => t[1]).map(t => t[0]))].join(' · ');

  const tiles = policies.map(x => {
    const val = im.policyImpact[x.code] || 0, on = exp.includes(x.code);
    return (
      <button
        key={x.code}
        type="button"
        className={`x-tile ${x.code === 'IRA' && on ? 'hi' : ''} ${pv === x.code ? 'sel' : ''}`}
        data-aia-policy={x.code}
        aria-pressed={pv === x.code}
        title={x.implication}
        style={{ boxShadow: `inset 4px 0 0 ${POLICY_ACCENT[x.code]}` }}
        onClick={() => setPolicyView(x.code)}
      >
        <div className="x-tile-top">
          <b style={{ color: POLICY_ACCENT[x.code] }}><Icon name={POLICY_ICON[x.code]} size={14} /> {x.code}</b>
          {!on && <span className="x-lvl none">Not in scope</span>}
        </div>
        <TileBottom x={x} val={val} on={on} />
        {on && <div className="x-tile-drv">Driven by: {(x.code === 'JCA' ? jcaDrivers : drivers(x.code)) || '—'}</div>}
      </button>
    );
  });

  const ira = im.policyImpact.IRA || 0, eff = d.effective, runway = eff && d.launch ? eff - d.launch + 1 : null;
  const pct = im.gross ? Math.round(Math.abs(ira) / im.gross * 100) : 0;
  const iraPanel = (
    <section className="x-card">
      <h2>IRA — what it means for {name} <span className="x-tags"><span className="x-tag">ILLUSTRATIVE</span></span></h2>
      <div className="x-metrics">
        <div className="x-metric"><small>NEGOTIATION <InfoButton label="Negotiation" text="Year the asset may be selected for Medicare negotiation." /></small><strong>{d.negotiation || '—'}</strong></div>
        <div className="x-metric"><small>PRICE EFFECTIVE <InfoButton label="Price effective" text="Year the negotiated price applies." /></small><strong>{eff || '—'}</strong></div>
        <div className="x-metric"><small>FULL-PRICE RUNWAY <InfoButton label="Full-price runway" text="Years at full price before the negotiated price applies." /></small><strong>{runway ? `${runway} yrs` : '—'}</strong></div>
        <div className="x-metric risk"><small>REVENUE IMPACT <InfoButton label="Revenue Impact" text="Lifetime revenue the policy may remove." /></small><strong>{fmtM(ira)} <span>({pct}%)</span></strong></div>
      </div>
      <IraTimeline s={s} asset={asset} d={d} />
      <IraYearChart s={s} asset={asset} p={p} ira={ira} d={d} />
      <div className="x-sub" style={{ marginTop: 0 }}>Considerations &amp; mitigation strategies</div>
      <IraConsiderationsTable />
    </section>
  );

  const info = policies.find(x => x.code === pv), val = im.policyImpact[pv] || 0;
  let main: ReactNode;
  if (!exp.includes(pv)) {
    main = (
      <section className="x-card">
        <h2>{pv} — what it means for {name}</h2>
        <span className="x-lvl none">Not in scope</span>
        <p className="x-desc" style={{ marginTop: 8 }}>{info?.trigger}</p>
      </section>
    );
  } else if (pv === 'IRA') main = iraPanel;
  else if (pv === 'EU-GPL') {
    const hasCons = assetQuestions(s, asset).some(q => (q.policies || []).includes('EU-GPL'));
    main = <>{GPL_PREVIEW}{hasCons && <section className="x-card" style={{ marginTop: 12 }}><PolicyConsiderations s={s} asset={asset} code="EU-GPL" /></section>}</>;
  } else {
    main = (
      <section className="x-card">
        <h2>{pv} — what it means for {name} <span className="x-tags"><span className="x-tag">ILLUSTRATIVE</span></span></h2>
        {pv !== 'JCA' && (
          <div className="x-metrics" style={{ gridTemplateColumns: 'minmax(0,260px)' }}>
            <div className={`x-metric ${val < 0 ? 'risk' : ''}`}><small>REVENUE IMPACT</small><strong>{fmtM(val)}</strong></div>
          </div>
        )}
        <p className="x-desc" style={{ fontSize: 12, lineHeight: 1.6 }}>{info?.summary}</p>
        <div className="evidence-meta"><b>Applies when</b><span>{info?.trigger}</span><b>Implication</b><span>{info?.implication}</span></div>
        <PolicyConsiderations s={s} asset={asset} code={pv} />
      </section>
    );
  }

  return (
    <>
      <div className="x-tiles">{tiles}</div>
      <div className="x-imp" style={{ gridTemplateColumns: '1fr' }}><div>{main}</div></div>
    </>
  );
}
