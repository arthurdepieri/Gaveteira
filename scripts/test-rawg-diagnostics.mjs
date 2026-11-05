import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../supabase/functions/metadata-search/index.ts", import.meta.url), "utf8");
const logs = [];
const secret = "test-secret-must-not-appear";
const context = vm.createContext({
  URL, Response, AbortSignal, Error, Date,
  Deno: { serve() {}, env: { get() { return undefined; } } },
  console: Object.fromEntries(["info", "warn", "error", "log"].map((level) => [level, (message) => logs.push(JSON.parse(message))])),
});
vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }), context);
const url = new URL(`https://api.rawg.io/api/games?key=${secret}`);
for (const [status, event] of [[200, "success"], [401, "http_error"], [403, "http_error"], [429, "http_error"], [500, "http_error"]]) {
  context.fetch = async (_url, options) => {
    assert.ok(options.signal);
    return new Response(JSON.stringify(status === 200 ? { results: [{ id: 1 }] } : { error: secret }), { status });
  };
  await context.fetchRawgWithDiagnostics(url);
  assert.equal(logs.at(-1).event, event);
  assert.equal(logs.at(-1).status, status);
}
assert.equal(logs[0].resultCount, 1);
context.fetch = async () => new Response('{"results":[]}');
await context.fetchRawgWithDiagnostics(url);
assert.equal(logs.at(-1).resultCount, 0);
for (const [body, event] of [["not json", "invalid_json"], ['{"unexpected":true}', "invalid_response"]]) {
  context.fetch = async () => new Response(body);
  await context.fetchRawgWithDiagnostics(url);
  assert.equal(logs.at(-1).event, event);
}
for (const [name, event] of [["TypeError", "network_error"], ["TimeoutError", "timeout"]]) {
  context.fetch = async () => { const error = new Error(secret); error.name = name; throw error; };
  await context.fetchRawgWithDiagnostics(url);
  assert.equal(logs.at(-1).event, event);
}
context.fetch = async () => new Response("[]");
await context.searchGames("God of War");
assert.equal(logs.at(-1).event, "missing_key");
assert.ok(!JSON.stringify(logs).includes(secret));
assert.ok(!JSON.stringify(logs).includes("https://"));
console.log("RAWG: HTTP, empty results, invalid payloads, network, timeout and missing key verified; no credentials logged.");
