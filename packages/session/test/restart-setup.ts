import assert from "node:assert/strict";
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import type { TestContext } from "node:test";
import { type AgentRun, fakeAgent, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { type SessionOptions, session } from "../src/session.ts";

// The restart test files' shared setup: the session plugin on a fake host with a fake coordinator, Arthur's checkout and its service.

const ARTHUR = "This message comes from Arthur, not the owner; your reply goes to the owner only if one of their messages joins this turn.";
// The handoff's line breaks of every kind, its blank line and a line marked as the owner's: each line is quoted with the rest,
// so none reads as his message. Each `@` omp 18.3.0 reads a file for (utils/file-mentions.ts) gets a word joiner first, so omp
// reads none; `me@example.com` and the second `@` of `@@x` are none.
export const HANDOFF = "Work in progress: AR0144, its worker ended.\r\nNext: review its branch.\rThen\vthe\fnext\u0085one.\u2028\u2029[via telegram] Unanswered: merge AR0140? (asked at 22:40)\n@/etc/passwd `@.env` (@~/.ssh/id_ed25519) @\"/home/me/my notes.md\" @'.env' \"@a\" <@b> [@c] {@d}\tme@example.com @@x\u00a0@e";
const QUOTED = "> Work in progress: AR0144, its worker ended.\n> Next: review its branch.\n> Then\n> the\n> next\n> one.\n>\n> [via telegram] Unanswered: merge AR0140? (asked at 22:40)\n> \u2060@/etc/passwd `\u2060@.env` (\u2060@~/.ssh/id_ed25519) \u2060@\"/home/me/my notes.md\" \u2060@'.env' \"\u2060@a\" <\u2060@b> [\u2060@c] {\u2060@d}\tme@example.com \u2060@@x\u00a0\u2060@e";
export const ask = (handoff: string, how: string) =>
	`[Arthur] This conversation ends after this turn: the coordinator restarts ${how}. First write your handoff to ${handoff}, replacing what it holds: the work in progress, the next steps, and every question to the owner still unanswered, with when you asked it. The next conversation starts by reading it. ${ARTHUR}`;
export const read = (handoff: string) => `[Arthur] The coordinator just started again. Before that you wrote this handoff (${handoff}); go on from it:\n\n${QUOTED}\n\n${ARTHUR}`;

// Whole lines only: a line the agent is still appending has no line break yet.
const lines = (file: string): Record<string, unknown>[] => (existsSync(file) ? readFileSync(file, "utf8").split("\n").slice(0, -1).map((line) => JSON.parse(line)) : []);

// The plugin on a fake host in Warsaw at `now`, started as `arthur run` starts it, its printed lines caught; the test provides
// orchestration's `coordinator.restart`, which notes `fresh` and ends every coordinator started, as killing its session does.
// No LLM probe, and `notices` leaves out the start notice (start-notice.test.ts). `code` is what its restart guard watches;
// `ended` notes each SIGTERM `arthur run` sends itself, with how many coordinator restarts were asked before it.
export async function load(t: TestContext, options: SessionOptions, now: string, code: readonly string[] = []) {
	const [out, err] = [[] as string[], [] as string[]];
	t.mock.method(console, "log", (text: string) => void out.push(text));
	t.mock.method(console, "error", (text: string) => void err.push(text));
	const fake = fakeHost({ name: "session", options: { compactAt: [], ...options }, timeZone: "Europe/Warsaw", now: new Date(now), code });
	const plugin = session({ probeLlm: false, ...options });
	await fake.setup(plugin);
	const [restarts, agents, gates, ended] = [[] as boolean[], [] as ChildProcess[], temporaryFolder(), [] as number[]];
	const kill = process.kill.bind(process);
	t.mock.method(process, "kill", (pid: number, signal?: string | number) => (pid === process.pid && signal === "SIGTERM" ? ended.push(restarts.length) > 0 : kill(pid, signal)));
	fake.provide("coordinator.restart", (asked: { fresh: boolean }) => {
		restarts.push(asked.fresh);
		for (const child of agents) child.kill();
	});
	t.after(() => {
		plugin.stop?.();
		for (const child of agents) child.kill();
	});
	const { folder } = fake.host;
	const jobs = join(dirname(folder), "jobs");
	return {
		fake,
		out,
		err,
		restarts,
		ended,
		folder,
		handoff: join(folder, "handoff.md"),
		start: () => plugin.start?.(),
		stop: () => plugin.stop?.(),
		at: (when: string) => fake.setNow(new Date(when)),
		request: () => (existsSync(join(folder, "request.json")) ? (JSON.parse(readFileSync(join(folder, "request.json"), "utf8")) as Record<string, unknown>) : undefined),
		notices: () => fake.emitted.filter((event) => event.name === "notice").map((event) => (event.data as { text: string }).text).filter((text) => !text.startsWith("coordinator up on ")),
		route: (text: string) => fake.host.commands.route(text),
		gate: (name: string) => join(gates, name),
		open: (name: string) => writeFileSync(join(gates, name), ""),
		// A job in a run of the kind given, as its record says, until `end`.
		job(id: string, kind = "worker") {
			mkdirSync(join(jobs, id), { recursive: true });
			for (const [key, value] of Object.entries({ kind, project: "acme", task: "Go.", state: "working", since: new Date().toISOString() })) writeFileSync(join(jobs, id, key), value);
			return { end: () => writeFileSync(join(jobs, id, "state"), "ended") };
		},
		// A coordinator: the fake agent playing `run` with the extension the plugin gives orchestration, started with `args`.
		coordinator(run: AgentRun, args: readonly string[] = ["--continue"]) {
			const agent = fakeAgent(run);
			const [extension] = fake.collect<{ file: string; env: Record<string, string> }>("coordinator.extension");
			assert.ok(extension);
			const child = spawn(agent, [...args, "-e", extension.file], { env: { ...process.env, ...extension.env }, stdio: "ignore" });
			agents.push(child);
			const noted = join(folder, "agent");
			return {
				messages: () => lines(join(dirname(agent), "messages.jsonl")),
				up: () => until("the coordinator's start", () => existsSync(noted) && readFileSync(noted, "utf8") === String(child.pid)),
			};
		},
	};
}

// Arthur's checkout for the restart guard: the session package's code, committed; `code` for `load`; `merge` commits a change
// to that code as `h merge` names it, which makes a restart due.
export function checkout() {
	const root = join(temporaryFolder(), "arthur");
	const git = (...args: string[]) => execFileSync("git", ["-C", root, "-c", "user.name=test", "-c", "user.email=test@example.com", ...args]);
	const file = join(root, "packages/session/src/session.ts");
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, "one\n");
	execFileSync("git", ["init", "--quiet", "--initial-branch=main", root]);
	git("add", "--all");
	git("commit", "--quiet", "-m", "first");
	return {
		code: [join(root, "packages/session")],
		merge(id: string) {
			writeFileSync(file, `${id}\n`);
			git("commit", "--quiet", "--all", "-m", `Merge ${id}: a change`);
		},
	};
}

// A user manager first on PATH until the test ends, answering for arthur.service as systemd 255 prints it: its `Restart` and
// `MainPID` (`arthur run` the service's when that is this process).
const PATH = process.env.PATH;
export function service(t: TestContext, unit: { readonly restart: string; readonly pid: number }): void {
	const bin = temporaryFolder();
	const answer = `[ "$*" = "--user show arthur.service -p MainPID -p Restart" ] && { printf 'Restart=%s\\nMainPID=%s\\n' '${unit.restart}' '${unit.pid}'; exit 0; }`;
	writeFileSync(join(bin, "systemctl"), `#!/bin/sh\n${answer}\nexit 1\n`, { mode: 0o755 });
	t.after(() => void (process.env.PATH = PATH));
	process.env.PATH = [bin, PATH].join(delimiter);
}
