import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SessionInfo } from "./types";

/**
 * - `unknown`: the app has not yet checked whether a session exists (first render).
 * - `authenticated`: an access token is held in memory.
 * - `anonymous`: no session; the user must sign in.
 */
export type SessionStatus = "unknown" | "authenticated" | "anonymous";

export type SessionState = {
  status: SessionStatus;
  /** Short-lived access token. Kept in memory only, never in localStorage. */
  accessToken: string | null;
};

const initialState: SessionState = { status: "unknown", accessToken: null };

export const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<SessionInfo>) {
      state.status = "authenticated";
      state.accessToken = action.payload.accessToken;
    },
    signedOut(state) {
      state.status = "anonymous";
      state.accessToken = null;
    },
  },
  selectors: {
    selectSessionStatus: (state) => state.status,
    selectAccessToken: (state) => state.accessToken,
  },
});

export const { signedIn, signedOut } = sessionSlice.actions;
export const { selectSessionStatus, selectAccessToken } = sessionSlice.selectors;
