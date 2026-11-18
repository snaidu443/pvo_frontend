/**
 * Round progress for one file of the AI extraction. The AI service does not report a percentage inside a document, so while a
 * file is being read the ring shows an estimate from the time taken (it slows down and stops at 95%); it shows 100% only when
 * the file is really done.
 */
import type { ExtractionStep } from '../../api';

const ESTIMATE_SECONDS = 60; // about how long a document takes; only the speed of the estimate, never the result

export const ringPercent = (state: ExtractionStep['state'], seconds: number | null): number =>
  state === 'done' ? 100 : state === 'running' ? Math.min(95, Math.round((1 - Math.exp(-(seconds ?? 0) / ESTIMATE_SECONDS)) * 100)) : state === 'failed' ? 100 : 0;

const clock = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;

export function ProgressRing({ label, state, seconds, size = 64 }: { label: string; state: ExtractionStep['state']; seconds: number | null; size?: number }) {
  const pct = ringPercent(state, seconds), stroke = Math.max(4, Math.round(size / 12)), r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const text = state === 'failed' ? '!' : `${pct}%`;
  return (
    <div className={`x-ring ${state}`} role="progressbar" aria-label={`${label} extraction`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="x-ring-dial" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle className="x-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
          <circle className="x-ring-bar" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </svg>
        <span className="x-ring-pct" style={{ fontSize: Math.round(size / 4.6) }}>{text}</span>
      </div>
      <b className="x-ring-label">{label}</b>
      <span className="x-ring-time small muted">
        {state === 'waiting' ? 'Waiting' : state === 'failed' ? 'Failed' : state === 'done' ? 'Done' : 'Reading…'}{seconds != null && state !== 'waiting' ? ` · ${clock(seconds)}` : ''}
      </span>
    </div>
  );
}
