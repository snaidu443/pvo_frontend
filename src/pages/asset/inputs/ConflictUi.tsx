/** Controls for conflicting document values (v10): choice box, short note and a compact button that opens the choices in a dialog. */
import { chooseConflict } from '../../../actions/assessment';
import { Icon } from '../../../components/common/Icon';
import { str } from '../../../engine/inputCatalogue';
import type { InputRow } from '../../../engine/inputs';
import { closeModal, openModal } from '../../../ui/overlay';
import type { InputConflict } from '../../../types/domain';
import { targetOf } from './InputEditor';

type Row = Pick<InputRow, 'it' | 'ind' | 'ci' | 'value' | 'cf'>;

export function ConflictBox({ row, ed, onDone }: { row: Row; ed: boolean; onDone?: () => void }) {
  const cf = row.cf!, cur = str(row.value), t = targetOf(row);
  const pick = (c: number | 'manual') => { chooseConflict(t, c); onDone?.(); };
  return (
    <div className="x-cfbox">
      <div className="x-cfhead"><Icon name="alert" size={11} /> Conflicting values · review</div>
      {cf.opts.map((o, i) => (
        <button key={i} type="button" className={`x-cfopt ${o.v === cur ? 'sel' : ''}`} disabled={!ed} title={`Use ${o.v} from ${o.src}`} onClick={() => pick(i)}>
          <b>{o.v}</b><small>{o.src}</small>
        </button>
      ))}
      <button type="button" className="x-cfopt x-cfman" disabled={!ed} onClick={() => pick('manual')}><b>Enter manually</b></button>
      <div className="x-cfnote">Using {cur || '—'} until you choose.</div>
    </div>
  );
}

/** Shown after a conflict was settled. */
export function ConflictNote({ cf }: { cf?: InputConflict }) {
  if (!cf || cf.state === 'open') return null;
  const src = cf.state === 'resolved' && cf.choice != null ? cf.opts[cf.choice]?.src : '';
  return <div className="x-cfdone" title={cf.opts.map(o => `${o.v} · ${o.src}`).join(' / ')}>{cf.state === 'manual' ? 'Conflict resolved · entered manually' : `Conflict resolved · used ${src}`}</div>;
}

/** For narrow table cells: a button that opens the choices in a dialog. */
export function ConflictButton({ row, ed }: { row: Row; ed: boolean }) {
  const open = () => openModal({
    title: `Conflicting values · ${row.it.label}`,
    small: true,
    body: (
      <>
        <p className="small" style={{ margin: '0 0 10px' }}>{row.ind ? `${row.ind.name} · ` : ''}Different values were found in the documents. Choose one, or enter the value yourself.</p>
        <ConflictBox row={row} ed={ed} onDone={closeModal} />
      </>
    ),
    footer: <button className="button" onClick={closeModal}>Close</button>
  });
  return <button type="button" className="x-cfbtn" disabled={!ed} onClick={open} title="Conflicting values found in the documents"><Icon name="alert" size={11} /> {row.cf!.opts.length} values · review</button>;
}
