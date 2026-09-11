import "server-only";

export function privateJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/** Bound actual bytes, including chunked requests without Content-Length. */
export async function readBoundedJson(
  request: Request,
  limit = 8192,
): Promise<unknown> {
  if (
    !(request.headers.get("content-type") ?? "")
      .toLowerCase()
      .includes("application/json") ||
    !request.body
  )
    return null;
  if (Number(request.headers.get("content-length") ?? 0) > limit) return null;
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(result.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
