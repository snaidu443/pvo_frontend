/** Asset Impact Analysis · Scenario Analysis (v05 renderAiaScenarioPage / renderAiaScenario). */
import { addScenarioRow, removeScenarioRow, resetScenario, saveScenario, setScenarioValue, setScenarioVariable } from '../../../actions/assessment';
import { Timeline, YearChart, YearLegend } from '../../../components/charts/YearCharts';
import { PolicyPills } from '../../../components/common/Common';
import { Icon } from '../../../components/common/Icon';
import { fmtB, fmtM } from '../../../engine/format';
import { iraDates, revWindow, SCN_MAX, SCN_VARS, scenarioCompute, type ScnKey, type ScnValues, type ScnVar, type YearRow } from '../../../engine/impact';
import { canEdit } from '../../../engine/permissions';
import { aia } from '../../../engine/workspace';
import { useAppState } from '../../../store/store';
import type { Asset } from '../../../types/domain';
import { AiaHeading, AssetSubNav } from '../AssetFrame';

const GPL_BAR = (
  <>
    <div className="x-gpl-bar" style={{ height: 22, margin: '12px 0 4px' }}>
      <span style={{ width: '66.6%', background: '#3b4a9c', justifyContent: 'start', paddingLeft: 9 }}>Baseline 8</span>
      <span style={{ width: '8.3%', background: '#6f7578' }}>+1</span>
      <span style={{ width: '8.3%', background: '#b9bcb9' }}>+1</span>
      <i className="x-gpl-cap" style={{ left: '91.6%' }} />
    </div>
    <div className="x-gpl-axis"><span>0</span><span>4</span><span>8</span><span>11 yrs</span></div>
  </>
);

function ScenarioBody({ asset }: { asset: Asset }) {
  const s = useAppState();
  const c = scenarioCompute(s, asset), { p, b, sc, rb, rs, nb, ns, rowsK } = c, v = aia(asset), ed = canEdit(s.role), ira = iraDates(asset, p), w = revWindow(s, asset);
  const top = (r: YearRow) => r.net + r.ira + r.mfn;
  const maxV = Math.max(50, Math.ceil(Math.max(...rb.map(top), ...rs.map(top)) / 50) * 50);
  const def = (k: ScnKey) => SCN_VARS.find(x => x.k === k)!;
  const optsOf = (d: ScnVar) => {
    const l = [...new Set([...d.opts(b), b[d.k]])];
    return typeof b[d.k] === 'number' ? (l as number[]).sort((x, y) => x - y) : l;
  };
  const tl = (x: ScnValues) => {
    const sh = x.usL - b.usL, at = (y: number | null) => (y == null ? NaN : y + sh);
    return (
      <Timeline w={w} items={[
        { y: at(ira.launch), label: 'US launch', up: true, hi: sh !== 0 },
        { y: at(ira.negotiation), label: 'IRA negotiation', up: true, hi: sh !== 0 },
        { y: x.euL, label: 'EU launch', up: false, hi: x.euL !== b.euL },
        { y: at(ira.effective), label: 'IRA price effective', up: false, hi: sh !== 0 }
      ].filter(it => Number.isFinite(it.y))} />
    );
  };
  const col = (rows: YearRow[], tlx: React.ReactNode, head: string) => (
    <>
      <YearLegend rows={rows} />
      <YearChart rows={rows} W={480} H={190} maxV={maxV} label={head} />
      <div className="x-scn-sub">IRA / MFN applicability timeline</div>
      {tlx}
      <div className="x-scn-sub">EU-GPL marketing authorization timeline</div>
      {GPL_BAR}
    </>
  );
  const dN = ns - nb;
  const saved = v.savedScenarios || [];

  return (
    <>
      <div className="x-toolbar">
        <b style={{ fontSize: 14 }}>Scenario analysis</b>
        <span className="small muted">Pick up to {SCN_MAX} inputs to test and see the effect against the base-case inputs, side by side.</span>
        <span className="x-tag" style={{ marginLeft: 'auto' }}>ILLUSTRATIVE</span>
        <button className="button" onClick={resetScenario}>Reset to base</button>
        {ed && <button className="button primary" onClick={saveScenario}>Save scenario</button>}
      </div>
      <div className="x-scn">
        <section className="x-card">
          <h3 className="x-scn-h">Base case <span>· your inputs from Inputs and Assumptions</span></h3>
          {rowsK.map(k => {
            const d = def(k);
            return (
              <div key={k} className="x-scn-row">
                <span className="x-scn-l">{d.l}</span>
                <span className="x-scn-v">{d.fmt(b[k])}</span>
                <span><PolicyPills items={d.ch} /></span>
              </div>
            );
          })}
          <div className="x-scn-row">
            <span className="x-scn-l" style={{ background: '#e8eaee', color: '#17191c' }}>Net lifetime value</span>
            <span className="x-scn-v" style={{ background: '#f4f4f2' }}>{fmtB(nb)}</span>
            <span className="small muted">{Math.round(nb / (c.tot.gross || 1) * 100)}% of {fmtB(c.tot.gross)} gross</span>
          </div>
          {col(rb, tl(b), 'Base case net revenue by year')}
        </section>
        <section className="x-card">
          <h3 className="x-scn-h dark">Scenario testing <span>· choose a variable, then change its value</span></h3>
          {rowsK.map((k, i) => {
            const d = def(k), changed = sc[k] !== b[k], dl = changed ? c.single(k) : 0;
            const numeric = typeof b[k] === 'number', sv = sc[k] as number, bv = b[k] as number;
            const diff = changed
              ? <span style={{ fontWeight: 700, color: dl < 0 ? 'var(--red-deep)' : 'var(--green)' }}>{numeric ? `${sv > bv ? '▲ +' : '▼ −'}${Math.abs(sv - bv)} ${d.u} · ` : ''}{fmtM(dl)}</span>
              : <span className="small muted">unchanged</span>;
            return (
              <div key={k} className="x-scn-row x4">
                <select className="select x-scn-varsel" aria-label={`Variable to test ${i + 1}`} value={k} onChange={e => setScenarioVariable(i, e.target.value)}>
                  {SCN_VARS.map(o => <option key={o.k} value={o.k} disabled={rowsK.includes(o.k) && o.k !== k}>{o.l}</option>)}
                </select>
                <select className={`select ${changed ? 'x-scn-chg' : ''}`} aria-label={d.l} value={String(sc[k])} onChange={e => setScenarioValue(k, e.target.value)}>
                  {optsOf(d).map(o => <option key={String(o)} value={String(o)}>{d.fmt(o)}</option>)}
                </select>
                {diff}
                <button type="button" className="icon-action" aria-label="Remove this variable" disabled={rowsK.length <= 1} onClick={() => removeScenarioRow(i)}><Icon name="close" size={13} /></button>
              </div>
            );
          })}
          {rowsK.length < SCN_MAX
            ? <button type="button" className="x-add" onClick={addScenarioRow}><Icon name="plus" size={13} /> Add a variable to test ({rowsK.length} of {SCN_MAX})</button>
            : <span className="small muted">Maximum of {SCN_MAX} variables</span>}
          <div className="x-scn-row" style={{ marginTop: 8 }}>
            <span className="x-scn-l" style={{ background: '#e8eaee', color: '#17191c' }}>Net lifetime value</span>
            <span className={`x-scn-v ${dN ? 'chg' : ''}`}>{fmtB(ns)}</span>
            <span style={{ fontWeight: 700, color: dN < 0 ? 'var(--red-deep)' : dN > 0 ? 'var(--green)' : 'var(--muted)' }}>
              {dN ? `${fmtM(dN)} (${dN < 0 ? '−' : '+'}${Math.abs(Math.round(dN / nb * 100))}%) vs. base` : 'same as base'}
            </span>
          </div>
          {col(rs, tl(sc), 'Scenario net revenue by year')}
        </section>
      </div>
      {saved.length > 0 && (
        <section className="x-card" style={{ marginTop: 14 }}>
          <h2>Saved scenarios</h2>
          {saved.map((x, i) => (
            <div key={i} className="cta-row">
              <div><div className="cta-title">{x.name}</div><div className="cta-note">{x.by} · {x.time}</div></div>
              <span className={`status ${x.delta < 0 ? 'red' : 'green'}`}>{fmtM(x.delta)} vs. base</span>
            </div>
          ))}
        </section>
      )}
      <div className="small muted" style={{ marginTop: 8 }}>Illustrative model: changing a variable rescales the policy effect or revenue and shifts the launch, negotiation and price-effective years. Not a forecast.</div>
    </>
  );
}

export function ScenarioAnalysis({ asset }: { asset: Asset }) {
  return (
    <>
      <AiaHeading asset={asset} title="Scenario Analysis" />
      <AssetSubNav asset={asset} />
      <ScenarioBody asset={asset} />
    </>
  );
}
