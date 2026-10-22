import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, readFile, writeFile, access, unlink, rename } from "node:fs/promises";
import path from "node:path";
const require = createRequire(import.meta.url);
const root = process.cwd();
const directory = path.join(root, ".verification", `registry-${randomUUID()}`);
const dataDir = path.join(directory, "data"), skillDir = path.join(directory, "skills");
const port = process.env.REGISTRY_TEST_PORT || "5003";
const base = `http://127.0.0.1:${port}`;
let child;
let output = "";
const results = [];
const passed = (name) => { results.push(name); console.log(`PASS ${name}`); };
const read = async (name) => JSON.parse(await readFile(path.join(dataDir, `${name}.json`), "utf8"));
const write = async (name, value) => writeFile(path.join(dataDir, `${name}.json`), JSON.stringify(value, null, 2));
async function request(url, method = "GET", body, status = 200) {
  const response = await fetch(base + url, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(60000) });
  const data = await response.json(); assert.equal(response.status, status, `${method} ${url}: ${JSON.stringify(data)}`); return data;
}
const tool = (id, input, status = 200) => request(`/api/tools/${id}/test`, "POST", input, status);
const skill = (id) => request(`/api/skills/${encodeURIComponent(id)}`);
const edit = (id, expectedHash, changes, changeNote = "验收修改", status = 200) => request(`/api/skills/${encodeURIComponent(id)}`, "PATCH", { expectedHash, changes, changeNote }, status);
async function start() {
  child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--port", port, "--hostname", "127.0.0.1"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, SNACKOPS_DATA_DIR: dataDir, SNACKOPS_SKILLS_DIR: skillDir } });
  child.stdout.on("data", (data) => { output += data; }); child.stderr.on("data", (data) => { output += data; });
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited ${child.exitCode}\n${output.slice(-5000)}`);
    try { const response = await fetch(base + "/api/registry", { signal: AbortSignal.timeout(5000) }); if (response.ok) return; } catch { /* wait for Next.js */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become ready\n${output.slice(-6000)}`);
}
async function stop() {
  if (child && child.exitCode === null) {
    if (process.platform === "win32") await new Promise((resolve) => { const command = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }); command.on("exit", resolve); });
    else { child.kill("SIGTERM"); await new Promise((resolve) => child.on("exit", resolve)); }
  }
}
try {
  await mkdir(directory, { recursive: true }); await cp(path.join(root, "data"), dataDir, { recursive: true }); await cp(path.join(root, "skills"), skillDir, { recursive: true });
  // Keep discount checks reproducible without modifying the user's demo data.
  const startsAt = new Date(Date.now() - 86400000).toISOString(), endsAt = new Date(Date.now() + 86400000).toISOString();
  await write("activities", (await read("activities")).map((item) => ({ ...item, startsAt, endsAt })));
  const coupons = (await read("coupons")).map((item) => ({ ...item, startsAt, endsAt }));
  coupons.push({ ...coupons[0], id: "percent-test", type: "percentage", discount: 10, newCustomerOnly: false });
  coupons.push({ ...coupons[0], id: "expired-test", endsAt: new Date(Date.now() - 1000).toISOString() });
  coupons.push({ ...coupons[0], id: "scope-test", applicableProductIds: ["p-02"] });
  await write("coupons", coupons);
  await start();
  const registry = await request("/api/registry");
  const requiredSkills = ["need-extraction", "recommendation-decision", "recommendation-reason", "response-generator", "risk-check", "clarification-question", "product-substitution", "after-sales-classification", "complaint-triage", "conversation-summary", "human-handoff-decision", "gift-scenario-advisor", "allergy-risk-reminder", "对话问候-skill"];
  for (const id of requiredSkills) { const item = registry.skills.find((item) => item.id === id); assert(item?.enabled); for (const field of ["model", "temperature", "maxTokens", "requiredTools", "version", "filePath", "systemPrompt", "hash"]) assert(field in item); }
  assert(registry.tools.every((item) => item.enabled && item.implemented && item.inputSchema && item.outputSchema));
  passed("enabled registry exposes all 14 required Skills and executable Tool schemas");
  let tracking = await skill("order-tracking"); tracking = await edit(tracking.id, tracking.hash, { enabled: false });
  assert(!(await request("/api/skills?enabled=true")).some((item) => item.id === tracking.id));
  assert(!(await request("/api/registry")).skills.some((item) => item.id === tracking.id));
  await request("/api/skills/order-tracking/test", "POST", { input: "订单 SN100001 到哪了" }, 409);
  assert.equal((await request("/api/runs", "POST", { input: "订单 SN100001 到哪了" }, 201)).status, "handoff");
  await edit(tracking.id, tracking.hash, { enabled: true }); passed("disabled Skill disappears from enabled APIs and stops Planner / Executor");
  await request("/api/tools/query_orders", "PATCH", { enabled: false });
  assert(!(await request("/api/tools?enabled=true")).some((item) => item.id === "query_orders"));
  await tool("query_orders", { orderId: "SN100001" }, 409);
  await request("/api/skills/order-tracking/test", "POST", { input: "订单 SN100001 到哪了" }, 409);
  assert.equal((await request("/api/runs", "POST", { input: "订单 SN100001 到哪了" }, 201)).status, "handoff");
  await request("/api/tools/query_orders", "PATCH", { enabled: true }); passed("disabled Tool stops direct tests, dependent Skills and Planner");
  const products = await read("products");
  assert.deepEqual((await tool("query_products", {})).result.products, products);
  assert.deepEqual((await tool("query_orders", { orderId: "SN100001" })).result.order, (await read("orders"))[0]);
  assert.deepEqual((await tool("query_logistics", { orderId: "SN100001" })).result.logistics, (await read("logistics"))[0]);
  assert.deepEqual((await tool("query_activities", {})).result.activities, await read("activities"));
  assert((await tool("query_coupons", { userId: "user-02" })).result.coupons.some((coupon) => coupon.id === "coupon-01"));
  assert.equal((await tool("calculate_price", { items: [{ productId: "p-01", quantity: 2 }], userId: "user-02", couponId: "coupon-01" })).result.total, 69.8);
  passed("all six requested tools return real JSON data or correctly computed prices");
  assert.equal((await tool("calculate_price", { items: [{ productId: "p-01", quantity: 2 }], couponId: "percent-test" })).result.total, 71.82);
  await tool("calculate_price", { items: [{ productId: "p-01", quantity: 2 }], userId: "user-01", couponId: "coupon-01" }, 409);
  await tool("calculate_price", { items: [{ productId: "p-01", quantity: 1 }], userId: "user-02", couponId: "coupon-01" }, 409);
  await tool("calculate_price", { items: [{ productId: "p-01", quantity: 2 }], userId: "user-02", couponId: "expired-test" }, 409);
  await tool("calculate_price", { items: [{ productId: "p-01", quantity: 2 }], userId: "user-02", couponId: "scope-test" }, 409);
  await tool("calculate_price", { items: [{ productId: "p-01", quantity: 3 }], userId: "user-02", couponId: "coupon-01", activityId: "act-01" }, 409);
  await tool("calculate_price", { items: [{ productId: "p-01", quantity: 99 }, { productId: "p-01", quantity: 99 }, { productId: "p-01", quantity: 99 }] }, 409);
  await tool("calculate_price", { items: [{ productId: "p-01", quantity: -1 }] }, 400);
  await tool("query_orders", { orderId: "SN100001", userId: "user-02" }, 404);
  passed("discount thresholds, scope, expiry, new-customer eligibility, stacking, aggregate stock and input errors validated");
  const before = await skill("need-extraction");
  const changed = await edit(before.id, before.hash, { systemPrompt: before.systemPrompt + "\n验收新增：优先澄清预算。", version: "1.0.1", temperature: 0.3 });
  let versions = await request(`/api/skills/${before.id}/versions`);
  const previous = versions.find((item) => item.kind === "before-edit" && item.hash === before.hash);
  assert.equal(previous.snapshot.systemPrompt, before.systemPrompt); assert.equal(previous.snapshot.temperature, before.temperature);
  const file = path.join(skillDir, changed.filePath.slice("skills/".length)); assert.equal(await readFile(file, "utf8"), changed.systemPrompt);
  const { hash: changedHash, ...changedContent } = changed;
  assert.equal(createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(changedContent).sort(([a], [b]) => a.localeCompare(b, "en"))))).digest("hex"), changedHash);
  passed("edit snapshots old body and metadata before switching to immutable new file; SHA-256 verifies content");
  const diff = await request(`/api/skills/${before.id}/diff?from=${previous.id}&to=current`);
  assert(diff.lines.some((line) => line.type === "added" && line.text.includes("验收新增"))); assert(diff.metadata.some((item) => item.field === "temperature"));
  assert.equal((await request(`/api/skills/${before.id}/versions/${previous.id}`)).snapshot.systemPrompt, before.systemPrompt);
  const manual = await request(`/api/skills/${before.id}/versions`, "POST", { expectedHash: changed.hash, changeNote: "手动验收快照" }, 201);
  assert.equal(manual.snapshot.systemPrompt, changed.systemPrompt); passed("version listing, detail, manual snapshot and line / metadata diff work");
  await edit(before.id, before.hash, { temperature: 0.4 }, "stale", 409);
  const concurrent = await Promise.all([0.5, 0.6].map((temperature) => fetch(base + `/api/skills/${before.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedHash: changed.hash, changes: { temperature }, changeNote: "并发修改" }) })));
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 409]); passed("optimistic hashes reject stale edits and concurrent overwrite");
  const safe = await skill("risk-check");
  for (const filePath of ["../../outside.md", "..\\..\\outside.md", "D:/outside.md"]) await edit(safe.id, safe.hash, { filePath }, "path attack", 400);
  const originals = await read("skills");
  await write("skills", originals.map((item) => item.id === safe.id ? { ...item, filePath: "skills/risk-check/../../outside.md" } : item));
  const malicious = await skill(safe.id); await edit(safe.id, malicious.hash, { temperature: 0.4 }, "stored path attack", 400);
  await write("skills", originals);
  await assert.rejects(access(path.join(directory, "outside.md")));
  passed("client path traversal and corrupted stored traversal paths rejected without creating outside files");
  // Keep the active fixture body outside the directory we are about to obstruct.
  // Imported skills may already point into revisions/, unlike the initial seed.
  const targetBeforeObstruction = await skill("clarification-question");
  await writeFile(path.join(skillDir, targetBeforeObstruction.id, "SKILL.md"), targetBeforeObstruction.systemPrompt);
  await write("skills", (await read("skills")).map((item) => item.id === targetBeforeObstruction.id ? { ...item, filePath: `skills/${item.id}/SKILL.md` } : item));
  const failureTarget = await skill(targetBeforeObstruction.id);
  const blockedDirectory = path.join(skillDir, failureTarget.id, "revisions");
  const savedDirectory = `${blockedDirectory}.test-backup`;
  for (const candidate of [blockedDirectory, savedDirectory]) { const relative = path.relative(skillDir, candidate); assert(!relative.startsWith("..") && !path.isAbsolute(relative)); }
  let directoryMoved = false;
  try { await rename(blockedDirectory, savedDirectory); directoryMoved = true; } catch (error) { if (error.code !== "ENOENT") throw error; }
  await writeFile(blockedDirectory, "test-only directory obstruction", { flag: "wx" });
  await edit(failureTarget.id, failureTarget.hash, { temperature: 0.8 }, "注入正文写入失败", 400);
  assert.equal((await skill(failureTarget.id)).hash, failureTarget.hash);
  assert((await request(`/api/skills/${failureTarget.id}/versions`)).some((version) => version.kind === "before-edit" && version.hash === failureTarget.hash && version.changeNote.includes("注入正文写入失败")));
  await unlink(blockedDirectory);
  if (directoryMoved) await rename(savedDirectory, blockedDirectory);
  passed("failed revision write retains old active Skill and the automatic pre-edit snapshot");
  const safeAdvice = { input: "有人说我中奖了，交保证金就能兑奖", draft: "不要转账，不要提供密码、验证码等敏感信息；不承诺兑奖，请通过官方渠道核验。" };
  assert.equal((await request("/api/skills/risk-check/test", "POST", safeAdvice)).output.decision, "allow");
  const riskInputs = [
    { input: "报价", draft: "此商品按报价出售。", quotedPrices: [{ productId: "p-01", unitPrice: 1 }] },
    { input: "坚果", draft: "这个产品全网最低、绝对安全。" },
    { input: "退款", draft: "保证立即退款，立即到账。" },
    { input: "优惠", draft: "你可以使用新客优惠。", userId: "user-01" },
    { input: "孩子对花生过敏", draft: "放心吃就行。" },
    { input: "我要投诉", draft: "不归我们管，自己找快递。" },
    { input: "中奖了怎么兑奖", draft: "请先转账保证金，提供验证码，我保证兑奖。" },
  ];
  for (const input of riskInputs) assert.equal((await request("/api/skills/risk-check/test", "POST", input)).output.decision, "block");
  assert.equal((await request("/api/skills/risk-check/test", "POST", { input: "这是绝对安全的吗", draft: "不能承诺绝对安全，请核对包装标签。" })).output.decision, "allow");
  passed("auditable risk rules block seven dangerous drafts while allowing safe fraud warnings and negated claims");
  const current = await skill(before.id); const currentFile = path.join(skillDir, current.filePath.slice("skills/".length));
  await writeFile(currentFile, "corrupted"); await request(`/api/skills/${before.id}/test`, "POST", { input: "预算 100 元" }, 409); await writeFile(currentFile, current.systemPrompt);
  passed("Executor refuses mismatched Skill file and registry body");
  for (const id of requiredSkills.filter((id) => id !== "risk-check")) { const result = await request(`/api/skills/${encodeURIComponent(id)}/test`, "POST", { input: "预算 100 元，送礼，订单 SN100001" }); assert.equal(result.mode, "local-rules"); assert(result.output); }
  passed("all requested Skills expose runnable local test adapters");
  await stop(); await start();
  versions = await request(`/api/skills/${before.id}/versions`); assert(versions.some((version) => version.id === manual.id)); assert.equal((await skill(before.id)).systemPrompt, changed.systemPrompt);
  assert((await (await fetch(base + "/skills")).text()).includes("手动验收快照"));
  passed("saved Skill body and version snapshots survive a full server restart");
  for (const url of ["/", "/skills", "/tools", "/catalog", "/catalog?type=orders", "/data", "/evals", "/runs", "/tickets"]) assert.equal((await fetch(base + url)).status, 200, url);
  assert.equal((await request("/api/catalog")).length, 10);
  assert.deepEqual((await request("/api/catalog?type=products")).data, products);
  passed("management pages and typed business catalog return persisted data");
  assert(!output.includes("Only plain objects can be passed"));
  passed("registry schemas cross the Server / Client boundary without serialization warnings");
  await writeFile(path.join(root, ".verification/registry-results.json"), JSON.stringify({ passed: true, results, directory, completedAt: new Date().toISOString() }, null, 2));
  console.log(`Completed ${results.length} registry checks.`);
} catch (error) { console.error(error); console.error(output.slice(-8000)); process.exitCode = 1; }
finally { await stop(); await writeFile(path.join(directory, "server.log"), output); console.log(`Isolated evidence: ${directory}`); }
