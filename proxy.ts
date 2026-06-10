import { NextResponse, type NextRequest } from "next/server";

const STATIC_ASSET_PATTERN =
  /\.(?:avif|gif|ico|jpg|jpeg|png|svg|webp|css|js|mjs|map|txt|xml|webmanifest|woff|woff2)$/i;

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-DNS-Prefetch-Control", "on");

  response.headers.set(
    "Permissions-Policy",
    [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
    ].join(", "),
  );

  response.headers.set("X-Tates-TV", "online");

  return response;
}

function applyCacheHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/admin")) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  }

  if (pathname === "/api/health") {
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  }

  if (pathname === "/api/programming") {
    response.headers.set(
      "Cache-Control",
      "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
    );
    return response;
  }

  if (
    pathname === "/manifest.webmanifest" ||
    pathname === "/site.webmanifest" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    STATIC_ASSET_PATTERN.test(pathname)
  ) {
    response.headers.set(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
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
     * Match all routes except Next internals and raw source-map chunks.
     */
    "/((?!_next/static|_next/image|.*\\.map$).*)",
  ],
};

