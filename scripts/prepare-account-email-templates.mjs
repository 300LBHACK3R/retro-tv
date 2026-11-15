import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Supabase accepts HTML, so export the same security templates used by the app.
const source = readFileSync(new URL('../lib/accountEmails.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const templates = {};
vm.runInNewContext(output, { exports: templates });
for (const [purpose, filename] of [['signup', 'confirmation'], ['recovery', 'recovery']]) {
  writeFileSync(new URL(`../supabase/templates/${filename}.html`, import.meta.url), templates.accountSecurityEmail(purpose).html + '\n');
  console.log(`Prepared ${filename}.html`);
}
