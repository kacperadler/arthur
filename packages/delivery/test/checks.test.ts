import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { temporaryFolder } from "@arthur/core/testing";
import checks from "../src/checks-extension.ts";

const SUMMARY = (passed: number, failed: number) => `✔ a\nℹ tests ${passed + failed}\nℹ suites 0\nℹ pass ${passed}\nℹ fail ${failed}\nℹ duration_ms 5\n`;
const BOTH = JSON.stringify({ scripts: { check: "tsc", test: "node --test" } });

type Call = { readonly toolName: string; readonly input?: object; readonly output?: string; readonly isError?: boolean; readonly details?: object; readonly during?: () => void };

// The extension loaded as omp loads it into job `2026-01-01-worker-00000001` of a home folder, the worktree a Git repository
// whose one commit holds its package.json `packageJson` (none when null); `run(calls)` plays each call as omp hands it over,
// its `tool_call`, what the command does to the tree (`during`), then its `tool_result`, and answers the job's `checks`, the
// worktree's HEAD in it written `<commit>`; `begin(id, call)` and `end(id, call)` play one half of a call.
function load(t: TestContext, packageJson: string | null = BOTH) {
	const [home, worktree] = [temporaryFolder(), temporaryFolder()];
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", worktree, ...args], { encoding: "utf8" }).trim();
	git("init", "--quiet");
	if (packageJson !== null) writeFileSync(join(worktree, "package.json"), packageJson);
	git("add", "--all");
	git("commit", "--quiet", "--allow-empty", "-m", "first");
	const before = process.env.ARTHUR_JOB;
	process.env.ARTHUR_JOB = join(home, "jobs", "2026-01-01-worker-00000001");
	t.after(() => (before === undefined ? delete process.env.ARTHUR_JOB : (process.env.ARTHUR_JOB = before)));
	const handlers: { readonly event: string; readonly handler: (event: object, ctx: { readonly cwd: string }) => unknown }[] = [];
	checks({ on: (event, handler) => void handlers.push({ event, handler: handler as (event: object, ctx: { readonly cwd: string }) => unknown }) });
	const file = join(home, "delivery", "2026-01-01-worker-00000001", "checks");
	const emit = (type: string, event: object) => handlers.filter((each) => each.event === type).map(({ handler }) => handler({ type, ...event }, { cwd: worktree }));
	// What `tool_call` answers: the input the call runs with when it revises it, never a block.
	const begin = (toolCallId: string, { toolName, input = {} }: Call) => emit("tool_call", { toolCallId, toolName, input }).map((answer) => (assert.equal((answer as { block?: unknown } | undefined)?.block, undefined, "the call is not blocked"), answer));
	const end = (toolCallId: string, { toolName, input = {}, output = "", isError = false, details = {} }: Call) => {
		for (const answer of emit("tool_result", { toolCallId, toolName, input, content: [{ type: "text", text: output }], details, isError })) assert.equal(answer, undefined, "the result is left as it is");
	};
	const read = () => (existsSync(file) ? readFileSync(file, "utf8").replaceAll(git("rev-parse", "HEAD"), "<commit>") : "");
	let calls = 0;
	const run = (...each: readonly Call[]) => {
		for (const call of each) {
			const id = `toolu_${++calls}`;
			begin(id, call);
			call.during?.();
			end(id, call);
		}
		return read();
	};
	return { run, begin, end, read, file, worktree, git };
}

const bash = (command: string, output = "", isError = false): Call => ({ toolName: "bash", input: { command }, output, isError });

test("a check passes by its exit status, and fails on it or on a TypeScript error a pipe hides", (t) => {
	assert.equal(load(t).run(bash("npm run check", "> tsc\n")), "check pass <commit> clean\n");
	assert.equal(load(t).run(bash("npm run check", "Command exited with code 2", true)), "check fail <commit> clean\n");
	assert.equal(load(t).run(bash("npm run check | tail -5", "src/a.ts(3,1): error TS2304: Cannot find name 'x'.\n")), "check fail <commit> clean\n");
});

test("a test takes its counts from node --test's last summary, a piped one too, or its exit status without one; npm t and npm run test count", (t) => {
	assert.equal(load(t).run(bash("npm test", SUMMARY(5, 0))), "test pass 5/5 <commit> clean\n");
	assert.equal(load(t).run(bash("npm test 2>&1 | tail -20", SUMMARY(4, 1))), "test fail 4/5 <commit> clean\n", "the pipe's status says 0; the summary says fail");
	assert.equal(load(t).run(bash("npm t", `${SUMMARY(1, 1)}${SUMMARY(2, 0)}`)), "test pass 2/2 <commit> clean\n");
	assert.equal(load(t).run(bash("npm run test", "no summary\n", true)), "test fail <commit> clean\n");
	assert.equal(load(t).run(bash("npm run test", "no summary\n")), "test pass <commit> clean\n");
});

test("commands joined by ;, && or | give one line each, in their order; any other command, or one that only mentions npm test, none", (t) => {
	assert.equal(load(t).run(bash("npm run check && npm test", SUMMARY(3, 0))), "check pass <commit> clean\ntest pass 3/3 <commit> clean\n");
	assert.equal(load(t).run(bash("npm test; npm run check", SUMMARY(3, 0))), "test pass 3/3 <commit> clean\ncheck pass <commit> clean\n");
	assert.equal(load(t).run(bash("npm ci | tail -1 && npm test | tail -3", SUMMARY(3, 0))), "test pass 3/3 <commit> clean\n");
	for (const command of ["npm install", "git commit -m 'npm test'", "echo npm test", "npm run checkout", "npm testing", "grep -rn 'npm test' docs"])
		assert.equal(load(t).run(bash(command, SUMMARY(3, 0))), "", command);
	assert.equal(load(t).run({ toolName: "read", input: { path: "package.json" }, output: "npm test" }), "", "another tool");
});

test("a script the package.json does not declare, or a missing or broken package.json, gives no line", (t) => {
	assert.equal(load(t, JSON.stringify({ scripts: { test: "node --test" } })).run(bash("npm run check && npm test", SUMMARY(3, 0))), "test pass 3/3 <commit> clean\n");
	for (const text of [null, "{ broken", "null", JSON.stringify({ scripts: { check: 1, test: ["x"] } })]) assert.equal(load(t, text).run(bash("npm run check && npm test", SUMMARY(3, 0))), "", String(text));
	const { run, worktree } = load(t);
	assert.equal(run(bash("npm test", SUMMARY(1, 0))), "test pass 1/1 <commit> clean\n");
	rmSync(join(worktree, "package.json"));
	assert.equal(run(bash("npm test", SUMMARY(1, 0))), "test pass 1/1 <commit> clean\n", "read at each call: the worktree's package.json, gone during the job, declares none");
});

test("each line ends with the worktree's HEAD and dirty when a tracked file differs from it, else clean; an edit adds no line; outside Git, none", (t) => {
	const { run, worktree, git } = load(t);
	const first = git("rev-parse", "HEAD");
	writeFileSync(join(worktree, "notes.txt"), "untracked\n");
	assert.equal(run(bash("npm test", SUMMARY(3, 0))), "test pass 3/3 <commit> clean\n", "an untracked file is on no branch");
	writeFileSync(join(worktree, "package.json"), `${BOTH}\n`);
	assert.equal(run({ toolName: "edit", input: { path: "package.json" } }, bash("npm run check")), "test pass 3/3 <commit> clean\ncheck pass <commit> dirty\n");
	git("commit", "--quiet", "--all", "-m", "second");
	assert.equal(run(bash("npm run check")), `test pass 3/3 ${first} clean\ncheck pass ${first} dirty\ncheck pass <commit> clean\n`, "a commit leaves the earlier lines on theirs");
	const outside = load(t);
	rmSync(join(outside.worktree, ".git"), { recursive: true });
	assert.equal(outside.run(bash("npm test", SUMMARY(3, 0))), "", "no commit to name");
});

test("a line is clean only when the call began and ended on the same clean tree, and names the commit it began on", (t) => {
	const { run, worktree, git } = load(t);
	const last = (text: string) => text.trimEnd().split("\n").at(-1);
	const first = git("rev-parse", "HEAD");
	writeFileSync(join(worktree, "package.json"), `${BOTH}\n`);
	assert.equal(last(run({ ...bash("npm test; git stash", SUMMARY(3, 0)), during: () => git("stash", "--quiet") })), "test pass 3/3 <commit> dirty", "tested beside a change, stashed after");
	writeFileSync(join(worktree, "package.json"), `${BOTH}\n`);
	git("commit", "--quiet", "--all", "-m", "second");
	const back = { ...bash(`git checkout ${first} -- . && npm test && git checkout HEAD -- .`, SUMMARY(3, 0)), during: () => void [git("checkout", first, "--", "."), git("checkout", "HEAD", "--", ".")] };
	assert.equal(last(run(back)), "test pass 3/3 <commit> dirty", "an older tree checked out, tested and put back");
	const detached = { ...bash(`git checkout -q ${first} && npm test && git checkout -q -`, SUMMARY(3, 0)), during: () => void [git("checkout", "--quiet", first), git("checkout", "--quiet", "-")] };
	assert.equal(last(run(detached)), "test pass 3/3 <commit> dirty", "an older commit checked out, tested and put back");
	assert.equal(last(run(bash("npm test", SUMMARY(3, 0)))), "test pass 3/3 <commit> clean", "the same clean tree again");
	assert.equal(last(run({ ...bash("npm test && truncate -s -1 package.json", SUMMARY(3, 0)), during: () => writeFileSync(join(worktree, "package.json"), BOTH) })), "test pass 3/3 <commit> dirty", "changed after");
	assert.equal(last(run({ ...bash("npm test; echo >> package.json", SUMMARY(3, 0)), during: () => writeFileSync(join(worktree, "package.json"), `${BOTH}\n`) })), "test pass 3/3 <commit> dirty", "tested beside a change, undone after");
	const rewrite = () => void [writeFileSync(join(worktree, "package.json"), "{}"), writeFileSync(join(worktree, "package.json"), `${BOTH}\n`)];
	assert.equal(last(run({ ...bash("cp old.json package.json && npm test && git show HEAD:package.json > package.json", SUMMARY(3, 0)), during: rewrite })), "test pass 3/3 <commit> dirty", "an older file put in, tested and put back without Git");
	// Another file of the same size tested and put back, its mtime too (`touch -r`): only its ctime tells.
	const reference = join(temporaryFolder(), "reference");
	const restamp = () => {
		execFileSync("touch", ["-r", join(worktree, "package.json"), reference]);
		writeFileSync(join(worktree, "package.json"), `${BOTH}\n`.replace("tsc", "tsx"));
		writeFileSync(join(worktree, "package.json"), `${BOTH}\n`);
		execFileSync("touch", ["-r", reference, join(worktree, "package.json")]);
	};
	assert.equal(last(run({ ...bash("touch -r package.json ref && cp old.json package.json && npm test && git show HEAD:package.json > package.json && touch -r ref package.json", SUMMARY(3, 0)), during: restamp })), "test pass 3/3 <commit> dirty", "put back with its mtime");
	const second = git("rev-parse", "HEAD");
	assert.equal(last(run({ ...bash("npm test; git commit -q --allow-empty -m empty", SUMMARY(3, 0)), during: () => git("commit", "--quiet", "--allow-empty", "-m", "empty") })), `test pass 3/3 ${second} dirty`, "the same tree, another commit");
	const empty = git("rev-parse", "HEAD");
	writeFileSync(join(worktree, "package.json"), BOTH);
	assert.equal(last(run({ ...bash("npm test && git commit -qam third", SUMMARY(3, 0)), during: () => git("commit", "--quiet", "--all", "-m", "third") })), `test pass 3/3 ${empty} dirty`, "tested beside a change, then committed");
});

test("a file Git is told not to look at (assume-unchanged, skip-worktree) is a change", (t) => {
	for (const flag of ["--assume-unchanged", "--skip-worktree"]) {
		const { run, worktree, git } = load(t);
		git("update-index", flag, "package.json");
		writeFileSync(join(worktree, "package.json"), `${BOTH}\n`);
		assert.equal(git("status", "--porcelain", "--untracked-files=no"), "", "hidden from git status");
		assert.equal(run(bash("npm test", SUMMARY(3, 0))), "test pass 3/3 <commit> dirty\n", flag);
	}
});

test("the reads run no fsmonitor the worktree's config names, nor read a replacement (refs/replace)", (t) => {
	const { run, worktree, git } = load(t);
	const [ran, monitor] = [join(temporaryFolder(), "ran"), join(temporaryFolder(), "fsmonitor")];
	writeFileSync(monitor, `#!/bin/sh\necho fsmonitor >> '${ran}'\n`, { mode: 0o755 });
	git("config", "core.fsmonitor", monitor);
	assert.equal(run(bash("npm test", SUMMARY(3, 0))), "test pass 3/3 <commit> clean\n");
	assert.equal(existsSync(ran), false, "the fsmonitor did not run");
	git("config", "--unset", "core.fsmonitor");
	// HEAD replaced by a commit of the staged change: git status, reading the replacement, sees none.
	writeFileSync(join(worktree, "package.json"), `${BOTH}\n`);
	git("add", "package.json");
	git("replace", git("rev-parse", "HEAD"), git("commit-tree", git("write-tree"), "-m", "replacement"));
	assert.equal(git("status", "--porcelain", "--untracked-files=no"), "", "hidden by the replacement");
	assert.equal(run(bash("npm test", SUMMARY(3, 0))), "test pass 3/3 <commit> clean\ntest pass 3/3 <commit> dirty\n");
});

test("calls that overlap are each recorded on the tree they began on, in either order of their ends; a result whose call was not seen is dirty", (t) => {
	const { begin, end, read, worktree, git } = load(t);
	const [tests, check] = [bash("npm test", SUMMARY(3, 0)), bash("npm run check")];
	writeFileSync(join(worktree, "package.json"), `${BOTH}\n`);
	begin("toolu_a", tests);
	git("checkout", "--", "package.json");
	begin("toolu_b", check);
	end("toolu_a", tests);
	end("toolu_b", check);
	assert.equal(read(), "test pass 3/3 <commit> dirty\ncheck pass <commit> clean\n", "ended in the order they began");
	writeFileSync(join(worktree, "package.json"), `${BOTH}\n`);
	begin("toolu_c", tests);
	git("checkout", "--", "package.json");
	begin("toolu_d", check);
	end("toolu_d", check);
	end("toolu_c", tests);
	assert.equal(read(), "test pass 3/3 <commit> dirty\ncheck pass <commit> clean\ncheck pass <commit> clean\ntest pass 3/3 <commit> dirty\n", "the later one ended first");
	end("toolu_e", tests);
	assert.equal(read(), "test pass 3/3 <commit> dirty\ncheck pass <commit> clean\ncheck pass <commit> clean\ntest pass 3/3 <commit> dirty\ntest pass 3/3 <commit> dirty\n");
});

test("a tracked file whose folder is now a file neither blocks the call nor throws at its end", (t) => {
	const { run, worktree, git } = load(t);
	mkdirSync(join(worktree, "src"));
	writeFileSync(join(worktree, "src", "a.ts"), "export {};\n");
	git("add", "--all");
	git("commit", "--quiet", "-m", "second");
	const flatten = () => void [rmSync(join(worktree, "src"), { recursive: true }), writeFileSync(join(worktree, "src"), "")];
	assert.equal(run({ ...bash("rm -r src && touch src && npm test", SUMMARY(3, 0)), during: flatten }), "test pass 3/3 <commit> dirty\n", "ENOTDIR as the call ends");
	assert.equal(run(bash("npm test", SUMMARY(3, 0))), "test pass 3/3 <commit> dirty\ntest pass 3/3 <commit> dirty\n", "ENOTDIR as the call begins");
});

test("a check call runs with a timeout of at least 1800 seconds; any other command, and a script the package.json lacks, run as given", (t) => {
	const { begin } = load(t, JSON.stringify({ scripts: { test: "node --test" } }));
	const call = (input: object, toolName = "bash") => begin("toolu_1", { toolName, input });
	assert.deepEqual(call({ command: "npm test" }), [{ input: { command: "npm test", timeout: 1800 } }], "no timeout: 300 s in omp");
	assert.deepEqual(call({ command: "npm test 2>&1 | tail -5", timeout: 300 }), [{ input: { command: "npm test 2>&1 | tail -5", timeout: 1800 } }]);
	assert.deepEqual(call({ command: "npm ci && npm t", timeout: 1799 }), [{ input: { command: "npm ci && npm t", timeout: 1800 } }]);
	assert.deepEqual(call({ command: "npm test", timeout: 1800 }), [{ input: { command: "npm test", timeout: 1800 } }]);
	assert.deepEqual(call({ command: "npm test", timeout: 2400, cwd: "sub" }), [{ input: { command: "npm test", timeout: 2400, cwd: "sub" } }], "a longer one kept, the rest of the input too");
	assert.deepEqual(call({ command: "npm test", timeout: "2400" }), [{ input: { command: "npm test", timeout: 1800 } }], "a timeout that is no number is none");
	for (const input of [{ command: "ls", timeout: 10 }, { command: "echo npm test" }, { command: "npm run check" }, {}]) assert.deepEqual(call(input), [undefined], JSON.stringify(input));
	assert.deepEqual(call({ command: "npm test" }, "read"), [undefined], "another tool");
});

test("a call the bash tool moved to the background, and a job without a record, give no line", (t) => {
	const { run } = load(t);
	assert.equal(run({ ...bash("npm test", "Backgrounded as job 1; result will be delivered automatically."), details: { async: { state: "running", jobId: "1", type: "bash" } } }), "");
	const before = process.env.ARTHUR_JOB;
	delete process.env.ARTHUR_JOB;
	t.after(() => (process.env.ARTHUR_JOB = before));
	const handlers: unknown[] = [];
	checks({ on: (_event, handler) => void handlers.push(handler) });
	assert.deepEqual(handlers, [], "the coordinator, or omp run by hand, records nothing");
});
