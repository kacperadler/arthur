import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
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
	const ran = stepRunner(root, jobSlice.slice, sandbox, () => {}, 60)(script, { ...process.env, XDG_CACHE_HOME: join(folder, "cache") });
	assert.equal(ran.status, 0, ran.stderr);
	assert.match(ran.stdout, /^[^\n]*environ: Permission denied\nrefused\ncat: env: Permission denied\nrefused\ncheckout written\ntop refused\nown cache written\nshared cache refused\nbeside refused\n$/);
	assert.doesNotMatch(ran.stdout, /s3cret-t0ken/);
	assert.equal(readFileSync(join(root, "src", "made"), "utf8"), "x\n");
	assert.deepEqual([readFileSync(join(cache, "uv", "made"), "utf8"), existsSync(join(cache, "npm", "_npx")), existsSync(join(folder, "cache", "uv", "made"))], ["x\n", true, false]);
	assert.deepEqual(lines, [], "set up, the sandbox adds no line to the merge's output");
});

test("a step still running at its limit is killed with SIGKILL, though it ignores SIGTERM, and its error names the limit", () => {
	const started = Date.now();
	// 8 s that SIGTERM does not end: with SIGTERM as the kill, the step exits 0 once they passed.
	const ran = stepRunner(root, jobSlice.slice, sandbox, () => {}, 1)("trap '' TERM; for second in 1 2 3 4 5 6 7 8; do sleep 1; done", process.env);
	assert.deepEqual([ran.status, ran.signal, ran.error?.message], [null, "SIGKILL", "timed out after 1 s"]);
	assert.ok(Date.now() - started < 10_000, `it took ${Date.now() - started} ms`);
});

// A checkout `acme` with a real submodule at `vendor/lib` and the owner's own clones at `tools/scratch`, with one commit, a
// linked worktree at `tools/wt` and `core.splitIndex` set, and `tools/other`, its `.git` 775 as umask 002 makes it, his bare
// repository `tools/bare.git`, his symlink `tools/beside` to a repository beside the checkout and `tools/py` to a file `out/py`
// there, all there before the first step; `fsmonitor` that repository, whose `core.fsmonitor` writes `pwned`, as the reviewer of AR0457 planted one.
function planted() {
	const folder = temporaryFolder();
	const [root, pwned] = [join(folder, "acme"), join(folder, "pwned")];
	const git = (at: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "protocol.file.allow=always", "-C", at, ...args], { encoding: "utf8" }).trim();
	for (const [path, text] of Object.entries({ "acme/src/shop.ts": "export const shop = 1;\n", "acme/lib/cart.ts": "export const cart = 1;\n", "acme/tools/scratch/notes.md": "# notes\n", "acme/tools/other/notes.md": "# notes\n", "lib/lib.ts": "export const lib = 1;\n", "fsmonitor/a": "", "out/py": "" })) {
		mkdirSync(join(folder, path, ".."), { recursive: true });
		writeFileSync(join(folder, path), text);
	}
	for (const at of ["acme", "lib", "acme/tools/scratch", "acme/tools/other", "fsmonitor"].map((name) => join(folder, name))) git(at, "init", "--quiet", "--initial-branch=main");
	git(join(folder, "fsmonitor"), "config", "core.fsmonitor", `touch '${pwned}'`);
	git(join(folder, "lib"), "add", "--all");
	git(join(folder, "lib"), "commit", "--quiet", "-m", "lib");
	git(root, "submodule", "--quiet", "add", join(folder, "lib"), "vendor/lib");
	git(join(root, "tools", "scratch"), "add", "--all");
	git(join(root, "tools", "scratch"), "commit", "--quiet", "-m", "notes");
	git(join(root, "tools", "scratch"), "worktree", "add", "--quiet", join(root, "tools", "wt"));
	git(join(root, "tools", "scratch"), "config", "core.splitIndex", "true");
	chmodSync(join(root, "tools", "other", ".git"), 0o775);
	git(root, "init", "--quiet", "--bare", "tools/bare.git");
	symlinkSync(join(folder, "fsmonitor"), join(root, "tools", "beside"));
	symlinkSync(join(folder, "out", "py"), join(root, "tools", "py"));
	writeFileSync(join(root, ".gitignore"), "tools/\n");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	const lines: string[] = [];
	const run = stepRunner(root, jobSlice.slice, (command) => ["sh", ["-c", command]], (line) => void (line.startsWith("uncapped: ") || lines.push(line)), 60);
	const kept = () => ["vendor/lib/.git", "tools/scratch/.git", "tools/other/.git", "tools/bare.git", "tools/beside"].map((path) => [lstatSync(join(root, path)).ino, existsSync(join(root, path))]);
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

test("a failed step is swept too: a submodule's .git file it rewrote, a repository in a folder it made unreadable, and one it made unremovable; the checkout's own .git, even remade by a step run bare, and the checkout with a HEAD at its top stay, and the .git it moved away is removed", () => {
	const { root, gitfile, git, run, lines } = planted();
	const head = git(root, "rev-parse", "HEAD");
	const command = ["mv .git .git-old", "cp -R .git-old .git", "echo 'ref: refs/heads/main' > HEAD", `echo '${gitfile}' > vendor/lib/.git`, "mkdir -p deep/x hard", "git init -q deep/x", "chmod 300 deep", "git init -q hard", "chmod 500 hard/.git/objects hard", "exit 1"].join(" && ");
	const ran = run(command, process.env);
	assert.equal(ran.status, 1, ran.stderr);
	assert.deepEqual(lines.sort(), said(command, ".git-old", "deep/x/.git", "hard/.git", "vendor/lib/.git"));
	assert.deepEqual([".git-old", "deep/x/.git", "hard/.git", "vendor/lib/.git"].map((path) => existsSync(join(root, path))), [false, false, false, false]);
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

test("a repository a step made under another name, a bare one turned into a working one with core.fsmonitor, is removed after it, one line; the owner's bare repository and symlink stay", () => {
	const { root, pwned, run, lines, kept } = planted();
	const before = kept();
	const command = ["git init -q --bare src/cache", "git -C src/cache config core.bare false", `git -C src/cache config core.worktree '${join(root, "src")}'`, `git -C src/cache config core.fsmonitor "touch '${pwned}'"`].join(" && ");
	const ran = run(command, process.env);
	assert.equal(ran.status, 0, ran.stderr);
	assert.deepEqual(lines, said(command, "src/cache"));
	assert.equal(existsSync(join(root, "src", "cache")), false);
	assert.deepEqual(kept(), before, "the owner's clones, bare repository and symlink are the same ones");
});

test("a symlink a step made to a folder outside the checkout, into its .git, or dangling outside it is removed after it, one line each; one to a folder inside it, to a file, or dangling inside it stays, and so does the owner's from before the first step, though its target went and a folder came in its place", () => {
	const { root, run, lines } = planted();
	const beside = join(root, "..");
	const links = { link: join(beside, "fsmonitor"), objects: "../.git/objects", later: join(beside, "later"), inner: "../lib", file: join(beside, "fsmonitor", "a"), soon: "../made/later" };
	const command = Object.entries(links).map(([name, target]) => `ln -s '${target}' src/${name}`).join(" && ");
	const ran = run(command, process.env);
	assert.equal(ran.status, 0, ran.stderr);
	assert.deepEqual(lines.sort(), said(command, "src/later", "src/link", "src/objects"));
	assert.deepEqual(Object.keys(links).map((name) => lstatSync(join(root, "src", name), { throwIfNoEntry: false })?.isSymbolicLink() ?? false), [false, false, false, true, true, true]);
	assert.equal(existsSync(join(beside, "fsmonitor", ".git")), true, "the removed symlink's target stays");
	for (const step of [`rm '${join(beside, "out", "py")}'`, `mkdir '${join(beside, "out", "py")}'`]) assert.equal(run(step, process.env).status, 0);
	assert.equal(lines.length, 3, "the owner's symlink, the same, adds no line");
	assert.equal(lstatSync(join(root, "tools", "py")).isSymbolicLink(), true);
});

test("a step that only reads the owner's clones with git keeps them and their history, though git status rewrote their index, a split one and a linked worktree's; one that then writes a hook or core.fsmonitor in one has it removed", () => {
	const { root, pwned, git, run, lines, kept } = planted();
	const indexes = ["tools/scratch/.git/index", "tools/scratch/.git/worktrees/wt/index"].map((path) => join(root, path));
	// A stat the index does not hold, so git status refreshes each index and writes it anew.
	for (const path of ["tools/scratch/notes.md", "tools/wt/notes.md"]) utimesSync(join(root, path), 0, 0);
	const [before, inodes] = [kept(), indexes.map((path) => lstatSync(path).ino)];
	const read = ["tools/scratch", "tools/wt", "tools/other"].map((folder) => `git -C ${folder} status --porcelain`).concat("git -C tools/scratch log --oneline").join(" && ");
	const ran = run(read, process.env);
	assert.equal(ran.status, 0, ran.stderr);
	for (const [at, path] of indexes.entries()) assert.notEqual(lstatSync(path).ino, inodes[at], `git status rewrote ${path}`);
	assert.match(readdirSync(join(root, "tools", "scratch", ".git")).join(" "), /\bsharedindex\.[0-9a-f]+\b/, "git status split the index");
	assert.deepEqual(lines, [], "a step that only read the clones adds no line");
	assert.deepEqual(kept(), before, "the owner's clones are the same ones");
	assert.equal(git(join(root, "tools", "scratch"), "log", "--format=%s"), "notes", "the clone keeps its history");
	assert.equal(git(join(root, "tools", "wt"), "rev-parse", "--show-toplevel"), join(root, "tools", "wt"), "the linked worktree still works");
	const hook = join(root, "tools/scratch/.git/hooks/post-checkout");
	const command = [read, `printf '#!/bin/sh\\ntouch %s\\n' '${pwned}' > ${hook}`, `chmod +x ${hook}`, `git -C tools/other config core.fsmonitor "touch '${pwned}'"`].join(" && ");
	assert.equal(run(command, process.env).status, 0);
	assert.deepEqual(lines.sort(), said(command, "tools/other/.git", "tools/scratch/.git"));
	assert.deepEqual([existsSync(hook), existsSync(join(root, "tools", "other", ".git"))], [false, false]);
	git(join(root, "tools", "other"), "status", "--porcelain");
	assert.equal(existsSync(pwned), false, "git status in the clone ran no planted fsmonitor");
});

// A POSIX ACL as Linux keeps it (`system.posix_acl_access`: version 2, then each entry's tag, permissions and id) that gives
// `nobody` (65534) rwx under the mask rwx, so a 775 folder's mode stays as it was: `setfacl -m u:nobody:rwx`, by python3.
const ACL = "import os, struct, sys\nos.setxattr(sys.argv[1], 'system.posix_acl_access', struct.pack('<I', 2) + b''.join(struct.pack('<HHI', *e) for e in [(1, 7, 2**32 - 1), (2, 7, 65534), (4, 7, 2**32 - 1), (16, 7, 2**32 - 1), (32, 5, 2**32 - 1)]))";
// One of Arthur's user's groups other than the one a new folder gets; none for a user in one group.
const group = process.getgroups?.().find((id) => id !== process.getegid?.());

// What a step that runs `command` prints, once the test saw it removed the `.git` of `path`.
function opened(command: string, path: string): string {
	const { root, run, lines } = planted();
	const ran = run(command, process.env);
	assert.equal(ran.status, 0, ran.stderr);
	assert.deepEqual(lines, said(command, path));
	assert.equal(existsSync(join(root, path)), false);
	return ran.stdout;
}

test("a step that only opens a folder in a clone's .git to others, by its mode or by an ACL that leaves the mode as it was, so another user could plant a hook there later, has it removed", () => {
	opened("chmod o+w tools/other/.git", "tools/other/.git");
	assert.equal(opened(`python3 -I -c "${ACL}" tools/other/.git && stat -c %a tools/other/.git`, "tools/other/.git"), "775\n", "the ACL left the mode as it was");
});

test("a step that only hands a group-writable .git of a clone to another group of Arthur's user has it removed", { skip: group === undefined && "Arthur's user is in one group" }, () => {
	opened(`chgrp ${group} tools/other/.git`, "tools/other/.git");
});

test("where python3 cannot read a folder's attributes, a git read in a clone's .git counts as a change, so no ACL there is missed", () => {
	// A python3 first on the PATH that fails, as one missing does, for Arthur's process only: the step runs on the PATH it had.
	const bin = join(temporaryFolder(), "bin");
	mkdirSync(bin);
	writeFileSync(join(bin, "python3"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
	const path = process.env.PATH;
	process.env.PATH = `${bin}:${path}`;
	try {
		const { run, lines } = planted();
		const command = "git -C tools/other status --porcelain";
		assert.equal(run(command, { ...process.env, PATH: path }).status, 0);
		assert.deepEqual(lines, said(command, "tools/other/.git"));
	} finally {
		process.env.PATH = path;
	}
});
