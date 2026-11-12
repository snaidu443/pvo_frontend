/** Yearly revenue chart, its legend and the applicability timeline (v05 yearChartSvg / yearLegend / timelineSvg). */
import { Fragment } from 'react';
import type { RevWindow, YearRow } from '../../engine/impact';
import { fmtM } from '../../engine/format';

type StackKey = 'net' | 'ira' | 'mfn';
const STACK: StackKey[] = ['net', 'ira', 'mfn'];
const COL: Record<StackKey, string> = { net: '#1f2f55', ira: '#e07a5f', mfn: '#8b5fc9' };
const NM: Record<StackKey, string> = { net: 'Net revenue', ira: 'IRA', mfn: 'MFN' };

/** Legend above a yearly chart: net revenue plus each policy with a material lifetime effect. */
export function YearLegend({ rows }: { rows: YearRow[] }) {
  const sum = (k: StackKey) => rows.reduce((t, r) => t + r[k], 0);
  const items: [StackKey, string, string, number | ''][] = (
    [['net', 'Net revenue', COL.net, ''], ['ira', 'IRA', COL.ira, sum('ira')], ['mfn', 'MFN', COL.mfn, sum('mfn')]] as [StackKey, string, string, number | ''][]
  ).filter(x => x[0] === 'net' || (x[3] as number) > 0.5);
  return (
    <div className="x-chart-legend">
      {items.map(x => (
        <span key={x[0]}><i style={{ background: x[2] }} />{x[1]}{x[3] === '' ? '' : ` ${fmtM(-x[3])}`}</span>
      ))}
    </div>
  );
}

/** Stacked bars per year (net revenue + revenue lost to IRA and MFN). */
export function YearChart({ rows, W = 620, H = 270, maxV, label }: { rows: YearRow[]; W?: number; H?: number; maxV?: number; label?: string }) {
  const L = 38, R = 10, T = 14, B = 22, n = rows.length, bw = (W - L - R) / (n || 1);
  const top = (r: YearRow) => r.net + r.ira + r.mfn;
  const max = maxV || Math.max(50, Math.ceil(Math.max(...rows.map(top)) / 50) * 50);
  const Y = (v: number) => T + (H - T - B) * (1 - v / max);
  const cx = (i: number) => L + i * bw + bw / 2;
  return (
    <svg className="x-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label || 'Net revenue by year'}>
      {[0, 0.25, 0.5, 0.75, 1].map(fr => {
        const v = max * fr;
        return (
          <Fragment key={fr}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#ececea" />
            <text x={L - 6} y={Y(v) + 3} fontSize="8" textAnchor="end" fill="#6f7578">${Math.round(v)}</text>
          </Fragment>
        );
      })}
      {rows.map((r, i) => {
        let acc = 0;
        const x = L + i * bw + bw * 0.14, w = bw * 0.72;
        return (
          <Fragment key={r.y}>
            {STACK.map(k => {
              const h = r[k];
              if (!(h > 0)) return null;
              const y1 = Y(acc + h), y2 = Y(acc);
              acc += h;
              return (
                <rect key={k} x={x} y={y1} width={w} height={Math.max(0.5, y2 - y1)} fill={COL[k]}>
                  <title>{`${r.y} · ${NM[k]}: $${Math.round(h)}M`}</title>
                </rect>
              );
            })}
            <text x={cx(i)} y={H - 8} fontSize="8" textAnchor="middle" fill="#6f7578">{r.y}</text>
          </Fragment>
        );
      })}
    </svg>
  );
}

/** Horizontal axis over the 15-year window with labelled milestones above/below; highlighted items are amber/red. */
export function Timeline({ items, w, W = 480 }: { items: { y: number; label: string; up: boolean; hi: boolean }[]; w: RevWindow; W?: number }) {
  const y0 = w.y0, y1 = w.y1, L = 26, R = 26, H = 76;
  const X = (y: number) => L + (Math.max(y0, Math.min(y1, y)) - y0) / (y1 - y0) * (W - L - R);
  return (
    <svg className="x-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Applicability timeline">
      <line x1={L - 10} x2={W - R + 10} y1="38" y2="38" stroke="#17191c" strokeWidth="1.4" />
      {items.map((it, i) => (
        <Fragment key={i}>
          <circle cx={X(it.y)} cy="38" r="4" fill={it.hi ? '#d19520' : '#17191c'} />
          <text x={X(it.y)} y={it.up ? 20 : 62} fontSize="8" textAnchor="middle" fill="#6f7578">{it.label}</text>
          <text x={X(it.y)} y={it.up ? 30 : 72} fontSize="9" fontWeight="800" textAnchor="middle" fill={it.hi ? '#b51e2e' : '#17191c'}>{String(it.y)}</text>
        </Fragment>
      ))}
    </svg>
  );
}
