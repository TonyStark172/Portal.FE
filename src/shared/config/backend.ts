/**
 * Path prefix under which the browser reaches Portal.BE.
 * next.config.ts rewrites "/backend/*" to the back end, so avatar URLs such as
 * "/api/Profiles/3/avatar" become "/backend/api/Profiles/3/avatar".
 */
export const BACKEND_PREFIX = "/backend";

export const backendUrl = (path: string) => `${BACKEND_PREFIX}${path}`;
