import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { advisory, checkParsers, reviewDeadline } from './picomatch.mjs';

// Retain the complete audit. The only reviewed finding is the exact advisory
// above, in dev-only packages whose installed parser protection is verified.
export function reviewAudit(report, lock, verified, now = Date.now()) {
  if (report.error || report.auditReportVersion !== 2 || !report.vulnerabilities ||
      !report.metadata?.vulnerabilities) throw new Error('Invalid npm audit response');
  const findings = report.vulnerabilities;
  const checked = new Set();
  function review(name, chain = new Set()) {
    if (checked.has(name)) return;
    const finding = findings[name];
    if (!finding || chain.has(name) || !finding.via?.length || !finding.nodes?.length) {
      throw new Error(`Unrecognized audit finding: ${name}`);
    }
    if (finding.nodes.some((path) => lock.packages[path]?.dev !== true)) {
      throw new Error(`Production dependency vulnerability: ${name}`);
    }
    const next = new Set([...chain, name]);
    for (const via of finding.via) {
      if (typeof via === 'string') {
        review(via, next);
      } else if (name !== 'picomatch' || via.name !== 'picomatch' || via.url !== advisory ||
                 finding.nodes.some((path) => !verified.has(path))) {
        throw new Error(`Unmitigated vulnerability: ${name} (${via.url ?? 'unknown advisory'})`);
      }
    }
    checked.add(name);
  }
  for (const name of Object.keys(findings)) review(name);
  if (!checked.size && report.metadata.vulnerabilities.total !== 0) {
    throw new Error('npm audit vulnerability summary is inconsistent');
  }
  if (checked.size && now >= reviewDeadline) {
    throw new Error('Temporary picomatch mitigation requires review by 2026-12-18');
  }
  return checked.size;
}

export function audit(root = process.cwd()) {
  const { lock, verified } = checkParsers(root);
  // npm_execpath avoids a Windows .cmd shell and uses the current npm version.
  const npm = process.env.npm_execpath;
  const result = npm
    ? spawnSync(process.execPath, [npm, 'audit', '--json'], { cwd: root, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024 })
    : spawnSync('npm', ['audit', '--json'], { cwd: root, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || ![0, 1].includes(result.status)) {
    throw new Error(`npm audit failed: ${result.error?.message ?? result.stderr}`);
  }
  const report = JSON.parse(result.stdout);
  console.log(JSON.stringify(report, null, 2));
  const count = reviewAudit(report, lock, verified);
  console.log(count
    ? `Security review passed: ${count} dev-only findings trace solely to the protected picomatch advisory. Raw npm audit still reports it. Review by 2026-12-18.`
    : 'Security review passed: npm audit reports no vulnerabilities.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) audit();
