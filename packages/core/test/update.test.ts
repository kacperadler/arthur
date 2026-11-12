import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { arthurVersion } from "../src/job-machine.ts";
import { temporaryFolder } from "../src/testing.ts";
import { update } from "../src/update.ts";

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const SYSTEMCTL = "restart arthur run on it once no job runs: systemctl --user restart arthur";
const GUARD = "arthur run restarts on it once no job and no merge runs (the session plugin's restart guard)";

// Arthur's repository in small: `origin`, bare, and `work`, where each release is committed and tagged `v<version>`: the core's
// package.json and one source file, and a root package without dependencies whose `npm ci` writes `installed` (its version)
// through its postinstall; `fails` makes that postinstall exit 1 instead, so `npm ci` there fails.
function repository() {
	const folder = temporaryFolder();
	const [origin, work] = [join(folder, "origin.git"), join(folder, "work")];
	git(folder, "init", "--quiet", "--bare", origin);
	git(folder, "init", "--quiet", "-b", "main", work);
	git(work, "remote", "add", "origin", origin);
	const release = (version: string, fails = false) => {
		mkdirSync(join(work, "packages/core/src"), { recursive: true });
		writeFileSync(join(work, "packages/core/package.json"), JSON.stringify({ name: "@arthur/core", version }));
		writeFileSync(join(work, "packages/core/src/core.ts"), `export const release = "${version}";\n`);
		const postinstall = fails ? `node -e "process.exit(1)"` : `node -e "require('fs').writeFileSync('installed', process.env.npm_package_version)"`;
		writeFileSync(join(work, "package.json"), JSON.stringify({ name: "arthur", version, private: true, scripts: { postinstall } }));
		const lockfile = { name: "arthur", version, lockfileVersion: 3, requires: true, packages: { "": { name: "arthur", version } } };
		writeFileSync(join(work, "package-lock.json"), JSON.stringify(lockfile));
		writeFileSync(join(work, ".gitignore"), "installed\nnode_modules/\n");
		git(work, "add", "-A");
		git(work, "commit", "--quiet", "-m", `Release ${version}`);
		git(work, "tag", `v${version}`);
		git(work, "push", "--quiet", "origin", "main", "--tags");
		return git(work, "rev-parse", "HEAD");
	};
	// A full clone of origin, as docs/setup.md installs one, at `at` (a tag, commit or branch); its core folder.
	const clone = (at: string) => {
		const root = join(folder, `clone-${Math.random().toString(16).slice(2)}`);
		git(folder, "clone", "--quiet", origin, root);
		git(root, "checkout", "--quiet", at);
		return { root, core: join(root, "packages/core") };
	};
	return { work, release, clone };
}
const head = (root: string) => git(root, "rev-parse", "HEAD");
const installed = (root: string) => (existsSync(join(root, "installed")) ? readFileSync(join(root, "installed"), "utf8") : undefined);

test("with no argument it fetches, checks out the newest release tag, runs npm ci there, and says the versions; again, it is up to date", () => {
	const { release, clone } = repository();
	release("0.1.0");
	const { root, core } = clone("v0.1.0");
	const old = arthurVersion(core);
	const newest = [release("0.9.0"), release("0.10.0")][1];
	release("0.2.0");
	assert.deepEqual(update(core, undefined, []), [`updated ${old} to ${arthurVersion(core)}`, SYSTEMCTL]);
	assert.deepEqual([head(root), installed(root), arthurVersion(core).split(" ")[0]], [newest, "0.10.0", "0.10.0"], "0.10.0 is newer than 0.9.0 and 0.2.0");
	assert.notEqual(arthurVersion(core).split(" ")[1], old.split(" ")[1]);
	rmSync(join(root, "installed"));
	assert.deepEqual(update(core, undefined, []), [`up to date: ${arthurVersion(core)}`]);
	assert.equal(installed(root), undefined, "up to date runs no npm ci");
});

test("a tag or commit given is the target, older than HEAD too; a checkout on a branch moves to it, detached", () => {
	const { release, clone } = repository();
	const first = release("0.1.0");
	release("0.2.0");
	const { root, core } = clone("main");
	assert.equal(update(core, "v0.1.0", [])[0]?.startsWith("updated 0.2.0 "), true);
	assert.deepEqual([head(root), installed(root)], [first, "0.1.0"]);
	assert.throws(() => git(root, "symbolic-ref", "-q", "HEAD"), "detached");
	const second = git(root, "rev-parse", "v0.2.0^{commit}");
	assert.deepEqual(update(core, second, [])[0], `updated ${arthurVersion(join(clone("v0.1.0").core))} to ${arthurVersion(core)}`);
	assert.deepEqual([head(root), installed(root)], [second, "0.2.0"]);
	assert.deepEqual(update(core, "v0.2.0", []), [`up to date: ${arthurVersion(core)}`]);
});

test("a replacement of the target's commit (refs/replace) in the checkout is not followed: the tag's own files are checked out", () => {
	const { release, clone } = repository();
	const first = release("0.1.0");
	const { root, core } = clone("v0.1.0");
	const second = release("0.2.0");
	git(root, "fetch", "--quiet", "--tags", "origin");
	git(root, "replace", second, first);
	assert.equal(update(core, "v0.2.0", [])[0]?.endsWith(` to ${arthurVersion(core)}`), true);
	assert.deepEqual([git(root, "--no-replace-objects", "rev-parse", "HEAD"), installed(root), arthurVersion(core).split(" ")[0]], [second, "0.2.0", "0.2.0"]);
});

test("after an update, the session plugin's restart guard restarts arthur run; without it, or with restartGuard false, the owner does", () => {
	const { release, clone } = repository();
	release("0.1.0");
	const { core } = clone("v0.1.0");
	release("0.2.0");
	assert.equal(update(core, "v0.2.0", [{ name: "manage" }, { name: "session", options: {} }])[1], GUARD);
	assert.equal(update(core, "v0.1.0", [{ name: "session", options: { restartGuard: true } }])[1], GUARD);
	assert.equal(update(core, "v0.2.0", [{ name: "session", options: { restartGuard: false } }])[1], SYSTEMCTL);
	assert.equal(update(core, "v0.1.0", [{ name: "manage", options: {} }])[1], SYSTEMCTL);
});

test("refused, naming what, nothing changed: a core outside Git, changed tracked files, a branch without an argument, an unknown target, no tag, a failed fetch", () => {
	const outside = join(temporaryFolder(), "packages/core");
	mkdirSync(outside, { recursive: true });
	assert.throws(() => update(outside, undefined, []), (error: Error) => error.message.startsWith(`${outside} is not in a Git checkout (fatal: not a git repository`) && error.message.endsWith("); install Arthur from a clone, as docs/setup.md, step 4, says"));

	const { work, release, clone } = repository();
	const first = release("0.1.0");
	const { root, core } = clone("v0.1.0");
	release("0.2.0");
	writeFileSync(join(root, "package.json"), "{}");
	writeFileSync(join(core, "src/core.ts"), "");
	writeFileSync(join(root, "untracked"), "");
	assert.throws(() => update(core, undefined, []), { message: `${root} has changed tracked files: package.json, packages/core/src/core.ts; commit, stash or undo them first` });
	git(root, "add", "package.json");
	git(root, "checkout", "--", "packages/core/src/core.ts");
	assert.throws(() => update(core, "v0.2.0", []), { message: `${root} has changed tracked files: package.json; commit, stash or undo them first` }, "a staged change too");
	git(root, "reset", "--quiet", "--hard");
	assert.equal(head(root), first);

	const branch = clone("main");
	assert.throws(() => update(branch.core, undefined, []), { message: "main is a development checkout; update it with git pull" });
	git(branch.root, "checkout", "--quiet", "-b", "mine");
	assert.throws(() => update(branch.core, undefined, []), { message: "mine is a development checkout; update it with git pull" });
	assert.throws(() => update(core, "v9.9.9", []), { message: `v9.9.9 is no tag or commit of ${root} after git fetch --tags origin` });
	assert.equal(head(root), first);

	const bare = clone("v0.1.0");
	git(bare.root, "tag", "-d", "v0.1.0", "v0.2.0");
	git(work, "push", "--quiet", "--delete", "origin", "v0.1.0", "v0.2.0");
	assert.throws(() => update(bare.core, undefined, []), { message: `${bare.root} has no release tag v* after git fetch --tags origin` });
	git(root, "remote", "set-url", "origin", join(root, "gone.git"));
	assert.throws(() => update(core, undefined, []), (error: Error) => error.message.startsWith(`git fetch in ${root}: fatal: `));
	assert.deepEqual([head(root), installed(root)], [first, undefined]);
});

test("npm ci that fails at the target goes back, to the branch it was on too, runs npm ci there again and says so; failing there too, says that", () => {
	const { release, clone } = repository();
	const good = release("0.1.0");
	release("0.2.0", true);
	const { root, core } = clone("v0.1.0");
	const old = arthurVersion(core);
	assert.throws(() => update(core, undefined, []), { message: `npm ci failed at v0.2.0 (exit code 1); back at ${old}, npm ci ran again there` });
	assert.deepEqual([head(root), installed(root), arthurVersion(core)], [good, "0.1.0", old]);

	const branch = clone("main");
	git(branch.root, "checkout", "--quiet", "-b", "mine", "v0.1.0");
	assert.throws(() => update(branch.core, "v0.2.0", []), { message: `npm ci failed at v0.2.0 (exit code 1); back at ${old}, npm ci ran again there` });
	assert.equal(git(branch.root, "symbolic-ref", "--short", "HEAD"), "mine");

	release("0.3.0", true);
	const broken = clone("v0.2.0");
	const was = arthurVersion(broken.core);
	assert.throws(() => update(broken.core, undefined, []), { message: `npm ci failed at v0.3.0 (exit code 1); back at ${was}, npm ci failed there too (exit code 1): run npm ci in ${broken.root} by hand` });
	assert.equal(head(broken.root), git(broken.root, "rev-parse", "v0.2.0^{commit}"));
});

test("more than one argument, or one that starts with -, is wrong usage, exit code 2", () => {
	const cli = join(import.meta.dirname, "../src/cli.ts");
	for (const args of [["v0.1.0", "v0.2.0"], ["--force"], ["-x"]]) {
		const run = spawnSync(process.execPath, [cli, "update", ...args], { cwd: temporaryFolder(), encoding: "utf8" });
		assert.deepEqual([run.status, run.stdout, run.stderr], [2, "", "usage: arthur update [<tag or commit>]\n"], args.join(" "));
	}
});
