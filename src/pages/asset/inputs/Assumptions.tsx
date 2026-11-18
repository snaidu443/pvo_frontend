/** Inputs and Assumptions → Key Assumptions view (v09 renderAiaJudgment): catalogue questions answered per indication, by category. */
import { runAssessment, toggleAnswer } from '../../../actions/assessment';
import { PolicyPills } from '../../../components/common/Common';
import { todayLabel } from '../../../engine/format';
import { INPUT_ITEMS, INPUT_SOURCE_LABEL, str, type InputItem } from '../../../engine/inputCatalogue';
import { inputRows, inputsGated, isMissing, isRequiredMissing, missingInputs, type InputRow } from '../../../engine/inputs';
import { canEditAiaInputs, userLabel } from '../../../engine/permissions';
import { aia } from '../../../engine/workspace';
import { useAppState } from '../../../store/store';
import type { Asset } from '../../../types/domain';
import { InputEditor, InputStatus, RegionNote, Req, targetOf } from './InputEditor';

const CATEGORIES = ['Asset Description', 'Clinical', 'HTA Insights', 'Regulatory'];

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

/** One question: a row per indication (or competitor) with its answer; question, source and policies span the rows. */
function Block({ it, rs, ed }: { it: InputItem; rs: InputRow[]; ed: boolean }) {
  const n = rs.length;
  return (
    <>
      {rs.map((r, k) => (
        <tr key={`${it.k}|${r.ind?.id ?? ''}|${r.ci ?? ''}`} className={isRequiredMissing(r) ? 'x-missing' : ''}>
          {k === 0 && (
            <td rowSpan={n}>
              <div className="x-jqt">{it.label}<Req it={it} req={rs.some(x => x.req)} /></div>
              <div className="small muted" style={{ marginTop: 3 }}>{it.q || ''}</div>
            </td>
          )}
          <td>
            {r.ind ? <div className="x-jind">{r.ind.name || 'Indication'}</div> : r.comp ? <div className="x-jind">{r.comp.name}</div> : null}
            {it.type === 'sel' ? <Answers r={r} ed={ed} /> : <InputEditor row={r} disabled={!ed} />}
          </td>
          {k === 0 && <td rowSpan={n}>{it.src === 'None' ? <span className="muted">— to be confirmed</span> : <span className="x-src">{INPUT_SOURCE_LABEL[it.src]}</span>}</td>}
          {k === 0 && <td rowSpan={n}><PolicyPills items={it.feeds} /></td>}
          <td><InputStatus row={r} /></td>
        </tr>
      ))}
    </>
  );
}

export function Assumptions({ asset }: { asset: Asset }) {
  const s = useAppState();
  const ed = canEditAiaInputs(s.role), rows = inputRows(s, asset, { judgment: true }), miss = inputsGated(asset) ? missingInputs(s, asset) : [];
  const answered = rows.filter(r => !isMissing(r)).length, w = aia(asset);

  const items = INPUT_ITEMS.filter(it => it.loc === 'assumption' && it.lvl !== 'comp');
  const body = CATEGORIES.flatMap(cat => {
    const blocks = items.filter(it => it.cat === cat).map(it => ({ it, rs: rows.filter(r => r.it === it) })).filter(x => x.rs.length);
    if (!blocks.length) return [];
    return [
      <tr key={`g-${cat}`} className="x-group"><td colSpan={5}>{cat}</td></tr>,
      ...blocks.map(({ it, rs }) => <Block key={it.k} it={it} rs={rs} ed={ed} />)
    ];
  });
  const compBlocks = INPUT_ITEMS.filter(it => it.loc === 'assumption' && it.lvl === 'comp').map(it => ({ it, rs: rows.filter(r => r.it === it) })).filter(x => x.rs.length);

  return (
    <>
      <div className="x-jhead">
        <div>
          <h2 className="x-h1">Key Assumptions</h2>
          <p className="x-desc">Confirm or change each answer. <span className="x-req">*</span> = required (conditional rules shown on hover). Click a selected answer again to clear it.</p>
        </div>
      </div>
      <RegionNote asset={asset} />
      <div className="panel">
        <div className="table-wrap">
          <table className="x-gtable x-jtable">
            <thead><tr><th>Question</th><th>Answer</th><th>Source</th><th>Feeds</th><th>Status</th></tr></thead>
            <tbody>
              {body.length || compBlocks.length ? body : <tr><td colSpan={5}><div className="empty-state">No indications included.</div></td></tr>}
              {compBlocks.length > 0 && <tr className="x-group"><td colSpan={5}>Competitors</td></tr>}
              {compBlocks.map(({ it, rs }) => <Block key={it.k} it={it} rs={rs} ed={ed} />)}
            </tbody>
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
