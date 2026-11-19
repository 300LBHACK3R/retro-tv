import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { access, link, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const generator = fileURLToPath(new URL("./build-bif.mjs", import.meta.url));
const magic = Buffer.from("894249460d0a1a0a", "hex");
const mib = 1024 * 1024;
const maxBifBytes = 64 * mib;
const hashPattern = /^[a-f0-9]{64}$/;
const standaloneVideo = /\.(mp4|m4v|mov|mkv)$/i;
const longVideoSeconds = 15 * 60;
const adminOrigin = "https://www.tatestv.ca";
const bifContentType = "application/octet-stream";
const adminCookieName = /^(?:ttv-admin-password|ttv-admin-auth(?:\.\d+)?)$/;
const cookieValue = /^[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]+$/;
const usage = `Roku seek-index workflow
  plan --dir DIR --programming JSON --catalog JSON --source-origin HTTPS_ORIGIN
  status --dir DIR
  build --dir DIR [--limit 5] [--seeds JSON] [--max-video-mib 5120]
  upload --dir DIR --public-base HTTPS_URL (--remote REMOTE:BUCKET[/PREFIX] | --admin) [--limit 5]
  sql --dir DIR --public-base HTTPS_URL --output FILE.sql

The default batch size is five. Only upload writes remote objects.
The --admin upload prompts for an existing Tate’s TV Admin login.
The sql command writes a local transaction for review and leaves programming untouched.`;

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function fileHash(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

function httpsUrl(value) {
  assert(typeof value === "string" && value.trim() === value && !/[\r\n]/.test(value),
    "Expected an HTTPS URL.");
  const url = new URL(value);
  assert(url.protocol === "https:" && !url.username && !url.password && !url.hash,
    "Use an HTTPS URL without credentials or a fragment.");
  return url;
}

function cleanBase(value) {
  const url = httpsUrl(value);
  assert(!url.search, "The public base URL cannot contain a query string.");
  return url.href.replace(/\/+$/, "");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function present(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return false;
  }
}

function boundedInteger(value, label, max) {
  const number = Number(value);
  assert(Number.isSafeInteger(number) && number >= 1 && number <= max,
    `${label} must be an integer between 1 and ${max}.`);
  return number;
}

async function createPlan(dir, values) {
  const [envelope, catalog] = await Promise.all([
    readJson(values.programming), readJson(values.catalog),
  ]);
  const sourceOrigin = httpsUrl(values["source-origin"]);
  assert(sourceOrigin.href === `${sourceOrigin.origin}/`, "Use only the approved video origin, without a path.");
  assert(envelope.ok && envelope.source === "database" && Array.isArray(envelope.programming?.media),
    "Use the database-backed /api/programming response.");
  assert(catalog.ok && catalog.version === 1 && catalog.audience === "all" && Array.isArray(catalog.library),
    "Use the full public /api/roku/catalog?audience=all response.");
  const { programming } = envelope;
  assert(typeof catalog.updatedAt === "string" && catalog.updatedAt === programming.updatedAt,
    "Programming changed between the two requests. Fetch both responses again.");

  const byId = new Map(programming.media.map(item => [item.id, item]));
  assert(byId.size === programming.media.length, "Programming has duplicate media IDs.");
  const eligibleIds = new Set();
  let alreadyIndexed = 0;
  const unsupported = [];
  const sources = new Map();

  for (const { items } of catalog.library) {
    for (const item of items) {
      if (!(item.duration > longVideoSeconds) || eligibleIds.has(item.id)) continue;
      assert(typeof item.id === "string" && item.id.startsWith("media:"), "Unknown catalog media ID.");
      eligibleIds.add(item.id);
      const entry = byId.get(item.id.slice(6));
      assert(entry && entry.duration === item.duration, `Catalog media ${item.id} differs from programming.`);
      const prior = entry.rokuSeekIndex;
      if (prior?.sourceFile === entry.file && typeof prior.hdBifUrl === "string" &&
          /^https:\/\/[^?#]+\.bif(?:\?[^#]*)?$/i.test(prior.hdBifUrl)) {
        alreadyIndexed++;
        continue;
      }
      let video;
      try {
        video = httpsUrl(entry.file);
      } catch {
        unsupported.push({ id: entry.id, reason: "source is not an absolute HTTPS video URL" });
        continue;
      }
      if (video.origin !== sourceOrigin.origin || !standaloneVideo.test(video.pathname)) {
        unsupported.push({ id: entry.id, reason: "source origin or video format needs a separate workflow" });
        continue;
      }
      let job = sources.get(entry.file);
      if (!job) {
        job = { key: sha256(entry.file), sourceFile: entry.file, duration: 0, ids: [] };
        sources.set(entry.file, job);
      }
      job.duration = Math.max(job.duration, item.duration);
      job.ids.push(entry.id);
    }
  }
  const plan = { sourceOrigin: sourceOrigin.origin, updatedAt: catalog.updatedAt,
    eligible: eligibleIds.size, alreadyIndexed, unsupported, jobs: [...sources.values()] };
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "plan.json"), JSON.stringify(plan, null, 2) + "\n", { flag: "wx" });
  return plan;
}

async function readPlan(dir) {
  const plan = await readJson(join(dir, "plan.json"));
  const origin = httpsUrl(plan.sourceOrigin).origin;
  assert(Array.isArray(plan.jobs) && plan.jobs.every(job =>
    job.key === sha256(job.sourceFile) && hashPattern.test(job.key) &&
    httpsUrl(job.sourceFile).origin === origin && standaloneVideo.test(httpsUrl(job.sourceFile).pathname) &&
    Number.isFinite(job.duration) && job.duration > longVideoSeconds &&
    Array.isArray(job.ids) && job.ids.length && job.ids.every(id => typeof id === "string" && id.length)),
  "Invalid BIF plan.");
  return plan;
}

function artifactPath(dir, job) {
  return join(dir, "bif", `${job.key}.bif`);
}

function receiptPath(dir, job) {
  return join(dir, "receipts", `${job.key}.json`);
}

function objectKey(job, digest) {
  return `RokuSeek/${job.key}-${digest}.bif`;
}

async function showStatus(dir, plan) {
  let prepared = 0;
  let verified = 0;
  for (const job of plan.jobs) {
    if (await present(artifactPath(dir, job))) prepared += job.ids.length;
    if (await present(receiptPath(dir, job))) verified += job.ids.length;
  }
  console.log(`Long VOD titles: ${plan.eligible}. Already indexed at planning: ${plan.alreadyIndexed}. ` +
    `Prepared locally: ${prepared}. Upload receipts: ${verified}. Unsupported: ${plan.unsupported.length}.`);
}

function checkLength(response, max) {
  const declared = Number(response.headers.get("content-length"));
  assert(!Number.isFinite(declared) || declared <= max, "Remote file exceeds the byte limit.");
}

function byteLimit(max) {
  let received = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      received += chunk.length;
      callback(received > max ? new Error("Remote file exceeds the byte limit.") : null, chunk);
    },
  });
}

async function download(url, target, max) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30 * 60_000) });
  try {
    assert(response.status === 200 && response.body, `Source download returned HTTP ${response.status}.`);
    checkLength(response, max);
    await pipeline(Readable.fromWeb(response.body), byteLimit(max), createWriteStream(target, { flags: "wx" }));
  } finally {
    if (!response.bodyUsed) await response.body?.cancel();
  }
}

async function verifyBif(path, duration) {
  const { size } = await stat(path);
  assert(size >= 84 && size <= maxBifBytes, "The BIF is empty or too large.");
  const data = await readFile(path);
  assert(data.subarray(0, magic.length).equals(magic) && data.readUInt32LE(8) === 0 &&
    data.readUInt32LE(16) === 10_000, "Invalid Roku BIF header.");
  const count = data.readUInt32LE(12);
  // Tolerate normal runtime rounding, but reject a partial or different video.
  assert(count > 0 && Math.abs(count * 10 - duration) <= 30,
    "The BIF does not cover the catalog runtime.");
  const firstOffset = 64 + (count + 1) * 8;
  assert(firstOffset < size && data.readUInt32LE(68) === firstOffset &&
    data.readUInt32LE(firstOffset - 8) === 0xffffffff &&
    data.readUInt32LE(firstOffset - 4) === size, "Invalid Roku BIF index.");
  for (let frame = 0; frame < count; frame++) {
    const entry = 64 + frame * 8;
    const offset = data.readUInt32LE(entry + 4);
    const end = data.readUInt32LE(entry + 12);
    assert(data.readUInt32LE(entry) === frame && offset >= firstOffset && end <= size &&
      end - offset >= 4 && data.readUInt16BE(offset) === 0xffd8 &&
      data.readUInt16BE(end - 2) === 0xffd9, "Invalid Roku BIF image.");
  }
  return { digest: sha256(data), size };
}

function runChecked(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  assert(result.status === 0, `${command} exited with ${result.signal ?? result.status}.`);
}

async function buildBatch(dir, plan, values) {
  const limit = boundedInteger(values.limit, "--limit", 10_000);
  const max = boundedInteger(values["max-video-mib"], "--max-video-mib", 16_384) * mib;
  const seedManifest = values.seeds ? await readJson(values.seeds) : { schemaVersion: 1, seeds: [] };
  assert(seedManifest.schemaVersion === 1 && Array.isArray(seedManifest.seeds), "Invalid verified seed manifest.");
  const seeds = new Map(seedManifest.seeds.map(seed => [seed.sourceFile, seed]));
  assert(seeds.size === seedManifest.seeds.length, "The seed manifest has duplicate source URLs.");
  await mkdir(join(dir, "bif"), { recursive: true });
  let attempted = 0;
  let failed = 0;
  for (const job of plan.jobs) {
    const output = artifactPath(dir, job);
    if (await present(output)) continue;
    const seed = seeds.get(job.sourceFile);
    if (values.seeds && !seed) continue;
    if (attempted >= limit) break;
    attempted++;
    const temp = await mkdtemp(join(dir, ".video-"));
    try {
      const path = seed ? resolve(seed.localFile) : join(temp, "source" + new URL(job.sourceFile).pathname.match(standaloneVideo)[0]);
      if (seed) {
        assert(hashPattern.test(seed.sha256) && await fileHash(path) === seed.sha256,
          "The local seed does not match its previously verified upload digest.");
      } else {
        await download(job.sourceFile, path, max);
      }
      const pending = join(temp, "preview.bif");
      runChecked(process.execPath, [generator, path, pending]);
      await verifyBif(pending, job.duration);
      // Atomic, no-replace move on the same filesystem.
      await link(pending, output);
    } catch (error) {
      failed++;
      console.error(`BIF failed for ${job.ids[0]}: ${error.message}`);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }
  if (failed) process.exitCode = 1;
}

async function publicMatches(url, digest, size) {
  const response = await fetch(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(60_000) });
  try {
    if (response.status === 404) return false;
    assert(response.status === 200 && response.body, `Public BIF returned HTTP ${response.status}.`);
    checkLength(response, size);
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of Readable.fromWeb(response.body)) {
      bytes += chunk.length;
      assert(bytes <= size, "The public BIF is larger than the verified local index.");
      hash.update(chunk);
    }
    assert(bytes === size && hash.digest("hex") === digest, "The public BIF differs from the verified local index.");
    return true;
  } finally {
    if (!response.bodyUsed) await response.body?.cancel();
  }
}

function adminCookieHeader(pairs) {
  const cookies = new Map();
  for (const pair of pairs) {
    const equalSign = pair.indexOf("=");
    if (equalSign < 0) continue;
    const name = pair.slice(0, equalSign).trim();
    const value = pair.slice(equalSign + 1).trim();
    if (!adminCookieName.test(name)) continue;
    if (cookieValue.test(value)) cookies.set(name, value);
    else cookies.delete(name);
  }
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function signInToAdmin() {
  const existingCookie = process.env.TTV_BIF_ADMIN_COOKIE;
  if (existingCookie) {
    const cookie = adminCookieHeader(existingCookie.split(";"));
    assert(cookie, "TTV_BIF_ADMIN_COOKIE has no usable Tate’s TV Admin session.");
    return cookie;
  }
  assert(process.stdin.isTTY && process.stderr.isTTY, "Run --admin from an interactive terminal to sign in.");

  let hidden = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (hidden) callback();
      else process.stderr.write(chunk, encoding, callback);
    },
  });
  const terminal = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  const controller = new AbortController();
  const cancel = () => controller.abort(new Error("Admin sign-in cancelled."));
  terminal.once("SIGINT", cancel);
  terminal.once("close", cancel);
  let email;
  let password;
  try {
    const options = { signal: controller.signal };
    email = (await terminal.question("Admin email (leave blank for password-only access): ", options)).trim();
    hidden = true;
    process.stderr.write("Admin password: ");
    password = await terminal.question("", options);
  } finally {
    terminal.close();
    if (hidden) process.stderr.write("\n");
  }
  assert(email.length <= 254 && password.length >= 1 && password.length <= 512, "Provide valid Admin credentials.");

  const response = await fetch(`${adminOrigin}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: adminOrigin },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  const cookie = adminCookieHeader(response.headers.getSetCookie().map(header => header.split(";", 1)[0]));
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error(`Tate’s TV Admin sign-in returned HTTP ${response.status}.`);
  }
  assert((await response.json()).ok && cookie, "Tate’s TV did not return an Admin session.");
  return cookie;
}

async function uploadAsAdmin(path, key, size, publicUrl, cookie) {
  const request = await fetch(`${adminOrigin}/api/admin/uploads/sign`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: adminOrigin, cookie },
    body: JSON.stringify({ purpose: "roku-bif", filename: basename(key), contentType: bifContentType, size }),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  if (request.status !== 200) {
    await request.body?.cancel();
    throw new Error(`Tate’s TV upload signer returned HTTP ${request.status}.`);
  }
  const signed = await request.json();
  assert(signed.ok && signed.objectKey === key && signed.publicUrl === publicUrl,
    "The upload signer did not return the requested BIF object and public URL.");
  const destination = httpsUrl(signed.uploadUrl);
  assert(/^[a-f0-9]+\.r2\.cloudflarestorage\.com$/.test(destination.hostname) &&
    destination.pathname.endsWith("/" + key),
  "The signed upload destination is not the requested Cloudflare R2 object.");
  const data = await readFile(path);
  assert(data.length === size, "The local BIF changed before upload.");
  const upload = await fetch(destination, {
    method: "PUT",
    headers: { "content-type": bifContentType, "content-length": String(size), "if-none-match": "*" },
    body: data,
    redirect: "error",
    signal: AbortSignal.timeout(2 * 60_000),
  });
  await upload.body?.cancel();
  assert(upload.ok || upload.status === 412, `Cloudflare R2 upload returned HTTP ${upload.status}.`);
}

async function uploadBatch(dir, plan, values) {
  const limit = boundedInteger(values.limit, "--limit", 10_000);
  const base = cleanBase(values["public-base"]);
  assert(values.admin || /^[a-zA-Z0-9_-]+:[a-zA-Z0-9._/-]+$/.test(values.remote ?? ""),
    "Use a configured rclone destination in the form REMOTE:BUCKET[/PREFIX].");
  const remote = values.remote?.replace(/\/+$/, "");
  await mkdir(join(dir, "receipts"), { recursive: true });
  let attempted = 0;
  let adminSession;
  for (const job of plan.jobs) {
    const path = artifactPath(dir, job);
    if (!(await present(path)) || await present(receiptPath(dir, job))) continue;
    if (attempted++ >= limit) break;
    const { digest, size } = await verifyBif(path, job.duration);
    const key = objectKey(job, digest);
    const hdBifUrl = `${base}/${key}`;
    if (!(await publicMatches(hdBifUrl, digest, size))) {
      if (values.admin) {
        adminSession ??= await signInToAdmin();
        await uploadAsAdmin(path, key, size, hdBifUrl, adminSession);
      } else {
        runChecked("rclone", ["copyto", "--immutable", path, `${remote}/${key}`]);
      }
      assert(await publicMatches(hdBifUrl, digest, size), "The uploaded BIF is unavailable at its public URL.");
    }
    await writeFile(receiptPath(dir, job), JSON.stringify({ digest, size, hdBifUrl }) + "\n", { flag: "wx" });
    console.log(`Verified public BIF for ${job.ids[0]}.`);
  }
}

async function emitSql(dir, plan, values) {
  const base = cleanBase(values["public-base"]);
  const changes = [];
  for (const job of plan.jobs) {
    if (!(await present(receiptPath(dir, job)))) continue;
    const receipt = await readJson(receiptPath(dir, job));
    const { digest, size } = await verifyBif(artifactPath(dir, job), job.duration);
    const hdBifUrl = `${base}/${objectKey(job, digest)}`;
    assert(receipt.digest === digest && receipt.size === size && receipt.hdBifUrl === hdBifUrl,
      `The upload receipt does not match the verified BIF for ${job.ids[0]}.`);
    assert(await publicMatches(hdBifUrl, digest, size), `Public BIF missing for ${job.ids[0]}.`);
    for (const id of job.ids) changes.push({ id, source_file: job.sourceFile, hd_bif_url: hdBifUrl });
  }
  assert(changes.length && new Set(changes.map(row => row.id)).size === changes.length,
    "Expected at least one verified upload and unique programming IDs.");
  const data = JSON.stringify(changes).replace(/'/g, "''");
  const delimiter = `$roku_bif_${sha256(data).slice(0, 20)}$`;
  assert(!data.includes(delimiter), "Unexpected SQL delimiter collision.");
  const sql = `-- Apply only verified, current-source Roku seek indexes.
begin;
set local standard_conforming_strings = on;
do ${delimiter}
declare
  changes constant jsonb := '${data}'::jsonb;
  current_data jsonb;
  updated_media jsonb;
begin
  select data into strict current_data from public.programming_state
    where id = 'main' for update;
  if exists (
    select 1 from jsonb_to_recordset(changes) as w(id text, source_file text, hd_bif_url text)
    where (select count(*) from jsonb_array_elements(current_data->'media') as m(item)
      where m.item->>'id' = w.id) <> 1
      or (select count(*) from jsonb_array_elements(current_data->'media') as m(item)
      where m.item->>'id' = w.id and m.item->>'file' = w.source_file
        and (m.item->'rokuSeekIndex' is null
          or m.item->'rokuSeekIndex' = 'null'::jsonb
          or m.item #>> '{rokuSeekIndex,sourceFile}' is distinct from w.source_file
          or m.item #>> '{rokuSeekIndex,hdBifUrl}' = w.hd_bif_url)) <> 1
  ) then
    raise exception 'A video source or current seek index changed. Refresh programming before applying.';
  end if;
  select jsonb_agg(case when w.id is null then m.item else
    jsonb_set(m.item, '{rokuSeekIndex}', jsonb_build_object('sourceFile', w.source_file, 'hdBifUrl', w.hd_bif_url))
    end order by m.ordinality) into updated_media
  from jsonb_array_elements(current_data->'media') with ordinality as m(item, ordinality)
  left join jsonb_to_recordset(changes) as w(id text, source_file text, hd_bif_url text)
    on m.item->>'id' = w.id and m.item->>'file' = w.source_file;
  if updated_media is distinct from current_data->'media' then
    update public.programming_state
    set data = jsonb_set(jsonb_set(current_data, '{media}', updated_media),
      '{updatedAt}', to_jsonb(to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),
      updated_at = clock_timestamp()
    where id = 'main';
  end if;
end
${delimiter};
commit;
`;
  await writeFile(values.output, sql, { flag: "wx" });
  console.log(`Wrote a local transaction for ${changes.length} verified media entries.`);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean" }, dir: { type: "string" },
      programming: { type: "string" }, catalog: { type: "string" },
      "source-origin": { type: "string" }, seeds: { type: "string" },
      "max-video-mib": { type: "string", default: "5120" },
      limit: { type: "string", default: "5" },
      admin: { type: "boolean" },
      remote: { type: "string" }, "public-base": { type: "string" }, output: { type: "string" },
    },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  const [mode] = positionals;
  const modes = { plan: createPlan, status: showStatus, build: buildBatch, upload: uploadBatch, sql: emitSql };
  assert(positionals.length === 1 && Object.hasOwn(modes, mode) && values.dir, usage);
  const dir = resolve(values.dir);
  if (mode === "plan") {
    assert(values.programming && values.catalog && values["source-origin"], usage);
    return showStatus(dir, await createPlan(dir, values));
  }
  if (mode === "sql") assert(values.output && values["public-base"], usage);
  if (mode === "upload") assert(Boolean(values.remote) !== Boolean(values.admin) && values["public-base"], usage);
  const plan = await readPlan(dir);
  await modes[mode](dir, plan, values);
  if (mode !== "status") await showStatus(dir, plan);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
