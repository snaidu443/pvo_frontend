/** Inputs and Assumptions → Key Assumptions view (v07 renderAiaJudgment): catalogue questions answered per indication. */
import { runAssessment, toggleAnswer } from '../../../actions/assessment';
import { PolicyPills } from '../../../components/common/Common';
import { todayLabel } from '../../../engine/format';
import { INPUT_ITEMS, INPUT_SOURCE_LABEL, str } from '../../../engine/inputCatalogue';
import { inputConfidence, inputRows, inputsGated, isMissing, isRequiredMissing, missingInputs, type InputRow } from '../../../engine/inputs';
import { canEditAiaInputs, userLabel } from '../../../engine/permissions';
import { aia } from '../../../engine/workspace';
import { useAppState } from '../../../store/store';
import type { Asset } from '../../../types/domain';
import { InputStatus, Req, targetOf } from './InputEditor';

function Answers({ r, ed }: { r: InputRow; ed: boolean }) {
  const opts = r.it.opts || [], cur = str(r.value);
  return (
    <div className="x-ans" role="radiogroup" aria-label={r.it.label} style={{ gridTemplateColumns: `repeat(${opts.length},1fr)` }}>
      {opts.map(o => (
        <button key={o} className={cur === o ? 'sel' : ''} role="radio" aria-checked={cur === o} disabled={!ed} onClick={() => toggleAnswer(targetOf(r), o)}>{o}</button>
      ))}
    </div>
  );
}

export function Assumptions({ asset }: { asset: Asset }) {
  const s = useAppState();
  const ed = canEditAiaInputs(s.role), rows = inputRows(s, asset, { judgment: true }), miss = inputsGated(asset) ? missingInputs(s, asset) : [];
  const answered = rows.filter(r => !isMissing(r)).length, w = aia(asset);

  const body = INPUT_ITEMS.filter(it => it.where === 'judgment').flatMap(it => {
    const rs = rows.filter(r => r.it === it);
    if (!rs.length) return [];
    const ev = it.src === 'Protocol' ? 'Illustrative: suggested from the Trial Protocol Concept Sheet.' : 'No source document is defined for this input yet; answer manually.';
    const n = rs.length;
    return rs.map((r, k) => {
      const c = inputConfidence(r);
      return (
        <tr key={`${it.k}|${r.ind?.id ?? ''}`} className={isRequiredMissing(r) ? 'x-missing' : ''}>
          {k === 0 && <td rowSpan={n}>{it.q}<Req it={it} /><div className="small muted" style={{ marginTop: 4 }}>{it.label} · {ev}</div></td>}
          <td>{r.ind && <div className="x-jind">{r.ind.name || 'Indication'}</div>}<Answers r={r} ed={ed} /></td>
          <td>{c && c !== 'NA' ? <span className="x-conf med">{c}</span> : <span className="muted">—</span>}</td>
          {k === 0 && <td rowSpan={n}>{it.src === 'None' ? <span className="muted">— to be confirmed</span> : <span className="x-src">{INPUT_SOURCE_LABEL[it.src]}</span>}</td>}
          {k === 0 && <td rowSpan={n}><PolicyPills items={it.feeds} /></td>}
          <td><InputStatus row={r} /></td>
        </tr>
      );
    });
  });

  return (
    <>
      <div className="x-jhead">
        <div>
          <h2 className="x-h1">Key Assumptions</h2>
          <p className="x-desc">Confirm or change each answer. <span className="x-req">*</span> = required. Click a selected answer again to clear it.</p>
        </div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="x-gtable x-jtable">
            <thead><tr><th>Question</th><th>Answer</th><th>Confidence</th><th>Source</th><th>Feeds</th><th>Status</th></tr></thead>
            <tbody>{body.length ? body : <tr><td colSpan={6}><div className="empty-state">No indications included.</div></td></tr>}</tbody>
          </table>
        </div>
      </div>
      <div className="x-jfoot">
        <span className="small">Confirmed by: <strong>{w.confirmedBy || userLabel(s)}</strong> · {w.confirmedAt || todayLabel()}</span>
        <span className="small">{answered} of {rows.length} answered</span>
        {ed && (
          <>
            {miss.length > 0 && <span className="small" style={{ color: 'var(--red)', fontWeight: 700 }}>{miss.length} required input{miss.length === 1 ? '' : 's'} missing</span>}
            <button className="button primary x-cta" onClick={() => { void runAssessment(); }}>Confirm &amp; run assessment →</button>
          </>
        )}
      </div>
    </>
  );
}
