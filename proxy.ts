import { NextResponse, type NextRequest } from "next/server";

const STATIC_ASSET_PATTERN =
  /\.(?:avif|gif|ico|jpg|jpeg|png|svg|webp|css|js|mjs|txt|xml|json|webmanifest|woff|woff2)$/i;

const MEDIA_ASSET_PATTERN =
  /\.(?:mp4|m4v|mov|webm|mp3|m4a|aac|wav|ogg)$/i;

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-DNS-Prefetch-Control": "on",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "magnetometer=()",
    "gyroscope=()",
    "accelerometer=()",
  ].join(", "),
  "X-Tates-TV": "online",
};

function isAdminApi(pathname: string): boolean {
  return pathname.startsWith("/api/admin");
}

function isHealthApi(pathname: string): boolean {
  return pathname === "/api/health";
}

function isProgrammingApi(pathname: string): boolean {
  return pathname === "/api/programming";
}

function isManifestOrSeoFile(pathname: string): boolean {
  return (
    pathname === "/manifest.webmanifest" ||
    pathname === "/site.webmanifest" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

function isStaticAsset(pathname: string): boolean {
  return STATIC_ASSET_PATTERN.test(pathname);
}

function isMediaAsset(pathname: string): boolean {
  return MEDIA_ASSET_PATTERN.test(pathname);
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
    response.headers.set(header, value);
  });

  return response;
}

function applyCacheHeaders(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const { pathname } = request.nextUrl;

  if (isAdminApi(pathname) || isHealthApi(pathname)) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  }

  if (isProgrammingApi(pathname)) {
    response.headers.set(
      "Cache-Control",
      "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
    );
    return response;
  }

  if (isManifestOrSeoFile(pathname) || isStaticAsset(pathname)) {
    response.headers.set(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    return response;
  }

  if (isMediaAsset(pathname)) {
    response.headers.set(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    response.headers.set("Accept-Ranges", "bytes");
    return response;
  }

  response.headers.set(
    "Cache-Control",
    "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
  );

  return response;
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  applySecurityHeaders(response);
  applyCacheHeaders(request, response);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all app routes except Next internals and source maps.
     */
    "/((?!_next/static|_next/image|.*\\.map$).*)",
  ],
};