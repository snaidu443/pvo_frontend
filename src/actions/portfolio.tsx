/** Overview, asset administration and user-management actions. */
import { assetService, userService } from '../api';
import { ASSET_AREAS } from '../engine/constants';
import { canEdit, canManage, canSeeUsers, isEditableAsset, userLabel, visibleAssets } from '../engine/permissions';
import type { AppState, FilterKey } from '../store/appState';
import { assetDeleted } from '../store/sharedActions';
import { assetAccessChanged, userSaved, userUpdated } from '../store/slices/adminSlice';
import { assessmentStarted, assetEdited } from '../store/slices/assessmentSlice';
import { filterChanged } from '../store/slices/uiSlice';
import { dispatch, getState } from '../store/store';
import type { Role, User } from '../types/domain';
import { closeModal, openModal, toast } from '../ui/overlay';
import { fail, now, record, saveAsset } from './core';
import { openAsset } from './navigation';

type OverviewKey = Extract<FilterKey, `overview${string}`>;
export const setOverviewFilter = (key: OverviewKey, value: string) => dispatch(filterChanged({ key, value }));

type UserFilterKey = Extract<FilterKey, `user${string}`>;
export const setUserFilter = (key: UserFilterKey, value: string) => dispatch(filterChanged({ key, value }));

const success = (message: string) =>
  openModal({
    title: 'Success',
    small: true,
    body: <p className="small" style={{ lineHeight: 1.65 }}><strong>{message}</strong></p>,
    footer: <button className="button primary" onClick={closeModal}>OK</button>
  });

const canAccess = (s: AppState, id: string) => visibleAssets(s).some(a => a.id === id);
const userById = (id: number) => getState().users.find(u => u.id === id);
const saveUser = (id: number, isNew = false) => {
  const u = userById(id);
  if (u) (isNew ? userService.create(u) : userService.update(u)).catch(fail('The user could not be saved.'));
};

/* ---------------- assessments ---------------- */

export function startAssessment(assetId: string) {
  const st = getState();
  if (!canEdit(st.role) || !canAccess(st, assetId)) { toast('You do not have permission to start an assessment for this asset.'); return; }
  const code = st.assets.find(a => a.id === assetId)?.assetCode || '';
  dispatch(assessmentStarted({ assetId, who: userLabel(st), today: now().today }));
  saveAsset(assetId);
  record(`Started new assessment for ${code}`);
  closeModal();
  openAsset(assetId, 'submission');
  toast(`New assessment started for ${code}.`);
}

/* ---------------- collaborators ---------------- */

export interface CollaboratorInput { name: string; email: string; role: string }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function addCollaborator(assetId: string, input: CollaboratorInput) {
  const st = getState();
  if (!canSeeUsers(st.role) || !canAccess(st, assetId)) { toast('You do not have permission to add users to this asset.'); return; }
  const name = input.name.trim().slice(0, 60), email = input.email.trim().toLowerCase().slice(0, 80), role = input.role as Role;
  const allowed: Role[] = canManage(st.role) ? ['Admin', 'Editor', 'Viewer'] : ['Editor', 'Viewer'];
  if (!name || !EMAIL.test(email) || !allowed.includes(role)) { toast('Enter a valid name, email and role.'); return; }
  const asset = st.assets.find(a => a.id === assetId)!;
  const existing = st.users.find(u => String(u.email).toLowerCase() === email);
  if (existing && (existing.assetIds || []).includes(assetId)) { toast(`${existing.name} already has access to ${asset.assetCode}.`); return; }
  if (existing) {
    dispatch(assetAccessChanged({ assetId, changes: [{ userId: existing.id, add: true }] }));
    saveUser(existing.id);
  } else {
    const user: User = {
      id: Math.max(0, ...st.users.map(u => u.id)) + 1, name, email, role, roleCode: role === 'Admin' ? 'super_admin' : role.toLowerCase(),
      active: false, status: 'pending', last: 'Invite sent · just now', assetIds: [assetId], assignedAssets: [assetId], asset: assetId, permissions: []
    };
    dispatch(userSaved(user));
    saveUser(user.id, true);
  }
  const who = existing ? existing.name : name;
  record(`Added ${who} to ${asset.assetCode}`);
  closeModal();
  toast(`${who} added to ${asset.assetCode}.`);
}

/* ---------------- edit / delete added assets ---------------- */

export interface AssetEditInput { assetName: string; therapeuticArea: string; owner: string }

export function saveEditedAsset(assetId: string, input: AssetEditInput) {
  const st = getState(), asset = st.assets.find(a => a.id === assetId);
  if (!asset || !isEditableAsset(st, asset)) return;
  const name = input.assetName.trim().slice(0, 80);
  if (!name) { toast('Asset name is required.'); return; }
  if (!ASSET_AREAS.includes(input.therapeuticArea) || !input.owner) return;
  if (input.owner !== asset.owner) {
    dispatch(assetAccessChanged({ assetId, changes: [{ userName: asset.owner, add: false }, { userName: input.owner, add: true }] }));
    [asset.owner, input.owner].forEach(n => { const u = getState().users.find(x => x.name === n); if (u) saveUser(u.id); });
  }
  dispatch(assetEdited({ assetId, name, therapeuticArea: input.therapeuticArea, owner: input.owner }));
  saveAsset(assetId);
  record(`Edited asset ${asset.assetCode}`);
  closeModal();
  success('Asset updated successfully.');
}

export function deleteAsset(assetId: string) {
  const st = getState(), asset = st.assets.find(a => a.id === assetId);
  if (!asset || !isEditableAsset(st, asset)) return;
  const remaining = visibleAssets({ ...st, assets: st.assets.filter(a => a.id !== assetId) });
  dispatch(assetDeleted({ id: assetId, nextSelectedId: remaining[0]?.id || '' }));
  assetService.remove(assetId).catch(fail('The asset could not be deleted.'));
  record(`Deleted asset ${asset.assetCode}`);
  closeModal();
  success(`Asset ${asset.assetCode} deleted successfully.`);
}

/* ---------------- user management (Admin) ---------------- */

export interface UserFormInput { userId: number | null; name: string; email: string; role: Role; status: User['status']; assetIds: string[] }

export function saveUserForm(input: UserFormInput) {
  const st = getState();
  if (!canManage(st.role)) { toast('Only Admin can manage demo users.'); return; }
  if (!input.assetIds.length) { toast('Assign at least one asset.'); return; }
  const name = input.name.trim().slice(0, 60), email = input.email.trim().slice(0, 80);
  if (!name || !EMAIL.test(email) || !['Admin', 'Editor', 'Viewer'].includes(input.role)) { toast('Enter a valid name, email and role.'); return; }
  const assigned = input.assetIds.map(id => st.assets.find(a => a.id === id)).filter(Boolean);
  const entry = {
    name, email, role: input.role, roleCode: input.role === 'Admin' ? 'super_admin' : input.role.toLowerCase(), assetIds: input.assetIds,
    assignedAssets: input.assetIds, asset: assigned.map(a => a!.assetCode).join(', '), status: input.status, active: input.status === 'active',
    last: input.status === 'pending' ? 'Invite sent · just now' : 'Just now'
  };
  const existing = input.userId ? st.users.find(u => u.id === input.userId) : undefined;
  const user: User = existing ? { ...existing, ...entry } : { ...entry, id: Math.max(0, ...st.users.map(x => x.id)) + 1, permissions: [] };
  dispatch(userSaved(user));
  saveUser(user.id, !existing);
  record(existing ? `Updated user: ${name}` : input.status === 'pending' ? `Invited user: ${name}` : `Added user: ${name}`);
  closeModal();
  toast(existing ? 'User changes saved locally.' : 'User added to the local demo.');
}

export function toggleUserActive(userId: number) {
  if (!canManage(getState().role)) { toast('Only Admin can manage user access.'); return; }
  const u = userById(userId);
  if (!u) return;
  const active = !u.active;
  dispatch(userUpdated({ id: userId, patch: { active, status: active ? 'active' : 'inactive', last: 'Just now' } }));
  saveUser(userId);
  record(`${active ? 'Activated' : 'Deactivated'} user ${u.name}`);
  toast(`${u.name} ${active ? 'activated' : 'deactivated'}.`);
}

export function resendInvite(userId: number) {
  if (!canManage(getState().role)) { toast('Only Admin can manage user access.'); return; }
  const u = userById(userId);
  if (!u) return;
  dispatch(userUpdated({ id: userId, patch: { last: 'Invite resent · just now' } }));
  userService.resendInvite(userId).catch(fail('The invite could not be sent.'));
  record(`Resent invite to ${u.email}`);
  toast(`Invite resent to ${u.email}.`);
}
