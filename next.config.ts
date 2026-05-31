import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).origin : "";

const allowedConnectSources = [
  "'self'",
  "https:",
  supabaseHost,
].filter(Boolean);

const allowedMediaSources = [
  "'self'",
  "blob:",
  "data:",
  "https:",
];

const allowedImageSources = [
  "'self'",
  "data:",
  "blob:",
  "https:",
];

const cspDirectives = [
  "default-src 'self'",
  [
    "script-src",
    "'self'",
    isDev ? "'unsafe-eval'" : "",
    /**
     * Next.js currently still needs inline scripts for normal app hydration.
     * Keep this until the app is fully nonce/hash-based.
     */
    "'unsafe-inline'",
  ]
    .filter(Boolean)
    .join(" "),
  "style-src 'self' 'unsafe-inline'",
  `img-src ${allowedImageSources.join(" ")}`,
  "font-src 'self' data:",
  `media-src ${allowedMediaSources.join(" ")}`,
  `connect-src ${allowedConnectSources.join(" ")}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspDirectives,
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "cross-origin",
  },
  {
    key: "Origin-Agent-Cluster",
    value: "?1",
  },
];

const cacheHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=31536000, immutable",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff|woff2)",
        headers: cacheHeaders,
      },
    ];
  },

  async redirects() {
    if (isDev) {
      return [];
    }

    return siteUrl.startsWith("https://www.")
      ? []
      : [
          {
            source: "/:path*",
            has: [
              {
                type: "host",
                value: "www.retrotv.ca",
              },
            ],
            destination: "https://retrotv.ca/:path*",
            permanent: true,
          },
        ];
  },
};

export default nextConfig;