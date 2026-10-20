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

  // Post videos are up to 100 MB (Portal.BE PostFileRules): without this the proxy forwards only the first 10 MB,
  // and a slow upload needs more than its default 30 s.
  experimental: {
    proxyClientMaxBodySize: "110mb",
    proxyTimeout: 120_000,
  },
};

export default nextConfig;
