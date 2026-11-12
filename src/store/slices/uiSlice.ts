import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PageId } from '../../engine/constants';
import type { AiaTab, PolicyCode } from '../../types/domain';
import { initialUi, type FilterKey } from '../appState';
import { assetCreated, assetDeleted, disclaimerAccepted, newAssetStarted, roleSwitched, workflowAdvanced } from '../sharedActions';

const uiSlice = createSlice({
  name: 'ui',
  initialState: initialUi,
  reducers: {
    pageChanged(state, action: PayloadAction<PageId>) {
      state.page = action.payload;
    },
    /** Open an existing asset on a tab (the thunk has already checked access and locked tabs). */
    assetOpened(state, { payload }: PayloadAction<{ id: string; tab: AiaTab }>) {
      state.aiaMode = 'asset';
      state.selectedAssetId = payload.id;
      state.page = 'assetAnalysis';
      state.assetSubPage = payload.tab;
    },
    subPageChanged(state, action: PayloadAction<AiaTab>) {
      state.assetSubPage = action.payload;
    },
    filterChanged(state, { payload }: PayloadAction<{ key: FilterKey; value: string }>) {
      state[payload.key] = payload.value.slice(0, 100);
    },
    /** Rules engine: show one policy's rules (optionally navigating to the page). */
    rulesPolicyChanged(state, { payload }: PayloadAction<{ policy: PolicyCode; open?: boolean }>) {
      state.rulesPolicy = payload.policy;
      if (payload.open) state.page = 'rules';
    }
  },
  extraReducers: builder => {
    builder
      .addCase(disclaimerAccepted, (state, { payload }) => {
        state.page = 'overview';
        state.selectedAssetId = payload.selectedAssetId;
      })
      .addCase(roleSwitched, (state, { payload }) => {
        if (payload.page) state.page = payload.page;
        if (payload.selectedAssetId !== undefined) state.selectedAssetId = payload.selectedAssetId;
      })
      .addCase(newAssetStarted, state => {
        state.page = 'assetAnalysis';
        state.aiaMode = 'new';
        state.assetSubPage = 'submission';
      })
      .addCase(assetCreated, (state, { payload }) => {
        state.selectedAssetId = payload.id;
        state.aiaMode = 'asset';
        state.assetSubPage = 'governance';
      })
      .addCase(assetDeleted, (state, { payload }) => {
        state.selectedAssetId = payload.nextSelectedId;
        state.page = 'overview';
      })
      .addCase(workflowAdvanced, (state, { payload }) => {
        state.assetSubPage = payload.tab;
      });
  }
});

export const { pageChanged, assetOpened, subPageChanged, filterChanged, rulesPolicyChanged } = uiSlice.actions;
export default uiSlice.reducer;
