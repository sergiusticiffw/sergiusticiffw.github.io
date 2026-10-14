import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

function contentSecurityPolicy(frameAncestors: "'none'" | "'self'") {
  return [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const sharedHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const pageHeaders = [
  ...sharedHeaders,
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy("'none'"),
  },
];

const documentHeaders = [
  ...sharedHeaders,
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy("'self'"),
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ["tesseract.js", "unpdf", "@napi-rs/canvas"],
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "32mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/((?!api/documents).*)",
        headers: pageHeaders,
      },
      {
        source: "/api/documents/:path*",
        headers: documentHeaders,
      },
    ];
  },
};

export default nextConfig;
