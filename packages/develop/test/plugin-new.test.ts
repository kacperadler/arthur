import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { develop } from "../src/develop.ts";

// `arthur plugin new` against the fake host, in a copy of this repository made in the test's own temporary folder, never in
// the checkout: its packages, its root tests and the files they read, with node_modules linked as `npm ci` links them. The
// copy is a Git repository, so "nothing was written" is `git status` clean.

const REPOSITORY = join(import.meta.dirname, "..", "..", "..");
const FILES = [".gitignore", ".github", "package.json", "package-lock.json", "tsconfig.json", "README.md", "arthur.mmd", "test", "packages"];
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

// `arthur plugin <args> [--project <project>]` with Arthur's copy `root` as the main project, and an empty folder as `other`;
// `home`, the fake host's home folder, where a job's record is.
async function load(t: TestContext, root: string) {
	const fake = fakeHost({ name: "develop" });
	fake.provide("projects", () => [{ name: "arthur", path: root, prefix: "AR" }, { name: "other", path: temporaryFolder(), prefix: "OT" }]);
	await fake.setup(develop());
	const command = fake.commands.find((each) => each.name === "plugin");
	const run = async (args: readonly string[], project?: string) => {
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => command?.run({ args, project })).finally(() => t.mock.restoreAll());
		return { code: code ?? 0, out: out.join("\n"), err: err.join("\n") };
	};
	return Object.assign(run, { home: dirname(fake.host.folder) });
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
	const [checkout, worktree] = [copy(), copy()];
	const plugin = await load(t, checkout);
	const record = join(plugin.home, "jobs", "2026-10-21-worker-0a1b2c3d");
	mkdirSync(record, { recursive: true });
	writeFileSync(join(record, "worktree"), `${worktree}\n`);
	const refused = (why: string) => ({ code: 1, out: "", err: `refused: ${why}; nothing was written` });
	assert.deepEqual(await plugin(["new", "acme", "--budget", "100", "--root", worktree]), refused("--root is a job's own worktree; outside a job the package goes into the project's checkout"));

	// The test kit clears every ARTHUR_ variable; a job's wrapper sets this one to the job's record, in the home the CLI reads.
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

// The job whose systemd scope runs this test, when one does (a job's own `npm test`).
const scope = /\/arthur-job-([^/]+)\.scope$/.exec(existsSync("/proc/self/cgroup") ? readFileSync("/proc/self/cgroup", "utf8").trimEnd() : "")?.[1];

test("in a job's scope only its own worktree is written with ARTHUR_JOB cleared once the home holds that job's record", { skip: scope === undefined && "not run in a job's systemd scope" }, async (t) => {
	const [checkout, worktree] = [temporaryFolder(), temporaryFolder()];
	const plugin = await load(t, checkout);
	const refused = (why: string) => ({ code: 1, out: "", err: `refused: ${why}; nothing was written` });
	assert.deepEqual(await plugin(["new", "acme", "--budget", "100"]), refused(`${checkout} is not Arthur's repository: no packages/core`), "the test's own home holds no record of the job");
	const record = join(plugin.home, "jobs", scope ?? "");
	mkdirSync(record, { recursive: true });
	writeFileSync(join(record, "worktree"), `${worktree}\n`);
	assert.deepEqual(await plugin(["new", "acme", "--budget", "100"]), refused(`a job writes only in its own worktree: add --root ${worktree}`));
});

// The checkout's config: develop, and in place of orchestration a test plugin that answers the project list.
const CONFIG = `import { develop } from "@arthur/develop";

export default { plugins: [{ name: "orchestration", setup: (host) => host.provide("projects", () => [{ name: "arthur", path: import.meta.dirname, prefix: "AR" }]) }, develop()] };
`;

test("the coordinator is told that a new plugin's ticket names the local machine, for each project that is Arthur's repository only", async () => {
	const [arthur, fork, other] = [temporaryFolder(), temporaryFolder(), temporaryFolder()];
	for (const root of [arthur, fork]) {
		mkdirSync(join(root, "packages", "core"), { recursive: true });
		writeFileSync(join(root, "packages", "core", "package.json"), "{}");
	}
	let projects = [{ name: "arthur", path: arthur, prefix: "AR" }, { name: "other", path: other, prefix: "OT" }, { name: "fork", path: fork, prefix: "FO" }];
	const fake = fakeHost({ name: "develop" });
	fake.provide("projects", () => projects);
	await fake.setup(develop());
	const line = (names: string) => `A ticket that makes a new plugin package in ${names} gets \`"machine": "local"\` in its JSON block before its first spawn: \`arthur plugin new\` runs only on the local machine, and every job of the ticket then goes there.`;
	assert.deepEqual(fake.collect("coordinator.context"), [line("arthur, fork")]);
	projects = [projects[1]!];
	assert.deepEqual(fake.collect("coordinator.context"), [undefined], "no project is Arthur's repository");
});

test("the planner and the worker are told the line that makes a new plugin from a job, and it runs as written; no other role or repository", async () => {
	const [checkout, worktree] = [copy(), join(temporaryFolder(), "worktree")];
	const record = join(checkout, ".arthur", "jobs", "2026-10-21-worker-0a1b2c3d");
	git(checkout, "worktree", "add", "--quiet", "--detach", worktree);
	const fake = fakeHost({ name: "develop" });
	await fake.setup(develop());
	const job = { project: "arthur", root: checkout, worktree, base: git(checkout, "rev-parse", "HEAD").trim(), machine: "local" };
	const fence = (root: string) => `\n\n\`\`\`\ncd <checkout> && node_modules/.bin/arthur plugin new <name> --budget <lines> --root ${root}\n\`\`\``;
	const [planner = ""] = fake.collect<string | undefined>("prompt", "planner", job);
	assert.match(planner, /^## A new plugin\n\nWhen the ticket makes a new plugin package, the plan says that its worker runs on the local machine, spawned with `--machine local`, and its first step is this line, so the worker makes the package with it, not by hand\. /);
	assert.ok(planner.endsWith(fence("<worktree>")), planner);
	const [worker = ""] = fake.collect<string | undefined>("prompt", "worker", job);
	assert.match(worker, /^## A new plugin\n\nWhen your ticket makes a new plugin package, make it first with this line, not by hand\. /);
	assert.ok(worker.endsWith(fence(worktree)), worker);
	for (const role of ["reviewer", "plan-reviewer", "coordinator"]) assert.deepEqual(fake.collect("prompt", role, job), [undefined], role);
	for (const role of ["planner", "worker"]) assert.deepEqual(fake.collect("prompt", role, { ...job, root: temporaryFolder() }), [undefined], `${role} outside Arthur's repository`);
	// On another machine the planner's section is the same; the worker gets no line, which cannot run there, and is told why.
	const away = { ...job, machine: "gpu", worktree: "/home/test/.arthur/repos/arthur.git.worktrees/x" };
	assert.deepEqual(fake.collect("prompt", "planner", away), [planner]);
	const [remote = ""] = fake.collect<string | undefined>("prompt", "worker", away);
	assert.match(remote, /^## A new plugin\n\nThis job runs on machine gpu, where `arthur plugin new` cannot run: .* when your ticket makes one, change nothing and end, saying that its ticket's JSON block needs `"machine": "local"`, which places every job of it there, and its worker spawned again with this task\.$/);
	assert.ok(!remote.includes("cd <checkout>"), remote);

	// The worker's line as written, `<checkout>` the first line of `git worktree list`, run in the job's worktree by a shell
	// with the job's record, in the home of the checkout's arthur.config.ts, and the systemd service's `PATH` of docs/setup.md
	// (Node's bin, `~/.local/bin`, the system folders), which has no `node_modules/.bin`; the checkout holds arthur.config.ts
	// and `arthur` as `npm ci` links it.
	writeFileSync(join(checkout, "arthur.config.ts"), CONFIG);
	symlinkSync(join("..", "@arthur", "core", "src", "cli.ts"), join(checkout, "node_modules", ".bin", "arthur"));
	mkdirSync(record, { recursive: true });
	writeFileSync(join(record, "worktree"), `${worktree}\n`);
	const first = git(worktree, "worktree", "list").split(" ")[0] ?? "";
	const line = worker.slice(worker.lastIndexOf("cd <checkout>"), -4).replace("<checkout>", first).replace("<name>", "acme").replace("<lines>", "100");
	const env = { ...ENV, ARTHUR_JOB: record, PATH: `${join(process.execPath, "..")}:${join(temporaryFolder(), ".local", "bin")}:/usr/local/bin:/usr/bin:/bin` };
	assert.notEqual(spawnSync("sh", ["-c", "command -v arthur"], { env }).status, 0, "the service's PATH has no arthur");
	const ran = spawnSync("sh", ["-c", line], { cwd: worktree, env, encoding: "utf8" });
	assert.equal(ran.status, 0, `${line}\n${ran.stdout}${ran.stderr}`);
	assert.match(changed(worktree), /^\?\? packages\/acme\/src\/acme\.ts$/m);
	assert.match(budgets(worktree), /, acme: 100$/);
	assert.equal(changed(checkout), "", "the project's checkout is untouched");
	// The same line in another folder, with the CLI the checkout links: there it reads no arthur.config.ts.
	const elsewhere = (folder: string) => line.replace(`cd ${first} && node_modules`, `cd ${folder} && ${first}/node_modules`);
	assert.equal(spawnSync("sh", ["-c", elsewhere(worktree)], { cwd: worktree, env, encoding: "utf8" }).status, 2, "from the worktree, without arthur.config.ts, the CLI has no plugin command");
	// Another machine's repository, bare as `arthur remote-job repo` makes it, with the job's worktree in it: the first line of
	// `git worktree list` there names the bare repository, which holds no arthur.config.ts either.
	const [bare, there] = [join(temporaryFolder(), "arthur.git"), join(temporaryFolder(), "there")];
	git(checkout, "clone", "--quiet", "--bare", checkout, bare);
	git(bare, "worktree", "add", "--quiet", "--detach", there);
	const repository = git(there, "worktree", "list").split(" ")[0] ?? "";
	assert.equal(repository, bare);
	writeFileSync(join(record, "worktree"), `${there}\n`);
	const far = spawnSync("sh", ["-c", elsewhere(repository).replace(worktree, there)], { cwd: there, env, encoding: "utf8" });
	assert.deepEqual([far.status, far.stderr.split("\n")[0]], [2, "arthur: unknown command plugin"], "in the bare repository there the CLI has no plugin command");
});
