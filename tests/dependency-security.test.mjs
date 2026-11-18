import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { reviewAudit } from '../scripts/security/audit.mjs';
import { advisory, checkParsers, guardedSource, reviewDeadline } from '../scripts/security/picomatch.mjs';

const root = resolve(import.meta.dirname, '..');
const now = Date.parse('2026-11-18T00:00:00Z');
const fixture = () => ({
  report: {
    auditReportVersion: 2,
    metadata: { vulnerabilities: { total: 2 } },
    vulnerabilities: {
      picomatch: { nodes: ['node_modules/picomatch'], via: [{ name: 'picomatch', url: advisory }] },
      compiler: { nodes: ['node_modules/compiler'], via: ['picomatch'] },
    },
  },
  lock: { packages: { 'node_modules/picomatch': { dev: true }, 'node_modules/compiler': { dev: true } } },
  verified: new Set(['node_modules/picomatch']),
});

test('accept only the reviewed advisory and its dev-only dependency chain', () => {
  const { report, lock, verified } = fixture();
  assert.equal(reviewAudit(report, lock, verified, now), 2);
  report.vulnerabilities = {};
  report.metadata.vulnerabilities.total = 0;
  assert.equal(reviewAudit(report, lock, verified, now), 0);
});

for (const [name, mutate] of [
  ['new advisory on the same package', ({ report }) => report.vulnerabilities.picomatch.via.push({ name: 'picomatch', url: 'https://example.com/new-advisory' })],
  ['new advisory on a parent', ({ report }) => report.vulnerabilities.compiler.via.push({ name: 'compiler', url: advisory })],
  ['unprotected parser', ({ verified }) => verified.clear()],
  ['runtime dependency', ({ lock }) => { lock.packages['node_modules/picomatch'].dev = false; }],
  ['runtime parent', ({ lock }) => { lock.packages['node_modules/compiler'].dev = false; }],
  ['missing lockfile node', ({ lock }) => { delete lock.packages['node_modules/compiler']; }],
  ['new unverified nested copy', ({ report, lock }) => {
    const path = 'node_modules/compiler/node_modules/picomatch';
    report.vulnerabilities.picomatch.nodes.push(path);
    lock.packages[path] = { dev: true };
  }],
  ['audit network error', ({ report }) => { report.error = { code: 'ECONNRESET' }; }],
  ['invalid report schema', ({ report }) => { report.auditReportVersion = 99; }],
  ['missing advisory details', ({ report }) => { report.vulnerabilities.picomatch.via = []; }],
  ['missing dependency finding', ({ report }) => { delete report.vulnerabilities.picomatch; }],
  ['circular findings', ({ report }) => { report.vulnerabilities.picomatch.via = ['compiler']; }],
]) {
  test(`security review rejects ${name}`, () => {
    const f = fixture(); mutate(f);
    assert.throws(() => reviewAudit(f.report, f.lock, f.verified, now));
  });
}

test('temporary review expires rather than silently allowing an old exception', () => {
  const { report, lock, verified } = fixture();
  assert.throws(() => reviewAudit(report, lock, verified, reviewDeadline), /requires review/);
});

test('installed parser hashes are protected; altered bytes and unknown versions fail', () => {
  const { lock, verified } = checkParsers(root);
  assert.equal(verified.size, 2);
  for (const path of verified) {
    const source = readFileSync(resolve(root, path, 'lib/parse.js'), 'utf8');
    const version = lock.packages[path].version;
    assert.equal(guardedSource(source, version), source);
    assert.throws(() => guardedSource(source + '\n// changed\n', version), /Unexpected/);
    assert.throws(() => guardedSource(source, '999.0.0'), /Unreviewed/);
  }
});

test('real picomatch APIs reject the vulnerable forms quickly and retain normal file matching', () => {
  const { verified } = checkParsers(root);
  for (const path of verified) {
    // An isolated process puts a hard deadline on the actual regex execution.
    const child = spawnSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict');
      const pm = require(${JSON.stringify(resolve(root))} + '/' + ${JSON.stringify(path)});
      for (const options of [{}, {capture:true}, {maxExtglobRecursion:false}, {fastpaths:false}]) {
        for (const pattern of ['+(*)b', '+(*a)', '*(*)b', '*(*a)', '+(*?a)', '*(*?)b', '+(a|aa)b', '+(*(a))b']) {
          const attack = 'a'.repeat(2048) + '!';
          assert.equal(pm(pattern, options)(attack), false);
          assert.equal(pm.makeRe(pattern, options).test(attack), false);
        }
      }
      for (const [path, pattern, expected] of [
        ['components/Player.tsx', '**/*.{ts,tsx}', true],
        ['components/Player.js', '**/*.{ts,tsx}', false],
        ['source/main.brs', '**/*.brs', true],
        ['components/Guide.xml', '**/*.xml', true],
        ['foo.test.ts', '**/!(*.test).ts', false],
        ['foo.ts', '**/!(*.test).ts', true],
        ['a.js', '**/@(a|b).js', true]
      ]) assert.equal(pm(pattern)(path), expected);
    `], { encoding: 'utf8', timeout: 3000 });
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr);
  }
});
