/**
 * Whether a request to a session route handler comes from this app's own pages (login CSRF). A cross-site form can
 * post `text/plain` or a form encoding without a preflight, but not JSON, and a browser always says where a request
 * comes from with `Sec-Fetch-Site` / `Origin`. The origin is compared with the host the app is served from, as a
 * reverse proxy forwards it. Kept apart from server.ts (server-only) so that it can be tested.
 */
export function isSameOriginJson(headers: Headers): boolean {
  const fetchSite = headers.get("Sec-Fetch-Site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  const origin = headers.get("Origin");
  if (origin) {
    const host = (headers.get("X-Forwarded-Host") ?? headers.get("Host"))?.split(",")[0].trim().toLowerCase();
    if (!host || originHost(origin) !== host) return false;
  }

  const hasBody = Number(headers.get("Content-Length") ?? 0) > 0 || headers.has("Transfer-Encoding");
  const contentType = headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  return !hasBody || contentType === "application/json";
}

function originHost(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null; // "null" (an opaque origin) or garbage
  }
}
