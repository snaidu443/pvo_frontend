/** Modals opened from the Assets overview row actions. */
import { useState, type FormEvent } from 'react';
import { addCollaborator, saveEditedAsset, startAssessment } from '../../actions/portfolio';
import { canEdit, canManage, canSeeUsers, isEditableAsset, visibleAssets } from '../../engine/permissions';
import { lastAssessmentDate } from '../../engine/workspace';
import { getState } from '../../store/store';
import type { Asset, Role } from '../../types/domain';
import { closeModal, openModal, toast } from '../../ui/overlay';

const findVisible = (id: string): Asset | undefined => visibleAssets(getState()).find(a => a.id === id);

export function openPastAssessments(id: string) {
  const asset = findVisible(id);
  if (!asset || !canEdit(getState().role)) { toast('You do not have access to past assessments for this asset.'); return; }
  const past = (asset.assessments || []).filter(x => x.status !== 'Current');
  openModal({
    title: `Past assessments · ${asset.assetCode}`,
    body: past.length ? (
      <>
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Assessment date</th><th>Run by</th></tr></thead>
            <tbody>{past.map(x => <tr key={x.id}><td>{x.date}</td><td>{x.by}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>Past assessments are read-only snapshots.</p>
      </>
    ) : <div className="empty-state">No past assessments for this asset yet.</div>,
    footer: <button className="button primary" onClick={closeModal}>Close</button>
  });
}

export function confirmStartAssessment(id: string) {
  const asset = findVisible(id);
  if (!asset || !canEdit(getState().role)) { toast('You do not have permission to start an assessment for this asset.'); return; }
  openModal({
    title: 'Start new assessment',
    small: true,
    body: (
      <p className="small" style={{ lineHeight: 1.6 }}>
        Start a new assessment for <strong>{asset.assetCode}</strong>? The current assessment ({lastAssessmentDate(asset)}) will be kept under Past Assessments,
        and you will continue from Data Submission with the existing inputs.
      </p>
    ),
    footer: (
      <>
        <button className="button" onClick={closeModal}>Cancel</button>
        <button className="button primary" onClick={() => startAssessment(asset.id)}>Start new assessment</button>
      </>
    )
  });
}

function CollaboratorForm({ asset }: { asset: Asset }) {
  const s = getState(), roles: Role[] = canManage(s.role) ? ['Admin', 'Editor', 'Viewer'] : ['Editor', 'Viewer'];
  const current = s.users.filter(u => (u.assetIds || []).includes(asset.id));
  const [form, setForm] = useState({ name: '', email: '', role: 'Viewer' });
  const submit = (e: FormEvent) => { e.preventDefault(); addCollaborator(asset.id, form); };
  return (
    <form id="collabForm" onSubmit={submit}>
      <p className="small muted">Add a collaborator to <strong>{asset.assetCode}</strong>. Enter an existing user's email to share access, or a new email to invite them.</p>
      <div className="asset-input-grid">
        <label className="form-field"><span className="field-label">Full name</span>
          <input className="input" required maxLength={60} placeholder="e.g. Jordan Lee" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="form-field"><span className="field-label">Email</span>
          <input className="input" type="email" required maxLength={80} placeholder="name@takeda.example" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="form-field"><span className="field-label">Role</span>
          <select className="select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{roles.map(r => <option key={r}>{r}</option>)}</select>
        </label>
      </div>
      <div className="detail-section">
        <h3>Current collaborators ({current.length})</h3>
        <div className="trace-list">
          {current.length ? current.map(u => <span key={u.id} className="trace-item">{u.name} · {u.role}{u.status === 'pending' ? ' · invited' : ''}</span>) : <span className="small muted">None yet</span>}
        </div>
      </div>
      <p className="small muted">Demo only: no invitation is sent and no account is created.</p>
    </form>
  );
}

export function openCollaboratorModal(id: string) {
  const asset = findVisible(id);
  if (!asset || !canSeeUsers(getState().role)) { toast('You do not have permission to add users to this asset.'); return; }
  openModal({
    title: `Add user · ${asset.assetCode}`,
    body: <CollaboratorForm asset={asset} />,
    footer: <><button className="button" onClick={closeModal}>Cancel</button><button className="button primary" type="submit" form="collabForm">Add user</button></>
  });
}

function EditAssetForm({ asset }: { asset: Asset }) {
  const s = getState();
  const owners = [...new Set([asset.owner, ...s.users.filter(u => u.status === 'active').map(u => u.name)])];
  const [form, setForm] = useState({
    assetName: asset.assetName.startsWith(asset.assetCode + ' ') ? asset.assetName.slice(asset.assetCode.length + 1) : asset.assetName,
    owner: asset.owner
  });
  const opt = (list: string[]) => list.map(x => <option key={x}>{x}</option>);
  return (
    <form id="editAssetForm" onSubmit={e => { e.preventDefault(); saveEditedAsset(asset.id, form); }}>
      <div className="asset-input-grid">
        <label className="form-field"><span className="field-label">Asset code</span><input className="input" value={asset.assetCode} disabled /></label>
        <label className="form-field"><span className="field-label">Asset name</span>
          <input className="input" required maxLength={80} value={form.assetName} onChange={e => setForm({ ...form, assetName: e.target.value })} />
        </label>
        <label className="form-field"><span className="field-label">Submission owner</span>
          <select className="select" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })}>{opt(owners)}</select>
        </label>
      </div>
      <p className="small muted">The asset code cannot be changed. Changes are saved in this browser only.</p>
    </form>
  );
}

export function openEditAssetModal(id: string) {
  const s = getState(), asset = s.assets.find(a => a.id === id);
  if (!asset || !isEditableAsset(s, asset)) { toast('Only added assets can be edited, by Admin or Editor.'); return; }
  openModal({
    title: 'Edit Asset',
    body: <EditAssetForm asset={asset} />,
    footer: <><button className="button" onClick={closeModal}>Cancel</button><button className="button primary" type="submit" form="editAssetForm">Save changes</button></>
  });
}

