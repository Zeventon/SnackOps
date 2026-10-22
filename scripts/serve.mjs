import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const mode = process.argv[2];
const port = process.env.DEPLOY_RUN_PORT || "5000";
if (!/^[0-9]+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error("DEPLOY_RUN_PORT must be 1–65535");
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), mode, "--port", port, ...process.argv.slice(3)], { stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
