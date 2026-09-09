import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Keep normal Next.js development and supervised browser QA on the same entrypoint.
const args = process.argv.slice(2).filter((arg) => arg !== '--strictPort')
  .map((arg) => arg === '--host' ? '--hostname' : arg);
const next = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const child = spawn(process.execPath, [next, 'dev', ...args], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
