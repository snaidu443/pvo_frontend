/** Inputs and Assumptions → Inputs view (v09 renderAiaFields): asset, indication and competitor inputs of the catalogue, by category. */
import type { ReactNode } from 'react';
import { goToJudgment, setGovFilter } from '../../../actions/assessment';
import { RevenueSection } from '../../../components/charts/RevenueChart';
import { InfoButton, PolicyPills } from '../../../components/common/Common';
import { Icon } from '../../../components/common/Icon';
import { DOC_SOURCES, INPUT_ITEMS, INPUT_SOURCE_LABEL, type InputItem } from '../../../engine/inputCatalogue';
import { inputConfidence, inputRows, inputShown, isRequiredMissing, type InputRow } from '../../../engine/inputs';
import { canEditGoverned } from '../../../engine/permissions';
import { aia } from '../../../engine/workspace';
import { useAppState } from '../../../store/store';
import type { Asset } from '../../../types/domain';
import { downloadCsv } from '../impact/csv';
import { ConflictBox, ConflictNote } from './ConflictUi';
import { CoverageStrip } from './CoverageStrip';
import { InputEditor, InputSource, InputStatus, RegionNote, Req } from './InputEditor';

/** The illustrative Revenue forecast panel is hidden for now; set to true to show it again when the team asks for it. */
const SHOW_REVENUE_FORECAST = false;

const FILTERS = ['All', 'Required missing', 'Manual', 'From documents'];

function keepRow(filter: string, r: InputRow) {
  if (filter === 'Required missing') return isRequiredMissing(r);
  if (filter === 'Manual') return ['Manual', 'Link'].includes(r.it.src);
  if (filter === 'From documents') return DOC_SOURCES.includes(r.it.src);
  return true;
}

/** Inputs confirmed on another page are shown greyed out and edited there. */
function lockedAt(it: InputItem): string {
  if (it.loc === 'setup') return 'Data Submission';
  if (it.loc === 'indications') return 'Indications tab';
  return '';
}

/** Value with its confidence dot (v07 valBox). */
function ValueBox({ r, ed }: { r: InputRow; ed: boolean }) {
  const c = inputConfidence(r), cls = c === 'High' ? 'high' : c === 'Med' ? 'med' : c === 'Low' ? 'low' : 'na', at = lockedAt(r.it);
  const open = r.cf?.state === 'open';
  if (open && !at) return <ConflictBox row={r} ed={ed} />;
  const title = at ? `Confirmed on ${at} · edit it there` : `Confidence: ${c === 'NA' ? 'NA (entered by you or calculated)' : c || '—'}`;
  return (
    <>
      <div className={`x-cv x-cv-${cls}${at ? ' x-locked' : ''}`} title={title}><InputEditor row={r} disabled={!ed || !!at} /></div>
      {open ? <div className="x-cfptr"><Icon name="alert" size={11} /> Conflicting values · review on the {at}</div> : <ConflictNote cf={r.cf} />}
    </>
  );
}

function MatrixCell({ r, ed }: { r: InputRow | undefined; ed: boolean }) {
  if (!r) return <td />;
  const miss = isRequiredMissing(r);
  return <td className={miss ? 'x-missing' : ''}><ValueBox r={r} ed={ed} />{miss && <div className="x-cellmiss">Required · missing</div>}</td>;
}

function SourceOf({ it }: { it: InputItem }) {
  return <><InputSource row={{ it, value: it.type === 'ym' ? { y: 'x', m: 'x' } : 'x' }} />{it.calcNote && <div className="small muted" style={{ marginTop: 4 }}>{it.calcNote}</div>}</>;
}

const Panel = ({ title, children }: { title: string; children: ReactNode }) => (
  <>
    <h3 className="x-subh">{title}</h3>
    <div className="panel" style={{ marginBottom: 14 }}><div className="table-wrap">{children}</div></div>
  </>
);

/** Smallest width of an indication / competitor matrix: the input name, one 180px column each, then Source and Feeds. Wider screens share the rest equally. */
const matrixMinWidth = (columns: number) => 220 + columns * 180 + 250;

/** A heading row that starts a new group of rows. */
const GroupRow = ({ name, cols }: { name: string; cols: number }) => <tr className="x-group"><td colSpan={cols}>{name}</td></tr>;

export function Fields({ asset }: { asset: Asset }) {
  const s = useAppState();
  const v = aia(asset), ed = canEditGoverned(s.role), rows = inputRows(s, asset), filter = FILTERS.includes(v.govFilter) ? v.govFilter : 'All';
  const keep = (r: InputRow) => keepRow(filter, r);

  const assetRows = rows.filter(r => !r.ind && !r.comp && keep(r));
  const inds = v.setup.indications.filter(i => i.include !== false);
  // Indication inputs: the Indications-tab ones first (greyed out here), then the rest by category.
  const indItems = [...INPUT_ITEMS.filter(it => it.lvl === 'ind' && it.loc === 'indications'), ...INPUT_ITEMS.filter(it => it.lvl === 'ind' && it.loc === 'inputs')].filter(it => inputShown(asset, it));
  const byItem = indItems.map(it => ({ it, cells: rows.filter(r => r.it === it && r.ind) })).filter(x => x.cells.length && x.cells.some(keep));
  const comps = v.v6?.comp || [], compItems = INPUT_ITEMS.filter(it => it.lvl === 'comp' && it.loc !== 'assumption' && inputShown(asset, it));
  const byComp = comps.length ? compItems.map(it => ({ it, cells: rows.filter(r => r.it === it && r.comp) })).filter(x => x.cells.some(keep)) : [];
  const shown = assetRows.length + byItem.length + byComp.length;
  const total = rows.filter(r => !r.ind && !r.comp).length + indItems.length + (comps.length ? compItems.length : 0);
  const nMiss = rows.filter(isRequiredMissing).length;

  const onExport = () => {
    const cell = (x: unknown): string => x == null ? '' : Array.isArray(x) ? x.join('; ') : typeof x === 'object' ? ('y' in (x as object) ? `${(x as { m: string }).m} ${(x as { y: string }).y}`.trim() : 'See Inputs tab') : String(x);
    downloadCsv('pvo-inputs.csv', [
      ['Group', 'Input', 'Required', 'Value', 'Source', 'Feeds'],
      ...[...rows, ...inputRows(s, asset, { judgment: true })].map(r => [r.group, r.it.label, r.it.req ? 'Required' : 'Optional', cell(r.value), r.it.src === 'None' ? '' : INPUT_SOURCE_LABEL[r.it.src], r.it.feeds.join('; ')])
    ]);
  };

  let lastCat = '';
  const assetBody = assetRows.map(r => {
    const head = r.it.cat !== lastCat ? <GroupRow key={`g-${r.it.cat}`} name={r.it.cat} cols={5} /> : null;
    lastCat = r.it.cat;
    return [
      head,
      <tr key={r.it.k} className={`x-row ${isRequiredMissing(r) ? 'x-missing' : ''}`}>
        <td>{r.it.label}<Req it={r.it} req={r.req} />{r.it.note && <> <InfoButton label={r.it.label} text={r.it.note} /></>}</td>
        <td><ValueBox r={r} ed={ed} /></td>
        <td><InputSource row={r} /></td>
        <td><PolicyPills items={r.it.feeds} /></td>
        <td><InputStatus row={r} /></td>
      </tr>
    ];
  });

  lastCat = '';
  const matrixBody = byItem.map(({ it, cells }) => {
    const grp = it.loc === 'indications' ? 'Confirmed on the Indications tab' : it.cat;
    const head = grp !== lastCat ? <GroupRow key={`g-${grp}`} name={grp} cols={inds.length + 3} /> : null;
    lastCat = grp;
    return [
      head,
      <tr key={it.k} className={`x-row ${cells.some(isRequiredMissing) ? 'x-missing-row' : ''}`}>
        <td>{it.label}<Req it={it} req={cells.some(c => c.req)} /></td>
        {inds.map(ind => <MatrixCell key={ind.id} r={cells.find(c => c.ind === ind)} ed={ed} />)}
        <td><SourceOf it={it} /></td>
        <td><PolicyPills items={it.feeds} /></td>
      </tr>
    ];
  });

  return (
    <>
      <CoverageStrip asset={asset} />
      {SHOW_REVENUE_FORECAST && <RevenueSection asset={asset} />}
      <div className="x-headrow">
        <h2 className="x-h1">Review inputs</h2>
        <div className="toolbar-right" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <div className="segmented">
            {FILTERS.map(k => <button key={k} className={`segment ${filter === k ? 'active' : ''}`} onClick={() => setGovFilter(k)}>{k === 'Required missing' ? `Required missing (${nMiss})` : k}</button>)}
          </div>
          <button className="button" onClick={onExport}><Icon name="download" /> Export</button>
        </div>
      </div>
      {!ed && <div className="x-view-only" style={{ marginBottom: 10 }}><Icon name="lock" size={13} /> View only for your role</div>}
      <RegionNote asset={asset} />
      <div className="x-conf-legend">
        <b>Confidence</b>
        <span><i className="x-dot high" />High</span><span><i className="x-dot med" />Med</span><span><i className="x-dot low" />Low</span>
        <span><i className="x-dot na" />No dot = NA (entered by you or calculated)</span>
        <span><i className="x-lock-key" />Greyed = confirmed on Data Submission or the Indications tab; edit it there</span>
        <span><i className="x-cf-key" />Amber = conflicting values found in the documents</span>
        <span><span className="x-req">*</span> Required (conditional rules shown on hover)</span>
      </div>
      {assetRows.length > 0 && (
        <Panel title="Asset">
          <table className="x-gtable">
            <thead><tr><th>Field</th><th>Value</th><th>Source</th><th>Feeds</th><th>Status</th></tr></thead>
            <tbody>{assetBody}</tbody>
          </table>
        </Panel>
      )}
      {byItem.length > 0 && (
        <Panel title="Indications">
          <table className="x-gtable x-imatrix" style={{ minWidth: matrixMinWidth(inds.length) }}>
            <thead><tr><th>Input</th>{inds.map((ind, i) => <th key={ind.id}>Ind. {i + 1} · {ind.name}</th>)}<th>Source</th><th>Feeds</th></tr></thead>
            <tbody>{matrixBody}</tbody>
          </table>
        </Panel>
      )}
      {byComp.length > 0 && (
        <Panel title="Competitors">
          <table className="x-gtable x-imatrix" style={{ minWidth: matrixMinWidth(comps.length) }}>
            <thead>
              <tr>
                <th>Input</th>
                {comps.map((c, ci) => {
                  const vs = v.setup.indications.find(i => i.id === c.vsId);
                  return <th key={ci}>{c.name}{vs ? ` · vs ${vs.name}` : ''}</th>;
                })}
                <th>Source</th><th>Feeds</th>
              </tr>
            </thead>
            <tbody>
              {byComp.map(({ it, cells }) => (
                <tr key={it.k} className="x-row">
                  <td>{it.label}<Req it={it} /></td>
                  {comps.map((_, ci) => <MatrixCell key={ci} r={cells.find(x => x.ci === ci)} ed={ed} />)}
                  <td><SourceOf it={it} /></td>
                  <td><PolicyPills items={it.feeds} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      {!shown && <div className="panel"><div className="empty-state">No inputs match this filter.</div></div>}
      <div className="x-foot">
        <span className="small"><span className="x-req">*</span> Required · {shown} of {total} inputs shown · judgement inputs are on the Assumptions tab</span>
        <button className="button primary x-cta" onClick={goToJudgment}>Next: Assumptions →</button>
      </div>
    </>
  );
}
