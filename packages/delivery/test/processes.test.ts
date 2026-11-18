import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { JOB_SCOPE } from "@arthur/core/inside-job";
import { fakeAgent, jobSlice, temporaryFolder } from "@arthur/core/testing";
import { leftProcesses } from "../src/processes-extension.ts";

// Delivery's one extension, which answers the run's end (AR0675); the file a record written before it names beside it.
const EXTENSION = join(import.meta.dirname, "..", "src", "checks-extension.ts");
const BEFORE = join(import.meta.dirname, "..", "src", "processes-extension.ts");
const manager = spawnSync("systemctl", ["--user", "show-environment"]).status === 0;
const ASK = "Stop each one you started and no longer need (a dev server, a watcher, a test run in the background) and leave the rest. Then end with your final message again, whole: the job's result is your last message, not the one above.";
// What a leftover runs: it notes its pid in `$PIDFILE` once it runs as itself, then waits; `@left` is a word of its command line.
const LEFT = `require("node:fs").writeFileSync(process.env.PIDFILE, String(process.pid)); setInterval(() => {}, 1000)`;
const NODE = `'${process.execPath}' -e '${LEFT}' @left`;
const SHOWN = `${process.execPath} -e ${LEFT} \u2060@left`;

// The fake agent with the extension (or `extensions`), in `cwd`, its run two ends in a row, an extension loaded before it starting
// `/bin/sh -c <shell>` (none when undefined), which leaves a process that notes its pid in `$PIDFILE`; with `gone`, the shell must
// have exited too before the run starts. With `under`, the agent runs under a shell that stays, as under its wrapper, started by
// that command (a systemd scope's) or by none. Answers the messages the agent got, its ends, the leftover's pid, killed at the
// test's end, the agent's pid and its parent's.
function play(t: TestContext, env: Readonly<Record<string, string | undefined>>, shell?: string, { gone = false, under, cwd, extensions = [EXTENSION] }: { readonly gone?: boolean; readonly under?: readonly string[]; readonly cwd?: string; readonly extensions?: readonly string[] } = {}) {
	const folder = temporaryFolder();
	const [starter, file] = [join(folder, "starter.ts"), join(folder, "pid")];
	const done = gone ? "child.exitCode !== null" : "true";
	writeFileSync(
		starter,
		`import { spawn } from "node:child_process";\nimport { existsSync, readFileSync } from "node:fs";\nimport { setTimeout as pause } from "node:timers/promises";\n` +
			`const child = spawn("/bin/sh", ["-c", ${JSON.stringify(shell)}], { stdio: "ignore", env: { ...process.env, PIDFILE: ${JSON.stringify(file)} } });\nchild.unref();\n` +
			`while (!(existsSync(${JSON.stringify(file)}) && readFileSync(${JSON.stringify(file)}, "utf8") !== "" && ${done})) await pause(10);\nexport default () => {};\n`,
	);
	const pid = () => Number(existsSync(file) ? readFileSync(file, "utf8") : 0);
	t.after(() => void (pid() > 0 && spawnSync("kill", ["-9", String(pid())])));
	const agent = fakeAgent({ steps: [{ message: "Done." }, { end: true }, { message: "Done, again." }, { end: true }] });
	const command = [agent, ...(shell === undefined ? [] : ["-e", starter]), ...extensions.flatMap((extension) => ["-e", extension])];
	const argv = under === undefined ? command : [...under, "/bin/sh", "-c", `${command.map((word) => `'${word}'`).join(" ")}; true`];
	// No ARTHUR_JOB unless `env` gives it: node leaves out a variable whose value is undefined.
	const run = spawnSync(argv[0] ?? "", argv.slice(1), { encoding: "utf8", cwd, env: { ...process.env, ARTHUR_JOB: undefined, ...env } });
	assert.equal(run.status, 0, run.stderr);
	const lines = (name: string) => (existsSync(join(dirname(agent), name)) ? readFileSync(join(dirname(agent), name), "utf8").trimEnd().split("\n").map((line) => JSON.parse(line) as unknown) : []);
	const [started] = lines("starts.jsonl") as { readonly pid: number }[];
	return { messages: lines("messages.jsonl"), ends: lines("ends.jsonl"), pid: pid(), agent: started?.pid, parent: run.pid };
}

const record = () => join(temporaryFolder(), "jobs", `2026-01-01-worker-${randomBytes(4).toString("hex")}`);
const reminded = (named: string) => [{ content: `[Arthur] Before your run ends: these processes of your job are still running.\n\n${named}\n\n${ASK}`, options: { continue: true }, step: 1 }];
const ENDED = [
	{ willContinue: false, step: 1 },
	{ willContinue: false, step: 3 },
];

test("a process the agent left gives one reminder naming its pid and command, @ guarded, and the run goes on; its second end gives none", (t) => {
	const { messages, ends, pid } = play(t, { ARTHUR_JOB: record() }, `exec ${NODE}`);
	assert.deepEqual(messages, reminded(`- pid ${pid}: ${SHOWN}`));
	assert.deepEqual(ends, [
		{ willContinue: true, step: 1 },
		{ willContinue: false, step: 3 },
	]);
});

test("a worker with a process left and no checks passed gets both reminders in one continuation, the checks' first; its second end gives none", (t) => {
	const [job, worktree] = [record(), temporaryFolder()];
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", worktree, ...args], { encoding: "utf8" }).trim();
	writeFileSync(join(worktree, "package.json"), JSON.stringify({ scripts: { check: "tsc", test: "node --test" } }));
	for (const args of [["init", "--quiet"], ["add", "--all"], ["commit", "--quiet", "-m", "first"]]) git(...args);
	mkdirSync(job, { recursive: true });
	for (const [name, value] of [["kind", "worker"], ["branch", `arthur/${basename(job)}`]] as const) writeFileSync(join(job, name), `${value}\n`);
	const { messages, ends, pid } = play(t, { ARTHUR_JOB: job }, `exec ${NODE}`, { cwd: worktree });
	const why = `arthur/${basename(job)} at ${git("rev-parse", "HEAD").slice(0, 7)} is reviewed only once the job's checks passed on its clean tip (check and test pass, mutate ran at least min(100, all) mutants): no check, no test`;
	const checks = `[Arthur] Before your run ends: Arthur starts no review yet: ${why}. Commit your work, then run npm run check && npm test in one bash call and npm run mutate in another, on the committed tip; change nothing after them, name each mutant that survives, and end with your final message again, whole. A run that stopped with a Blocked: line ends again with it.`;
	assert.deepEqual(messages, [{ ...reminded(`- pid ${pid}: ${SHOWN}`)[0], content: `${checks}\n\n${reminded(`- pid ${pid}: ${SHOWN}`)[0]?.content}` }]);
	assert.deepEqual(ends, [
		{ willContinue: true, step: 1 },
		{ willContinue: false, step: 3 },
	]);
});

test("a job whose record, written before AR0675, names processes-extension.ts as an extension of its own too gets the one reminder", (t) => {
	const { messages, ends, pid } = play(t, { ARTHUR_JOB: record() }, `exec ${NODE}`, { extensions: [EXTENSION, BEFORE] });
	assert.deepEqual(messages, reminded(`- pid ${pid}: ${SHOWN}`));
	assert.deepEqual(ends, [
		{ willContinue: true, step: 1 },
		{ willContinue: false, step: 3 },
	]);
});

test("an @ that starts a command line, or a word of it after a space or one of ( [ { < \" ' `, gets a word joiner; one inside a word, none", async (t) => {
	// A child of this process, which `leftProcesses` takes for the agent, its command line `@left -e <script> (@a ... h@i`; gone and reaped at the test's end.
	const left = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "(@a", "[@b", "{@c", "<@d", '"@e', "'@f", "`@g", "h@i"], { argv0: "@left", stdio: "ignore" });
	t.after(() => (left.kill("SIGKILL"), once(left, "exit")));
	const line = `\n- pid ${left.pid}: \u2060@left -e setInterval(() => {}, 1000) (\u2060@a [\u2060@b {\u2060@c <\u2060@d "\u2060@e '\u2060@f \`\u2060@g h@i\n`;
	const reminder = leftProcesses("2026-01-01-worker-00000000");
	assert.ok(reminder?.includes(line), reminder);
});

test("each process below the agent is named, its child's child too", (t) => {
	const { messages, pid } = play(t, { ARTHUR_JOB: record() }, `${NODE} & wait`);
	const content = String((messages as readonly { readonly content?: unknown }[])[0]?.content);
	assert.equal(messages.length, 1);
	assert.match(content, /\n- pid \d+: \/bin\/sh -c /);
	assert.ok(content.includes(`- pid ${pid}: ${SHOWN}\n`), content);
});

test("with no process left, without ps, or outside a job, nothing is said and the run ends at its first end", (t) => {
	const none = play(t, { ARTHUR_JOB: record() });
	assert.deepEqual([none.messages, none.ends], [[], ENDED]);
	const noPs = play(t, { ARTHUR_JOB: record(), PATH: temporaryFolder() }, `exec ${NODE}`);
	assert.deepEqual([noPs.messages, noPs.ends], [[], ENDED]);
	assert.ok(noPs.pid > 0, "a process was left");
	for (const outside of [{}, { ARTHUR_JOB: "" }] satisfies Readonly<Record<string, string>>[]) {
		const run = play(t, outside, `exec ${NODE}`);
		assert.deepEqual([run.messages, run.ends], [[], ENDED]);
	}
});

// The job whose systemd scope runs this test, when one does (a job's own `npm test`): the agent runs in it as that job's.
const own = JOB_SCOPE.exec(existsSync("/proc/self/cgroup") ? readFileSync("/proc/self/cgroup", "utf8").trimEnd() : "")?.[1];

test("in the job's systemd scope a daemon that left the agent's tree is named; the agent and its parent, its wrapper, are not", { skip: own === undefined && !manager && "no systemd user manager, and not run in a job's systemd scope" }, (t) => {
	const job = own === undefined ? record() : join(temporaryFolder(), "jobs", own);
	const unit = `arthur-job-${basename(job)}.scope`;
	if (own === undefined) t.after(() => spawnSync("systemctl", ["--user", "stop", unit]));
	const under = own === undefined ? ["systemd-run", "--user", "--scope", "--quiet", "--collect", `--slice=${jobSlice.slice}.slice`, `--unit=${unit}`] : [];
	const { messages, pid, agent, parent } = play(t, { ARTHUR_JOB: job }, `(setsid ${NODE} </dev/null >/dev/null 2>&1 &)`, { gone: true, under });
	const content = String((messages as readonly { readonly content?: unknown }[])[0]?.content);
	assert.equal(messages.length, 1);
	assert.ok(content.includes(`\n- pid ${pid}: ${SHOWN}\n`), content);
	for (const not of [agent, parent]) assert.ok(not !== undefined && !content.includes(`- pid ${not}: `), `${not} in ${content}`);
	// Only the job's own processes: a scope of its own holds none but the leftover.
	if (own === undefined) assert.deepEqual(messages, reminded(`- pid ${pid}: ${SHOWN}`));
});

test("in a continued run's systemd scope, named by the time it started, a daemon that left the agent's tree is named", { skip: !manager && "no systemd user manager" }, (t) => {
	const job = record();
	const unit = `arthur-job-${basename(job)}.1793433600000.scope`;
	t.after(() => spawnSync("systemctl", ["--user", "stop", unit]));
	const under = ["systemd-run", "--user", "--scope", "--quiet", "--collect", `--slice=${jobSlice.slice}.slice`, `--unit=${unit}`];
	const { messages, pid } = play(t, { ARTHUR_JOB: job }, `(setsid ${NODE} </dev/null >/dev/null 2>&1 &)`, { gone: true, under });
	assert.deepEqual(messages, reminded(`- pid ${pid}: ${SHOWN}`));
});
