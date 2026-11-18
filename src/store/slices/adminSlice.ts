/**
 * admin slice: users, policy versions and deltas, engine rules, decision traces,
 * policy refresh monitoring (new policy documents) and the activity log. Reducers are pure.
 * Monitoring and the rules catalogue are read-only (v07), so they have no reducers.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { ref } from '../../engine/reference';
import type { ActivityEntry, User } from '../../types/domain';
import { initialAdmin } from '../appState';
import { assetCreated, assetDeleted, workspaceLoaded } from '../sharedActions';

function setAssignment(user: User | undefined, assetId: string, add: boolean) {
  if (!user) return;
  const ids = new Set(user.assetIds || []);
  if (add) ids.add(assetId);
  else ids.delete(assetId);
  user.assetIds = [...ids];
  user.assignedAssets = user.assetIds;
  user.asset = user.assetIds.join(', ');
}

const adminSlice = createSlice({
  name: 'admin',
  initialState: initialAdmin,
  reducers: {
    activityRecorded(state, action: PayloadAction<ActivityEntry>) {
      state.activity = [action.payload, ...state.activity].slice(0, 10);
    },

    /* ----- users ----- */
    userSaved(state, action: PayloadAction<User>) {
      const i = state.users.findIndex(u => u.id === action.payload.id);
      if (i >= 0) state.users[i] = action.payload;
      else state.users.push(action.payload);
    },
    /** The server's saved copy of a user. A user added here got a temporary id; the server's id replaces it. */
    userReplaced(state, { payload }: PayloadAction<{ tempId: number; user: User }>) {
      state.users = state.users.filter(u => u.id !== payload.tempId && u.id !== payload.user.id);
      state.users.push(payload.user);
      state.users.sort((a, b) => a.id - b.id);
    },
    /** The server's whole user list (used to undo a local change the server refused). */
    usersReplaced(state, action: PayloadAction<User[]>) { state.users = action.payload; },
    userUpdated(state, { payload }: PayloadAction<{ id: number; patch: Partial<User> }>) {
      const u = state.users.find(x => x.id === payload.id);
      if (u) Object.assign(u, payload.patch);
    },
    /** Add or remove asset access; users are matched by name (asset owner) or id. */
    assetAccessChanged(state, { payload }: PayloadAction<{ assetId: string; changes: { userName?: string; userId?: number; add: boolean }[] }>) {
      payload.changes.forEach(c => setAssignment(state.users.find(u => (c.userId !== undefined ? u.id === c.userId : u.name === c.userName)), payload.assetId, c.add));
    }
  },
  extraReducers: builder => {
    builder
      .addCase(workspaceLoaded, (state, { payload: { data } }) => {
        state.users = data.users;
        state.policyVersions = data.policyVersions;
        state.deltas = data.deltas;
        state.rules = data.rules;
        state.decisionTraces = data.decisionTraces;
        state.activity = data.activity;
        state.monitoring = data.monitoring;
      })
      .addCase(assetCreated, (state, { payload }) => {
        setAssignment(state.users.find(u => u.name === payload.owner), payload.id, true);
        const t = ref().initialDecisionTrace;
        state.decisionTraces[payload.id] = {
          assetId: payload.code, activePolicyVersions: { ...t.activePolicyVersions }, activeRuleVersions: { ...t.activeRuleVersions },
          firedRules: [], skippedRules: [], failedRules: [], outputSummary: `${payload.assetName} · governed inputs pending`,
          explanationLog: ['Data extracted with AI from the uploaded documents.']
        };
      })
      .addCase(assetDeleted, (state, { payload: { id } }) => {
        delete state.decisionTraces[id];
        state.users.forEach(u => setAssignment(u, id, false));
      });
  }
});

export const { activityRecorded, userSaved, userReplaced, usersReplaced, userUpdated, assetAccessChanged } = adminSlice.actions;
export default adminSlice.reducer;
