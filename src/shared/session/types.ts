/** What the browser receives about a session: the refresh token stays in an httpOnly cookie. */
export type SessionInfo = {
  accessToken: string;
  accessTokenExpiresAt: string;
};

export type Credentials = {
  userName: string;
  password: string;
};

/** Route handlers (BFF) that manage the session cookie, see src/app/api/session. */
export const SESSION_ENDPOINT = "/api/session";
export const SESSION_REFRESH_ENDPOINT = "/api/session/refresh";
/** Accepts an invitation (creating the account) and signs in as it, see src/app/api/session/invitation/[token]. */
export const sessionInvitationEndpoint = (token: string) => `/api/session/invitation/${encodeURIComponent(token)}`;
