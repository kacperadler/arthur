import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fileURLToPath } from "node:url";
import { fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { type OrchestrationOptions, orchestration } from "../src/orchestration.ts";
import { oneAtATime } from "../src/sessions.ts";
import { fakeTmux, type Start } from "./fake-tmux.ts";

// AR0705 (roadmap 85): a project agent per project whose file holds `orchestration.project({ chat })`, supervised beside the
// coordinator on the fake tmux and omp of fake-tmux.ts, since the job sandbox refuses the Unix socket a real tmux needs.

const PATH = process.env.PATH ?? "";
const ENV_GUARD = fileURLToPath(import.meta.resolve("@arthur/core/env-guard"));
const INBOX = fileURLToPath(new URL("../src/inbox-extension.ts", import.meta.url));
const CONTEXT = fileURLToPath(new URL("../src/context-extension.ts", import.meta.url));
const CLI = fileURLToPath(import.meta.resolve("@arthur/core/plugin").replace(/plugin\.ts$/, "cli.ts"));
const SOCKET = `arthur-test-${process.pid}`;
const PREFIXES = ["SH", "BL", "DC", "WB"];

type Line = { readonly at: number; readonly text: string };
const chat = (plugin: string, place: string, instance?: string) => ({ chat: { plugin, place, ...(instance === undefined ? {} : { instance }) } });

// A Git repository of one commit, a project's checkout.
function repository(): string {
	const root = temporaryFolder();
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { cwd: root });
	git("init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), "# demo\n");
	git("add", "--all");
	git("commit", "--quiet", "-m", "first");
	return root;
}

// The plugin on a fake host whose projects are `pieces`' keys, each its own repository and its piece of orchestration (none for
// undefined); the fake tmux and omp first on PATH; its printed lines caught. Stopped, with every agent ended, at the test's end.
async function load(t: TestContext, pieces: Readonly<Record<string, unknown>>, options: OrchestrationOptions = {}) {
	const tmux = fakeTmux();
	process.env.PATH = `${tmux.bin}${delimiter}${PATH}`;
	const [out, err] = [[] as Line[], [] as Line[]];
	t.mock.method(console, "log", (text: string) => void out.push({ at: Date.now(), text }));
	t.mock.method(console, "error", (text: string) => void err.push({ at: Date.now(), text }));
	const coordinator = { exitWaitSeconds: 1, restartDelaySeconds: 1, tmux: { session: "coord", socket: SOCKET }, ...options.coordinator };
	const all = { ...options, coordinator };
	const fake = fakeHost({ name: "orchestration", options: all });
	const projects = Object.entries(pieces).map(([name, piece], index) => ({ name, path: repository(), prefix: PREFIXES[index], pieces: piece === undefined ? {} : { orchestration: piece } }));
	fake.provide("projects", () => projects);
	const plugin = orchestration(all);
	t.after(async () => {
		try {
			await plugin.stop?.();
		} finally {
			tmux.end();
			process.env.PATH = PATH;
		}
	});
	await fake.setup(plugin);
	const command = async (name: string, args: string[]) => {
		const [before, errors] = [out.length, err.length];
		const code = (await fake.commands.find((each) => each.name === name)?.run({ args, project: undefined })) ?? 0;
		return { code, out: out.slice(before).map((line) => line.text), err: err.slice(errors).map((line) => line.text) };
	};
	const of = (project: string | null) => tmux.starts().filter((start) => start.ARTHUR_PROJECT === project);
	return { fake, plugin, tmux, out, err, command, of, projects, folder: (project: string) => join(fake.host.folder, "agents", project) };
}

test("a chat of the wrong shape refuses the load, naming the project and the helper; a whole one loads", async (t) => {
	const shapes = [
		"telegram",
		null,
		[],
		{},
		{ chat: "telegram" },
		{ chat: { plugin: "telegram" } },
		{ chat: { place: "4" } },
		{ chat: { plugin: "", place: "4" } },
		{ chat: { plugin: "telegram", place: "" } },
		{ chat: { plugin: "telegram", place: 4 } },
		{ chat: { plugin: "telegram", place: "4", instance: "" } },
		{ chat: { plugin: "telegram", place: "4", instance: 1 } },
		{ chat: { plugin: "telegram", place: "4", topic: "x" } },
		{ ...chat("telegram", "4"), more: true },
	];
	for (const value of shapes)
		await assert.rejects(load(t, { docs: undefined, shop: value }), {
			message: `project shop: orchestration.project(...): expected { chat: { plugin, instance?, place } }, each a non-empty string, got ${JSON.stringify(value)}`,
		});
	const { fake } = await load(t, { shop: chat("telegram", "4", "shop"), blog: chat("telegram", "5") });
	assert.deepEqual(fake.collect("orchestration.chats"), [[{ project: "shop", plugin: "telegram", instance: "shop", place: "4" }, { project: "blog", plugin: "telegram", place: "5" }]]);
	assert.deepEqual(orchestration.project({ chat: { plugin: "telegram", place: "4" } }), { orchestration: { chat: { plugin: "telegram", place: "4" } } });
});

test("two projects in one place of one channel refuse the load, naming both; another place, bot or channel does not", async (t) => {
	const twice = { shop: chat("telegram", "4", "shop"), docs: undefined, blog: chat("telegram", "4", "shop") };
	await assert.rejects(load(t, twice), { message: `project blog: orchestration.project(...): its chat {"plugin":"telegram","place":"4","instance":"shop"} is project shop's too; each project agent needs a place of its own` });
	await assert.rejects(load(t, { shop: chat("discord", "9"), blog: chat("discord", "9") }), { message: /^project blog: .* is project shop's too;/ });
	for (const blog of [chat("telegram", "5", "shop"), chat("telegram", "4"), chat("telegram", "4", "blog"), chat("discord", "4", "shop")]) {
		const { fake } = await load(t, { shop: chat("telegram", "4", "shop"), blog });
		assert.equal(fake.collect<unknown[]>("orchestration.chats")[0]?.length, 2, JSON.stringify(blog));
	}
});

test("doctor: a chat whose plugin provides no channel.send is a critical line, asked with no file; none without a chat", async (t) => {
	const { fake } = await load(t, { shop: chat("test", "4"), blog: chat("discord", "5"), docs: undefined });
	const requirements = () => fake.collect<{ name: string; check(): string; costs: string; fix: string; critical: boolean }[]>("doctor").flat();
	const shown = () => requirements().map(({ name, check, costs, fix, critical }) => [name, check(), costs, fix, critical]);
	const line = (project: string, plugin: string, check: string) => {
		const fix = `enable the ${plugin} plugin in arthur.config.ts, or name a channel plugin in the chat of ${project}'s orchestration.project(...)`;
		return [`chat of ${project}`, check, `no agent of project ${project}, nor arthur run`, fix, true];
	};
	assert.deepEqual(shown(), [line("shop", "test", "missing: test provides no channel.send; plugins that do: none"), line("blog", "discord", "missing: discord provides no channel.send; plugins that do: none")]);
	const asked: unknown[] = [];
	fake.provide("channel.send", (message: unknown) => {
		asked.push(message);
		throw new Error("expected files, a list of at least one path");
	});
	assert.deepEqual(shown(), [line("shop", "test", "ok"), line("blog", "discord", "missing: discord provides no channel.send; plugins that do: test")]);
	assert.deepEqual(asked.slice(0, 1), [{ files: [] }]);
	const alone = await load(t, { docs: undefined });
	assert.deepEqual(alone.fake.collect("doctor"), [], "no chat: no line");
});

test("no project with a chat: only the coordinator starts, as before, with no project's variables", async (t) => {
	const { fake, plugin, tmux, of } = await load(t, { docs: undefined, blog: undefined });
	await plugin.start?.();
	await until("the coordinator's start", () => of(null).length === 1);
	const [start] = tmux.starts();
	assert.deepEqual(start?.args, ["--continue", "--auto-approve", "-e", ENV_GUARD, "-e", INBOX, "-e", CONTEXT]);
	assert.deepEqual([start?.ARTHUR_ORCHESTRATION_SESSION, start?.ARTHUR_ORCHESTRATION_FOLDER, start?.ARTHUR_ORCHESTRATION_CONTEXT], [null, fake.host.folder, JSON.stringify([process.execPath, CLI, "coordinator", "context"])]);
	// Two more looks at the coordinator's session: a second session's start would have come right after the first.
	const looks = () => tmux.calls().filter((call) => call[0] === "display-message").length;
	const seen = looks();
	await until("two more looks", () => looks() >= seen + 2);
	assert.deepEqual([tmux.starts().length, tmux.live(), existsSync(join(fake.host.folder, "agents"))], [1, ["coord"], false]);
});

test("each project agent: its tmux session, roles.project's model, --session-dir, mcp.roles.project, its variables and context, its plugins' extensions", async (t) => {
	const mcp = { servers: { docs: { command: "docs-mcp" }, web: { url: "https://example.com/mcp" } }, all: ["docs"], roles: { project: ["web"], coordinator: [] } };
	const roles = { project: { model: "anthropic/claude-sonnet-5", thinking: "low" }, quick: { model: "anthropic/claude-haiku-5-5" } };
	const box = await load(t, { shop: chat("telegram", "4"), docs: undefined, "web.shop": chat("telegram", "5") }, { coordinator: { model: "anthropic/claude-opus-5-5" }, roles, mcp });
	const [every, coordinators] = [join(temporaryFolder(), "every.ts"), join(temporaryFolder(), "coordinator.ts")];
	for (const file of [every, coordinators]) writeFileSync(file, "export default () => {};\n");
	box.fake.provide("coordinator.extension", (asked: { session: string }) => ({ file: every, env: { ARTHUR_TEST_SESSION: asked.session } }));
	box.fake.provide("coordinator.extension", (asked: { session: string }) => (asked.session === "coordinator" ? { file: coordinators, env: {} } : undefined));
	await box.plugin.start?.();
	await until("three starts", () => box.tmux.starts().length === 3);
	const [coordinator, shop, web] = [box.of(null)[0], box.of("shop")[0], box.of("web.shop")[0]] as [Start, Start, Start];
	const own = ["-e", ENV_GUARD, "-e", INBOX, "-e", CONTEXT];
	assert.deepEqual(coordinator.args, ["--continue", "--auto-approve", "--model", "anthropic/claude-opus-5-5", "--smol", "anthropic/claude-haiku-5-5", ...own, "-e", every, "-e", coordinators]);
	const models = ["--model", "anthropic/claude-sonnet-5", "--thinking", "low", "--smol", "anthropic/claude-haiku-5-5"];
	assert.deepEqual(shop.args, ["--continue", "--auto-approve", ...models, "--session-dir", join(box.folder("shop"), "sessions"), ...own, "-e", every, "--plugin-dir", join(box.folder("shop"), "mcp")]);
	assert.deepEqual(
		[shop.ARTHUR_ORCHESTRATION_SESSION, shop.ARTHUR_ORCHESTRATION_FOLDER, shop.ARTHUR_ORCHESTRATION_CONTEXT, shop.cwd],
		["agent:shop", box.folder("shop"), JSON.stringify([process.execPath, CLI, "coordinator", "context", "shop"]), process.cwd()],
	);
	assert.deepEqual([web.ARTHUR_ORCHESTRATION_SESSION, web.ARTHUR_ORCHESTRATION_FOLDER], ["agent:web.shop", box.folder("web.shop")]);
	assert.deepEqual(JSON.parse(readFileSync(join(box.folder("shop"), "mcp", ".mcp.json"), "utf8")), { mcpServers: { web: { type: "http", url: "https://example.com/mcp" } } });
	assert.equal(existsSync(join(box.fake.host.folder, "mcp")), false, "the coordinator's own list is empty");
	const made = box.tmux.calls().filter((call) => call[0] === "new-session");
	const named = (session: string) => made.find((call) => call[call.indexOf("-s") + 1] === session);
	assert.ok(named("coord-web_shop")?.includes("ARTHUR_TEST_SESSION=agent:web.shop"), "a . in a project's name is _ in its tmux session's");
	assert.ok(named("coord")?.includes("ARTHUR_TEST_SESSION=coordinator"));
	assert.deepEqual(box.tmux.live().sort(), ["coord", "coord-shop", "coord-web_shop"]);
	assert.deepEqual(box.err, [], "an extension that answers nothing for a session is left out without a word");
});

test("an agent crashing in a loop restarts never faster than restartDelaySeconds and leaves the coordinator and the other agent running", async (t) => {
	const { plugin, tmux, out, of } = await load(t, { crash: chat("telegram", "4"), blog: chat("telegram", "5") });
	await plugin.start?.();
	await until("three starts of the crashing agent", () => of("crash").length >= 3);
	const crashes = of("crash");
	for (const [index, start] of crashes.entries()) if (index > 0) assert.ok(start.at - (crashes[index - 1]?.at ?? 0) >= 1000, `starts ${index} and ${index + 1} came ${start.at - (crashes[index - 1]?.at ?? 0)} ms apart`);
	// The crashing agent's session lives a moment after each start.
	assert.deepEqual([of(null).length, of("blog").length, tmux.live().filter((name) => name !== "coord-crash").sort()], [1, 1, ["coord", "coord-blog"]]);
	assert.ok(out.some((line) => line.text === "orchestration: the project agent crash ended; starting it again in 1 s"));
	assert.ok(out.some((line) => line.text.startsWith("orchestration: project agent blog started: omp (pid ") && line.text.endsWith(" in tmux session coord-blog")));
});

test("the starts of every session go one at a time: an agent's waits for the coordinator's wait for its previous omp", async (t) => {
	const box = await load(t, { shop: chat("telegram", "4") });
	// The coordinator's previous omp still alive: this process, as `ps` gives its start time.
	const since = spawnSync("ps", ["-o", "lstart=", "-p", String(process.pid)], { encoding: "utf8" }).stdout.trim();
	writeFileSync(join(box.fake.host.folder, "coordinator.pid"), `${process.pid} ${since}\n`);
	await box.plugin.start?.();
	await until("the agent's start", () => box.of("shop").length === 1);
	const refused = box.err.find((line) => line.text.startsWith(`orchestration: coordinator start refused: the previous omp (pid ${process.pid}) is still running`));
	assert.ok(refused !== undefined && refused.at <= (box.of("shop")[0]?.at ?? 0), "the agent started only once the coordinator's start was over");
	assert.equal(box.of(null).length, 0);
});

test("arthur attach and arthur coordinator context name a project's agent; a project without one is refused, naming those with one", async (t) => {
	const box = await load(t, { shop: chat("telegram", "4"), docs: undefined });
	const where = `tmux session coord-shop (socket ${SOCKET})`;
	const none = "has no agent (no orchestration.project({ chat }) in its project file); projects with one: shop";
	assert.deepEqual(await box.command("attach", ["docs"]), { code: 1, out: [], err: [`arthur attach: project docs ${none}`] });
	assert.deepEqual(await box.command("attach", ["shop"]), { code: 1, out: [], err: [`arthur attach: no agent of project shop: ${where} is not running; arthur run starts it`] });
	assert.deepEqual(await box.command("attach", ["shop", "now"]), { code: 2, out: [], err: ["usage: arthur attach [<project>]"] });
	assert.deepEqual(await box.command("coordinator", ["context", "docs"]), { code: 1, out: [], err: [`arthur coordinator context: project docs ${none}`] });
	for (const args of [[], ["start", "shop"], ["stop", "shop", "now"], ["context", "shop", "now"]])
		assert.deepEqual(await box.command("coordinator", args), { code: 2, out: [], err: ["usage: arthur coordinator stop|context [<project>]"] }, args.join(" "));
	// The agent's context: its role, the project's own override of it, and the time.
	const root = box.projects[0]?.path ?? "";
	mkdirSync(join(root, ".agents", "arthur", "roles"), { recursive: true });
	writeFileSync(join(root, ".agents", "arthur", "roles", "project.md"), "Shop's own rule.\n");
	const { code, out } = await box.command("coordinator", ["context", "shop"]);
	assert.equal(code, 0);
	assert.match(out[0] ?? "", /^# Project agent\n\n## Your job\n/);
	assert.match(out[0] ?? "", /Shop's own rule\./);
	assert.match(out[0] ?? "", /\n\n## Warnings\n\n- criteria file \.agents\/arthur\/criteria\/styleguide\.md is missing; the project goes without it\n/);
	assert.match(out[0] ?? "", /\n\n## Time\n\n00:00 on thu 2026-01-01 \(UTC\), day: outside the owner's quiet hours\.$/);
	assert.doesNotMatch(out[0] ?? "", /^# Coordinator/m);
	// A stop before arthur run ever started the agent leaves its mark in a folder made for it; the next start lifts it.
	assert.deepEqual(await box.command("coordinator", ["stop", "shop"]), { code: 0, out: [`arthur coordinator stop: ${where} was not running; it stays stopped until arthur run starts again`], err: [] });
	assert.deepEqual((await box.command("attach", ["shop"])).err, [`arthur attach: no agent of project shop: ${where} is not running; arthur coordinator stop shop stopped it until arthur run starts again`]);
	await box.plugin.start?.();
	await until("the agent's start", () => box.of("shop").length === 1);
	assert.deepEqual(await box.command("attach", ["shop"]), { code: 0, out: [], err: [] });
	assert.deepEqual(box.tmux.calls().findLast((call) => call[0] === "attach-session"), ["attach-session", "-t", "=coord-shop"]);
});

test("arthur coordinator stop <project> is refused while a job of that project runs, and otherwise stops that agent alone until arthur run starts again", async (t) => {
	const box = await load(t, { shop: chat("telegram", "4"), blog: chat("telegram", "5") });
	await box.plugin.start?.();
	await until("three starts", () => box.tmux.starts().length === 3);
	const job = await box.fake.host.jobs.spawn({ task: "Wait.", project: "shop" });
	await until("the job in its run", () => box.fake.host.jobs.running().includes(job.id));
	const ended = (where: string) => `arthur coordinator stop: tmux session ${where} (socket ${SOCKET}) ended; it stays stopped until arthur run starts again`;
	assert.deepEqual(await box.command("coordinator", ["stop", "shop"]), {
		code: 1,
		out: [],
		err: [`arthur coordinator stop: refused: 1 job of shop running: ${job.id}; the agent of project shop directs them; stop them first (arthur stop <id>, or arthur stopall)`],
	});
	assert.equal((await box.command("coordinator", ["stop"])).code, 1, "the coordinator hears every job's end");
	assert.deepEqual(await box.command("coordinator", ["stop", "blog"]), { code: 0, out: [ended("coord-blog")], err: [] });
	await until("its end seen", () => box.out.some((line) => line.text === "orchestration: the project agent blog ended; arthur coordinator stop blog asked, so it stays stopped until arthur run starts again"));
	const looks = () => box.tmux.calls().filter((call) => call.includes("=coord-blog:")).length;
	const seen = looks();
	await until("two more looks at its session", () => looks() >= seen + 2);
	assert.deepEqual([box.of("blog").length, box.tmux.live().sort(), existsSync(join(box.folder("blog"), "stopped")), existsSync(join(box.folder("shop"), "stopped"))], [1, ["coord", "coord-shop"], true, false]);
	assert.deepEqual(await box.command("attach", ["blog"]), {
		code: 1,
		out: [],
		err: [`arthur attach: no agent of project blog: tmux session coord-blog (socket ${SOCKET}) is not running; arthur coordinator stop blog stopped it until arthur run starts again`],
	});
	box.tmux.releaseJobs();
	await until("the job's end", () => box.fake.host.jobs.running().length === 0);
	assert.deepEqual(await box.command("coordinator", ["stop", "shop"]), { code: 0, out: [ended("coord-shop")], err: [] });
	await box.plugin.stop?.();
	await box.plugin.start?.();
	await until("blog's start after arthur run started again", () => box.of("blog").length === 2);
});

test("from a project agent's session a spawn or continue of another project's job is refused; its own and any outside a session go on", async (t) => {
	const box = await load(t, { shop: chat("telegram", "4"), blog: chat("telegram", "5"), docs: undefined });
	t.after(() => delete process.env.ARTHUR_ORCHESTRATION_FOLDER);
	const ended = await box.fake.host.jobs.spawn({ task: "Go.", project: "blog" });
	box.tmux.releaseJobs();
	await until("blog's job ended", () => box.fake.host.jobs.running().length === 0);
	process.env.ARTHUR_ORCHESTRATION_FOLDER = box.folder("shop");
	for (const project of ["blog", "docs"])
		await assert.rejects(box.fake.host.jobs.spawn({ task: "Go.", project }), { message: `refused by orchestration: the agent of project shop spawns only shop's jobs, not ${project}'s; the coordinator directs ${project}` });
	await assert.rejects(box.fake.host.jobs.continue(ended.id, "Go on."), { message: "refused by orchestration: the agent of project shop continues only shop's jobs, not blog's; the coordinator directs blog" });
	assert.equal((await box.fake.host.jobs.spawn({ task: "Go.", project: "shop" })).project, "shop");
	process.env.ARTHUR_ORCHESTRATION_FOLDER = box.fake.host.folder;
	assert.equal((await box.fake.host.jobs.spawn({ task: "Go.", project: "blog" })).project, "blog", "the coordinator's session spawns for every project");
});

test("roles.project.model is one model name: a list is refused, naming the path", () => {
	const problems = orchestration().check?.({ roles: { project: { model: ["anthropic/claude-sonnet-5", "openai/gpt-5"] } } }, {} as never) ?? [];
	assert.deepEqual(problems, [{ path: "roles.project.model", problem: "expected one model name, the project agents' model, not a list" }]);
	assert.deepEqual(orchestration().check?.({ roles: { project: { model: "anthropic/claude-sonnet-5" }, worker: { model: ["a/b", "c/d"] } } }, {} as never), []);
});

test("one at a time: each start begins once the one before it ended, and one that throws holds back none after it", async () => {
	const turns = oneAtATime();
	const [order, gate] = [[] as string[], Promise.withResolvers<void>()];
	const first = turns(async () => {
		order.push("first begins");
		await gate.promise;
		order.push("first ends");
		throw new Error("first failed");
	});
	const second = turns(async () => order.push("second begins"));
	gate.resolve();
	await assert.rejects(first, { message: "first failed" });
	assert.equal(await second, 3);
	assert.deepEqual(order, ["first begins", "first ends", "second begins"]);
});
