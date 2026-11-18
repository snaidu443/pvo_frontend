/** Impact charts ported from the v05 HTML (iraTimeline, iraYearChart, waterfallSvg) as JSX SVG. */
import type { Ctx, Profile } from '../../engine/eligibility';
import { fmtB, fmtM } from '../../engine/format';
import { revWindow, usLaunch, yearly, type IraDates, type ValueModel } from '../../engine/impact';
import { displayName } from '../../engine/workspace';
import type { Asset } from '../../types/domain';

/** IRA timeline (feedback slide 9 C4 / slide 11), shown above the revenue graph. */
export function IraTimeline({ s, asset, d }: { s: Ctx; asset: Asset; d: IraDates }) {
  const w = revWindow(s, asset), code = asset.assetCode || displayName(asset), W = 620, H = 124, L = 46, R = 46, line = 76, tiers = [48, 14, 0, 31, 48];
  const X = (y: number) => L + (Math.max(w.y0, Math.min(w.y1, y)) - w.y0) / (w.y1 - w.y0) * (W - L - R);
  const items = ([
    [d.launch, d.launchLabel || d.launch, `${code} FDA approval`, false],
    [d.negotiation, d.negotiationLabel || d.negotiation, `${code} MFP eligibility date`, true],
    [d.publication, d.publication, 'MFP price publication', false],
    [d.effective, d.effective, `${code} MFP effective price change`, true],
    [d.generic, d.generic, 'Generic entry date', false]
  ] as [number | null, string | number | null, string, boolean][]).filter((x): x is [number, string | number, string, boolean] => Number.isFinite(x[0]));
  return (
    <>
      <div className="x-sub" style={{ marginTop: 0 }}>IRA timeline</div>
      <svg className="x-svg x-ira-tl" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="IRA timeline">
        <line x1={L - 20} x2={W - R + 20} y1={line} y2={line} stroke="#17191c" strokeWidth="1.4" />
        {items.map(([y, date, label, star], i) => {
          const ty = tiers[i] ?? 48, below = !ty;
          return (
            <g key={label}>
              <text x={X(y)} y={below ? line + 34 : ty} fontSize="8" fontWeight="700" textAnchor="middle" fill="#17191c">{label}</text>
              {!below && <line x1={X(y)} x2={X(y)} y1={ty + 4} y2={line} stroke="#9aa0a3" />}
              {star
                ? <text x={X(y)} y={line + 5} fontSize="15" textAnchor="middle" fill="#d19520">★</text>
                : <circle cx={X(y)} cy={line} r="3.5" fill="#17191c" />}
              <text x={X(y)} y={line + 20} fontSize="9" fontWeight="800" textAnchor="middle" fill="#b51e2e">{String(date)}</text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

/** "IRA effect, year by year" over the 15-year window (renders nothing without an IRA effect). */
export function IraYearChart({ s, asset, p, ira, d }: { s: Ctx; asset: Asset; p: Profile; ira: number; d: IraDates }) {
  if (!ira || !d.effective) return null;
  const rows = yearly(s, asset, { IRA: ira, MFN: 0 }, { usL: usLaunch(asset, p), euL: p.launchEU, iraMul: 1, mfnMul: 1 });
  const total = Math.round(rows.reduce((t, r) => t + r.ira, 0)), y0 = rows[0].y, y1 = rows[rows.length - 1].y;
  const W = 620, H = 170, L = 40, R = 10, T = 24, B = 22, bw = (W - L - R) / rows.length;
  const maxV = Math.max(50, Math.ceil(Math.max(...rows.map(r => r.gross)) / 50) * 50);
  const Y = (v: number) => T + (H - T - B) * (1 - v / maxV), cx = (y: number) => L + (y - y0) * bw + bw / 2;
  const mark = (y: number | null, label: string, dy: number) => (y != null && y >= y0 && y <= y1 ? (
    <g key={label}>
      <line x1={cx(y)} x2={cx(y)} y1={T - 6} y2={H - B} stroke="#3e4447" strokeDasharray="3 3" />
      <text x={cx(y)} y={dy} fontSize="8" fontWeight="700" textAnchor="middle">{label} {y}</text>
    </g>
  ) : null);
  return (
    <>
      <div className="x-sub" style={{ marginTop: 0 }}>IRA effect, year by year</div>
      <div className="x-chart-legend">
        <span><i style={{ background: '#1f2f55' }} />Revenue retained</span>
        <span><i style={{ background: '#e07a5f' }} />IRA revenue impact (~−${total}M)</span>
        <span style={{ marginLeft: 'auto' }}>$M per year</span>
      </div>
      <svg className="x-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="IRA effect, year by year">
        {[0, maxV / 2, maxV].map(t => (
          <g key={t}>
            <text x={L - 6} y={Y(t) + 3} fontSize="8" textAnchor="end" fill="#6f7578">${Math.round(t)}</text>
            <line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="#ececea" />
          </g>
        ))}
        {rows.map(({ y, gross: v, ira: risk }) => {
          const keep = v - risk, x = L + (y - y0) * bw + bw * 0.15, w = bw * 0.7;
          return (
            <g key={y}>
              <rect x={x} y={Y(keep)} width={w} height={Math.max(0, Y(0) - Y(keep))} fill="#1f2f55"><title>{`${y}: retained $${Math.round(keep)}M`}</title></rect>
              {risk ? <rect x={x} y={Y(v)} width={w} height={Math.max(1, Y(keep) - Y(v))} fill="#e07a5f"><title>{`${y}: IRA revenue impact $${Math.round(risk)}M`}</title></rect> : null}
              <text x={cx(y)} y={H - 8} fontSize="8" textAnchor="middle" fill="#6f7578">{y}</text>
            </g>
          );
        })}
        {mark(d.negotiation, 'Negotiation', 10)}
        {mark(d.effective, 'Price effective', 20)}
      </svg>
      <div className="small muted" style={{ margin: '4px 0 14px' }}>Illustrative: net revenue from the Year 1–15 inputs; the IRA effect applies from the MFP effective price change.</div>
    </>
  );
}

type BarKind = 'total' | 'neg' | 'pos' | 'net';
interface WBar { l: string; t: BarKind; from: number; to: number; val?: number }

const axisLabel = (v: number) => fmtB(v).replace(/0B$/, 'B').replace('.00B', 'B');

/** 15-year net revenue waterfall (gross → IRA → MFN → net). */
export function Waterfall({ m }: { m: ValueModel }) {
  const bars: WBar[] = [{ l: 'Gross', t: 'total', from: 0, to: m.gross }];
  let run = m.gross;
  m.deltas.forEach(d => { const from = run; run += d.val; bars.push({ l: d.code, t: d.val < 0 ? 'neg' : 'pos', val: d.val, from, to: run }); });
  bars.push({ l: 'Net', t: 'net', from: 0, to: m.net });
  const vals = bars.flatMap(b => [b.from, b.to]).filter(x => x > 0);
  const minV = Math.min(...vals.filter(x => x > 0 && x <= m.gross));
  const axis = Math.max(0, Math.floor(Math.min(m.net, minV) * 0.8 / 500) * 500), top = Math.ceil(m.gross * 1.04 / 250) * 250;
  const W = 600, H = 270, L = 46, R = 10, T = 20, B = 40, bw = (W - L - R) / bars.length;
  const Y = (v: number) => T + (H - T - B) * (1 - (Math.max(axis, v) - axis) / (top - axis));
  const col: Record<BarKind, string> = { total: '#323a4b', neg: '#c4161c', pos: '#3aa76d', net: '#17191c' };
  const grid: number[] = [];
  for (let g = axis; g <= top; g += 500) grid.push(g);
  return (
    <>
      <svg className="x-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Lifetime net revenue waterfall">
        {grid.map(g => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={Y(g)} y2={Y(g)} stroke="#ececea" />
            <text x={L - 6} y={Y(g) + 3} fontSize="9" textAnchor="end" fill="#6f7578">{axisLabel(g)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = L + i * bw + bw * 0.2, w = bw * 0.6, y1 = Y(Math.max(b.from, b.to)), y2 = Y(Math.min(b.from, b.to)), h = Math.max(2, y2 - y1);
          const strong = b.t === 'total' || b.t === 'net';
          const label = strong ? fmtB(b.to) : fmtM(b.val ?? 0);
          return (
            <g key={`${b.l}-${i}`}>
              <rect x={x} y={y1} width={w} height={h} fill={col[b.t]} rx="1"><title>{`${b.l}: ${label}`}</title></rect>
              <text x={x + w / 2} y={y1 - 5} fontSize="9.5" fontWeight="700" textAnchor="middle" fill={b.t === 'neg' ? '#b51e2e' : b.t === 'pos' ? '#24734b' : '#17191c'}>{label}</text>
              <text x={x + w / 2} y={H - B + 14} fontSize="9" textAnchor="middle" fontWeight={strong ? 700 : 400} fill="#3e4447">{b.l}</text>
            </g>
          );
        })}
        <line x1={L} x2={W - R} y1={Y(axis)} y2={Y(axis)} stroke="#aeb2b1" />
      </svg>
      <div className="small muted" style={{ marginTop: 4 }}>Axis starts at {fmtB(axis).replace('.00B', 'B').replace(/0B$/, 'B')}</div>
    </>
  );
}
