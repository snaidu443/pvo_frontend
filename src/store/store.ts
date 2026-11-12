/**
 * Redux Toolkit store.
 *
 *   session     sign-in status, user, role
 *   ui          navigation, selection, filters
 *   assessment  assets + workspaces, draft, documents, fields, answers
 *   admin       users, policy governance, rules, decision traces, activity
 *
 * Components read with `useAppSelector` (or `useAppState()` for the flat view)
 * and change state through the action modules in src/actions, which dispatch
 * slice actions and call the API services.
 */
import { combineReducers, configureStore, createSelector, type UnknownAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { AppState } from './appState';
import { signedOut } from './sharedActions';
import admin from './slices/adminSlice';
import assessment from './slices/assessmentSlice';
import session from './slices/sessionSlice';
import ui from './slices/uiSlice';

const combined = combineReducers({ session, ui, assessment, admin });

/** Sign-out returns every slice to its initial state. */
const rootReducer = (state: ReturnType<typeof combined> | undefined, action: UnknownAction) =>
  combined(signedOut.match(action) ? undefined : state, action);

export const store = configureStore({
  reducer: rootReducer,
  middleware: getDefault => getDefault({
    // The dev-only checks walk the whole state; raise the warning threshold for the larger mock workspace.
    immutableCheck: { warnAfter: 200 },
    serializableCheck: { warnAfter: 200 }
  }),
  // Redux DevTools in development builds only (webpack sets NODE_ENV from --mode).
  devTools: process.env.NODE_ENV !== 'production'
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

/** Memoized flat view of all slices (same object until one of the slices changes). */
export const selectApp = createSelector(
  [(s: RootState) => s.session, (s: RootState) => s.ui, (s: RootState) => s.assessment, (s: RootState) => s.admin],
  (sessionState, uiState, assessmentState, adminState): AppState => ({ ...sessionState, ...uiState, ...assessmentState, ...adminState })
);

/** Flat state for components. Prefer `useAppSelector(s => s.<slice>.<field>)` for new, focused components. */
export const useAppState = (): AppState => useAppSelector(selectApp);

/** Flat state outside React (action modules, event handlers). */
export const getState = (): AppState => selectApp(store.getState());

export const dispatch: AppDispatch = store.dispatch;
