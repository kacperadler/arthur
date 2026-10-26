import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fakeHost, jobSlice, temporaryFolder } from "@arthur/core/testing";
import { stepRunner } from "../src/merge-checks.ts";

// Main's checkout `acme` with a `src` folder and the fake host's env file in it, as the host hides it, the temporary folder
// moved beside it, so a write beside the checkout is outside every writable path, a shared cache there (uv's, as the merge's
// `XDG_CACHE_HOME` names it), and the merge's own cache folder in the plugin's folder.
const folder = temporaryFolder();
const root = join(folder, "acme");
mkdirSync(join(folder, "tmp"));
mkdirSync(join(folder, "cache", "uv"), { recursive: true });
mkdirSync(join(root, "src"), { recursive: true });
writeFileSync(join(root, "env"), "ARTHUR_SECRET_TOKEN=s3cret-t0ken\n");
const fake = fakeHost({ name: "delivery", root });
const cache = join(fake.host.folder, "cache-1");
const saved = process.env.TMPDIR;
process.env.TMPDIR = join(folder, "tmp");
const lines: string[] = [];
const sandbox = fake.host.sandbox(root, cache, (line) => lines.push(line));
saved === undefined ? delete process.env.TMPDIR : (process.env.TMPDIR = saved);
// Why this host runs the steps bare (no Landlock, no python3): the one line the sandbox told; the test skips there, and only there.
const bare = lines[0]?.match(/^no sandbox: (.*); each step writes wherever Arthur's user can$/)?.[1];

test("each step on main runs in a sandbox: it writes main's checkout and the merge's own cache, not a shared cache, beside them, nor a new entry at the checkout's top, and reads neither the merge's environment nor the env file", { skip: bare }, () => {
	assert.match(readFileSync(`/proc/${process.pid}/environ`, "utf8"), /(^|\0)PATH=/, "outside the sandbox the merge's environment reads");
	const writes = {
		checkout: "echo x > src/made",
		top: "echo x > made",
		"own cache": 'mkdir -p "$XDG_CACHE_HOME/uv" "$npm_config_cache/_npx" && echo x > "$XDG_CACHE_HOME/uv/made"',
		"shared cache": `echo x > '${join(folder, "cache", "uv", "made")}'`,
		beside: `echo x > '${join(folder, "planted")}'`,
	};
	const tries = Object.entries(writes).map(([name, command]) => `if (${command}) 2>/dev/null; then echo '${name} written'; else echo '${name} refused'; fi`);
	const script = [`{ tr '\\0' '\\n' < /proc/${process.pid}/environ || echo refused; } 2>&1`, "{ cat env || echo refused; } 2>&1", ...tries].join("\n");
	const ran = stepRunner(root, jobSlice.slice, sandbox, () => {})(script, { ...process.env, XDG_CACHE_HOME: join(folder, "cache") });
	assert.equal(ran.status, 0, ran.stderr);
	assert.match(ran.stdout, /^[^\n]*environ: Permission denied\nrefused\ncat: env: Permission denied\nrefused\ncheckout written\ntop refused\nown cache written\nshared cache refused\nbeside refused\n$/);
	assert.doesNotMatch(ran.stdout, /s3cret-t0ken/);
	assert.equal(readFileSync(join(root, "src", "made"), "utf8"), "x\n");
	assert.deepEqual([readFileSync(join(cache, "uv", "made"), "utf8"), existsSync(join(cache, "npm", "_npx")), existsSync(join(folder, "cache", "uv", "made"))], ["x\n", true, false]);
	assert.deepEqual(lines, [], "set up, the sandbox adds no line to the merge's output");
});
