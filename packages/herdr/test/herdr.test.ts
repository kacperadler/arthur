import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { type AgentRun, fakeAgent, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { ATTACH } from "../src/herdr-cli.ts";
import { checkOptions, herdr } from "../src/herdr.ts";
import { fakeHerdr, type Mode, pathWithoutHerdr } from "./fake-herdr.ts";

// The herdr plugin against the fake host and a fake `herdr` on PATH (AR0670): docs/herdr.md.

const PATH = process.env.PATH ?? "";
const [A, B, C, D, E] = ["a", "b", "c", "d", "e"].map((letter) => `2026-11-09-worker-0000000${letter}`) as [string, string, string, string, string];
// A field of an event's data as text, "" when it has none.
const text = (data: unknown, key: string): string => String((typeof data === "object" && data !== null ? Reflect.get(data, key) : undefined) ?? "");

// A Git repository with one commit, holding the planned ticket AC0001 on its board, where the fake host's spawns start.
function repository(): string {
	const root = temporaryFolder();
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { cwd: root });
	git("init", "--quiet", "--initial-branch=main");
	mkdirSync(join(root, "spec", "features", "AC0001-shop-cart"), { recursive: true });
	writeFileSync(join(root, "spec", "features", "AC0001-shop-cart", "ticket.md"), "# AC0001 - Shop cart\n");
	writeFileSync(join(root, "spec", "build.json"), JSON.stringify([{ id: "AC0001", title: "Shop cart", status: "planned", path: "spec/features/AC0001-shop-cart/ticket.md", updated: "2026-11-09T00:00:00Z" }]));
	git("add", "--all");
	git("commit", "--quiet", "-m", "first");
	return root;
}

// The plugin set up on a fake host, the fake herdr in `mode` on PATH (none: no herdr at all), the fake agent playing `run`.
async function load(t: TestContext, mode: Mode | "absent" = "up", run: AgentRun = { steps: [{ message: "Done." }] }) {
	const server = fakeHerdr(mode === "absent" ? "up" : mode);
	process.env.PATH = [dirname(fakeAgent(run)), mode === "absent" ? pathWithoutHerdr() : server.path].join(delimiter);
	t.after(() => void (process.env.PATH = PATH));
	const root = repository();
	const fake = fakeHost({ name: "herdr", root });
	// The project list the board reads tickets from.
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	const plugin = herdr();
	await fake.setup(plugin);
	const home = dirname(fake.host.folder);
	return {
		fake,
		plugin,
		server,
		home,
		// A record as the spawn and the wrapper leave it.
		record(id: string, files: Readonly<Record<string, string>>) {
			mkdirSync(join(home, "jobs", id), { recursive: true });
			for (const [name, text] of Object.entries({ kind: "worker", project: "acme", task: "Go.", since: "2026-11-09T08:00:00.000Z", ...files })) writeFileSync(join(home, "jobs", id, name), text);
		},
		// The tab whose label ends in the job's short id, and its pane.
		tab: (id: string) => server.state().tabs.find((each) => each.label.endsWith(id.slice(-8))),
		pane: (id: string) => {
			const state = server.state();
			return state.panes.find((each) => each.tab_id === state.tabs.find((tab) => tab.label.endsWith(id.slice(-8)))?.tab_id);
		},
		creates: (label: string) => server.calls().filter((args) => args[0] === "tab" && args[1] === "create" && args.includes(label)).length,
	};
}

test("start makes the arthur workspace, its first tab the coordinator running arthur attach again and again; a later start makes no second one", async (t) => {
	const box = await load(t);
	await box.plugin.start?.();
	await until("the attach loop", () => box.server.state().panes[0]?.ran.length === 1);
	const first = box.server.state();
	assert.deepEqual([first.workspaces.map((each) => each.label), first.tabs.map((each) => [each.label, each.cwd]), first.panes[0]?.ran], [["arthur"], [["coordinator", process.cwd()]], [ATTACH]]);
	assert.deepEqual(box.server.calls()[1], ["workspace", "create", "--label", "arthur", "--cwd", process.cwd(), "--no-focus"]);
	await box.plugin.start?.();
	await until("the second pass", () => box.server.calls().filter(([group, verb]) => group === "pane" && verb === "list").length === 2);
	assert.deepEqual([box.server.state().workspaces.length, box.server.state().tabs.length], [1, 1]);
	// The owner closed the coordinator's tab: the next start opens a new one.
	box.server.seed([]);
	execFileSync(join(box.server.folder, "herdr"), ["tab", "close", "t2"]);
	await box.plugin.start?.();
	await until("a new coordinator tab", () => box.server.state().tabs.some((each) => each.label === "coordinator"));
	await until("its attach loop", () => box.server.state().panes[0]?.ran[0] === ATTACH);
	assert.deepEqual(box.server.state().workspaces.length, 1);
});

test("a spawned job gets a tab named by its ticket, kind and short id, running its follow view, its state reported; its end is idle, and its prune closes the tab", async (t) => {
	const gate = join(temporaryFolder(), "go");
	const box = await load(t, "up", { steps: [{ waitFor: gate }, { message: "Done." }] });
	await box.plugin.start?.();
	await until("the coordinator", () => box.server.state().panes[0]?.ran.length === 1);
	const job = await box.fake.host.jobs.spawn({ task: "Ticket: spec/features/AC0001-shop-cart/ticket.md\n" });
	const plain = await box.fake.host.jobs.spawn({ task: "Go." });
	await until("both tabs working", () => box.pane(job.id)?.agent_status === "working" && box.pane(plain.id)?.agent_status === "working");
	assert.deepEqual([box.tab(job.id)?.label, box.tab(plain.id)?.label], [`AC0001 worker ${job.id.slice(-8)}`, `worker ${plain.id.slice(-8)}`]);
	assert.deepEqual([box.tab(job.id)?.cwd, box.pane(job.id)?.ran, box.pane(job.id)?.agent, box.pane(job.id)?.message], [process.cwd(), [`arthur jobs --follow ${job.id}`], "arthur", null]);
	writeFileSync(gate, "");
	// The wrapper's `job-state`, logged by its own process, reaches `arthur run` through the log it follows; the fake host follows none.
	const ended = await until("its job-state ended", () => box.fake.host.events.read(1).find(({ name, data }) => name === "job-state" && text(data, "id") === job.id && text(data, "to") === "ended"));
	box.fake.emit("job-state", ended.data);
	await until("its end in the sidebar", () => box.pane(job.id)?.agent_status === "idle");
	assert.equal(box.pane(job.id)?.message, "ended: finished");
	const reports = box.server.calls().filter((args) => args[1] === "report-agent" && args[2] === box.pane(job.id)?.pane_id);
	assert.deepEqual(reports.at(-1), ["pane", "report-agent", box.pane(job.id)?.pane_id, "--source", "arthur", "--agent", "arthur", "--state", "idle", "--message", "ended: finished"]);
	const [line = ""] = await box.fake.host.jobs.prune([job.id]);
	assert.ok(line.endsWith("record deleted"), line);
	assert.equal(box.tab(job.id), undefined, "closed once the prune is over");
	assert.ok(box.tab(plain.id), "the other job's tab stays");
	assert.deepEqual(box.fake.emitted, [], "the plugin emits nothing");
});

test("each job state as herdr shows it; a second job-started closes the job's old tab first; a state reaches herdr after its tab; a job without a tab gets no report", async (t) => {
	const box = await load(t);
	box.record(A, { state: "working" });
	await box.plugin.start?.();
	await until("A's tab", () => box.pane(A)?.agent_status === "working");
	const state = (to: string, reason: string, message: string | null, shown: string) => async () => {
		box.fake.emit("job-state", { id: A, project: "acme", ticket: null, machine: "local", from: "", to, reason });
		await until(`${to} as ${shown}`, () => box.pane(A)?.agent_status === shown && box.pane(A)?.message === message);
	};
	await state("idle", "", "idle", "working")();
	await state("blocked", "user: may I drop the old table?", "user: may I drop the old table?", "blocked")();
	await state("working", "", null, "working")();
	await state("ended", "limit: time: 120 minutes", "ended: limit: time: 120 minutes", "idle")();
	const [old, oldPane] = [box.tab(A)?.tab_id, box.pane(A)?.pane_id];
	box.record(A, { state: "working", reason: "" });
	// `arthur continue`: its job-started, then at once its first state; the state lands on the new tab.
	box.fake.emit("job-started", { id: A, kind: "worker" });
	box.fake.emit("job-state", { id: A, to: "blocked", reason: "dependency: the deploy" });
	await until("the new tab, blocked", () => box.pane(A)?.agent_status === "blocked");
	assert.notEqual(box.tab(A)?.tab_id, old);
	assert.deepEqual([box.server.state().tabs.length, box.creates(`worker ${A.slice(-8)}`)], [2, 2], "one tab for the job, the old one closed");
	// No tab, no report: B has none; an unknown state is not reported either.
	box.fake.emit("job-state", { id: B, to: "blocked", reason: "user: why?" });
	box.fake.emit("job-state", { id: A, to: "constructor", reason: "" });
	box.fake.emit("job-state", { id: A, to: "working", reason: "" });
	await until("A working again", () => box.pane(A)?.agent_status === "working");
	const reported = box.server.calls().filter((args) => args[1] === "report-agent").map((args) => args[2]);
	assert.deepEqual([reported.length, [...new Set(reported)]], [8, [oldPane, box.pane(A)?.pane_id]], "each state of A once on the tab it had, none for B or an unknown state");
});

test("before start nothing reaches herdr; start opens a tab for each job in a run, reports each ended job that still has a tab, and leaves the rest", async (t) => {
	const box = await load(t);
	box.server.seed([`worker ${C.slice(-8)}`, `worker ${D.slice(-8)}`]);
	box.record(A, { state: "working" });
	box.record(B, { state: "blocked", reason: "dependency: the deploy", hold: "the deploy" });
	box.record(C, { state: "ended", reason: "finished" });
	box.record(D, { state: "blocked", reason: "user: may I?" });
	box.record(E, { state: "ended", reason: "stopped" });
	// Replayed at `arthur run`'s start, before `start`: the start-up pass covers them, once.
	box.fake.emit("job-started", { id: A, kind: "worker" });
	box.fake.emit("job-state", { id: C, to: "working", reason: "" });
	assert.deepEqual(box.server.calls(), []);
	await box.plugin.start?.();
	await until("the start-up pass", () => box.pane(A)?.agent_status === "working" && box.pane(B)?.agent_status === "blocked" && box.pane(C)?.agent_status === "idle" && box.pane(D)?.agent_status === "blocked");
	assert.deepEqual([box.pane(C)?.agent_status, box.pane(C)?.message, box.pane(D)?.message, box.pane(B)?.message], ["idle", "ended: finished", "user: may I?", "dependency: the deploy"]);
	assert.deepEqual([box.creates(`worker ${A.slice(-8)}`), box.creates(`worker ${B.slice(-8)}`), box.tab(E)], [1, 1, undefined], "one tab each; an ended job without a tab gets none");
	// A job-started for a job not in a run opens nothing.
	box.fake.emit("job-started", { id: E, kind: "worker" });
	box.fake.emit("job-state", { id: A, to: "idle", reason: "" });
	await until("A idle", () => box.pane(A)?.message === "idle");
	assert.equal(box.tab(E), undefined);
});

test("a prune in a process that never started closes the job's tab and never makes the workspace or its coordinator tab", async (t) => {
	const box = await load(t);
	const job = await box.fake.host.jobs.spawn({ task: "Go." });
	await until("its end", () => box.fake.host.jobs.list().find((each) => each.id === job.id)?.state === "ended");
	assert.ok((await box.fake.host.jobs.prune([job.id]))[0]?.endsWith("record deleted"));
	assert.deepEqual(box.server.calls(), [["workspace", "list"]], "no workspace, nothing made");
	const other = await box.fake.host.jobs.spawn({ task: "Go." });
	box.server.seed([`worker ${other.id.slice(-8)}`, "notes"]);
	// The owner closed the coordinator's tab: a prune does not open it again.
	execFileSync(join(box.server.folder, "herdr"), ["tab", "close", "t2"]);
	await until("its end", () => box.fake.host.jobs.list().find((each) => each.id === other.id)?.state === "ended");
	await box.fake.host.jobs.prune([other.id]);
	assert.deepEqual(box.server.state().tabs.map((each) => each.label), ["notes"]);
});

for (const mode of ["absent", "down", "hang", "error"] as const) {
	test(`herdr ${mode}: start resolves, a spawn starts and ends as always, nothing is emitted and no handler fails`, async (t) => {
		const box = await load(t, mode);
		const errors: string[] = [];
		t.mock.method(console, "error", (line: string) => void errors.push(line));
		await box.plugin.start?.();
		const job = await box.fake.host.jobs.spawn({ task: "Go." });
		assert.equal(job.failed, undefined);
		await until("its end", () => box.fake.host.jobs.list().find((each) => each.id === job.id)?.state === "ended");
		assert.equal(box.fake.host.jobs.list()[0]?.reason, "finished");
		// Its start's call and the spawn's, each giving up: the test ends with no task left that a later test's PATH would reach.
		if (mode !== "absent") await until("herdr asked twice", () => box.server.calls().length === 2);
		assert.deepEqual([box.fake.emitted, errors], [[], []]);
	});
}

test("arthur doctor: herdr ok, not on PATH, its server down or refusing, or no answer in 5 s; never critical", async (t) => {
	// The requirement's line and whether it is critical, with herdr on PATH in `mode`.
	const line = async (mode: Mode | "absent") => {
		await load(t, mode);
		const [requirement] = (await herdr().doctor?.({}, {} as never)) ?? [];
		return [await requirement?.check(), requirement?.critical];
	};
	assert.deepEqual(await line("up"), ["ok", false]);
	assert.deepEqual(await line("absent"), ["missing: herdr not found on PATH", false]);
	assert.deepEqual(await line("down"), ['missing: herdr workspace list: Error: Os { code: 2, kind: NotFound, message: "No such file or directory" }', false]);
	assert.deepEqual(await line("error"), ['missing: herdr workspace list: {"id":"cli:1","error":{"code":"internal","message":"the server failed"}}', false]);
	const asked = Date.now();
	assert.equal((await line("hang"))[0], "missing: herdr workspace list did not answer in 5 s");
	assert.ok(Date.now() - asked < 9000, `before the doctor's own 10 s: ${Date.now() - asked} ms`);
});

test("herdr has no options but enabled: any key is refused, naming it", () => {
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ workspace: "jobs" }), [{ path: "workspace", problem: "unknown option; herdr has no options but enabled" }]);
});
