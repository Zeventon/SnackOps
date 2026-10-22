import { readFile, writeFile, mkdir, readdir, access } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
const source = path.resolve(".verification/reference-snack-agent-studio/snack-agent-studio-main");
const require = createRequire(import.meta.url);
const postcss = createRequire(require.resolve("next/package.json"))("postcss");
const copied = [];
async function write(file, value) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, value); copied.push(file); }
async function walk(directory) { const result = []; for (const entry of await readdir(directory, { withFileTypes: true })) { const file = path.join(directory, entry.name); if (entry.isDirectory()) result.push(...await walk(file)); else result.push(file); } return result; }
function imports(text) { return text.replaceAll('"@/lib/', '"@/lib/studio/').replaceAll('"@/components/', '"@/components/studio/').replaceAll('/api/', '/api/studio/'); }
for (const folder of ["lib", "components"]) for (const file of await walk(path.join(source, folder))) {
  if (file.endsWith("store.ts")) continue;
  const target = path.join("src", folder, "studio", path.relative(path.join(source, folder), file));
  await write(target, imports(await readFile(file, "utf8")));
}
for (const file of await walk(path.join(source, "app"))) {
  if (file.endsWith("page.tsx")) {
    await write(path.join("src/app/studio", path.relative(path.join(source, "app"), file)), imports(await readFile(file, "utf8")));
  } else if (file.endsWith("route.ts")) {
    let code = imports(await readFile(file, "utf8"));
    const mutations = [];
    code = code.replace(/export async function (POST|PUT|PATCH|DELETE)\(([^)]*)\)/g, (_match, method, parameters) => {
      const args = parameters.split(",").map((value) => value.trim().split(":")[0]).join(", ");
      mutations.push(`export async function ${method}(${parameters}) { return studioMutation(req, () => ${method.toLowerCase()}Handler(${args})); }`);
      return `async function ${method.toLowerCase()}Handler(${parameters})`;
    });
    if (mutations.length) code = 'import { studioMutation } from "@/lib/studio/mutation";\n' + code + "\n" + mutations.join("\n") + "\n";
    await write(path.join("src/app/api/studio", path.relative(path.join(source, "app/api"), file)), code);
  }
}
// Prefix every selector, including media queries, so reference styles cannot alter existing pages.
const css = postcss.parse((await readFile(path.join(source, "app/globals.css"), "utf8")).replace('@import "tailwindcss";', ""));
function splitSelectors(value) { const parts = []; let depth = 0, start = 0; for (let i = 0; i < value.length; i++) { if ("([".includes(value[i])) depth++; if (")]".includes(value[i])) depth--; if (value[i] === "," && depth === 0) { parts.push(value.slice(start, i)); start = i + 1; } } parts.push(value.slice(start)); return parts; }
css.walkRules((rule) => {
  if (rule.parent.type === "atrule" && rule.parent.name.includes("keyframes")) return;
  rule.selector = splitSelectors(rule.selector).map((selector) => { const s = selector.trim(); return s === ":root" || s === "body" ? ".studio" : `.studio ${s}`; }).join(", ");
});
await write("src/app/studio.css", css.toString() + '\n.studio h1 {font-size:28px;line-height:1.3} .studio .hero-row h1 br {display:none} .studio .page {padding-top:28px} .studio .card {border-radius:12px;box-shadow:none} .studio .hero-row {margin-bottom:22px} .studio .topbar {flex-wrap:wrap;height:auto;min-height:68px;gap:12px;padding-block:12px} .studio .nav {overflow-x:auto;max-width:100%} .studio .page {min-width:0} .studio .import-notice {max-width:1184px;margin:12px auto 0;padding:9px 16px;font-size:11px;color:#64706e;border:1px solid #e3ded3;border-radius:8px;background:#fffdf8} .studio .import-notice a {color:#a7532c;text-decoration:underline} @media(max-width:700px){.studio .topbar{padding-inline:16px}.studio .nav{order:3;width:100%}.studio .nav a{white-space:nowrap}.studio .page{padding-inline:16px}.studio h1{font-size:24px}}\n');
await mkdir("data/studio", { recursive: true });
for (const file of await walk(path.join(source, "data"))) {
  const target = path.join("data/studio", path.basename(file));
  try { await access(target); } catch { await write(target, await readFile(file, "utf8")); }
}
await write(".verification/studio-import-manifest.json", JSON.stringify({ source: "snack-agent-studio-main.zip", importedAt: new Date().toISOString(), files: copied }, null, 2));
console.log(`Imported ${copied.length} source/data files, without running archive scripts.`);
