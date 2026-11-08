/** Serve synthetic media like object storage, including byte-range seeking. */
export function mediaResponse(bytes: Buffer, range?: string) {
  const headers: Record<string, string> = {
    "content-type": "video/webm",
    "accept-ranges": "bytes",
  };
  if (!range) return { status: 200, headers: { ...headers, "content-length": String(bytes.length) }, body: bytes };

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start = 0;
  let end = bytes.length - 1;
  if (match?.[1]) {
    start = Number(match[1]);
    if (match[2]) end = Math.min(end, Number(match[2]));
  } else if (match?.[2]) {
    start = Math.max(0, bytes.length - Number(match[2]));
  }
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) || start > end || start >= bytes.length) {
    return { status: 416, headers: { ...headers, "content-range": `bytes */${bytes.length}` }, body: Buffer.alloc(0) };
  }
  const body = bytes.subarray(start, end + 1);
  return { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${bytes.length}`, "content-length": String(body.length) }, body };
}
