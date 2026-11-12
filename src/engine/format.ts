/** Formatting and small numeric helpers shared by the engine and the UI. */

export const fmtM = (v: number) => `${v < 0 ? '−' : '+'}$${Math.abs(Math.round(v))}M`;
export const fmtB = (v: number) => `$${(v / 1000).toFixed(2)}B`;

export const nowStamp = () => {
  const d = new Date();
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const todayLabel = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}`;
};

/** Parse a number out of a display value such as "$205M" or "2031"; null when empty or invalid. */
export function num(v: unknown): number | null {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null;
}

export const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

