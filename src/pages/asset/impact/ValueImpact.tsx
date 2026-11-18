/** "Asset Value Impact" view (v05 renderAiaValue + valueYearBody). JCA and EU-GPL revenue impact is not modelled. */
import { togglePolicyOn } from '../../../actions/assessment';
import { Waterfall } from '../../../components/charts/ImpactCharts';
import { YearChart, YearLegend } from '../../../components/charts/YearCharts';
import { InfoButton } from '../../../components/common/Common';
import { profile, type Ctx } from '../../../engine/eligibility';
import { fmtB } from '../../../engine/format';
import { REVENUE_POLICIES, usLaunch, valueModel, yearly, type ValueModel } from '../../../engine/impact';
import { ref } from '../../../engine/reference';
import { aia } from '../../../engine/workspace';
import { useAppState } from '../../../store/store';
import type { Asset, PolicyCode } from '../../../types/domain';

function ValueYearBody({ s, asset, m }: { s: Ctx; asset: Asset; m: ValueModel }) {
  const v = aia(asset), p = profile(s, asset), dv = (c: PolicyCode) => m.deltas.find(d => d.code === c)?.val || 0;
  const rows = yearly(s, asset, { IRA: dv('IRA'), MFN: dv('MFN') }, { usL: usLaunch(asset, p), euL: p.launchEU, iraMul: 1, mfnMul: 1 });
  return (
    <>
      <p className="x-desc" style={{ margin: '-4px 0 8px' }}>
        Net revenue and revenue impact by policy, each year ($M) — {v.scenario && v.scenario !== 'Base' ? `${v.scenario.toLowerCase()} scenario` : 'base case'} lifetime {fmtB(m.net)}
      </p>
      <YearLegend rows={rows} />
      <YearChart rows={rows} />
      <div className="small muted" style={{ marginTop: 6 }}>Bar height = revenue before IRA and MFN effects. Axis: $M per year. Illustrative.</div>
    </>
  );
}

export function ValueImpact({ asset }: { asset: Asset }) {
  const s = useAppState();
  const v = aia(asset), m = valueModel(s, asset);
  const toggles = ref().policies.filter(x => REVENUE_POLICIES.includes(x.code)).map(x => {
    const inS = m.exp.includes(x.code), on = inS && v.policiesOn[x.code];
    return (
      <button key={x.code} className={`x-pol-toggle ${on ? '' : 'off'}`} data-aia-pol={x.code} disabled={!inS} aria-pressed={on} onClick={() => togglePolicyOn(x.code, m.exp)}>
        {on ? '✓ ' : ''}{x.code}
      </button>
    );
  });
  return (
    <>
      <div className="x-toolbar"><b>Policies</b>{toggles}</div>
      <div className="x-avi">
        <section className="x-card">
          <h2>
            15 Years Net Revenue <InfoButton label="Net revenue" text="Gross to net, policy by policy. Scenarios rescale it." />{' '}
            <span className="x-tags"><span className="x-tag">ILLUSTRATIVE</span></span>
          </h2>
          <div className="x-chart-legend">
            <span><i style={{ background: '#323a4b' }} />Total</span>
            <span><i style={{ background: '#c4161c' }} />Reduction</span>
          </div>
          <Waterfall m={m} />
        </section>
        <section className="x-card">
          <h2>
            Net revenue by year, policy by policy <InfoButton label="Net revenue by year" text="Net revenue and revenue impact by policy, each year." />{' '}
            <span className="x-tags"><span className="x-tag">ILLUSTRATIVE</span></span>
          </h2>
          <ValueYearBody s={s} asset={asset} m={m} />
        </section>
      </div>
    </>
  );
}
