import type { NextConfig } from "next";

/** Address of Portal.BE, read on the server only (see .env.development). */
const portalApiUrl = process.env.PORTAL_API_URL ?? "http://localhost:5128";

const nextConfig: NextConfig = {
  // The sidebar's user menu sits bottom-left; keep the dev tools button out of its way.
  devIndicators: { position: "bottom-right" },

  // The browser calls the API through this app ("/backend/api/..."), so there is no CORS
  // to configure and the back-end address lives in a single server-side setting.
  async rewrites() {
    return [{ source: "/backend/:path*", destination: `${portalApiUrl}/:path*` }];
  },

  // Security headers for every response, the proxied "/backend/..." ones included. Only the frame-ancestors directive
  // of a CSP is set: no page may be framed (clickjacking); a full policy would need per-request nonces.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // The invitation token is in this page's URL: never send it on, not even as the origin of a request.
      // Listed last so that it overrides the Referrer-Policy above.
      { source: "/invite/:token", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },

  // Post videos are up to 100 MB (Portal.BE PostFileRules): without this the proxy forwards only the first 10 MB,
  // and a slow upload needs more than its default 30 s.
  experimental: {
    proxyClientMaxBodySize: "110mb",
    proxyTimeout: 120_000,
  },
};

export default nextConfig;
