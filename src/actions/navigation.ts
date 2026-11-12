import { AIA_ORDER, type PageId } from '../engine/constants';
import { visibleAssets } from '../engine/permissions';
import { blockedByInputs, isTabOpen, missingInputs } from '../engine/inputs';
import { isUnlocked } from '../engine/workspace';
import { newAssetStarted } from '../store/sharedActions';
import { assetPrepared, subjectPrepared, viewChanged } from '../store/slices/assessmentSlice';
import { assetOpened, pageChanged, subPageChanged } from '../store/slices/uiSlice';
import { dispatch, getState } from '../store/store';
import type { AiaTab, Asset, GovView, ImpactView } from '../types/domain';
import { toast } from '../ui/overlay';
import { subjectId, subjectOf } from './core';
import { clearDraftFiles } from './submission';

export const closeMobileNav = () => document.body.classList.remove('nav-open');
const toTop = () => window.scrollTo(0, 0);

/** Never land on a locked tab: fall back to the furthest unlocked one. */
const allowedTab = (a: Asset, tab: AiaTab): AiaTab => {
  const s = getState(), open = (t: AiaTab) => isTabOpen(s, a, t);
  return open(tab) ? tab : [...AIA_ORDER].reverse().find(open) || 'submission';
};

/** Open an asset's analysis on the given tab (v03 setSelectedAsset). */
export function openAsset(id: string, subPage: AiaTab = 'impact') {
  if (!visibleAssets(getState()).some(a => a.id === id)) { toast('This role does not have access to that asset.'); return; }
  dispatch(assetPrepared(id));
  const a = getState().assets.find(x => x.id === id)!;
  dispatch(assetOpened({ id, tab: allowedTab(a, subPage) }));
}

/** "Add New Product" and the sidebar "Asset Impact Analysis" entry. */
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
  } else dispatch(pageChanged(page));
  closeMobileNav();
}

/** Switch tab within Asset Impact Analysis; locked tabs are ignored. */
export function goTab(tab: AiaTab, view?: GovView | ImpactView) {
  const s = getState(), a = subjectOf(s), id = subjectId(s);
  if (!a?.aia || !isUnlocked(a, tab)) return;
  if (blockedByInputs(s, a, tab)) { toast(`Enter the ${missingInputs(s, a).length} required inputs first.`); return; }
  if (view && tab === 'governance') dispatch(viewChanged({ assetId: id, patch: { govView: view as GovView } }));
  if (view && tab === 'impact') dispatch(viewChanged({ assetId: id, patch: { impactView: view as ImpactView } }));
  dispatch(subjectPrepared(id));
  dispatch(subPageChanged(tab));
  toTop();
}

export function setGovView(view: GovView) {
  const id = subjectId(getState());
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
