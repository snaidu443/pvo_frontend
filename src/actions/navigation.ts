import { assetService, documentService } from '../api';
import { isMock } from '../config/env';
import { AIA_ORDER, type PageId } from '../engine/constants';
import { visibleAssets } from '../engine/permissions';
import { blockedByInputs, isTabOpen, missingBeforeView, missingInputs, missingSetupInputs, viewBlockedByIndications } from '../engine/inputs';
import { isUnlocked } from '../engine/workspace';
import { newAssetStarted } from '../store/sharedActions';
import { DRAFT_ID, assetPrepared, assetRefreshed, subjectPrepared, viewChanged } from '../store/slices/assessmentSlice';
import { assetOpened, pageChanged, subPageChanged } from '../store/slices/uiSlice';
import { dispatch, getState } from '../store/store';
import type { AiaTab, Asset, GovView, ImpactView } from '../types/domain';
import { toast } from '../ui/overlay';
import { clearDraftFiles } from './documents';
import { fail, saveActivity, subjectId, subjectOf } from './core';

export const closeMobileNav = () => document.body.classList.remove('nav-open');
const toTop = () => window.scrollTo(0, 0);

/** Never land on a locked tab: fall back to the furthest unlocked one. */
const allowedTab = (a: Asset, tab: AiaTab): AiaTab => {
  const s = getState(), open = (t: AiaTab) => isTabOpen(s, a, t);
  return open(tab) ? tab : [...AIA_ORDER].reverse().find(open) || 'submission';
};

/**
 * API mode: read the asset and its documents again from the server when the asset is opened, so the screen shows what is
 * in structx.sqlite now (for example after the AI team's extraction finished). The screen shows the loaded copy at once
 * and updates when the answer arrives. If the user saved something in the meantime, the local copy is newer and is kept.
 */
export function refreshAsset(id: string): Promise<void> {
  if (isMock() || id === DRAFT_ID) return Promise.resolve();
  const before = saveActivity();
  return Promise.all([assetService.get(id), documentService.listForAsset(id)]).then(([asset, documents]) => {
    const now = saveActivity();
    if (now.started !== before.started || now.running > 0) return;
    dispatch(assetRefreshed({ asset, documents }));
  }).catch(fail('The latest data for this asset could not be loaded.'));
}

/** Open an asset's analysis on the given tab (v03 setSelectedAsset). */
export function openAsset(id: string, subPage: AiaTab = 'impact') {
  if (!visibleAssets(getState()).some(a => a.id === id)) { toast('This role does not have access to that asset.'); return; }
  dispatch(assetPrepared(id));
  const a = getState().assets.find(x => x.id === id)!;
  dispatch(assetOpened({ id, tab: allowedTab(a, subPage) }));
  refreshAsset(id);
}

/** "Add New Product" and the sidebar "Asset Impact Analysis" entry: a blank asset opens on Data Submission. */
export function startNewAsset() {
  clearDraftFiles(); // files picked for an earlier draft
  dispatch(newAssetStarted());
  closeMobileNav();
  toTop();
}

export function goPage(page: PageId) {
  if (page === 'assetAnalysis') { startNewAsset(); return; }
  if (page === 'governance') {
    // Opens Inputs and Assumptions › Inputs for the selected (or first visible) asset.
    const s = getState(), visible = visibleAssets(s);
    const id = visible.some(a => a.id === s.selectedAssetId) ? s.selectedAssetId : visible[0]?.id;
    if (!id) { dispatch(pageChanged('overview')); return; }
    dispatch(assetPrepared(id));
    dispatch(viewChanged({ assetId: id, patch: { govView: 'fields' } }));
    const a = getState().assets.find(x => x.id === id)!;
    dispatch(assetOpened({ id, tab: allowedTab(a, 'governance') }));
    refreshAsset(id);
  } else dispatch(pageChanged(page));
  closeMobileNav();
}

/** Switch tab within Asset Impact Analysis; locked tabs are ignored. */
export function goTab(tab: AiaTab, view?: GovView | ImpactView) {
  const s = getState(), a = subjectOf(s), id = subjectId(s);
  if (!a?.aia || !isUnlocked(a, tab)) return;
  if (blockedByInputs(s, a, tab)) {
    const n = tab === 'governance' ? missingSetupInputs(s, a).length : missingInputs(s, a).length;
    toast(`Enter the ${n} required input${n === 1 ? '' : 's'} first.`);
    return;
  }
  if (view && tab === 'governance') dispatch(viewChanged({ assetId: id, patch: { govView: view as GovView } }));
  if (view && tab === 'impact') dispatch(viewChanged({ assetId: id, patch: { impactView: view as ImpactView } }));
  dispatch(subjectPrepared(id));
  dispatch(subPageChanged(tab));
  toTop();
}

export function setGovView(view: GovView) {
  const s = getState(), id = subjectId(s), a = subjectOf(s);
  if (a?.aia && viewBlockedByIndications(s, a, view)) {
    const n = missingBeforeView(s, a, view).length;
    toast(`Enter the ${n} required input${n === 1 ? '' : 's'} on the earlier page first.`);
    return;
  }
  dispatch(viewChanged({ assetId: id, patch: { govView: view } }));
  dispatch(subjectPrepared(id));
}

export function setImpactView(view: ImpactView) {
  const s = getState(), a = subjectOf(s);
  if (!a?.aia || !isTabOpen(s, a, 'impact')) return;
  dispatch(viewChanged({ assetId: subjectId(s), patch: { impactView: view } }));
  dispatch(subPageChanged('impact'));
  toTop();
}

/** Header asset picker. */
export function selectAssetFromHeader(value: string) {
  if (value === 'portfolio') dispatch(pageChanged('overview'));
  else openAsset(value, 'impact');
}
