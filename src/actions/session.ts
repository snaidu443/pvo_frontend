import { authService, referenceService, setUnauthorizedHandler, workspaceService } from '../api';
import { todayLabel } from '../engine/format';
import { canManage, canSeeUsers, visibleAssets } from '../engine/permissions';
import { setReference } from '../engine/reference';
import { disclaimerAccepted, roleSwitched, signedOut, workspaceLoaded } from '../store/sharedActions';
import { loginFailed, loginStarted } from '../store/slices/sessionSlice';
import { dispatch, getState } from '../store/store';
import type { Role } from '../types/domain';
import { closeDrawer, closeModal, toast } from '../ui/overlay';
import { clearDraftFiles, stopWatching } from './submission';

/**
 * Sign in, load reference + workspace data, then show the disclaimer.
 * The reducers fill in anything the API does not return yet (assessment
 * workspaces, assessment history, the TEST-100 summary), as v03 did on load.
 */
export async function signIn(name: string, password: string, role: Role): Promise<void> {
  const session = await authService.login(name, password, role);
  dispatch(loginStarted(session));
  try {
    const [reference, data] = await Promise.all([referenceService.get(), workspaceService.load()]);
    setReference(reference);
    dispatch(workspaceLoaded({ data, today: todayLabel() }));
  } catch (e) {
    dispatch(loginFailed());
    throw e;
  }
}

/** "I accept" on the disclaimer opens the workspace on the Overview. */
export function acceptDisclaimer() {
  const s = getState(), assigned = visibleAssets(s);
  dispatch(disclaimerAccepted({ selectedAssetId: assigned.some(a => a.id === s.selectedAssetId) ? s.selectedAssetId : assigned[0]?.id || '' }));
  toast(`Signed in as ${getState().role} (demo).`);
  window.scrollTo(0, 0);
}

export async function signOut() {
  closeModal();
  closeDrawer();
  stopWatching();
  clearDraftFiles();
  await authService.logout();
  dispatch(signedOut());
}

/** Demo-only role preview from the header. In API mode the server-assigned role is authoritative. */
export function switchRole(role: Role) {
  const s = getState(), assigned = visibleAssets({ ...s, role });
  dispatch(roleSwitched({
    role,
    page: (s.page === 'users' && !canSeeUsers(role)) || (s.page === 'monitoring' && !canManage(role)) ? 'overview' : undefined,
    selectedAssetId: s.page === 'assetAnalysis' && s.aiaMode !== 'new' && !assigned.some(a => a.id === s.selectedAssetId) ? assigned[0]?.id || '' : undefined
  }));
  toast(`Demo role switched to ${role}.`);
}

// A 401 from the API signs the user out (fail closed).
setUnauthorizedHandler(() => { dispatch(signedOut()); });
