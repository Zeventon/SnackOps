import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink, readFile, cp } from "node:fs/promises";
import path from "node:path";
const require = createRequire(import.meta.url);
const root = process.cwd();
const testId = randomUUID();
const routeDir = path.join(root, "src/app/api/store-verification");
const route = path.join(routeDir, "route.ts");
const testDir = path.join(root, ".verification", testId);
const token = randomUUID();
const port = process.env.STORE_TEST_PORT || "5001";
const base = `http://127.0.0.1:${port}`;
let child;
let routeCreated = false;
const results = [];
function passed(name) { results.push({ name, passed: true }); console.log(`PASS ${name}`); }
async function api(action, expected = 200) { const response = await fetch(`${base}/api/store-verification`, { method: "POST", headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action }), signal: AbortSignal.timeout(30000) }); assert.equal(response.status, expected, `${action}: unexpected HTTP status`); return response.json(); }
try {
  await mkdir(routeDir, { recursive: true }); await mkdir(testDir, { recursive: true });
  await cp(path.join(root, "data"), path.join(testDir, "business"), { recursive: true });
  const fixture = await readFile(path.join(root, "scripts/store-test-route.fixture"), "utf8");
  await writeFile(route, fixture, { flag: "wx" }); routeCreated = true;
  child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--port", port, "--hostname", "127.0.0.1"], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true, env: { ...process.env, SNACKOPS_DATA_DIR: path.join(testDir, "business"), SNACKOPS_STORE_TEST_DIR: testDir, SNACKOPS_STORE_TEST_TOKEN: token } });
  child.stdout.on("data", (data) => process.stdout.write(data)); child.stderr.on("data", (data) => process.stderr.write(data));
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`Test server exited ${child.exitCode}`);
    try { const response = await fetch(`${base}/api/runs`, { signal: AbortSignal.timeout(5000) }); if (response.ok) { ready = true; break; } } catch { /* wait for compilation */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(ready, "Test server did not start");
  await api("init"); passed("temporary API creates and reads isolated JSON");
  let observations = 0;
  const updates = Promise.all(Array.from({ length: 40 }, () => api("increment")));
  const reader = (async () => { for (let i = 0; i < 60; i++) { const data = await api("raw-read"); assert(data.valid); assert(data.count >= 0 && data.count <= 40); observations++; } })();
  const [counts] = await Promise.all([updates, reader]);
  assert.deepEqual(counts.map((item) => item.count).sort((a, b) => a - b), Array.from({ length: 40 }, (_, i) => i + 1));
  assert.equal((await api("read")).count, 40); passed("40 concurrent HTTP updates: no lost updates, FIFO file lock");
  passed(`${observations} unlocked reads during writes: every snapshot is complete valid JSON`);
  const before = await readFile(path.join(testDir, "counter.json"));
  const renameFailure = await api("rename-failure", 503); assert(renameFailure.temporaryWasValid);
  assert.deepEqual(await readFile(path.join(testDir, "counter.json")), before); passed("injected rename failure preserves previous bytes after valid temporary write");
  await api("invalid-write", 400); assert.deepEqual(await readFile(path.join(testDir, "counter.json")), before); passed("schema validation rejects invalid data without modifying original");
  await api("throw-update", 503); assert.deepEqual(await readFile(path.join(testDir, "counter.json")), before);
  assert.equal((await api("increment")).count, 41); passed("updater failure releases lock; subsequent update succeeds");
  assert((await api("independent-locks")).independentCompleted); passed("different files do not share a blocking lock");
  assert.deepEqual((await api("cleanup-check")).temporaryFiles, []); passed("temporary files cleaned after success and failure");
  const forbidden = await fetch(`${base}/api/store-verification`, { method: "POST" }); assert.equal(forbidden.status, 404); passed("temporary test endpoint rejects missing token");
  const runResponse = await fetch(`${base}/api/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: "订单 SN100001 到哪了" }) }); assert.equal(runResponse.status, 201); const run = await runResponse.json(); assert.equal(run.status, "success");
  const runs = await (await fetch(`${base}/api/runs`)).json(); assert(runs.some((item) => item.id === run.id)); passed("Planner API persists real execution record");
  const invalid = await fetch(`${base}/api/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: "" }) }); assert.equal(invalid.status, 400); passed("Planner API validates request input");
  const takeover = await fetch(`${base}/api/tickets/TK-1024`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "processing" }) }); assert.equal(takeover.status, 200);
  const tickets = JSON.parse(await readFile(path.join(testDir, "business/tickets.json"), "utf8")); assert.equal(tickets.find((item) => item.id === "TK-1024").status, "processing"); passed("ticket takeover persists status");
  const evalResponse = await fetch(`${base}/api/evals`, { method: "POST" }); assert.equal(evalResponse.status, 201); const batch = await evalResponse.json(); assert.equal(batch.passed, batch.total); assert.equal(batch.total, 5); passed("Eval API executes and passes all 5 seeded regression cases");
  for (const page of ["/", "/playground", "/runs", "/tickets", "/skills", "/tools", "/evals", "/data"]) { const response = await fetch(`${base}${page}`); assert.equal(response.status, 200, page); }
  passed("all 8 application routes return HTTP 200");
  await writeFile(path.join(root, ".verification/store-results.json"), JSON.stringify({ passed: true, results, testId }, null, 2));
  console.log(`Completed ${results.length} checks.`);
} catch (error) { console.error(error); process.exitCode = 1; }
finally {
  if (child && child.exitCode === null) {
    if (process.platform === "win32") await new Promise((resolve) => { const stop = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }); stop.on("close", resolve); });
    else child.kill("SIGTERM");
  }
  if (routeCreated) await unlink(route);
  // next typegen refreshes production types, but not stale development validators.
  if (routeCreated) await unlink(path.join(root, ".next/dev/types/validator.ts")).catch((error) => { if (error.code !== "ENOENT") throw error; });
  console.log("Temporary API source removed; isolated evidence retained under .verification/.");
}
