import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import type { Job } from "@arthur/core/plugin";
import { type FakeHost, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { checkOptions, table } from "../src/commit-rules-options.ts";
import { commitRules, type Rule } from "../src/commit-rules.ts";
import { hookStep } from "../src/hook.ts";

const REGEX = "^(feat|fix|docs)(\\([\\w-]+\\))?!?: .{1,72}$";
const RULE = "commit refused: the subject \"Fixed it\" does not match this project's commit rule, the regex ^(feat|fix|docs)(\\([\\w-]+\\))?!?: .{1,72}$";
const WORDS = "Start with the ticket id, then a verb in the imperative.";

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
// A commit as an agent makes it: hooks run; its exit code and what it said.
const commit = (cwd: string, message: string, ...more: string[]) => {
	const ran = spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", message, ...more], { cwd, encoding: "utf8" });
	return { code: ran.status, said: ran.stderr.trim() };
};

function repository(files: Readonly<Record<string, string>> = {}): string {
	const root = temporaryFolder();
	git(root, "init", "--quiet", "--initial-branch=main");
	for (const [path, text] of Object.entries({ "README.md": "# demo\n", ...files })) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text, { mode: path.includes("hooks/") ? 0o755 : 0o644 });
	}
	git(root, "add", "--all");
	assert.equal(commit(root, "start").code, 0);
	return root;
}

// The plugin set up with project acme at `root`, its project folder `folder`, its piece `rule`, and another project at `other`.
async function load(root: string, rule?: Rule, other?: string, folder = temporaryFolder()): Promise<FakeHost> {
	const fake = fakeHost({ name: "commit-rules", root });
	const project = { name: "acme", prefix: "AC", path: root, folder, pieces: rule === undefined ? {} : commitRules.project(rule) };
	fake.provide("projects", () => (other === undefined ? [project] : [project, { name: "other", prefix: "OT", path: other, folder: temporaryFolder(), pieces: {} }]));
	await fake.setup(commitRules());
	const reviewer = join(temporaryFolder(), "reviewer.md");
	writeFileSync(reviewer, "# Reviewer\n");
	fake.host.jobs.registerRole({ name: "reviewer", file: pathToFileURL(reviewer), criteria: [] });
	fake.host.jobs.registerKind({ name: "review", readOnly: true, role: "reviewer" });
	fake.host.jobs.registerRole({ name: "planner", file: pathToFileURL(reviewer), criteria: [] });
	fake.host.jobs.registerKind({ name: "plan", readOnly: true, role: "planner" });
	return fake;
}

const promptOf = (fake: FakeHost, id: string) => readFileSync(join(dirname(fake.host.folder), "jobs", id, "prompt"), "utf8");
// The main checkout's Git configuration as Git reads it there, every scope with where it comes from, and its hooks folder.
const gitSetup = (root: string) => ({ config: git(root, "config", "--list", "--show-scope", "--show-origin").split("\n"), hooks: readdirSync(join(root, ".git", "hooks")).sort() });

test("a regex is a commit-msg hook in the job's worktree: a subject that does not match is refused and the rule said", async () => {
	const root = repository();
	const before = gitSetup(root);
	const fake = await load(root, { regex: REGEX });
	const job = await fake.host.jobs.spawn({ task: "Build it." });
	assert.deepEqual(commit(job.worktree, "Fixed it"), { code: 1, said: RULE });
	assert.deepEqual(commit(job.worktree, "\n# a comment\nFixed it\n\nWhy."), { code: 1, said: RULE }, "the subject is the first line neither blank nor a comment");
	assert.deepEqual(commit(job.worktree, "fix(AC1): the parser keeps blank lines"), { code: 0, said: "" });
	assert.equal(git(job.worktree, "log", "-1", "--format=%s"), "fix(AC1): the parser keeps blank lines");
	assert.equal(promptOf(fake, job.id).includes("Commit messages"), false, "a regex adds no prompt text");
	// Outside the job's worktree nothing changed but the switch that lets Git read a worktree's own configuration.
	const after = gitSetup(root);
	assert.deepEqual(after.hooks, before.hooks);
	assert.deepEqual(after.config.filter((line) => !before.config.includes(line)), ["local\tfile:.git/config\textensions.worktreeconfig=true"]);
	assert.deepEqual(before.config.filter((line) => !after.config.includes(line)), []);
	assert.deepEqual(commit(root, "Fixed it"), { code: 0, said: "" }, "the main checkout has no hook");
	const other = await fake.host.jobs.spawn({ task: "Read it.", kind: "review" });
	assert.deepEqual(commit(other.worktree, "Fixed it").code, 1, "a read-only kind's checkout gets it too");
});

test("a merge commit's subject is Git's, so it passes, also after a conflict; the next commit is checked again", async () => {
	const root = repository();
	const fake = await load(root, { regex: REGEX });
	const job = await fake.host.jobs.spawn({ task: "Build it." });
	const merge = () => spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", "merge", "--no-ff", "--no-edit", "main"], { cwd: job.worktree, encoding: "utf8" });
	assert.equal(commit(job.worktree, "feat: one").code, 0);
	assert.equal(commit(root, "docs: on main").code, 0);
	const merged = merge();
	assert.equal(merged.status, 0, merged.stderr);
	assert.equal(git(job.worktree, "log", "-1", "--format=%s"), `Merge branch 'main' into arthur/${job.id}`);
	for (const [cwd, text] of [[job.worktree, "# ours\n"], [root, "# theirs\n"]] as const) {
		writeFileSync(join(cwd, "README.md"), text);
		assert.equal(commit(cwd, "docs: the title", "--all").code, 0);
	}
	assert.equal(merge().status, 1, "a conflict");
	writeFileSync(join(job.worktree, "README.md"), "# both\n");
	git(job.worktree, "add", "README.md");
	assert.deepEqual(commit(job.worktree, "Merged by hand"), { code: 0, said: "" });
	assert.deepEqual(commit(job.worktree, "Fixed it"), { code: 1, said: RULE });
});

test("the project's own hooks still run in the job's worktree: its hooks folder, or its relative core.hooksPath", async () => {
	const log = join(temporaryFolder(), "log");
	const hook = (name: string, refuse = "") => `#!/bin/sh\necho "${name} $(basename "$PWD")" >> '${log}'\n${refuse}`;
	const plain = repository();
	writeFileSync(join(plain, ".git", "hooks", "pre-commit"), hook("pre-commit"), { mode: 0o755 });
	writeFileSync(join(plain, ".git", "hooks", "commit-msg"), hook("commit-msg", 'grep -q WIP "$1" && { echo "no WIP" >&2; exit 1; }\nexit 0\n'), { mode: 0o755 });
	const job = await (await load(plain, { regex: REGEX })).host.jobs.spawn({ task: "Build it." });
	assert.deepEqual(commit(job.worktree, "feat: WIP"), { code: 1, said: "no WIP" }, "its commit-msg runs after the rule");
	assert.deepEqual(commit(job.worktree, "Fixed it"), { code: 1, said: RULE });
	assert.deepEqual(commit(job.worktree, "feat: done"), { code: 0, said: "" });
	assert.deepEqual(readFileSync(log, "utf8").trim().split("\n"), [`pre-commit ${job.id}`, `commit-msg ${job.id}`, `pre-commit ${job.id}`, `pre-commit ${job.id}`, `commit-msg ${job.id}`]);
	const husky = repository({ "githooks/pre-commit": hook("own pre-commit") });
	git(husky, "config", "core.hooksPath", "githooks");
	const second = await (await load(husky, { regex: REGEX })).host.jobs.spawn({ task: "Build it." });
	assert.deepEqual(commit(second.worktree, "feat: done"), { code: 0, said: "" });
	assert.equal(readFileSync(log, "utf8").trim().split("\n").at(-1), `own pre-commit ${second.id}`, "the worktree's own githooks folder");
	assert.equal(git(husky, "config", "core.hooksPath"), "githooks");
});

test("a project without commitRules gets no hook and no text; its Git configuration is untouched", async () => {
	const [root, other] = [repository(), repository()];
	const before = [gitSetup(root), gitSetup(other)];
	const fake = await load(root, { regex: REGEX }, other);
	for (const kind of ["worker", "review"]) {
		const job = await fake.host.jobs.spawn({ task: "Build it.", kind, project: "other" });
		assert.equal(spawnSync("git", ["config", "--get", "core.hooksPath"], { cwd: job.worktree }).status, 1);
		assert.deepEqual(commit(job.worktree, "Fixed it").code, 0);
		assert.equal(promptOf(fake, job.id).includes("Commit messages"), false);
	}
	assert.deepEqual([gitSetup(root), gitSetup(other)], before, "no job of acme ran, and other has no rule");
});

test("words go into the worker's and the reviewer's prompt, and no other role's", async () => {
	const fake = await load(repository(), { words: `  ${WORDS}\n` });
	const worker = await fake.host.jobs.spawn({ task: "Build it." });
	assert.ok(promptOf(fake, worker.id).endsWith(`\n\n## Commit messages\n\nThis project's rule for every commit message you write (commitRules.project({ words }) in its project file):\n\n${WORDS}\n`));
	const review = await fake.host.jobs.spawn({ task: "Review it.", kind: "review" });
	const judge = "This project's rule for commit messages; judge each commit of the branch by it, and a message that breaks it is a finding";
	assert.equal(promptOf(fake, review.id), `# Reviewer\n\n## Commit messages\n\n${judge} (commitRules.project({ words }) in its project file):\n\n${WORDS}\n`);
	const plan = await fake.host.jobs.spawn({ task: "Plan it.", kind: "plan" });
	assert.equal(promptOf(fake, plan.id), "# Reviewer\n");
	assert.deepEqual(commit(worker.worktree, "Fixed it").code, 0, "words are no hook");
});

test("a file is read from the project's folder at each spawn, not from its repository", async () => {
	const root = repository({ "docs/commit-rules.md": "Anything goes.\n" });
	const folder = temporaryFolder();
	mkdirSync(join(folder, "docs"));
	writeFileSync(join(folder, "docs/commit-rules.md"), `# Commits\n\n${WORDS}\n`);
	const fake = await load(root, { file: "docs/commit-rules.md" }, undefined, folder);
	const job = await fake.host.jobs.spawn({ task: "Build it." });
	const file = join(folder, "docs/commit-rules.md");
	assert.ok(promptOf(fake, job.id).endsWith(`## Commit messages\n\nThis project's rule for every commit message you write (${file}):\n\n# Commits\n\n${WORDS}\n`));
	assert.deepEqual(job.warnings.filter((warning) => warning.startsWith("commit-rules")), []);
	writeFileSync(file, "# Commits\n\nChanged.\n");
	assert.ok(promptOf(fake, (await fake.host.jobs.spawn({ task: "Build it." })).id).endsWith("(" + file + "):\n\n# Commits\n\nChanged.\n"), "read again at the next spawn");
});

test("a missing, empty, folder or symlinked rule file is a warning of the spawn, not a line on stderr, and the job starts without it", async (t) => {
	const root = repository();
	const folder = temporaryFolder();
	mkdirSync(join(folder, "docs/rules"), { recursive: true });
	writeFileSync(join(folder, "docs/empty.md"), " \n\n");
	writeFileSync(join(folder, "docs/rules/a.md"), "A\n");
	symlinkSync(join(folder, "docs/rules/a.md"), join(folder, "docs/link.md"));
	const printed = t.mock.method(console, "error", () => {});
	for (const [file, problem, kind, role] of [
		["docs/missing.md", "missing or not a file", "worker", "worker"],
		["docs/rules", "missing or not a file", "review", "reviewer"],
		["docs/link.md", "missing or not a file", "worker", "worker"],
		["docs/empty.md", "empty", "worker", "worker"],
	] as const) {
		const fake = await load(root, { file }, undefined, folder);
		const job = await fake.host.jobs.spawn({ task: "Build it.", kind });
		assert.equal(job.failed, undefined);
		assert.equal(promptOf(fake, job.id).includes("Commit messages"), false, file);
		assert.deepEqual(job.warnings.filter((warning) => warning.startsWith("commit-rules")), [`commit-rules: project acme: rule file ${join(folder, file)} is ${problem}; the ${role} goes without it`]);
	}
	assert.equal(printed.mock.callCount(), 0);
});

test("refused at load, before the setup, naming the project and the helper: a regex that does not compile, a piece of another shape, a file outside the folder", async () => {
	for (const [rule, problem] of [
		[{ regex: "^(feat: .+$" }, "regex does not compile: Invalid regular expression: /^(feat: .+$/: Unterminated group"],
		[{ regex: "^a", words: "b" }, "expected exactly one of { regex }, { words }, { file }, a non-empty string"],
		[{ words: "" }, "expected exactly one of { regex }, { words }, { file }, a non-empty string"],
		[{ format: "x" }, "expected exactly one of { regex }, { words }, { file }, a non-empty string"],
		["^a", "expected exactly one of { regex }, { words }, { file }, a non-empty string"],
		[{ file: "../rules.md" }, 'file "../rules.md" is not a path inside the project\'s folder'],
		[{ file: "/etc/rules.md" }, 'file "/etc/rules.md" is not a path inside the project\'s folder'],
	] as const) {
		const fake = fakeHost({ name: "commit-rules" });
		fake.provide("projects", () => [{ name: "acme", prefix: "AC", path: repository(), folder: temporaryFolder(), pieces: { "commit-rules": rule } }]);
		await assert.rejects(fake.setup(commitRules()), { message: `project acme: commit-rules.project(...): ${problem}` }, JSON.stringify(rule));
		assert.deepEqual(fake.provided, [], "no setup ran");
	}
});

test("a hook that cannot be installed refuses the spawn, naming the project; no worktree or branch is left", async () => {
	const root = repository();
	const fake = await load(root, { regex: REGEX });
	writeFileSync(join(root, ".git", "config.lock"), "");
	await assert.rejects(fake.host.jobs.spawn({ task: "Build it." }), (error: Error) => {
		assert.match(error.message, /^plugin commit-rules: prepare failed: project acme: the commit-msg hook was not installed: exit 255: error: could not lock config file .*; the job's worktree and record were removed$/);
		return true;
	});
	assert.equal(git(root, "branch", "--list"), "* main");
	assert.equal(git(root, "worktree", "list").split("\n").length, 1);
});

test("the plugin takes no option: a project's rule is its commitRules.project(...)", () => {
	assert.deepEqual(table, {});
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ installHook: true }), [{ path: "installHook", problem: "unknown option; commit-rules takes none: a project's rule is its commitRules.project(...) in its project file" }]);
});

// The hook as `prepare` installs it in a worktree the test made, as `arthur remote-job add` makes one on another machine;
// `continued` as `arthur continue` runs the prepares again.
const install = (worktree: string, continued = false) => {
	const job = { project: "acme", machine: "local", worktree } as Job;
	return hookStep(fakeHost({ name: "commit-rules" }).host, [{ name: "acme", commitRules: { regex: REGEX } }])(job, {}, continued);
};

test("a continue installs nothing: the worktree keeps what its spawn installed", async () => {
	const root = repository();
	const job = join(temporaryFolder(), "job");
	git(root, "worktree", "add", "--quiet", "-b", "job", job);
	const before = gitSetup(root);
	assert.equal(await install(job, true), undefined);
	assert.deepEqual(gitSetup(root), before);
	assert.deepEqual(commit(job, "Fixed it"), { code: 0, said: "" }, "no hook was installed");
});

test("a bare repository, as on another machine: its worktrees, earlier and later ones, still work, and it stays bare", async () => {
	const folder = temporaryFolder();
	const bare = join(folder, "repos", "acme.git");
	git(folder, "init", "--quiet", "--bare", bare);
	git(repository(), "push", "--quiet", bare, "main");
	const add = (name: string) => {
		git(bare, "worktree", "add", "--quiet", "-b", name, join(folder, name), "main");
		return join(folder, name);
	};
	const [earlier, job] = [add("earlier"), add("job")];
	await install(job);
	assert.deepEqual(commit(job, "Fixed it"), { code: 1, said: RULE });
	assert.deepEqual(commit(job, "feat: done"), { code: 0, said: "" });
	const later = add("later");
	for (const worktree of [earlier, job, later]) assert.equal(git(worktree, "status", "--porcelain"), "", worktree);
	assert.deepEqual(commit(earlier, "Fixed it").code, 0, "no hook in a worktree it did not install");
	assert.equal(git(bare, "rev-parse", "--is-bare-repository"), "true");
	assert.equal(spawnSync("git", ["config", "--file", join(bare, "config"), "--get", "core.bare"]).status, 1, "moved out of the shared config");
});

test("a repository whose shared config sets core.worktree: the main checkout keeps it, the job's worktree is its own", async () => {
	const root = repository();
	git(root, "config", "core.worktree", root);
	const job = join(temporaryFolder(), "job");
	git(root, "worktree", "add", "--quiet", "-b", "job", job);
	await install(job);
	assert.deepEqual([git(job, "rev-parse", "--show-toplevel"), git(root, "rev-parse", "--show-toplevel"), git(root, "config", "core.worktree")], [job, root, root]);
	assert.deepEqual(commit(job, "Fixed it"), { code: 1, said: RULE });
	writeFileSync(join(job, "new.txt"), "x\n");
	git(job, "add", "new.txt");
	assert.deepEqual(commit(job, "feat: a file"), { code: 0, said: "" });
	assert.equal(git(root, "status", "--porcelain"), "", "the commit was the job's, not the main checkout's");
});
