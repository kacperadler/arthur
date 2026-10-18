import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { loadConfig } from "@arthur/core";
import { fakeAgent, fakeHost, jobSlice, temporaryFolder } from "@arthur/core/testing";
import { type ResourcesOptions, resources } from "../src/resources.ts";

const manager = spawnSync("systemctl", ["--user", "show-environment"]).status === 0;
const TICKET = "spec/features/AC0001-one/ticket.md";
const TASK = `Ticket: ${TICKET}. Go.`;

// The project `acme` as the projects plugin serves it: one commit holding ticket AC0001 on its board, in progress, whose
// `ticket.md` has `json` as its JSON block.
function acme(json = '{ "id": "AC0001" }'): string {
	const folder = join(temporaryFolder(), "acme");
	mkdirSync(join(folder, "spec/features/AC0001-one"), { recursive: true });
	writeFileSync(join(folder, TICKET), ticketText(json));
	writeFileSync(join(folder, "spec/build.json"), JSON.stringify([{ id: "AC0001", title: "One", status: "in-progress", path: TICKET, updated: "2026-10-18T00:00:00Z" }]));
	execFileSync("git", ["init", "--quiet", "--initial-branch=main", folder]);
	execFileSync("git", ["-C", folder, "add", "--all"]);
	execFileSync("git", ["-C", folder, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first"]);
	return folder;
}
const ticketText = (json: string) => `# AC0001 - One\n\n\`\`\`json\n${json}\n\`\`\`\n\n## Goal\n`;

// The plugin on the fake host with `acme` as its project list, its clock at `now`.
async function load(options: ResourcesOptions, json?: string, now = new Date()) {
	const root = acme(json);
	const plugin = resources(options);
	const fake = fakeHost({ name: "resources", options, root, now });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	await fake.setup(plugin);
	return { fake, plugin, root, home: dirname(fake.host.folder), now };
}

// A job's record as the core's runner leaves it; a key set to undefined leaves its file out.
function record(home: string, id: string, files: Readonly<Record<string, string | undefined>>): void {
	const folder = join(home, "jobs", `2026-10-18-worker-${id}`);
	mkdirSync(folder, { recursive: true });
	const all = { kind: "worker", project: "acme", task: TASK, budget: "2", cost: "0.0000", state: "ended", reason: "finished", since: "2026-10-18T00:00:00.000Z", ...files };
	for (const [name, text] of Object.entries(all)) if (text !== undefined) writeFileSync(join(folder, name), text);
}

async function until<T>(what: string, predicate: () => T | undefined | false, ms = 20_000): Promise<T> {
	for (const start = Date.now(); Date.now() - start < ms; await sleep(20)) {
		const value = predicate();
		if (value !== undefined && value !== false) return value;
	}
	throw new Error(`timed out waiting for ${what}`);
}

const refused = (text: string) => ({ message: `refused by resources: AC0001: ${text}; raise "caps" in its ticket's JSON block, or perFeature.${text.split(" ")[2]}` });

test("perFeature takes budgetUsd, hours and cpu of 0 or more and memory in MemoryMax syntax or 0; anything else is refused at load", async () => {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "arthur.config.ts"), "export default { core: {} };\n");
	const core = (await loadConfig(join(folder, "arthur.config.ts"))).core;
	const check = (options: unknown) => resources(options as ResourcesOptions).check?.(options as ResourcesOptions, core);
	assert.deepEqual(check({ perFeature: { budgetUsd: 15, hours: 8, cpu: 4, memory: "8G" } }), []);
	assert.deepEqual(check({ perFeature: { budgetUsd: 0, hours: 0, cpu: 0, memory: 0 } }), []);
	assert.deepEqual(check({ perFeature: { budgetUsd: -1, hours: "8", cpu: Number.NaN, memory: "0", disk: 1 } }), [
		{ path: "perFeature.budgetUsd", problem: "expected a number of 0 or more, 0 for no cap, got -1" },
		{ path: "perFeature.hours", problem: 'expected a number of 0 or more, 0 for no cap, got "8"' },
		{ path: "perFeature.cpu", problem: "expected a number of 0 or more, 0 for no cap, got NaN" },
		{ path: "perFeature.memory", problem: 'expected systemd MemoryMax syntax such as "8G", "25%" or "infinity", or 0 for no cap, got "0"' },
		{ path: "perFeature.disk", problem: "unknown key; keys: budgetUsd, hours, cpu, memory" },
	]);
	assert.deepEqual(check({ perFeature: [] }), [{ path: "perFeature", problem: "expected an object with budgetUsd, hours, cpu, memory, got a list" }]);
});

test("a spawn for a ticket at its money cap is refused naming the spend and the cap, one cent below it starts; other tickets' and ticketless jobs do not count", async () => {
	const { fake, home } = await load({ perFeature: { budgetUsd: 2 } });
	record(home, "00000001", { cost: "1.5000" });
	record(home, "00000002", { cost: "0.4900", kind: "review" });
	record(home, "00000003", { cost: "9.0000", task: "Go." });
	record(home, "00000004", { cost: "9.0000", task: "Ticket: spec/features/AC0002-two/ticket.md" });
	const started = await fake.host.jobs.spawn({ task: TASK, kind: "worker" });
	await until("its end", () => fake.host.jobs.list().find((job) => job.id === started.id)?.state === "ended");
	record(home, "00000005", { cost: "0.0100" });
	await assert.rejects(fake.host.jobs.spawn({ task: TASK }), refused("feature cap budgetUsd reached: $2.0000 of $2"));
	await assert.rejects(fake.host.jobs.spawn({ task: TASK, kind: "worker", budgetUsd: 50 }), refused("feature cap budgetUsd reached: $2.0000 of $2"), "every kind, whatever its own budget");
	assert.ok((await fake.host.jobs.spawn({ task: "Go." })).id, "a job without a ticket is held by the per-job caps only");
});

test("a job whose cost file is missing counts as its whole budget, never as zero; without a budget its spend is unknown and reaches the cap", async () => {
	const { fake, home } = await load({ perFeature: { budgetUsd: 2.5 } });
	record(home, "00000001", { cost: undefined, budget: "2" });
	record(home, "00000002", { cost: "0.5000" });
	await assert.rejects(fake.host.jobs.spawn({ task: TASK }), refused("feature cap budgetUsd reached: $2.5000 of $2.5"));
	const other = await load({ perFeature: { budgetUsd: 100 } });
	record(other.home, "00000001", { cost: "broken", budget: "0" });
	await assert.rejects(other.fake.host.jobs.spawn({ task: TASK }), refused("feature cap budgetUsd reached: unknown (a job with neither its cost nor a budget) of $100"));
});

test("a ticket's own caps replace perFeature's, 0 being no cap; caps below what it spent refuse the next spawn; caps of the wrong shape are refused naming the file", async () => {
	const { fake, home, root } = await load({ perFeature: { budgetUsd: 10, hours: 1 } }, '{ "id": "AC0001", "caps": { "budgetUsd": 1 } }');
	record(home, "00000001", { cost: "1.5000", ran: "7200" });
	await assert.rejects(fake.host.jobs.spawn({ task: TASK }), refused("feature cap budgetUsd reached: $1.5000 of $1"));
	writeFileSync(join(root, TICKET), ticketText('{ "caps": { "budgetUsd": 0, "hours": 3 } }'));
	assert.ok((await fake.host.jobs.spawn({ task: TASK })).id, "budgetUsd 0: no money cap, though perFeature has one; 2 h of 3");
	writeFileSync(join(root, TICKET), ticketText('{ "caps": { "hours": "3" } }'));
	await assert.rejects(fake.host.jobs.spawn({ task: TASK }), { message: `${join(root, TICKET)}: caps.hours: expected a number of 0 or more, 0 for no cap, got "3"` });
	writeFileSync(join(root, TICKET), ticketText("{ caps"));
	await assert.rejects(fake.host.jobs.spawn({ task: TASK }), { message: new RegExp(`^${join(root, TICKET)}: its JSON block is not JSON \\(.+\\); fix it by hand$`) });
});

test("time is the sum of the jobs' runs, one in a run counted up to now: one second below the cap starts, at it the spawn is refused", async () => {
	const now = new Date();
	const { fake, home } = await load({ perFeature: { hours: 1 } }, undefined, now);
	record(home, "00000001", { ran: "3000" });
	record(home, "00000002", { state: "working", reason: "", since: now.toISOString(), ran: "599" });
	assert.ok((await fake.host.jobs.spawn({ task: TASK })).id);
	fake.setNow(new Date(now.getTime() + 1000));
	await assert.rejects(fake.host.jobs.spawn({ task: TASK }), { message: /^refused by resources: AC0001: feature cap hours reached: 1\.00 h of 1 h; / });
});

test("jobs.limits puts a job in its ticket's slice with the ticket's CPU and memory caps; none for a ticket without them or a job without a ticket", async () => {
	const { fake, root } = await load({ perJob: { cpu: 1 }, perFeature: { cpu: 2, memory: "2G", budgetUsd: 5 } }, '{ "caps": { "cpu": 0 } }');
	assert.deepEqual(fake.call("jobs.limits", { tickets: [TICKET] }), { cpu: 1, feature: { name: "AC0001", memory: "2G" } });
	assert.deepEqual(fake.call("jobs.limits", { tickets: [] }), { cpu: 1 });
	writeFileSync(join(root, TICKET), ticketText('{ "caps": { "cpu": 0, "memory": 0 } }'));
	assert.deepEqual(fake.call("jobs.limits", { tickets: [TICKET] }), { cpu: 1 });
});

test("jobs of one ticket crossing its money cap together are both stopped and held blocked on the user, cap-reached once; one cent below runs on", async (t) => {
	const gate = join(temporaryFolder(), "gate");
	const saved = process.env.PATH;
	t.after(() => void (process.env.PATH = saved));
	const never = join(temporaryFolder(), "never");
	const steps = [{ message: "half", cost: 0.995, stopReason: "toolUse" as const }, { waitFor: gate }, { message: "more", cost: 0.005, stopReason: "toolUse" as const }, { waitFor: never }, { message: "Done." }];
	process.env.PATH = [dirname(fakeAgent({ steps })), saved].join(delimiter);
	const { fake, plugin } = await load({ perFeature: { budgetUsd: 2 } });
	t.after(() => plugin.stop?.());
	const jobs = [await fake.host.jobs.spawn({ task: TASK }), await fake.host.jobs.spawn({ task: TASK, kind: "worker" })];
	const of = (id: string) => fake.host.jobs.list().find((job) => job.id === id);
	await until("both at $0.995", () => jobs.every((job) => of(job.id)?.cost === "0.9950"));
	await plugin.start?.();
	await sleep(200);
	assert.deepEqual(jobs.map((job) => of(job.id)?.state), ["working", "working"], "$1.99 of $2: both run on");
	writeFileSync(gate, "");
	const reason = "user: feature cap budgetUsd reached: $2.0000 of $2";
	await until("both stopped by the next sweep", () => jobs.every((job) => of(job.id)?.state === "blocked" && of(job.id)?.hold === ""), 15_000);
	assert.deepEqual(jobs.map((job) => [of(job.id)?.reason, fake.host.jobs.running().includes(job.id)]), [[reason, false], [reason, false]]);
	const events = fake.emitted.filter((event) => event.name === "cap-reached").map((event) => event.data);
	assert.deepEqual(events, [{ ticket: "AC0001", project: "acme", cap: "budgetUsd", spent: 2, limit: 2, reason, jobs: [jobs[1]?.id, jobs[0]?.id] }]);
	await assert.rejects(fake.host.jobs.spawn({ task: TASK }), refused("feature cap budgetUsd reached: $2.0000 of $2"));
});

test("a job of a ticket with CPU and memory caps runs in the ticket's slice inside the test kit's, with those caps", { skip: !manager && "no systemd user manager" }, async (t) => {
	const gate = join(temporaryFolder(), "gate");
	const saved = process.env.PATH;
	const slice = `${jobSlice.slice}-AC0001.slice`;
	t.after(() => {
		process.env.PATH = saved;
		for (const verb of ["stop", "revert"]) spawnSync("systemctl", ["--user", verb, slice], { stdio: "ignore" });
	});
	process.env.PATH = [dirname(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] })), saved].join(delimiter);
	const { fake, home } = await load({ perFeature: { cpu: 1 } }, '{ "caps": { "memory": "256M" } }');
	const job = await fake.host.jobs.spawn({ task: TASK });
	await until("the wrapper's pid", () => existsSync(join(home, "jobs", job.id, "pid")));
	const show = (unit: string, property: string) => execFileSync("systemctl", ["--user", "show", unit, "-p", property, "--value"], { encoding: "utf8" }).trim();
	assert.equal(show(`arthur-job-${job.id}.scope`, "Slice"), slice);
	assert.deepEqual([show(slice, "CPUQuotaPerSecUSec"), show(slice, "MemoryMax")], ["1s", String(256 * 2 ** 20)]);
	writeFileSync(gate, "");
	await until("the job's end", () => readFileSync(join(home, "jobs", job.id, "state"), "utf8") === "ended");
	rmSync(gate);
});

test("the sweep leaves a job it stopped already, still in its stop, and emits no second cap-reached", async (t) => {
	const { fake, plugin, home } = await load({ perFeature: { budgetUsd: 1 } });
	const reason = "user: feature cap budgetUsd reached: $3.0000 of $1";
	record(home, "00000001", { cost: "3.0000", state: "blocked", reason, hold: reason.slice(6) });
	t.mock.method(console, "error", () => {});
	await plugin.start?.();
	await plugin.stop?.();
	assert.deepEqual(fake.emitted.filter((event) => event.name === "cap-reached"), []);
	assert.equal(readFileSync(join(home, "jobs/2026-10-18-worker-00000001/reason"), "utf8"), reason);
});

test("arthur resources <ticket> shows each cap with the spend against it and where it comes from; refused for an unknown ticket and wrong usage", async (t) => {
	const now = new Date();
	const { fake, home } = await load({ perFeature: { budgetUsd: 15, cpu: 4 } }, '{ "caps": { "hours": 8 } }', now);
	record(home, "00000001", { cost: "1.2345", ran: "1800" });
	record(home, "00000002", { state: "working", reason: "", since: now.toISOString(), ran: "72" });
	const command = fake.commands.find((each) => each.name === "resources");
	const log = t.mock.method(console, "log", () => {});
	const error = t.mock.method(console, "error", () => {});
	assert.equal(await command?.run({ args: ["AC0001"], project: undefined }), undefined);
	assert.equal(
		log.mock.calls[0]?.arguments[0],
		"AC0001: 2 jobs, 1 in a run\nbudgetUsd: $1.2345 of $15 (perFeature)\nhours: 0.52 h of 8 h (ticket AC0001)\ncpu: 4 cores for all its jobs (perFeature)\nmemory: no cap",
	);
	for (const args of [["AC0001", "AC0002"], ["1"]]) assert.equal(await command?.run({ args, project: undefined }), 2);
	assert.deepEqual(error.mock.calls.map((call) => call.arguments[0]), Array(2).fill("usage: arthur resources [<ticket id>]"));
	assert.throws(() => command?.run({ args: ["AC0099"], project: undefined }), { message: "AC0099: no such ticket on the board, and no jobs" });
});
