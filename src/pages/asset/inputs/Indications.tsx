/** Inputs and Assumptions → Indications view (v09 renderAiaIndications): include, phase and the US / EU timing of each indication. */
import { addIndication, goToFields, setIndicationIncluded, updateIndication } from '../../../actions/assessment';
import { CommitInput } from '../../../components/common/CommitInput';
import { Icon } from '../../../components/common/Icon';
import { INPUT_ITEM } from '../../../engine/inputCatalogue';
import { conflictOf, inputConfidence, inputShown, isMissing, isRequired, readInput } from '../../../engine/inputs';
import { canEditGoverned } from '../../../engine/permissions';
import { aia } from '../../../engine/workspace';
import { useAppState } from '../../../store/store';
import type { Asset, Indication } from '../../../types/domain';
import { ConflictButton, ConflictNote } from './ConflictUi';
import { InputEditor, RegionNote } from './InputEditor';

const US = ['usSub', 'usApp', 'usLaunch'].map(k => INPUT_ITEM[k]);
const EU = ['maaSub', 'euApp', 'euLaunch'].map(k => INPUT_ITEM[k]);

function onAddIndication() {
  const n = addIndication();
  if (n < 0) return;
  setTimeout(() => document.querySelector<HTMLInputElement>(`[data-ind="${n}"][data-ind-key="name"]`)?.focus(), 0);
}

export function Indications({ asset }: { asset: Asset }) {
  const s = useAppState();
  const st = aia(asset).setup, ed = canEditGoverned(s.role), inds = st.indications, n = inds.filter(i => i.include !== false).length;

  const us = US.filter(it => inputShown(asset, it)), eu = EU.filter(it => inputShown(asset, it));
  const cell = (it: typeof US[number], ind: Indication) => {
    const row = { it, ind, value: readInput(s, asset, it, ind), cf: conflictOf(asset, it, ind) }, miss = isRequired(asset, it, ind) && isMissing(row);
    const c = inputConfidence(row), cls = c === 'High' ? 'high' : c === 'Med' ? 'med' : c === 'Low' ? 'low' : 'na', open = row.cf?.state === 'open';
    return (
      <td key={it.k} className={open ? 'x-cftd' : ''}>
        <div className={`x-cv x-cv-${cls}`} title={`Confidence: ${c === 'NA' ? 'NA (entered by you)' : c || '—'}`}><InputEditor row={row} disabled={!ed} /></div>
        {miss && <div className="x-stat conflict x-cellpill"><Icon name="alert" size={11} /> Required · missing</div>}
        {open ? <ConflictButton row={row} ed={ed} /> : <ConflictNote cf={row.cf} />}
      </td>
    );
  };
  /** An included indication with a required value still empty gets the same row marking as the Inputs page. */
  const rowMissing = (ind: Indication) => ind.include !== false && [INPUT_ITEM.phase, ...us, ...eu].some(it => {
    const row = { it, ind, value: readInput(s, asset, it, ind), cf: conflictOf(asset, it, ind) };
    return isRequired(asset, it, ind) && isMissing(row);
  });
  const head = (it: typeof US[number]) => <th key={it.k}>{it.col}{it.req && <span className="x-req">*</span>}</th>;

  return (
    <>
      <div className="x-headrow">
        <div>
          <h2 className="x-h1">Confirm indications</h2>
          <p className="x-desc">Confirm the indications found in your documents, their phase and timelines, and choose which are considered for this assessment.</p>
        </div>
      </div>
      <RegionNote asset={asset} />
      {!ed && <div className="x-view-only" style={{ marginBottom: 10 }}><Icon name="lock" size={13} /> View only for your role</div>}
      <div className="panel">
        <div className="table-wrap">
          <table className="x-gtable x-indtable">
            <thead>
              <tr>
                <th rowSpan={2}>Include</th>
                <th rowSpan={2}>Indication<span className="x-req">*</span></th>
                <th rowSpan={2}>Phase of Development<span className="x-req">*</span></th>
                {us.length > 0 && <th colSpan={us.length} className="x-grp">US</th>}
                {eu.length > 0 && <th colSpan={eu.length} className="x-grp">EU</th>}
                <th rowSpan={2}>Source · Status</th>
              </tr>
              <tr>{us.map(head)}{eu.map(head)}</tr>
            </thead>
            <tbody>
              {inds.length ? inds.map((ind, i) => {
                const on = ind.include !== false;
                return (
                  <tr key={ind.id ?? i} className={rowMissing(ind) ? 'x-missing' : ''} style={on ? undefined : { opacity: 0.55 }}>
                    <td style={{ width: 56, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        data-ind-include={i}
                        checked={on}
                        disabled={!ed}
                        aria-label={`Include indication ${i + 1} in assessment`}
                        style={{ width: 16, height: 16, accentColor: 'var(--red)' }}
                        onChange={e => setIndicationIncluded(i, e.target.checked)}
                      />
                    </td>
                    <td>
                      <CommitInput className="input" data-ind={i} data-ind-key="name" value={ind.name} maxLength={80} aria-label={`Indication ${i + 1} name`} disabled={!ed}
                        onCommit={v => updateIndication(i, 'name', v)} />
                    </td>
                    {cell(INPUT_ITEM.phase, ind)}
                    {us.map(it => cell(it, ind))}
                    {eu.map(it => cell(it, ind))}
                    <td>
                      <span className="x-src">{ind.source || 'You entered'}</span>
                      <div style={{ marginTop: 4 }}>{ind.source ? <span className="x-stat">AI-extracted</span> : <span className="x-stat edited">Added</span>}</div>
                    </td>
                  </tr>
                );
              }) : <tr><td colSpan={4 + us.length + eu.length}><div className="empty-state">No indications yet. Add one below.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="x-conf-legend" style={{ marginTop: 8 }}>
        <b>Confidence</b>
        <span><i className="x-dot high" />High</span><span><i className="x-dot med" />Med</span><span><i className="x-dot low" />Low</span>
        <span><i className="x-dot na" />No dot = entered by you or not found</span>
        <span><i className="x-cf-key" />Amber = conflicting values found in the documents</span>
      </div>
      {ed && <button className="x-add" onClick={onAddIndication}><Icon name="plus" size={13} /> Add indication</button>}
      <div className="x-foot">
        <span className="small">{n} of {inds.length} indications included in the assessment. Unchecked indications are left out of extracted data, eligibility and impact. <span className="x-req">*</span> Required.</span>
        <button className="button primary x-cta" onClick={goToFields}>Next: Inputs →</button>
      </div>
    </>
  );
}
