import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const advisory = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
export const reviewDeadline = Date.parse('2026-12-18T00:00:00Z');
const originals = {
  '2.3.2': '3a91656f440069aa8f8e15c9d695b9f6b2209df1eab2be8127c72cbcca45ff5f',
  '4.0.4': 'ce57c04e04994b83e2ca566170fa192e6fe19d710bea6da00ce2f76d01c0dea4',
};
const before = '    const analysis = analyzeRepeatedExtglob(body, opts);';
const after = [
  '    // Tate\'s TV: temporarily literalize ALL +(...) and *(...) extglobs.',
  '    // GHSA-fc5q-39xc-vjpf; remove when upstream ships a reviewed fix.',
  '    const analysis = { risky: true };',
].join('\n');
const hash = (text) => createHash('sha256').update(text).digest('hex');

// Accept only the exact upstream bytes or our exact reversible transformation.
// Versions are not renamed: npm audit must continue reporting the advisory.
export function guardedSource(source, version) {
  const expected = originals[version];
  if (!expected) throw new Error(`Unreviewed picomatch version: ${version}`);
  if (hash(source) === expected && source.split(before).length === 2) {
    return source.replace(before, after);
  }
  if (source.split(after).length === 2 && hash(source.replace(after, before)) === expected) {
    return source;
  }
  throw new Error(`Unexpected picomatch ${version} parser bytes; review required`);
}

export function checkParsers(root, { apply = false } = {}) {
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
  const verified = new Set();
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!/(^|\/)node_modules\/picomatch$/.test(path)) continue;
    if (entry.dev !== true) throw new Error(`picomatch must remain build-only: ${path}`);
    const parser = resolve(root, path, 'lib/parse.js');
    // Production-only installs intentionally omit these development packages.
    if (apply && !existsSync(parser)) continue;
    const installed = JSON.parse(readFileSync(resolve(root, path, 'package.json'), 'utf8'));
    if (installed.name !== 'picomatch' || installed.version !== entry.version) {
      throw new Error(`Installed picomatch does not match lockfile: ${path}`);
    }
    const source = readFileSync(parser, 'utf8');
    const guarded = guardedSource(source, entry.version);
    if (source !== guarded) {
      if (!apply) throw new Error(`Missing picomatch protection: ${path}`);
      writeFileSync(parser, guarded);
    }
    verified.add(path);
  }
  return { lock, verified };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { verified } = checkParsers(process.cwd(), { apply: true });
  console.log(`Protected ${verified.size} build-only picomatch parser(s).`);
}
