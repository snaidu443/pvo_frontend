/**
 * Role checks used to show or hide UI. They are a convenience only: the API must
 * enforce the same rules per asset on the server (fail closed).
 */
import { isMock } from '../config/env';
import type { AppState } from '../store/appState';
import type { Asset, Role } from '../types/domain';

export const canEdit = (role: Role) => role !== 'Viewer';
export const canEditGoverned = (role: Role) => canEdit(role);
export const canEditAiaInputs = (_role: Role) => true;
export const canManage = (role: Role) => role === 'Admin';
export const canSeeUsers = (role: Role) => role === 'Admin' || role === 'Editor';

/**
 * Assets the current role may see. API mode: the server already returns only the caller's assets.
 * Mock mode (demo role switching): Admin sees all, others see assets assigned to an active user with that role.
 */
export function visibleAssets(s: Pick<AppState, 'role' | 'assets' | 'users'>): Asset[] {
  if (s.role === 'Admin' || !isMock()) return s.assets;
  const assigned = new Set(s.users.filter(u => u.role === s.role && u.status === 'active').flatMap(u => u.assetIds || []));
  return s.assets.filter(a => assigned.has(a.id) || a.createdByRole === s.role);
}

export const userLabel = (s: Pick<AppState, 'role' | 'users'>) => s.users.find(u => u.role === s.role)?.name || s.role;

/** Added (user-created) assets can be edited/deleted by Admin or Editor. */
export const isEditableAsset = (s: Pick<AppState, 'role'>, a: Asset | undefined) => !!a && !!a.createdByRole && canSeeUsers(s.role);
