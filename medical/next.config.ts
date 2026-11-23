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
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), publickey-credentials-get=(self), publickey-credentials-create=(self)",
  },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000",
        },
      ]),
];

const pageHeaders = [
  ...sharedHeaders,
  ...(isDev
    ? [{ key: "Cache-Control", value: "no-store" }]
    : []),
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
  serverExternalPackages: [
    "tesseract.js",
    "tesseract.js-core",
    "unpdf",
    "@napi-rs/canvas",
  ],
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    proxyClientMaxBodySize: "32mb",
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    serverActions: {
      bodySizeLimit: "32mb",
    },
    // Auth layout wraps pages in Suspense; don't auto-validate every route
    // for Instant Navigation (pages can opt in with `export const instant = true`).
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  outputFileTracingIncludes: {
    "/profiles/**": [
      "./ocr/**/*",
      // The OCR worker thread is loaded from the real pnpm path, so its
      // sibling dependencies (bmp-js, is-url, tesseract.js-core, ...) must
      // ship with the function too.
      "./node_modules/tesseract.js/**/*",
      "./node_modules/.pnpm/tesseract.js@*/node_modules/**/*",
    ],
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
