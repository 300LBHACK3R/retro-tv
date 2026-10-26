import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

/** Run real server handlers with controlled provider and Next.js boundaries. */
export function serverModule(
  file: string,
  imports: Record<string, unknown> = {},
  env: Record<string, string> = {},
  globals: Record<string, unknown> = {},
) {
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports: Record<string, (...args: any[]) => any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  const nodeRequire = createRequire(process.cwd() + "/package.json");
  vm.runInNewContext(output, {
    exports,
    require: (name: string) =>
      name === "server-only" ? {} : (imports[name] ?? nodeRequire(name)),
    process: { env: { NODE_ENV: "production", ...env } },
    Request,
    Response,
    URL,
    TextDecoder,
    Uint8Array,
    Buffer,
    Date,
    Error,
    Promise,
    Map,
    AbortSignal,
    ...globals,
  });
  return exports;
}
export function jsonRequest(
  path: string,
  body: unknown,
  method = "POST",
  origin = "https://www.tatestv.ca",
) {
  return new Request(`https://www.tatestv.ca${path}`, {
    method,
    headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify(body),
  });
}
