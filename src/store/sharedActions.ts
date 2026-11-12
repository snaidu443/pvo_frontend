/**
 * Actions handled by more than one slice (RTK "extraReducers" pattern).
 * Payloads are plain serializable data; anything non-deterministic (ids, dates,
 * the acting user) is computed in the calling thunk and passed in.
 */
import { createAction } from '@reduxjs/toolkit';
import type { AiaTab, Role, WorkspaceData } from '../types/domain';
import type { PageId } from '../engine/constants';

/** Resets every slice to its initial state. */
export const signedOut = createAction('session/signedOut');

/** Workspace data arrived from the services after sign-in. */
export const workspaceLoaded = createAction<{ data: WorkspaceData; today: string }>('session/workspaceLoaded');

export const disclaimerAccepted = createAction<{ selectedAssetId: string }>('session/disclaimerAccepted');

export const roleSwitched = createAction<{ role: Role; page?: PageId; selectedAssetId?: string }>('session/roleSwitched');

/** "Add New Product": a blank draft asset opens on Data Submission. */
export const newAssetStarted = createAction('assessment/newAssetStarted');

/** The draft became a real asset after "Extract data with AI". */
export const assetCreated = createAction<{ id: string; code: string; assetName: string; owner: string; role: Role; today: string }>('assessment/assetCreated');

export const assetDeleted = createAction<{ id: string; nextSelectedId: string }>('assessment/assetDeleted');

/** Unlocks a tab and moves the user onto it (assessment + ui). */
export const workflowAdvanced = createAction<{ assetId: string; tab: AiaTab; who: string; today: string }>('assessment/workflowAdvanced');

