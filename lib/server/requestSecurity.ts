import "server-only";

type RateBucket = {
  count: number;
  resetAt: number;
};

type GlobalRateStore = typeof globalThis & {
  __ttvRateBuckets?: Map<string, RateBucket>;
};

function getRateStore(): Map<string, RateBucket> {
  const globalStore = globalThis as GlobalRateStore;

  if (!globalStore.__ttvRateBuckets) {
    globalStore.__ttvRateBuckets = new Map<string, RateBucket>();
  }

  return globalStore.__ttvRateBuckets;
}

export function getClientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function consumeRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const store = getRateStore();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  store.set(key, current);

  return {
    allowed: true,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();

    return (
      process.env.NODE_ENV !== "production" ||
      fetchSite === "same-origin" ||
      fetchSite === "same-site" ||
      fetchSite === "none"
    );
  }

  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    return requestUrl.host === originUrl.host && requestUrl.protocol === originUrl.protocol;
  } catch {
    return false;
  }
}
