import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

// A checkout `acme` with a real submodule at `vendor/lib` and the owner's own clones at `tools/scratch` and `tools/other`, all
// there before the first step; `fsmonitor` a repository beside it whose `core.fsmonitor` writes `pwned`, as the reviewer of
// AR0457 planted one.
function planted() {
	const folder = temporaryFolder();
	const [root, pwned] = [join(folder, "acme"), join(folder, "pwned")];
	const git = (at: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "protocol.file.allow=always", "-C", at, ...args], { encoding: "utf8" }).trim();
	for (const [path, text] of Object.entries({ "acme/src/shop.ts": "export const shop = 1;\n", "acme/lib/cart.ts": "export const cart = 1;\n", "acme/tools/scratch/notes.md": "# notes\n", "acme/tools/other/notes.md": "# notes\n", "lib/lib.ts": "export const lib = 1;\n", "fsmonitor/a": "" })) {
		mkdirSync(join(folder, path, ".."), { recursive: true });
		writeFileSync(join(folder, path), text);
	}
	for (const at of ["acme", "lib", "acme/tools/scratch", "acme/tools/other", "fsmonitor"].map((name) => join(folder, name))) git(at, "init", "--quiet", "--initial-branch=main");
	git(join(folder, "fsmonitor"), "config", "core.fsmonitor", `touch '${pwned}'`);
	git(join(folder, "lib"), "add", "--all");
	git(join(folder, "lib"), "commit", "--quiet", "-m", "lib");
	git(root, "submodule", "--quiet", "add", join(folder, "lib"), "vendor/lib");
	writeFileSync(join(root, ".gitignore"), "tools/\n");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	const lines: string[] = [];
	const run = stepRunner(root, jobSlice.slice, (command) => ["sh", ["-c", command]], (line) => void (line.startsWith("uncapped: ") || lines.push(line)), 60);
	const kept = () => ["vendor/lib/.git", "tools/scratch/.git", "tools/other/.git"].map((path) => [lstatSync(join(root, path)).ino, existsSync(join(root, path))]);
	return { root, pwned, gitfile: `gitdir: ${join(folder, "fsmonitor", ".git")}`, git, run, lines, kept };
}

const said = (command: string, ...paths: string[]) => paths.map((path) => `removed ${path}, which ${command} left: a git call in that folder would run its config outside any sandbox`);

test("a step's nested repository and .git file are removed after it, one line each, and a git call there runs no planted fsmonitor; its other changes, the submodule and the owner's own clone stay", () => {
	const { root, pwned, gitfile, git, run, lines, kept } = planted();
	const before = kept();
	const command = `git init -q src && git -C src config core.fsmonitor "touch '${pwned}'" && echo '${gitfile}' > lib/.git && echo changed > src/shop.ts`;
	const ran = run(command, process.env);
	assert.equal(ran.status, 0, ran.stderr);
	assert.deepEqual(lines.sort(), said(command, "lib/.git", "src/.git"));
	assert.deepEqual([existsSync(join(root, "src", ".git")), existsSync(join(root, "lib", ".git"))], [false, false]);
	assert.equal(readFileSync(join(root, "src", "shop.ts"), "utf8"), "changed\n");
	assert.deepEqual(kept(), before, "the submodule's .git file and the owner's clones are the same ones");
	assert.equal(git(join(root, "vendor", "lib"), "rev-parse", "--show-toplevel"), join(root, "vendor", "lib"), "the submodule still works");
	for (const folder of ["src", "lib", "vendor/lib"]) git(join(root, folder), "status", "--porcelain");
	assert.equal(existsSync(pwned), false, "git status in each folder ran no planted fsmonitor");
	assert.equal(run("true", process.env).status, 0);
	assert.equal(lines.length, 2, "a step that plants nothing adds no line");
});

test("a failed step is swept too: a submodule's .git file it rewrote, a repository in a folder it made unreadable, and one it made unremovable; the checkout's own .git, even remade by a step run bare, stays", () => {
	const { root, gitfile, git, run, lines } = planted();
	const head = git(root, "rev-parse", "HEAD");
	const command = ["mv .git .git-old", "cp -R .git-old .git", `echo '${gitfile}' > vendor/lib/.git`, "mkdir -p deep/x hard", "git init -q deep/x", "chmod 300 deep", "git init -q hard", "chmod 500 hard/.git/objects hard", "exit 1"].join(" && ");
	const ran = run(command, process.env);
	assert.equal(ran.status, 1, ran.stderr);
	assert.deepEqual(lines.sort(), said(command, "deep/x/.git", "hard/.git", "vendor/lib/.git"));
	assert.deepEqual(["deep/x/.git", "hard/.git", "vendor/lib/.git"].map((path) => existsSync(join(root, path))), [false, false, false]);
	assert.equal(git(root, "rev-parse", "HEAD"), head);
});

test("a .git folder there before the first step that a step wrote in, its config appended to in place and a folder in it closed, or replaced is removed, and a git call there runs no planted fsmonitor", () => {
	const { root, pwned, git, run, lines } = planted();
	const command = [`printf '[core]\\n\\tfsmonitor = touch %s\\n' '${pwned}' >> tools/scratch/.git/config`, "chmod 000 tools/scratch/.git/info", "rm -rf tools/other/.git", "git init -q tools/other", `git -C tools/other config core.fsmonitor "touch '${pwned}'"`].join(" && ");
	const ran = run(command, process.env);
	assert.equal(ran.status, 0, ran.stderr);
	assert.deepEqual(lines.sort(), said(command, "tools/other/.git", "tools/scratch/.git"));
	for (const folder of ["tools/scratch", "tools/other"]) git(join(root, folder), "status", "--porcelain");
	assert.equal(existsSync(pwned), false, "git status in each clone ran no planted fsmonitor");
});
