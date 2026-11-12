/** Revenue forecast (v05 revenueChart / revenueSection): Years 1-15 net revenue from the first US launch, editable per year. */
import { editRevenueYear } from '../../actions/assessment';
import { profile } from '../../engine/eligibility';
import { revenueSeries, revWindow, windowYears } from '../../engine/impact';
import { canEditGoverned } from '../../engine/permissions';
import { assetDocs, hasType } from '../../engine/workspace';
import { useAppState } from '../../store/store';
import type { Asset } from '../../types/domain';
import { CommitInput } from '../common/CommitInput';
import { Icon } from '../common/Icon';

export function RevenueChart({ asset }: { asset: Asset }) {
  const s = useAppState();
  const w = revWindow(s, asset), S = revenueSeries(s, asset), p = profile(s, asset), ys = windowYears(w), W = 380, H = 140;
  const maxV = Math.max(100, Math.ceil(Math.max(...S) / 100) * 100), peak = Math.max(...S), pk = ys[S.indexOf(peak)];
  const X = (y: number) => 40 + (y - w.y0) / (w.y1 - w.y0) * (W - 50);
  const Y = (v: number) => H - 18 - (v / maxV) * (H - 34);
  const gen = p.generic, ticks = [0, maxV / 2, maxV];
  return (
    <>
      <div className="x-chart-legend"><span><i style={{ background: 'var(--ink)' }} />Net revenue, Years 1–15</span></div>
      <svg className="x-svg" viewBox={`0 0 ${W} ${H + 6}`} role="img" aria-label="Revenue forecast chart">
        {ticks.map((t, i) => <text key={i} x="32" y={Y(t) + 3} textAnchor="end" fontSize="8" fill="#6f7578">${t}</text>)}
        <line x1="40" y1={H - 18} x2={W - 10} y2={H - 18} stroke="#d7d9d6" />
        <polyline fill="none" stroke="#17191c" strokeWidth="1.8" points={ys.map((y, i) => `${X(y).toFixed(1)},${Y(S[i]).toFixed(1)}`).join(' ')} />
        {gen != null && gen >= w.y0 && gen <= w.y1 && (
          <>
            <line x1={X(gen)} y1="12" x2={X(gen)} y2={H - 18} stroke="var(--red)" strokeDasharray="3 3" />
            <text x={X(gen) - 4} y="18" fontSize="8" fontWeight="700" textAnchor="end" fill="var(--red-deep)">Generic entry</text>
          </>
        )}
        <text x={X(pk)} y={Y(peak) - 5} fontSize="8" fontWeight="700" textAnchor="middle">${Math.round(peak)}M</text>
        {[w.y0, w.y0 + 5, w.y0 + 10, w.y1].map((y, i) => <text key={i} x={X(y)} y={H - 5} fontSize="8" textAnchor="middle" fill="#6f7578">{y}</text>)}
      </svg>
      <div className="small muted">$M per year</div>
    </>
  );
}

export function RevenueSection({ asset }: { asset: Asset }) {
  const s = useAppState();
  const w = revWindow(s, asset), S = revenueSeries(s, asset), ed = canEditGoverned(s.role), fdoc = assetDocs(s, asset).find(d => hasType(d, 'Forecast'));
  return (
    <section className="x-card" style={{ marginBottom: 14 }}>
      <h2>
        <Icon name="trend" /> Revenue forecast{' '}
        <span className="x-tags">
          {fdoc && <span className="x-tag" style={{ textTransform: 'none' }}>Source: {fdoc.name}</span>}
          <span className="x-tag">ILLUSTRATIVE</span>
        </span>
      </h2>
      <div className="x-rev-wrap">
        <div><RevenueChart asset={asset} /></div>
        <div className="x-rev-grid">
          {S.map((v, i) => (
            <label key={i} className="x-rev">
              <span>Year {i + 1} · {w.y0 + i}</span>
              <CommitInput className="input" data-aia-rev={i} value={String(Math.round(v))} inputMode="numeric" readOnly={!ed}
                aria-label={`Net revenue, Year ${i + 1} (${w.y0 + i}), $M`} onCommit={x => editRevenueYear(i, x)} />
            </label>
          ))}
        </div>
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>Net revenue per year, $M. Confirm or edit each year; the impact charts use these values.</p>
    </section>
  );
}
