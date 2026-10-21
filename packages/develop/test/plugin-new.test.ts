import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { develop } from "../src/develop.ts";

// `arthur plugin new` against the fake host, in a copy of this repository made in the test's own temporary folder, never in
// the checkout: its packages, its root tests and the files they read, with node_modules linked as `npm ci` links them. The
// copy is a Git repository, so "nothing was written" is `git status` clean.

const REPOSITORY = join(import.meta.dirname, "..", "..", "..");
const FILES = [".gitignore", "package.json", "package-lock.json", "tsconfig.json", "README.md", "arthur.mmd", "test", "packages"];
const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" });

function copy(): string {
	const root = join(temporaryFolder(), "arthur");
	for (const file of FILES) cpSync(join(REPOSITORY, file), join(root, file), { recursive: true, filter: (path) => !path.includes("node_modules") });
	mkdirSync(join(root, "node_modules", "@arthur"), { recursive: true });
	for (const name of readdirSync(join(root, "packages"))) symlinkSync(join("..", "..", "packages", name), join(root, "node_modules", "@arthur", name));
	for (const tool of ["typescript", "@types"]) symlinkSync(join(REPOSITORY, "node_modules", tool), join(root, "node_modules", tool));
	mkdirSync(join(root, "node_modules", ".bin"));
	symlinkSync(join("..", "typescript", "bin", "tsc"), join(root, "node_modules", ".bin", "tsc"));
	git(root, "init", "--quiet", "--initial-branch=main");
	commit(root);
	return root;
}

function commit(root: string): void {
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "copy");
}

const changed = (root: string) => git(root, "status", "--porcelain", "--untracked-files=all");

// `arthur plugin <args> [--project <project>]` with Arthur's copy `root` as the main project, and an empty folder as `other`.
async function load(t: TestContext, root: string) {
	const fake = fakeHost({ name: "develop" });
	fake.provide("projects", () => [{ name: "arthur", path: root, prefix: "AR" }, { name: "other", path: temporaryFolder(), prefix: "OT" }]);
	await fake.setup(develop());
	const command = fake.commands.find((each) => each.name === "plugin");
	return async (args: readonly string[], project?: string) => {
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => command?.run({ args, project })).finally(() => t.mock.restoreAll());
		return { code: code ?? 0, out: out.join("\n"), err: err.join("\n") };
	};
}

const budgets = (root: string) => readFileSync(join(root, "test", "structure.test.ts"), "utf8").match(/^const BUDGETS = \{ (.*) \};$/m)?.[1] ?? "";
// A command in the copy; a node:test run of its own, not one the test runner around this test skips as nested in it.
const { NODE_TEST_CONTEXT: _, ...ENV } = process.env;
const run = (root: string, command: string, ...args: string[]) => spawnSync(command, args, { cwd: root, env: ENV, encoding: "utf8" });

test("a new package passes npm run check, its own test and the structure test as created; one without a budget still fails", async (t) => {
	const root = copy();
	const plugin = await load(t, root);
	const before = budgets(root);
	assert.deepEqual(await plugin(["new", "acme-test-plugin", "--budget", "40"]), {
		code: 0,
		out: [
			"created packages/acme-test-plugin: package.json, src/acme-test-plugin.ts, test/acme-test-plugin.test.ts, docs/acme-test-plugin.md",
			'added "acme-test-plugin": 40 to BUDGETS in test/structure.test.ts, and @arthur/acme-test-plugin to package-lock.json',
			"next: write what it does, and list acmeTestPlugin() in the plugins of arthur.config.ts to load it",
		].join("\n"),
		err: "",
	});
	assert.equal((await plugin(["new", "acmetest", "--budget=25"])).code, 0, "a budget of exactly the new src/ lines");
	assert.equal(budgets(root), `${before}, "acme-test-plugin": 40, acmetest: 25`);
	assert.deepEqual(changed(root).split("\n").filter(Boolean).sort(), [
		" M package-lock.json",
		" M test/structure.test.ts",
		"?? packages/acme-test-plugin/docs/acme-test-plugin.md",
		"?? packages/acme-test-plugin/package.json",
		"?? packages/acme-test-plugin/src/acme-test-plugin.ts",
		"?? packages/acme-test-plugin/test/acme-test-plugin.test.ts",
		"?? packages/acmetest/docs/acmetest.md",
		"?? packages/acmetest/package.json",
		"?? packages/acmetest/src/acmetest.ts",
		"?? packages/acmetest/test/acmetest.test.ts",
	]);
	const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")).packages;
	assert.deepEqual([lock["node_modules/@arthur/acme-test-plugin"], lock["packages/acme-test-plugin"]], [{ resolved: "packages/acme-test-plugin", link: true }, { name: "@arthur/acme-test-plugin", license: "Apache-2.0" }]);
	const keys = Object.keys(lock);
	assert.deepEqual(keys, [...keys].sort(), "in npm's order");
	assert.equal(readlinkSync(join(root, "node_modules", "@arthur", "acme-test-plugin")), join("..", "..", "packages", "acme-test-plugin"));

	const check = run(root, "npm", "run", "check");
	assert.equal(check.status, 0, check.stdout + check.stderr);
	const tests = run(root, process.execPath, "--import", "@arthur/core/testing", "--test", "packages/acme-test-plugin/test/acme-test-plugin.test.ts", "packages/acmetest/test/acmetest.test.ts", "test/structure.test.ts");
	assert.equal(tests.status, 0, tests.stdout + tests.stderr);
	for (const ran of ["acme-test-plugin sets up on the fake host", "acmetest sets up on the fake host", "the repository keeps every rule"]) assert.match(tests.stdout, new RegExp(`^✔ ${ran}`, "m"), ran);
	// The specifier as an argument: written out here, the structure test would take it for this package's import.
	const options = run(root, process.execPath, "--input-type=module", "-e", "const o = await import(process.argv[1]); console.log(o.summary, Object.keys(o.table).length, o.tools.length)", "@arthur/acme-test-plugin/options");
	assert.equal(options.stdout, "acme-test-plugin: what the plugin does, in one line 0 0\n", "arthur setup reads its options file");

	mkdirSync(join(root, "packages", "stray", "test"), { recursive: true });
	writeFileSync(join(root, "packages", "stray", "package.json"), '{ "name": "@arthur/stray", "license": "Apache-2.0" }\n');
	writeFileSync(join(root, "packages", "stray", "test", "stray.test.ts"), "");
	const stray = run(root, process.execPath, "--test", "test/structure.test.ts");
	assert.notEqual(stray.status, 0, stray.stdout + stray.stderr);
	assert.match(stray.stdout, /packages\/stray: has no line budget; add one to test\/structure.test.ts/);
});

test("refused, exit 1, before any write: a bad name, a missing or wrong budget, a name taken; wrong usage exits 2", async (t) => {
	const root = copy();
	const plugin = await load(t, root);
	const refused = (why: string) => ({ code: 1, out: "", err: `refused: ${why}; nothing was written` });
	const usage = "usage: arthur plugin new <name> --budget <lines> [--project <name> | --root <job's worktree>]";
	for (const name of ["Acme", "acme_bot", "acme2", "acme-", "acme--bot", "é"])
		assert.deepEqual(await plugin(["new", name, "--budget", "100"]), refused(`plugin name "${name}": lowercase letters and dashes, such as uptime or commit-rules`), name);
	for (const [name, fn] of [["new", "new"], ["delete", "delete"], ["fake-host", "fakeHost"], ["check-options", "checkOptions"], ["summary", "summary"]] as const)
		assert.deepEqual(await plugin(["new", name, "--budget", "100"]), refused(`plugin name "${name}": its function would be named ${fn}, which the new package's files cannot declare`), name);
	assert.deepEqual(await plugin(["new", "acme"]), refused("--budget is missing: the plugin's line budget, the number its ticket decides"));
	for (const budget of ["0", "-1", "1.5", "01", "abc", "", "1e3", " 5"])
		assert.deepEqual(await plugin(["new", "acme", `--budget=${budget}`]), refused(`--budget "${budget}": a positive whole number of lines`), budget);
	assert.deepEqual(await plugin(["new", "acme", "--budget", "24"]), refused("--budget 24: below the 25 lines the new package's src/ holds as created"));
	for (const name of ["manage", "core", "develop"]) assert.deepEqual(await plugin(["new", name, "--budget", "100"]), refused(`packages/${name} exists already`), name);
	for (const args of [[], ["new"], ["make", "acme", "--budget", "100"], ["new", "acme", "more", "--budget", "100"]]) assert.deepEqual(await plugin(args), { code: 2, out: "", err: usage }, args.join(" "));
	for (const args of [["new", "acme", "--budget"], ["new", "acme", "--nope"], ["new", "acme", "--budget", "-1"]]) {
		const answer = await plugin(args);
		assert.deepEqual([answer.code, answer.out, answer.err.split("\n").at(-1)], [2, "", usage], args.join(" "));
	}
	await assert.rejects(plugin(["new", "acme", "--budget", "100"], "nope"), /^Error: unknown project nope; projects: arthur, other$/);
	assert.equal(changed(root), "");

	const structure = join(root, "test", "structure.test.ts");
	writeFileSync(structure, readFileSync(structure, "utf8").replace(/^const BUDGETS = \{ /m, 'const BUDGETS = { ghost: 5, "ghost-town": 9, '));
	commit(root);
	for (const name of ["ghost", "ghost-town"]) assert.deepEqual(await plugin(["new", name, "--budget", "100"]), refused(`${name} has a line budget in test/structure.test.ts already`), name);
	assert.equal((await plugin(["new", "town", "--budget", "100"])).code, 0, "ghost-town's budget is not town's");
	git(root, "reset", "--quiet", "--hard");
	git(root, "clean", "--quiet", "-d", "--force");
	assert.equal(changed(root), "");

	const answer = await plugin(["new", "acme", "--budget", "100"], "other");
	assert.match(answer.err, /^refused: \/.+ is not Arthur's repository: no packages\/core; nothing was written$/);
	writeFileSync(structure, `${readFileSync(structure, "utf8")}const BUDGETS = { core: 1 };\n`);
	commit(root);
	assert.deepEqual(await plugin(["new", "acme", "--budget", "100"]), refused(`${structure} holds 2 lines "const BUDGETS = { ... };", not one`));
	writeFileSync(structure, "");
	commit(root);
	assert.deepEqual(await plugin(["new", "acme", "--budget", "100"]), refused(`${structure} holds 0 lines "const BUDGETS = { ... };", not one`));
	git(root, "rm", "--quiet", "package-lock.json");
	git(root, "checkout", "--quiet", "HEAD~2", "--", "test/structure.test.ts");
	commit(root);
	assert.deepEqual(await plugin(["new", "acme", "--budget", "100"]), refused(`${root} has no package-lock.json`));
	assert.equal(changed(root), "");
	assert.ok(!existsSync(join(root, "node_modules", "@arthur", "acme")));
});

test("in a job only its own worktree, named by --root, is written; never the project's checkout; --root outside a job is refused", async (t) => {
	const [checkout, worktree, record] = [copy(), copy(), temporaryFolder()];
	writeFileSync(join(record, "worktree"), `${worktree}\n`);
	const plugin = await load(t, checkout);
	const refused = (why: string) => ({ code: 1, out: "", err: `refused: ${why}; nothing was written` });
	assert.deepEqual(await plugin(["new", "acme", "--budget", "100", "--root", worktree]), refused("--root is a job's own worktree; outside a job the package goes into the project's checkout"));

	// The test kit clears every ARTHUR_ variable; a job's wrapper sets this one to the job's record.
	t.after(() => delete process.env.ARTHUR_JOB);
	process.env.ARTHUR_JOB = record;
	assert.deepEqual(await plugin(["new", "acme", "--budget", "100"]), refused(`a job writes only in its own worktree: add --root ${worktree}`));
	for (const other of [checkout, join(worktree, "packages"), join(worktree, "missing")])
		assert.deepEqual(await plugin(["new", "acme", "--budget", "100", "--root", other]), refused(`--root ${other} is not this job's worktree ${worktree}`), other);
	assert.equal(changed(checkout), "");
	assert.equal(changed(worktree), "");

	const link = join(temporaryFolder(), "worktree");
	symlinkSync(worktree, link);
	assert.equal((await plugin(["new", "acme", "--budget", "100", "--root", link])).code, 0, "a link to the worktree is the worktree");
	assert.equal(changed(checkout), "", "the project's checkout is untouched");
	assert.match(changed(worktree), /^\?\? packages\/acme\/src\/acme\.ts$/m);
	assert.match(budgets(worktree), /, acme: 100$/);
	assert.equal(readlinkSync(join(worktree, "node_modules", "@arthur", "acme")), join("..", "..", "packages", "acme"));
	assert.ok(!existsSync(join(checkout, "node_modules", "@arthur", "acme")));
});
