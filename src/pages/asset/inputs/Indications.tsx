/** Inputs and Assumptions → Indications view (v07 renderAiaIndications + v6IndicationMatrix). */
import { addIndication, goToFields, setIndicationIncluded, updateIndication } from '../../../actions/assessment';
import { CommitInput } from '../../../components/common/CommitInput';
import { Icon } from '../../../components/common/Icon';
import { MONTHS } from '../../../engine/impact';
import { canEditGoverned } from '../../../engine/permissions';
import { aia } from '../../../engine/workspace';
import { useAppState } from '../../../store/store';
import { INPUT_ITEMS } from '../../../engine/inputCatalogue';
import { isMissing, readInput } from '../../../engine/inputs';
import type { Asset } from '../../../types/domain';
import { PolicyPills } from '../../../components/common/Common';
import { InputEditor, Req } from './InputEditor';

function onAddIndication() {
  const n = addIndication();
  if (n < 0) return;
  setTimeout(() => document.querySelector<HTMLInputElement>(`[data-ind="${n}"][data-ind-key="name"]`)?.focus(), 0);
}

export function Indications({ asset }: { asset: Asset }) {
  const s = useAppState();
  const st = aia(asset).setup, ed = canEditGoverned(s.role), inds = st.indications, n = inds.filter(i => i.include !== false).length;

  return (
    <>
      <div className="x-headrow">
        <div>
          <h2 className="x-h1">Confirm indications</h2>
          <p className="x-desc">Confirm the indications found in your documents and choose which are considered for this assessment.</p>
        </div>
      </div>
      {!ed && <div className="x-view-only" style={{ marginBottom: 10 }}><Icon name="lock" size={13} /> View only for your role</div>}
      <div className="panel">
        <div className="table-wrap">
          <table className="x-gtable">
            <thead>
              <tr><th>Include</th><th>Indication<span className="x-req">*</span></th><th>US Launch Year<span className="x-req">*</span></th><th>US Launch Month<span className="x-req">*</span></th><th>EU Launch Year<span className="x-req">*</span></th><th>Source</th><th>Status</th></tr>
            </thead>
            <tbody>
              {inds.length ? inds.map((ind, i) => {
                const on = ind.include !== false;
                return (
                  <tr key={ind.id ?? i} style={on ? undefined : { opacity: 0.55 }}>
                    <td style={{ width: 70, textAlign: 'center' }}>
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
                    <td>
                      <CommitInput className="input" data-ind={i} data-ind-key="launchUS" value={ind.launchUS} inputMode="numeric" maxLength={4} aria-label="US launch year"
                        style={{ maxWidth: 90 }} disabled={!ed} onCommit={v => updateIndication(i, 'launchUS', v)} />
                    </td>
                    <td>
                      <select className="select" data-ind={i} data-ind-key="launchUSMonth" aria-label="US launch month" style={{ maxWidth: 96 }} disabled={!ed} value={ind.launchUSMonth || ''}
                        onChange={e => updateIndication(i, 'launchUSMonth', e.target.value)}>
                        <option value="">—</option>
                        {MONTHS.map(mo => <option key={mo}>{mo}</option>)}
                      </select>
                    </td>
                    <td>
                      <CommitInput className="input" data-ind={i} data-ind-key="launchEU" value={ind.launchEU} inputMode="numeric" maxLength={4} aria-label="EU launch year"
                        style={{ maxWidth: 90 }} disabled={!ed} onCommit={v => updateIndication(i, 'launchEU', v)} />
                    </td>
                    <td><span className="x-src">{ind.source || 'You entered'}</span></td>
                    <td>{ind.source ? <span className="x-stat">AI-extracted</span> : <span className="x-stat edited">Added</span>}</td>
                  </tr>
                );
              }) : <tr><td colSpan={7}><div className="empty-state">No indications yet. Add one below.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {ed && <button className="x-add" onClick={onAddIndication}><Icon name="plus" size={13} /> Add indication</button>}
      <IndicationMatrix asset={asset} ed={ed} />
      <div className="x-foot">
        <span className="small">{n} of {inds.length} indications included in the assessment. Unchecked indications are left out of extracted data, eligibility and impact.</span>
        <button className="button primary x-cta" onClick={goToFields}>Next: Inputs →</button>
      </div>
    </>
  );
}

/** Indication inputs the user enters (not extracted), one column per included indication (v07 v6IndicationMatrix). */
function IndicationMatrix({ asset, ed }: { asset: Asset; ed: boolean }) {
  const s = useAppState(), inds = aia(asset).setup.indications.filter(i => i.include !== false);
  if (!inds.length) return null;
  const items = INPUT_ITEMS.filter(it => it.lvl === 'ind' && ['Manual', 'Link'].includes(it.src));
  return (
    <>
      <div className="x-headrow" style={{ marginTop: 18 }}>
        <div>
          <h2 className="x-h1">Indication details <span className="x-opt">(entered by you)</span></h2>
          <p className="x-desc">These inputs are not extracted from documents. Enter them for each included indication. <span className="x-req">*</span> = required.</p>
        </div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="x-gtable x-matrix">
            <thead><tr><th>Input</th>{inds.map(ind => <th key={ind.id}>{ind.name}</th>)}<th>Feeds</th></tr></thead>
            <tbody>
              {items.map(it => (
                <tr key={it.k}>
                  <td>{it.label}<Req it={it} /></td>
                  {inds.map(ind => {
                    const row = { it, ind, value: readInput(s, asset, it, ind) };
                    return <td key={ind.id} className={it.req && isMissing(row) ? 'x-missing' : ''}><InputEditor row={row} disabled={!ed} /></td>;
                  })}
                  <td><PolicyPills items={it.feeds} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
