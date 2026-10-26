import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fakeHost, jobSlice, temporaryFolder } from "@arthur/core/testing";
import { stepRunner } from "../src/merge-checks.ts";

// Main's checkout `acme` with a `src` folder and the fake host's env file in it, as the host hides it, and the temporary folder
// and the caches moved beside it, so a write beside the checkout is outside every writable path.
const folder = temporaryFolder();
const root = join(folder, "acme");
mkdirSync(join(folder, "tmp"));
mkdirSync(join(folder, "cache", "uv"), { recursive: true });
mkdirSync(join(root, "src"), { recursive: true });
writeFileSync(join(root, "env"), "ARTHUR_SECRET_TOKEN=s3cret-t0ken\n");
const fake = fakeHost({ name: "delivery", root });
const saved = { TMPDIR: process.env.TMPDIR, XDG_CACHE_HOME: process.env.XDG_CACHE_HOME };
Object.assign(process.env, { TMPDIR: join(folder, "tmp"), XDG_CACHE_HOME: join(folder, "cache") });
const lines: string[] = [];
const sandbox = fake.host.sandbox(root, (line) => lines.push(line));
for (const [name, value] of Object.entries(saved)) value === undefined ? delete process.env[name] : (process.env[name] = value);
// Why this host runs the steps bare (no Landlock, no python3): the one line the sandbox told; the test skips there, and only there.
const bare = lines[0]?.match(/^no sandbox: (.*); each step writes wherever Arthur's user can$/)?.[1];

test("each step on main runs in a sandbox: it writes main's checkout and the caches, not beside them, nor a new entry at the checkout's top, and reads neither the merge's environment nor the env file", { skip: bare }, () => {
	assert.match(readFileSync(`/proc/${process.pid}/environ`, "utf8"), /(^|\0)PATH=/, "outside the sandbox the merge's environment reads");
	const writes = { checkout: "echo x > src/made", top: "echo x > made", cache: `echo x > '${join(folder, "cache", "uv", "made")}'`, beside: `echo x > '${join(folder, "planted")}'` };
	const tries = Object.entries(writes).map(([name, command]) => `if (${command}) 2>/dev/null; then echo '${name} written'; else echo '${name} refused'; fi`);
	const script = [`{ tr '\\0' '\\n' < /proc/${process.pid}/environ || echo refused; } 2>&1`, "{ cat env || echo refused; } 2>&1", ...tries].join("\n");
	const ran = stepRunner(root, jobSlice.slice, sandbox, () => {}, 60)(script, process.env);
	assert.equal(ran.status, 0, ran.stderr);
	assert.match(ran.stdout, /^[^\n]*environ: Permission denied\nrefused\ncat: env: Permission denied\nrefused\ncheckout written\ntop refused\ncache written\nbeside refused\n$/);
	assert.doesNotMatch(ran.stdout, /s3cret-t0ken/);
	assert.equal(readFileSync(join(root, "src", "made"), "utf8"), "x\n");
	assert.deepEqual(lines, [], "set up, the sandbox adds no line to the merge's output");
});

test("a step still running at its limit is killed with SIGKILL, though it ignores SIGTERM, and its error names the limit", () => {
	const started = Date.now();
	// 8 s that SIGTERM does not end: with SIGTERM as the kill, the step exits 0 once they passed.
	const ran = stepRunner(root, jobSlice.slice, sandbox, () => {}, 1)("trap '' TERM; for second in 1 2 3 4 5 6 7 8; do sleep 1; done", process.env);
	assert.deepEqual([ran.status, ran.signal, ran.error?.message], [null, "SIGKILL", "timed out after 1 s"]);
	assert.ok(Date.now() - started < 10_000, `it took ${Date.now() - started} ms`);
});
