import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync, watch, writeFileSync } from "node:fs";
import { delimiter, dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { clock } from "../src/clock.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import { type JobRunner, jobRunner } from "../src/jobs.ts";
import type { Collect } from "../src/roles.ts";
import { type AgentRun, fakeAgent, jobSlice, temporaryFolder } from "../src/testing.ts";

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const commit = (root: string, message: string) => git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", message);
const RECORD = ["state", "reason", "pid", "log", "result", "cost", "tool-calls", "activity", "commits"];
const EXTENSIONS = ["env-guard.ts", "worktree-guard.ts", "steer.ts"].flatMap((file) => ["-e", join(import.meta.dirname, "..", "src", file)]);
const SETTINGS = ["--config", join(import.meta.dirname, "..", "src", "job-omp.yml")];

// A repository `acme`, a home folder beside it, and a runner whose agent is `agent` and whose plugins provide `collect`; the
// plugin `delivery` owns the read-only kind `review`.
function setup(agent: string, collect: Collect = () => []): { readonly root: string; readonly home: string; readonly jobs: JobRunner } {
	const folder = temporaryFolder();
	const root = join(folder, "acme");
	mkdirSync(root);
	git(root, "init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), "acme\n");
	git(root, "add", "--all");
	commit(root, "first");
	const home = join(folder, "home");
	const time = clock("UTC", undefined, () => new Date("2026-10-16T08:00:00Z"));
	const jobs = jobRunner(home, root, join(root, "env"), { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, agent, time, eventBus(home), collect);
	writeFileSync(join(folder, "reviewer.md"), "# Reviewer\n");
	jobs.registerRole("delivery", { name: "reviewer", file: pathToFileURL(join(folder, "reviewer.md")), criteria: [] });
	jobs.registerKind("delivery", { name: "review", readOnly: true, role: "reviewer" });
	return { root, home, jobs };
}

// Waits until `predicate` holds, at most 20 seconds.
async function until<T>(what: string, predicate: () => T | undefined): Promise<T> {
	for (const start = Date.now(); Date.now() - start < 20_000; await sleep(20)) {
		const value = predicate();
		if (value !== undefined && value !== false) return value;
	}
	throw new Error(`timed out waiting for ${what}`);
}

// The job's `job-ended`, once the wrapper emitted it, and the record as it is then.
async function ended(home: string, id: string): Promise<{ readonly data: unknown; readonly record: Readonly<Record<string, string>> }> {
	const event = await until("job-ended", () => readEvents(home, 1).find((event) => event.name === "job-ended"));
	const record = Object.fromEntries(RECORD.map((name) => [name, readFileSync(join(home, "jobs", id, name), "utf8")]));
	return { data: event.data, record };
}

// Whole lines only: a line the agent is still appending has no line break yet.
const starts = (agent: string) =>
	readFileSync(join(dirname(agent), "starts.jsonl"), "utf8")
		.split("\n")
		.slice(0, -1)
		.map((line) => JSON.parse(line) as { readonly pid: number; readonly cwd: string; readonly args: readonly string[] });

const alive = (pid: number) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};

test("a finished worker: the agent gets the worker's tools, model, thinking and prompt; the record holds the run, state last", async (t) => {
	const gate = join(temporaryFolder(), "committed");
	const tests = "✔ one\nℹ tests 3\nℹ suites 0\nℹ pass 3\nℹ fail 0\n";
	const agent = fakeAgent({
		steps: [
			{ message: "Reading first.", stopReason: "toolUse", cost: 0.01 },
			{ tool: "read", args: { path: "README.md" }, output: "acme" },
			{ tool: "bash", args: { command: "npm test" }, output: tests },
			{ tool: "edit", args: { path: "README.md" }, output: "edited" },
			{ tool: "bash", args: { command: "git commit -am 'fix the README'" }, output: "" },
			{ waitFor: gate },
			{ message: "Fixed the README.\nAll tests pass.", cost: 0.02 },
		],
	});
	const { root, home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Fix the README.", model: "anthropic/opus", thinking: "high" });
	const folder = join(home, "jobs", job.id);
	const field = (name: string) => (existsSync(join(folder, name)) ? readFileSync(join(folder, name), "utf8") : undefined);
	// Every file the wrapper writes into the record, in order; a rename shows under the new name. The lock of a state change is no file of the record.
	const changes: string[] = [];
	const watcher = watch(folder, (_, name) => void (name !== null && !name.startsWith(".") && !name.startsWith("state.lock") && changes.push(name)));
	t.after(() => watcher.close());
	const current = ["tool-calls", "state", "cost", "activity"];
	const expected = ["4", "working", "0.0100", "think"];
	await until("the record kept current while it runs", () => JSON.stringify(current.map(field)) === JSON.stringify(expected));
	writeFileSync(join(job.worktree, "README.md"), "acme, fixed\n");
	git(job.worktree, "add", "--all");
	commit(job.worktree, "fix the README");
	writeFileSync(gate, "");
	const { data, record } = await ended(home, job.id);
	// The test's own file, after job-ended: once its change is seen, every change before it was.
	writeFileSync(join(folder, "seen"), "");
	await until("the test's own change", () => changes.includes("seen"));
	assert.equal(changes[changes.indexOf("seen") - 1], "state", `state written last: ${changes.join(", ")}`);
	assert.deepEqual(RECORD.filter((name) => name !== "pid" && !changes.includes(name)), [], "every file written at the end");
	const [start] = starts(agent);
	assert.ok(start);
	assert.deepEqual(start?.args, [
		...["-p", "--mode", "json", "--auto-approve", ...SETTINGS, "--tools", "read,edit,write,bash,grep,glob"],
		...["--session-dir", join(folder, "session"), "--append-system-prompt", join(folder, "prompt"), ...EXTENSIONS, "--model", "anthropic/opus", "--thinking", "high", `@${join(folder, "task")}`],
	]);
	// omp's settings the agent got: no bash call moves to the background, whose result a run that ended never gets (AR0541).
	const settings = readFileSync(start?.args[start.args.indexOf("--config") + 1] ?? "", "utf8");
	assert.match(settings, /^bash:\n  autoBackground:\n    enabled: false\n/m);
	assert.match(settings, /^async:\n  enabled: false\n/m);
	assert.equal(start?.cwd, job.worktree);
	assert.deepEqual(data, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" });
	const { log, pid, ...rest } = record;
	assert.deepEqual(rest, {
		state: "ended",
		reason: "finished",
		result: "Fixed the README.\nAll tests pass.",
		cost: "0.0300",
		"tool-calls": "4",
		activity: "think",
		commits: `${git(root, "log", "--oneline", "-1", `arthur/${job.id}`)}\n`,
	});
	assert.notEqual(Number(pid), start?.pid, "pid is the wrapper's, not the agent's");
	assert.ok(Number(pid) > 0);
	// The agent's command line first, after the one line of a job without a user manager (scope.test.ts).
	assert.match(log ?? "", /^(\[arthur [^\]]+\] no systemd scope: [^\n]+\n)?\[arthur [^\]]+\] agent: \S+ -p --mode json/);
	// The worktree guard's one line, written by the agent's own process, may land anywhere among the tool lines.
	const tools = (log ?? "").replace(/\[arthur [^\]]+\] worktree guard: [^\n]*\n/, "");
	assert.match(tools, /\nread README\.md\nbash npm test\nedit README\.md\nbash git commit -am 'fix the README'\n\[arthur [^\]]+\] ended: finished\n$/);
	assert.deepEqual(readdirSync(folder).filter((name) => name.startsWith(".") || name.startsWith("state.lock")), [], "no temporary file or lock left");
});

test("a read-only kind gets no edit or write, no model flag, and no commits", async () => {
	const agent = fakeAgent({ steps: [{ message: "PASS" }] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Review it.", kind: "review" });
	const { data, record } = await ended(home, job.id);
	const folder = join(home, "jobs", job.id);
	assert.deepEqual(starts(agent)[0]?.args, [
		...["-p", "--mode", "json", "--auto-approve", ...SETTINGS, "--tools", "read,bash,grep,glob"],
		...["--session-dir", join(folder, "session"), "--append-system-prompt", join(folder, "prompt"), ...EXTENSIONS, `@${join(folder, "task")}`],
	]);
	assert.deepEqual(data, { id: job.id, kind: "review", project: "acme", state: "ended", reason: "finished" });
	assert.deepEqual([record.result, record.commits, record["tool-calls"], record.cost], ["PASS", "", "0", "0.0000"]);
});

test("the extensions plugins register load after the core's own, in their order, kept in the record; a URL of no file is refused", async () => {
	const agent = fakeAgent({ steps: [{ message: "PASS" }] });
	const { home, jobs } = setup(agent);
	const folder = temporaryFolder();
	const paths = ["first.ts", "second.ts"].map((name) => {
		writeFileSync(join(folder, name), `import { appendFileSync } from "node:fs";\nexport default () => appendFileSync(${JSON.stringify(join(folder, "loaded"))}, "${name}\\n");\n`);
		return join(folder, name);
	});
	for (const url of [new URL("https://example.com/x.ts"), pathToFileURL(join(folder, "missing.ts")), "first.ts" as unknown as URL])
		assert.throws(() => jobs.registerExtension(url), { message: `extension ${String(url)}: expected the file: URL of a module that exists, as new URL("./<file>.ts", import.meta.url) gives` });
	for (const path of paths) jobs.registerExtension(pathToFileURL(path));
	const job = await jobs.spawn({ task: "Review it.", kind: "review" });
	await ended(home, job.id);
	const record = join(home, "jobs", job.id);
	assert.deepEqual(starts(agent)[0]?.args, [
		...["-p", "--mode", "json", "--auto-approve", ...SETTINGS, "--tools", "read,bash,grep,glob"],
		...["--session-dir", join(record, "session"), "--append-system-prompt", join(record, "prompt"), ...EXTENSIONS, ...paths.flatMap((path) => ["-e", path]), `@${join(record, "task")}`],
	]);
	assert.equal(readFileSync(join(folder, "loaded"), "utf8"), "first.ts\nsecond.ts\n", "the agent loaded each");
	assert.equal(readFileSync(join(record, "extensions"), "utf8"), paths.map((path) => relative(join(import.meta.dirname, "..", "src"), path)).join("\n"));
});

// Each run, and the reason it ends `ended` with; every file of the record is there once the state is final.
const ENDINGS: readonly (readonly [string, AgentRun, string])[] = [
	["exit code", { steps: [{ message: "Done." }], exitCode: 3 }, "failed: the agent exited 3"],
	["error", { steps: [{ message: "", stopReason: "error", error: "401 authentication_error" }], exitCode: 1 }, "failed: the agent stopped on error: 401 authentication_error"],
	["aborted", { steps: [{ message: "Half.", stopReason: "aborted" }] }, "failed: the agent stopped on aborted"],
	["no final message", { steps: [{ tool: "read", args: { path: "README.md" } }] }, "failed: the agent ended without a final message"],
	["signal", { steps: [{ tool: "read", args: { path: "README.md" } }, { signal: "SIGKILL" }, { message: "never" }] }, "failed: the agent was killed by SIGKILL"],
	["crash mid-line", { steps: [{ stdout: '{"type":"message_end","message":{"role":"assist' }], exitCode: 134 }, "failed: the agent exited 134"],
	["a Blocked: line after a failure", { steps: [{ message: "Blocked: user may I?" }], exitCode: 1 }, "failed: the agent exited 1"],
];

for (const [name, run, reason] of ENDINGS)
	test(`an agent that ends on ${name}: ended, ${reason}`, async () => {
		const { home, jobs } = setup(fakeAgent(run));
		const job = await jobs.spawn({ task: "Go." });
		const { data, record } = await ended(home, job.id);
		assert.deepEqual(data, { id: job.id, kind: "worker", project: "acme", state: "ended", reason });
		assert.deepEqual([record.state, record.reason], ["ended", reason]);
		assert.ok(record.log?.endsWith(`] ended: ${reason}\n`), record.log);
		const tools = run.steps.filter((step) => "tool" in step).length;
		assert.deepEqual([record["tool-calls"], record.commits], [String(tools), ""]);
		if (name === "crash mid-line") assert.match(record.log ?? "", /\n\{"type":"message_end","message":\{"role":"assist\n/);
		if (name === "aborted") assert.equal(record.result, "Half.");
	});

test("an agent that cannot start: failed, naming why", async () => {
	const missing = join(temporaryFolder(), "omp");
	const { home, jobs } = setup(missing);
	const job = await jobs.spawn({ task: "Go." });
	const { data, record } = await ended(home, job.id);
	const reason = `the agent did not start: spawn ${missing} ENOENT`;
	assert.deepEqual(data, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: `failed: ${reason}` });
	assert.deepEqual([record.result, record.cost, record["tool-calls"]], ["", "0.0000", "0"]);
});

// Every role's MCP servers as orchestration answers them in `roles.model`, a secret filled in from `token()` at each answer.
const withMcp = (token: () => string): Collect => (name) => (name === "roles.model" ? [{ mcp: { docs: { command: "docs-mcp", env: { TOKEN: token() } } } }] : []);

test("a job's MCP secrets lie in its record only during a run: gone once it is ended, written again from the role's answer by a continue", async (t) => {
	// The usual umask, so a `.mcp.json` written without its own mode 600 shows as 644 on any machine.
	const umask = process.umask(0o022);
	t.after(() => void process.umask(umask));
	const gate = join(temporaryFolder(), "go");
	const agent = fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] });
	let token = "first-s3cret";
	const { home, jobs } = setup(agent, withMcp(() => token));
	const job = await jobs.spawn({ task: "Go." });
	const [folder, secrets] = [join(home, "jobs", job.id), join(home, "jobs", job.id, "mcp", ".mcp.json")];
	await until("the agent started", () => existsSync(join(dirname(agent), "starts.jsonl")) && starts(agent).length === 1);
	assert.match(readFileSync(secrets, "utf8"), /"TOKEN": "first-s3cret"/);
	writeFileSync(gate, "");
	await ended(home, job.id);
	assert.deepEqual([readFileSync(join(folder, "state"), "utf8"), existsSync(join(folder, "mcp"))], ["ended", false]);
	token = "second-s3cret";
	rmSync(gate);
	assert.equal(await jobs.continue(job.id, "Go on."), undefined);
	await until("the agent resumed", () => starts(agent).length === 2);
	assert.match(readFileSync(secrets, "utf8"), /"TOKEN": "second-s3cret"/, "the role's answer at the continue, not the spawn's");
	assert.equal(statSync(secrets).mode & 0o777, 0o600);
	assert.deepEqual(starts(agent)[1]?.args.slice(9, 13), ["--plugin-dir", join(folder, "mcp"), "--config", join(folder, "mcp.yml")]);
	writeFileSync(gate, "");
	await until("the second job-ended", () => readEvents(home, 1).filter((event) => event.name === "job-ended").length === 2);
	assert.equal(existsSync(join(folder, "mcp")), false);
});

test("a continue of a job whose kind no plugin registers now starts without MCP servers", async () => {
	const agent = fakeAgent({ steps: [{ message: "Done." }] });
	const { root, home, jobs } = setup(agent, withMcp(() => "s3cret"));
	jobs.registerKind("delivery", { name: "fixer", readOnly: false, role: "reviewer" });
	const job = await jobs.spawn({ task: "Go.", kind: "fixer" });
	await ended(home, job.id);
	// The next load, without the plugin that registered the kind.
	const time = clock("UTC", undefined, () => new Date("2026-10-16T08:00:00Z"));
	const next = jobRunner(home, root, join(root, "env"), { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, agent, time, eventBus(home), withMcp(() => "s3cret"));
	assert.equal(await next.continue(job.id, "Go on."), undefined);
	await until("the second job-ended", () => readEvents(home, 1).filter((event) => event.name === "job-ended").length === 2);
	assert.deepEqual(starts(agent).map((start) => start.args.includes("--plugin-dir")), [true, false]);
});

test("a spawn whose wrapper does not start leaves no MCP secrets in the ended record", async (t) => {
	const { home, jobs } = setup(fakeAgent({ steps: [{ message: "Done." }] }), withMcp(() => "s3cret"));
	// A `systemctl` that sets any slice and a `systemd-run` that refuses the scope, first on PATH.
	const bin = temporaryFolder();
	writeFileSync(join(bin, "systemctl"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
	writeFileSync(join(bin, "systemd-run"), "#!/bin/sh\necho 'Failed to start transient scope unit: Access denied' >&2\nexit 1\n", { mode: 0o755 });
	const saved = process.env.PATH;
	t.after(() => void (process.env.PATH = saved));
	process.env.PATH = [bin, saved].join(delimiter);
	const job = await jobs.spawn({ task: "Go." });
	assert.equal(job.failed, "systemd-run: Failed to start transient scope unit: Access denied");
	assert.deepEqual([readFileSync(join(home, "jobs", job.id, "state"), "utf8"), existsSync(join(home, "jobs", job.id, "mcp"))], ["ended", false]);
});

test("lines longer than a pipe buffer reach the log and the result whole", async () => {
	// `€` is three bytes, so a chunk of 64 KiB ends inside a character.
	const long = (letter: string) => `${letter}${"€".repeat(100_000)}`;
	const agent = fakeAgent({ steps: [{ stderr: long("e") }, { stdout: long("o") }, { message: long("m") }] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	const { data, record } = await ended(home, job.id);
	assert.deepEqual(data, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" });
	assert.equal(record.result, long("m"));
	const lines = (record.log ?? "").split("\n");
	assert.ok(lines.includes(long("e")), "the stderr line whole");
	assert.ok(lines.includes(long("o")), "the stdout line that is not JSON whole");
});

test("a record deleted while the job runs: the agent is stopped, the wrapper ends with one line and writes nothing else", async () => {
	const gates = temporaryFolder();
	const agent = fakeAgent({
		steps: [{ waitFor: join(gates, "deleted") }, { message: "Still here.", stopReason: "toolUse" }, { waitFor: join(gates, "never") }],
	});
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	const folder = join(home, "jobs", job.id);
	const wrapper = Number(await until("the wrapper's pid", () => (existsSync(join(folder, "pid")) ? readFileSync(join(folder, "pid"), "utf8") : undefined)));
	// Past its start the agent has loaded its extensions, which read the record: deleted earlier, the agent fails on it, and the
	// wrapper appends that error to the record's `log`, which may land while `rmSync` empties the folder (ENOTEMPTY).
	const [start] = await until("the agent's start", () => (existsSync(join(dirname(agent), "starts.jsonl")) ? starts(agent) : undefined));
	rmSync(folder, { recursive: true });
	writeFileSync(join(gates, "deleted"), "");
	await until("the wrapper's end", () => !alive(wrapper));
	await until("the agent's end", () => !alive(start?.pid ?? 0));
	assert.equal(existsSync(folder), false, "nothing written into the record");
	assert.deepEqual(readdirSync(join(home, "jobs")), []);
	const line = `job ${job.id}: its record ${folder} was deleted while it ran; the agent was stopped and nothing more is written`;
	assert.match(readFileSync(join(home, "wrapper.log"), "utf8"), new RegExp(`^\\[arthur [^\\]]+\\] ${line.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\n$`));
	assert.deepEqual(readEvents(home, 1).map((event) => event.name), ["job-started"]);
});

test("a record removed file by file, its folder kept a while as `rm -r` does: the wrapper ends with its one line, never a crash", async () => {
	const gates = temporaryFolder();
	const agent = fakeAgent({ steps: [{ waitFor: join(gates, "emptied") }, { stderr: "still here" }, { waitFor: join(gates, "never") }] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	const folder = join(home, "jobs", job.id);
	const wrapper = Number(await until("the wrapper's pid", () => (existsSync(join(folder, "pid")) ? readFileSync(join(folder, "pid"), "utf8") : undefined)));
	const [start] = await until("the agent's start", () => (existsSync(join(dirname(agent), "starts.jsonl")) ? starts(agent) : undefined));
	for (const name of readdirSync(folder)) rmSync(join(folder, name), { recursive: true });
	writeFileSync(join(gates, "emptied"), "");
	await until("the wrapper's end", () => !alive(wrapper));
	await until("the agent's end", () => !alive(start?.pid ?? 0));
	const line = `job ${job.id}: its record ${folder} was deleted while it ran; the agent was stopped and nothing more is written`;
	assert.match(readFileSync(join(home, "wrapper.log"), "utf8"), new RegExp(`^\\[arthur [^\\]]+\\] ${line.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\n$`));
	assert.equal(existsSync(join(folder, "state")), false, "no state written into the record");
});

test("a record `rm -r` empties, its `log` unlinked first, while the agent writes to stderr: the wrapper ends with its one line and never recreates `log`", async () => {
	const gates = temporaryFolder();
	const agent = fakeAgent({ steps: [{ waitFor: join(gates, "log gone") }, { stderr: "still here" }, { waitFor: join(gates, "never") }] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	const folder = join(home, "jobs", job.id);
	const wrapper = Number(await until("the wrapper's pid", () => (existsSync(join(folder, "pid")) ? readFileSync(join(folder, "pid"), "utf8") : undefined)));
	const [start] = await until("the agent's start", () => (existsSync(join(dirname(agent), "starts.jsonl")) ? starts(agent) : undefined));
	// `rm -r` as it goes: the folder listed once, its entries unlinked in that order (here `log` first, `pid` last), the folder then.
	const listed = readdirSync(folder).sort((a, b) => Number(b === "log") - Number(a === "log") || Number(a === "pid") - Number(b === "pid"));
	rmSync(join(folder, "log"));
	writeFileSync(join(gates, "log gone"), "");
	await until("the wrapper's end or a new `log`", () => !alive(wrapper) || existsSync(join(folder, "log")));
	for (const name of listed.slice(1)) rmSync(join(folder, name), { recursive: true });
	rmdirSync(folder);
	await until("the wrapper's end", () => !alive(wrapper));
	await until("the agent's end", () => !alive(start?.pid ?? 0));
	assert.deepEqual(readdirSync(join(home, "jobs")), []);
	const line = `job ${job.id}: its record ${folder} was deleted while it ran; the agent was stopped and nothing more is written`;
	assert.match(readFileSync(join(home, "wrapper.log"), "utf8"), new RegExp(`^\\[arthur [^\\]]+\\] ${line.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\n$`));
});

test("a record deleted while the job runs stops every process the agent started, not only the agent", async () => {
	// An agent whose bash call left a process running, as `npm test` or a server does: a child of its own.
	const dir = temporaryFolder();
	const agent = join(dir, "omp");
	const script = [
		"#!/bin/sh",
		`sleep 100 & echo $! > '${dir}/child'`,
		`while [ ! -e '${dir}/deleted' ] && [ -d '${dir}' ]; do sleep 0.02; done`,
		`echo '{"type":"turn_start"}'`,
		`while [ -d '${dir}' ]; do sleep 0.02; done`,
	];
	writeFileSync(agent, `${script.join("\n")}\n`, { mode: 0o755 });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	const folder = join(home, "jobs", job.id);
	const wrapper = Number(await until("the wrapper's pid", () => (existsSync(join(folder, "pid")) ? readFileSync(join(folder, "pid"), "utf8") : undefined)));
	const child = Number(await until("the agent's child", () => (existsSync(join(dir, "child")) ? readFileSync(join(dir, "child"), "utf8").trim() || undefined : undefined)));
	assert.ok(alive(child));
	rmSync(folder, { recursive: true });
	writeFileSync(join(dir, "deleted"), "");
	await until("the wrapper's end", () => !alive(wrapper));
	await until("the end of the agent's child", () => !alive(child));
	assert.equal(existsSync(folder), false, "nothing written into the record");
});
