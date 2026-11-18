/** Editors for the consolidated input catalogue (v07 v6Editor, v6SeriesTable, v6Status, v6SrcCell). */
import { setInput, type InputTarget } from '../../../actions/assessment';
import { setGovView } from '../../../actions/navigation';
import { CommitInput } from '../../../components/common/CommitInput';
import { Icon } from '../../../components/common/Icon';
import type { Asset } from '../../../types/domain';
import { MONTHS } from '../../../engine/impact';
import { DOC_SOURCES, EU_REFERENCE_COUNTRIES, INPUT_COND_LABEL, INPUT_SOURCE_LABEL, indValues, isEmptyValue, str, type InputItem } from '../../../engine/inputCatalogue';
import { hiddenRegion, isMissing, type InputRow, type RowValue, type YearMonth } from '../../../engine/inputs';

type Series = (number | null)[] | undefined;

export const targetOf = (r: Pick<InputRow, 'it' | 'ind' | 'ci'>): InputTarget => ({ key: r.it.k, indId: r.ind?.id, compIndex: r.ci });

const fmtNum = (v: number | null | undefined) => (v == null ? '—' : Number(v).toLocaleString('en-US'));
const seriesSummary = (arr: Series) => (arr && arr.length ? `Y1 ${fmtNum(arr[0])} … Y15 ${fmtNum(arr[14] ?? arr[arr.length - 1])}` : 'Not provided');

/** Year 1-15 table; editable cells commit one year at a time. */
function SeriesTable({ rows, unit, target }: { rows: [string, Series, string?][]; unit: string; target?: InputTarget }) {
  return (
    <>
      <div className="table-wrap">
        <table className="x-series">
          <thead><tr><th />{Array.from({ length: 15 }, (_, i) => <th key={i}>Y{i + 1}</th>)}</tr></thead>
          <tbody>
            {rows.map(([name, arr, country]) => (
              <tr key={name}>
                <td>{name}</td>
                {Array.from({ length: 15 }, (_, i) => {
                  const v = arr?.[i];
                  return (
                    <td key={i}>
                      {target ? (
                        <CommitInput className="input" value={v == null ? '' : String(v)} inputMode="decimal" aria-label={`${name} Year ${i + 1}`}
                          onCommit={raw => setInput(target, { kind: 'year', index: i, raw, country })} />
                      ) : fmtNum(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="small muted" style={{ marginTop: 4 }}>Unit: {unit}</div>
    </>
  );
}

/** Value editor for one catalogue input. `disabled` renders it read-only (role or input owned by another page). */
export function InputEditor({ row, disabled }: { row: Pick<InputRow, 'it' | 'ind' | 'ci' | 'value'>; disabled: boolean }) {
  const { it, value: v } = row, target = targetOf(row), label = it.label;
  switch (it.type) {
    case 'inds':
      return <><span>{(Array.isArray(v) ? v.join(' · ') : '') || '—'}</span> <button className="link-button small" onClick={() => setGovView('indications')}>Edit on Indications tab</button></>;
    case 'sel':
      return (
        <select className="select x-cell" value={str(v)} disabled={disabled} aria-label={label} onChange={e => setInput(target, { kind: 'value', raw: e.target.value })}>
          <option value="">Select…</option>
          {it.opts!.map(o => <option key={o}>{o}</option>)}
        </select>
      );
    case 'multi': {
      const list = Array.isArray(v) ? v.map(String) : [], x = it.extra, xv = x ? str(indValues(row.ind)[x.key]) : '';
      return (
        <>
          <details className="x-multi">
            <summary>{list.length ? <b>{list.map(o => (x && o === x.opt && xv ? `${o} (${xv})` : o)).join(', ')}</b> : 'Select…'}</summary>
            <div className="x-multi-list">
              {it.opts!.map(o => (
                <label key={o}>
                  <input type="checkbox" checked={list.includes(o)} disabled={disabled} onChange={e => setInput(target, { kind: 'toggle', option: o, checked: e.target.checked })} /> {o}
                </label>
              ))}
            </div>
          </details>
          {x && list.includes(x.opt) && (
            <label className="x-extra">
              <span>{x.label}</span>
              <CommitInput className="input x-cell" value={xv} disabled={disabled} aria-label={x.label} {...(x.type === 'num' ? { inputMode: 'numeric' as const, maxLength: 2, style: { maxWidth: 70 } } : {})}
                onCommit={raw => setInput(target, { kind: 'extra', raw })} />
            </label>
          )}
        </>
      );
    }
    case 'ym': {
      const ym = (v || { y: '', m: '' }) as YearMonth;
      return (
        <span style={{ display: 'flex', gap: 6 }}>
          <CommitInput className="input x-cell" value={ym.y} inputMode="numeric" maxLength={4} placeholder="Year" style={{ maxWidth: 80 }} disabled={disabled} aria-label={`${label} year`}
            onCommit={raw => setInput(target, { kind: 'ym', part: 'y', raw })} />
          <select className="select x-cell" value={ym.m} style={{ maxWidth: 90 }} disabled={disabled} aria-label={`${label} month`} onChange={e => setInput(target, { kind: 'ym', part: 'm', raw: e.target.value })}>
            <option value="">Month</option>
            {MONTHS.map(m => <option key={m}>{m}</option>)}
          </select>
        </span>
      );
    }
    case 'year':
      if (it.src === 'Calc') return <span className="muted">{isEmptyValue(v) ? '—' : str(v)}</span>;
      return <CommitInput className="input x-cell" value={str(v)} inputMode="numeric" maxLength={4} placeholder="Year" disabled={disabled} aria-label={label} onCommit={raw => setInput(target, { kind: 'value', raw })} />;
    case 'num': case 'pct': case 'text':
      return (
        <CommitInput className="input x-cell" value={str(v)} inputMode={it.type === 'text' ? undefined : 'decimal'} placeholder={it.type === 'pct' ? '% (0-100)' : it.unit || ''}
          disabled={disabled} aria-label={label} onCommit={raw => setInput(target, { kind: 'value', raw })} />
      );
    case 'series':
      return (
        <details className="x-sdet">
          <summary>{seriesSummary(v as Series)}</summary>
          <SeriesTable rows={[[label.replace(/ \(Year 1-15\)/, ''), v as Series]]} unit={it.unit || ''} target={disabled ? undefined : target} />
        </details>
      );
    case 'eu': {
      const o = (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Record<string, Series>, n = Object.keys(o).length;
      return (
        <details className="x-sdet">
          <summary>{n ? `${n} EU MFN reference countries` : 'Not provided'}</summary>
          <SeriesTable rows={EU_REFERENCE_COUNTRIES.map(c => [c, o[c], c])} unit={it.unit || ''} target={disabled ? undefined : target} />
        </details>
      );
    }
    case 'calc': {
      if (v == null) return <span className="muted">Insufficient data – Payer Mix (% Medicare) missing</span>;
      const ivs = indValues(row.ind), share = Math.round(Number(ivs.revShare ?? 0) * 100);
      return (
        <details className="x-sdet">
          <summary>{seriesSummary(v as Series)} ($M)</summary>
          <SeriesTable rows={[['Medicare revenue', v as Series]]} unit={`$M · ${share || 'equal'}% indication share of the asset revenue forecast × ${str(ivs.payer)}% payer mix`} />
        </details>
      );
    }
  }
  return null;
}

/** Status chip for an input row. */
export function InputStatus({ row }: { row: Pick<InputRow, 'it' | 'value' | 'cf'> }) {
  const { it } = row, miss = isMissing(row);
  if (row.cf?.state === 'open') return <span className="x-stat conflict"><Icon name="alert" size={11} /> Conflict · review</span>;
  if (row.cf) return <span className="x-stat edited">Resolved</span>;
  if (it.src === 'Calc') {
    if (!miss) return <span className="x-stat">Calculated</span>;
    return it.calcNote ? <span className="x-stat review">{it.calcNote}</span> : <span className="x-stat review">Not calculated</span>;
  }
  if (miss) return it.req ? <span className="x-stat conflict"><Icon name="alert" size={11} /> Required · missing</span> : <span className="x-stat review">Not provided</span>;
  if (['Manual', 'Link', 'None'].includes(it.src)) return <span className="x-stat edited">Entered by you</span>;
  return <span className="x-stat">AI-extracted</span>;
}

/** Source cell: document name, "Manual", or a note that the document did not contain it. */
export function InputSource({ row }: { row: { it: InputItem; value: RowValue } }) {
  const { it } = row;
  if (it.src === 'None') return <span className="muted" title="Source data not yet defined in the input list">— to be confirmed</span>;
  if (it.src === 'Link') return <span className="x-src">Manual</span>;
  if (DOC_SOURCES.includes(it.src) && isMissing(row)) return <span className="muted">Not found in {INPUT_SOURCE_LABEL[it.src]}</span>;
  return <span className="x-src">{it.srcNote || INPUT_SOURCE_LABEL[it.src]}</span>;
}

/**
 * Red asterisk for required inputs. A conditional input shows it only while its condition holds (`req`; the tooltip says why),
 * otherwise a small "conditional" tag.
 */
export function Req({ it, req }: { it: InputItem; req?: boolean }) {
  if (it.req) return <span className="x-req" title="Required" aria-label="required">*</span>;
  if (!it.cond) return null;
  if (req) return <span className="x-req" title={INPUT_COND_LABEL[it.cond]} aria-label="required">*</span>;
  return <span className="x-cond" title={`Conditional: ${INPUT_COND_LABEL[it.cond]}`}>conditional</span>;
}

/** Note shown when Launch Markets limits the inputs to one region (v10 v6RegionNote). */
export function RegionNote({ asset }: { asset: Asset }) {
  const hidden = hiddenRegion(asset);
  if (!hidden) return null;
  const shown = hidden === 'US' ? 'EU' : 'US';
  return (
    <div className="x-regnote">
      <Icon name="info" size={13} /> Launch Markets is <b>{shown} only launch</b>: only {shown} and shared inputs are shown and required. {hidden} inputs are hidden; values already entered are kept.
    </div>
  );
}
