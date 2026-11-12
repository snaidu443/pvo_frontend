import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SessionUser } from '../../types/domain';
import { initialSession } from '../appState';
import { disclaimerAccepted, roleSwitched, workspaceLoaded } from '../sharedActions';

const sessionSlice = createSlice({
  name: 'session',
  initialState: initialSession,
  reducers: {
    loginStarted(state, action: PayloadAction<SessionUser>) {
      state.status = 'loading';
      state.session = action.payload;
      state.role = action.payload.role;
    },
    loginFailed() {
      return initialSession();
    }
  },
  extraReducers: builder => {
    builder
      .addCase(workspaceLoaded, state => { state.status = 'disclaimer'; })
      .addCase(disclaimerAccepted, state => { state.status = 'ready'; })
      .addCase(roleSwitched, (state, { payload }) => { state.role = payload.role; });
  }
});

export const { loginStarted, loginFailed } = sessionSlice.actions;
export default sessionSlice.reducer;
