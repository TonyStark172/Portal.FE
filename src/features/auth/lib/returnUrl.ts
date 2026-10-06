export const RETURN_URL_PARAM = "returnUrl";

/**
 * Only allows returning to a page of this app ("/users"), never to another site
 * ("//evil.com", "https://...") or a "javascript:" URL.
 */
export function safeReturnUrl(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

export const loginUrl = (returnUrl: string) =>
  returnUrl === "/" ? "/login" : `/login?${RETURN_URL_PARAM}=${encodeURIComponent(returnUrl)}`;
