import { spawnSync } from "node:child_process";
import { closeSync, fstatSync, linkSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";

// Roku version 0 BIF layout: https://developer.roku.com/dev/docs/bif-file-creation
const magic = Buffer.from([0x89, 0x42, 0x49, 0x46, 0x0d, 0x0a, 0x1a, 0x0a]);
const intervalSeconds = 10;
const headerSize = 64;
const entrySize = 8;
const endOfIndex = 0xffffffff;
const usage = "Usage: node roku/scripts/build-bif.mjs <local-video> <output.bif>";

function writeBif(path, framePaths) {
  const header = Buffer.alloc(headerSize);
  magic.copy(header);
  header.writeUInt32LE(framePaths.length, 12);
  header.writeUInt32LE(intervalSeconds * 1000, 16);

  const index = Buffer.alloc(entrySize * (framePaths.length + 1));
  const sizes = framePaths.map(file => statSync(file).size);
  let offset = header.length + index.length;
  sizes.forEach((size, timestamp) => {
    if (size < 4 || size > endOfIndex - offset) throw new Error("The BIF frame sizes are out of range.");
    const entry = entrySize * timestamp;
    index.writeUInt32LE(timestamp, entry);
    index.writeUInt32LE(offset, entry + 4);
    offset += size;
  });
  index.writeUInt32LE(endOfIndex, index.length - 8);
  index.writeUInt32LE(offset, index.length - 4);

  const output = openSync(path, "wx");
  try {
    writeFileSync(output, header);
    writeFileSync(output, index);
    framePaths.forEach((file, timestamp) => {
      const frame = readFileSync(file);
      if (frame.length !== sizes[timestamp] || frame.readUInt16BE(0) !== 0xffd8 || frame.readUInt16BE(frame.length - 2) !== 0xffd9) {
        throw new Error(`Invalid JPEG at ${timestamp * intervalSeconds} seconds.`);
      }
      writeFileSync(output, frame);
    });
    if (fstatSync(output).size !== offset) throw new Error("The BIF index does not match the file size.");
  } finally {
    closeSync(output);
  }
}

function buildBif(input, output) {
  const inputPath = resolve(input);
  if (!statSync(inputPath).isFile()) throw new Error("Choose a local video file.");
  const outputPath = resolve(output);
  if (extname(outputPath).toLowerCase() !== ".bif") throw new Error("The output path must end in .bif.");

  const frames = mkdtempSync(join(tmpdir(), "roku-bif-frames-"));
  try {
    // Start at the first displayed frame, sample at 0/10/20 seconds, and
    // keep the source display aspect ratio even for anamorphic videos.
    const filter = `setpts=PTS-STARTPTS,fps=1/${intervalSeconds}:start_time=0:round=up:eof_action=pass,scale=320:trunc(320/dar/2)*2,setsar=1`;
    const ffmpeg = spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-xerror",
      "-protocol_whitelist", "file", "-i", inputPath, "-map", "0:V:0",
      "-vf", filter, "-c:v", "mjpeg", "-q:v", "4", "-start_number", "0", "%08d.jpg",
    ], { cwd: frames, stdio: "inherit" });
    if (ffmpeg.error) throw ffmpeg.error;
    if (ffmpeg.status !== 0) throw new Error(`FFmpeg failed (${ffmpeg.signal ?? ffmpeg.status}).`);

    const names = readdirSync(frames).sort();
    if (!names.length || names.some((name, index) => name !== `${String(index).padStart(8, "0")}.jpg`)) {
      throw new Error("FFmpeg did not produce a complete sequence of preview frames.");
    }

    // Stage on the output volume, then publish the verified archive without
    // overwriting an existing file or exposing a partially generated BIF.
    const staging = mkdtempSync(join(dirname(outputPath), ".roku-bif-"));
    try {
      const archive = join(staging, "preview.bif");
      writeBif(archive, names.map(name => join(frames, name)));
      linkSync(archive, outputPath);
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
    console.log(`Created ${outputPath} with ${names.length} HD thumbnails.`);
  } finally {
    rmSync(frames, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
  console.log(usage);
} else if (args.length !== 2) {
  console.error(usage);
  process.exitCode = 1;
} else {
  try {
    buildBif(...args);
  } catch (error) {
    console.error(`Could not generate Roku BIF: ${error.message}`);
    process.exitCode = 1;
  }
}
