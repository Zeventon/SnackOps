import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
const require = createRequire(import.meta.url), root = process.cwd();
const directory = path.join(root, ".verification", `studio-${randomUUID()}`);
const port = process.env.STUDIO_TEST_PORT || "5004", base = `http://127.0.0.1:${port}`;
let child, output = "", modelCalls = 0, retryFailureSent = false, mcpCalls = 0;
const results = [];
const passed = (name) => { results.push(name); console.log(`PASS ${name}`); };
async function body(request) { let text = ""; for await (const chunk of request) text += chunk; return text ? JSON.parse(text) : {}; }
const fixture = createServer(async (request, response) => {
  try {
    const input = await body(request); response.setHeader("Content-Type", "application/json");
    if (request.url === "/mcp") {
      if (!input.id) { response.statusCode = 202; response.end(); return; }
      let result = {};
      if (input.method === "initialize") result = { protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "test-fixture", version: "1" } };
      if (input.method === "tools/list") result = { tools: [{ name: "lookup", description: "测试查询", inputSchema: { type: "object", properties: { keyword: { type: "string" } }, required: ["keyword"] } }] };
      if (input.method === "tools/call") { mcpCalls++; assert.equal(input.params.arguments.keyword, "零食"); result = { content: [{ type: "text", text: "fixture result" }], structuredContent: { source: "fixture" } }; }
      response.end(JSON.stringify({ jsonrpc: "2.0", id: input.id, result })); return;
    }
    if (request.url !== "/v1/chat/completions") { response.statusCode = 404; response.end("{}"); return; }
    modelCalls++;
    assert.equal(input.response_format.type, "json_object"); assert.equal(input.messages[0].role, "system");
    const prompt = input.messages[0].content, args = JSON.parse(input.messages[1].content);
    let result;
    if (args.available_skills) result = { goal: "测试客服链路", reasoning: "使用可用能力，最后风控", steps: args.userInput.includes("MCP") ? [{ capability: "mcp__fixture__lookup", type: "tool", purpose: "查询远程测试数据" }, { capability: "not-registered", type: "tool", purpose: "白名单测试" }] : [] };
    else if (args.tool?.inputSchema) result = { keyword: "零食" };
    else if (typeof args.reply === "string") result = { passed: !args.userInput.includes("BLOCK"), risk_level: args.userInput.includes("BLOCK") ? "high" : "low", issues: args.userInput.includes("BLOCK") ? ["fixture blocked"] : [], safe_reply: "UNSAFE_UNREVIEWED_REPLACEMENT" };
    else if (args.criteria !== undefined) result = { score: 100, issues: [] };
    else if ("reasons" in args) result = { reply: "海盐芝士小饼干可用于办公室分享。价格以代码 Tool 结果为准。" };
    else if (args.need && args.toolResults) result = { recommended_product_ids: (args.products || []).slice(0, 2).map((item) => item.id), decision_summary: "按工具结果选择" };
    else if (args.need && args.products) result = { reasons: { P001: "独立包装，便于分享" } };
    else if (/Skill.*设计|Skill.*创建|Skill.*生成|标准.*Skill/.test(prompt) && args.request) result = { name: "fixture-created-skill", id: "fixture-created-skill", display_name: "测试生成技能", description: "用于验证创建技能流程", instructions: "根据输入生成一个 JSON 对象，不能编造事实。", temperature: 0.2, max_tokens: 800 };
    else if (/解释器|优化顾问/.test(prompt)) result = { summary: "本地协议桩的解释结果", sections: [{ title: "依据", content: "仅用于集成测试" }], verification_tips: ["查看 Trace"], target_skills: [], planner_rules: [], skill_prompt_patches: [], eval_followups: [] };
    else {
      if (args.userInput?.includes("RETRY") && !retryFailureSent) { retryFailureSent = true; response.statusCode = 503; response.end('{"error":"transient fixture failure"}'); return; }
      result = { intent: "recommendation", taste: [], categories: [], budget: 200, quantity: 1, constraints: [], needs_price: true };
    }
    response.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify(result) } }] }));
  } catch (error) { response.statusCode = 500; response.end(JSON.stringify({ error: String(error) })); }
});
async function api(route, method = "GET", value, status = 200) {
  const response = await fetch(`${base}/api/studio${route}`, { method, headers: { "Content-Type": "application/json" }, ...(value === undefined ? {} : { body: JSON.stringify(value) }), signal: AbortSignal.timeout(60000) });
  const data = await response.json(); assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(data).slice(0, 1200)}`); return data;
}
async function start(configured = true) {
  child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", port], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, SNACKOPS_DATA_DIR: path.join(directory, "data"), SNACKOPS_SKILLS_DIR: path.join(directory, "skills"), OPENAI_API_KEY: configured ? "fixture-not-a-real-key" : "", DEEPSEEK_API_KEY: "", AI_BASE_URL: `http://127.0.0.1:${fixture.address().port}/v1`, AI_MODEL: "fixture-model" } });
  child.stdout.on("data", (data) => { output += data; }); child.stderr.on("data", (data) => { output += data; });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error(output);
    try { const response = await fetch(`${base}/api/studio/status`, { signal: AbortSignal.timeout(4000) }); if (response.ok) return; } catch { /* wait until ready */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Studio test server did not start\n" + output.slice(-5000));
}
async function stop() {
  if (child && child.exitCode === null) {
    if (process.platform === "win32") await new Promise((resolve) => { const command = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }); command.on("exit", resolve); });
    else { child.kill("SIGTERM"); await new Promise((resolve) => child.on("exit", resolve)); }
  }
}
try {
  await mkdir(directory, { recursive: true }); await cp("data", path.join(directory, "data"), { recursive: true }); await cp("skills", path.join(directory, "skills"), { recursive: true });
  await new Promise((resolve) => fixture.listen(0, "127.0.0.1", resolve));
  await start(false);
  assert.equal((await api("/status")).ai.configured, false);
  const missing = await api("/run", "POST", { input: "预算 100 元" }, 500); assert.match(missing.error, /API Key/);
  passed("without credentials, runtime reports unconfigured and refuses fabricated model output");
  await stop(); await start(true);
  for (const route of ["", "/demo", "/planner", "/skills", "/tools", "/ops", "/catalog"]) assert.equal((await fetch(`${base}/studio${route}`)).status, 200, route);
  for (const route of ["/planner", "/skills", "/tools", "/metrics", "/ratings", "/evaluations", "/annotations", "/human-reviews", "/improvement-suggestions", "/versions", "/experiments", "/evaluation-settings", "/catalog/products"]) await api(route);
  const originalAnnotations = JSON.parse(await readFile(path.join(directory, "data/studio/annotations.json"), "utf8"));
  const loadedAnnotations = (await api("/annotations")).records;
  if (originalAnnotations.length && originalAnnotations[0].updatedAt) assert.equal(loadedAnnotations.find((item) => item.id === originalAnnotations[0].id).updatedAt, originalAnnotations[0].updatedAt);
  passed("all 7 cloned pages and all operations data endpoints load");
  const plan = await api("/planner");
  await api("/planner", "PUT", { ...plan, name: "验收 Planner" });
  const version = (await api("/versions")).find((item) => item.kind === "planner" && item.payload.name === plan.name); assert(version);
  await api("/versions", "POST", { id: version.id }); assert.equal((await api("/planner")).name, plan.name);
  await api("/planner", "PUT", { ...plan, requiredSkills: [] }, 400);
  passed("Planner save, version snapshot, rollback and mandatory risk-check validation work");
  const run = await api("/run", "POST", { input: "预算 200 元，办公室分享" });
  assert.equal(run.plan.steps.at(-1).capability, "risk-check"); assert(run.executionTrace.every((step) => step.status === "success")); assert.equal(run.risk.passed, true); assert(run.finalReply.includes("海盐"));
  const price = run.executionTrace.find((item) => item.capability === "calculate_price").output; assert.equal(price.couponApplied, null); assert(price.finalPrice > 0);
  const multi = await api("/run", "POST", { input: "继续推荐", sessionId: run.sessionId }); assert.equal(multi.sessionId, run.sessionId);
  const conversations = JSON.parse(await readFile(path.join(directory, "data/studio/conversations.json"), "utf8")); assert.equal(conversations.find((item) => item.id === run.sessionId).messages.length, 4);
  passed("HTTP model contract drives complete Planner / Skill / Tool / risk trace and persisted multi-turn conversations");
  const retry = await api("/run", "POST", { input: "RETRY 预算 100 元" }); assert(retry.executionTrace.some((step) => step.attempts === 2));
  const blocked = await api("/run", "POST", { input: "BLOCK 预算 100 元" }); assert.equal(blocked.risk.passed, false); assert(!blocked.finalReply.includes("UNSAFE")); assert(blocked.handoff.required);
  passed("transient step errors retry, and failed risk checks never send unreviewed replacement text");
  let skills = await api("/skills");
  await api("/skills", "PUT", skills.map((skill) => skill.id === "risk-check" ? { ...skill, enabled: false } : skill));
  const coreSkills = await (await fetch(`${base}/api/skills?enabled=true`)).json(); assert(!coreSkills.some((item) => item.id === "risk-check"));
  await api("/run", "POST", { input: "你好" }, 500);
  skills = await api("/skills"); await api("/skills", "PUT", skills.map((skill) => skill.id === "risk-check" ? { ...skill, enabled: true } : skill));
  const created = await api("/skills", "POST", { id: "integration-skill", name: "集成技能", description: "用于集成验收的新技能", prompt: "根据输入生成 JSON 结果，只使用核实数据。", model: "default", temperature: 0.2, maxTokens: 800, enabled: true }, 201); assert(created.skill.hash);
  assert((await api("/skills/integration-skill")).content.includes("核实数据"));
  await api("/skills", "POST", { ...created.skill, id: "../../bad" }, 400);
  passed("Studio Skill editing, creation and file view share core registry, snapshots and path guards");
  const tools = await api("/tools"); await api("/tools", "PUT", tools.map((tool) => tool.id === "query_products" ? { ...tool, enabled: false } : tool));
  const coreTools = await (await fetch(`${base}/api/tools?enabled=true`)).json(); assert(!coreTools.some((item) => item.id === "query_products"));
  await api("/tools", "PUT", tools); assert.equal((await api("/tools/calculate_price/source")).kind, "typescript");
  passed("Tool metadata and enable state are shared, and implementation source can be inspected");
  const products = await api("/catalog/products"); await api("/catalog/products", "PUT", products.map((product) => product.id === "P001" ? { ...product, price: 30 } : product)); assert.equal((await api("/catalog/products"))[0].price, 30);
  const before = await api("/catalog/products"); await api("/catalog/products", "PUT", [{ id: "bad", price: -1 }], 400); assert.deepEqual(await api("/catalog/products"), before);
  const paths = await api("/versions"); const pathAttack = { id: "path-test", kind: "catalog", label: "test", createdAt: new Date().toISOString(), payload: { file: "../../bad.json", data: [] } };
  const versionsFile = path.join(directory, "data/studio/versions.json"); await writeFile(versionsFile, JSON.stringify([pathAttack, ...paths])); await api("/versions", "POST", { id: "path-test" }, 400);
  passed("catalog writes validate data and preserve old valid data; rollback cannot escape the data allowlist");
  const review = await api("/ratings", "POST", { score: 1, source: "agent", requestId: run.requestId, sessionId: run.sessionId, qaPairs: [{ question: "预算 100 元", answer: run.finalReply }], messages: [] });
  const annotations = await api("/annotations"); const record = annotations.records.find((item) => item.sourceId === review.rating.id); assert(record);
  const approved = { ...record, status: "approved", expectedResponse: "请核对商品信息。" };
  await api("/annotations", "PUT", annotations.records.map((item) => item.id === record.id ? approved : item));
  const published = await api("/annotations", "POST", { action: "publish_eval", id: record.id }); assert(published.evaluation.id);
  const generated = await api("/annotations", "POST", { action: "generate_skill_draft", id: record.id }); assert.equal(generated.skill.id, "fixture-created-skill");
  const explained = await api("/explain", "POST", { type: "planner", payload: { planner: plan } }); assert(explained.summary);
  const exported = await fetch(`${base}/api/studio/annotations/export`); assert(exported.headers.get("Content-Type").includes("ndjson")); assert((await exported.text()).includes("请核对商品信息"));
  passed("one-star rating becomes an annotation; reviewed annotations publish to Eval and export JSONL");
  const cases = (await api("/evaluations")).cases;
  const item = { id: "fixture-eval", name: "协议桩回归", input: "预算 100 元", expectedKeywords: ["海盐"], enabled: true, tags: ["fixture"], judgeCriteria: "答复应相关", assertions: { expectedCapabilities: ["query_products", "risk-check"], forbiddenCapabilities: [], expectedFacts: [], forbiddenPhrases: [], riskMustPass: true, maxLatencyMs: 60000 } };
  await api("/evaluations", "PUT", [item, ...cases]); const evaluation = await api("/evaluations", "POST", { caseId: item.id }); assert(evaluation.result.trace?.length); assert(evaluation.result.scoringMethods.some((method) => method.id === "llm_as_judge"));
  await api("/experiments", "POST", { name: "集成实验", skillId: "response-generator", variantPrompt: "保持事实准确。", trafficPercent: 100 }, 201);
  const experimented = await api("/run", "POST", { input: "预算 100 元" }); assert(experimented.experiments.some((experiment) => experiment.variant === "variant"));
  await api("/handoff", "POST", { sessionId: run.sessionId, input: "请求人工", reason: "test" }); assert((await api("/metrics")).summary.total > 0);
  passed("Eval saves scoring methods and traces, A/B assigns variants, handoff and monitoring persist");
  const mcpUrl = `http://127.0.0.1:${fixture.address().port}/mcp`;
  const discovered = await api("/mcp/discover", "POST", { id: "fixture", name: "协议测试 MCP", url: mcpUrl, authTokenEnv: "", enabled: true }); assert.equal(discovered.tools.length, 1);
  const mcpRun = await api("/run", "POST", { input: "MCP 预算 100 元" }); assert(mcpRun.executionTrace.some((step) => step.capability === "mcp__fixture__lookup")); assert(!mcpRun.plan.steps.some((step) => step.capability === "not-registered")); assert(mcpCalls > 0);
  passed("MCP initialize/list/call integrates with Planner whitelist and execution traces");
  const crossSite = await fetch(`${base}/api/studio/experiments`, { method: "POST", headers: { origin: "https://other.example", "Content-Type": "application/json" }, body: "{}" }); assert.equal(crossSite.status, 403);
  await stop(); await start(true); assert((await api("/skills")).some((item) => item.id === "integration-skill")); assert((await api("/annotations")).records.some((item) => item.id === record.id));
  passed("cross-site mutation is refused and saved skills / annotations survive a full process restart");
  await writeFile(".verification/studio-results.json", JSON.stringify({ passed: true, protocolFixture: true, vendorVerified: false, modelCalls, mcpCalls, results, directory, completedAt: new Date().toISOString() }, null, 2));
  console.log(`Completed ${results.length} checks with ${modelCalls} local protocol calls; no vendor request or real key used.`);
} catch (error) { console.error(error); console.error(output.slice(-6000)); process.exitCode = 1; }
finally { await stop(); fixture.closeAllConnections(); await new Promise((resolve) => fixture.close(resolve)); await writeFile(path.join(directory, "server.log"), output); }
