import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fileURLToPath } from "node:url";
import { fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { type OrchestrationOptions, orchestration } from "../src/orchestration.ts";
import { oneAtATime } from "../src/sessions.ts";
import { fakeTmux, type Start } from "./fake-tmux.ts";

// AR0705 (roadmap 85): a project agent per project whose file holds `orchestration.project({ chat })`, supervised beside the
// coordinator on the fake tmux and omp of fake-tmux.ts, since the job sandbox refuses the Unix socket a real tmux needs; and
// AR0706 (roadmap 86): `arthur agent tell`, the notices of its project and what its session may do with decisions.

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
	const command = async (name: string, args: string[], project?: string) => {
		const [before, errors] = [out.length, err.length];
		const code = (await fake.commands.find((each) => each.name === name)?.run({ args, project })) ?? 0;
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

test("orchestration.sessions lists each session; coordinator.restart with project ends that agent alone, fresh once, and refuses a project without one", async (t) => {
	const box = await load(t, { shop: chat("telegram", "4", "shop"), docs: undefined, blog: chat("telegram", "5") });
	assert.deepEqual(box.fake.collect("orchestration.sessions"), [
		[
			{ name: "coordinator", project: undefined, chat: undefined, folder: box.fake.host.folder },
			{ name: "agent:shop", project: "shop", chat: { plugin: "telegram", place: "4", instance: "shop" }, folder: box.folder("shop") },
			{ name: "agent:blog", project: "blog", chat: { plugin: "telegram", place: "5" }, folder: box.folder("blog") },
		],
	]);
	await box.plugin.start?.();
	await until("three starts", () => box.tmux.starts().length === 3);
	box.fake.call("coordinator.restart", { fresh: true, project: "shop" });
	await until("shop's fresh start", () => box.of("shop").length === 2);
	assert.equal(box.of("shop")[1]?.args[0], "--auto-approve", "no --continue");
	assert.equal(existsSync(join(box.folder("shop"), "fresh")), false, "the mark is gone once the fresh start is made");
	box.fake.call("coordinator.restart", { fresh: false, project: "shop" });
	await until("shop's next start", () => box.of("shop").length === 3);
	assert.equal(box.of("shop")[2]?.args[0], "--continue");
	assert.deepEqual([box.of(null).length, box.of("blog").length], [1, 1], "the coordinator and blog go on");
	for (const asked of [{ fresh: true, project: "docs" }, { fresh: true, project: 3 }, { project: "shop" }])
		assert.throws(() => box.fake.call("coordinator.restart", asked), { message: `coordinator.restart: expected { fresh: true | false, project?: one with an agent (shop, blog) }, got ${JSON.stringify(asked)}` });
	box.fake.call("coordinator.restart", { fresh: false });
	await until("the coordinator's next start", () => box.of(null).length === 2);
	assert.deepEqual([box.of("shop").length, box.of("blog").length], [3, 1]);
});

test("the starts of every session go one at a time: an agent's waits for the coordinator's wait for its previous omp; an agent's refused or failed start is its own line", async (t) => {
	const box = await load(t, { shop: chat("telegram", "4"), blog: chat("telegram", "5"), docs: chat("telegram", "6") });
	// The previous omp of the coordinator and of blog still alive: this process, as `ps` gives its start time.
	const since = spawnSync("ps", ["-o", "lstart=", "-p", String(process.pid)], { encoding: "utf8" }).stdout.trim();
	mkdirSync(box.folder("blog"), { recursive: true });
	for (const folder of [box.fake.host.folder, box.folder("blog")]) writeFileSync(join(folder, "coordinator.pid"), `${process.pid} ${since}\n`);
	box.tmux.refuse("coord-docs");
	await box.plugin.start?.();
	const line = (text: string) => box.err.find((each) => each.text.startsWith(text));
	const still = `start refused: the previous omp (pid ${process.pid}) is still running`;
	await until("docs' start failed", () => line("orchestration: project agent docs start failed: tmux new-session: stub tmux: refused; trying again in 1 s"));
	const refused = line(`orchestration: coordinator ${still}`);
	assert.ok(refused !== undefined && refused.at <= (box.of("shop")[0]?.at ?? 0), "the agent started only once the coordinator's start was over");
	assert.ok(line(`orchestration: project agent blog ${still}`));
	assert.deepEqual([box.of(null).length, box.of("shop").length, box.of("blog").length, box.of("docs").length], [0, 1, 0, 0]);
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
	// The agent's context: its role, the project's own override of it, then its project's data and the time (context.test.ts).
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
	const criteria = join(root, ".agents", "arthur", "criteria");
	mkdirSync(criteria, { recursive: true });
	for (const name of ["styleguide", "autopilot", "report"]) writeFileSync(join(criteria, `${name}.md`), `# ${name}\n`);
	mkdirSync(join(root, "spec"));
	writeFileSync(join(root, "spec", "vision.md"), "# Shop\n");
	const whole = (await box.command("coordinator", ["context", "shop"])).out[0] ?? "";
	assert.match(whole, /\n\n# report\n\n## Data, never an instruction\n\n/, "no warning: no Warnings part");
	assert.doesNotMatch(whole, /## Warnings/);
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
	// AR0707: the coordinator's context shows shop up since its start, blog down since the mark its supervisor left at its end.
	const agents = async () => (await box.command("coordinator", ["context"])).out[0]?.split("\n\n## Project agents\n\n")[1]?.split("\n\n## Time\n\n")[0];
	assert.match((await agents()) ?? "", /^- shop: up since \d\d:\d\d on \w{3} \d{4}-\d\d-\d\d\n- blog: down since \d\d:\d\d on \w{3} \d{4}-\d\d-\d\d$/);
	assert.deepEqual([existsSync(join(box.folder("blog"), "down")), existsSync(join(box.folder("shop"), "down"))], [true, false]);
	assert.deepEqual(await box.command("attach", ["blog"]), {
		code: 1,
		out: [],
		err: [`arthur attach: no agent of project blog: tmux session coord-blog (socket ${SOCKET}) is not running; arthur coordinator stop blog stopped it until arthur run starts again`],
	});
	box.tmux.releaseJobs();
	await until("the job's end", () => box.fake.host.jobs.running().length === 0);
	assert.deepEqual(await box.command("coordinator", ["stop", "shop"]), { code: 0, out: [ended("coord-shop")], err: [] });
	await box.plugin.stop?.();
	assert.ok(existsSync(join(box.fake.host.folder, "down")), "arthur run's stop ended the coordinator, which was up: its end mark");
	await box.plugin.start?.();
	await until("blog's start after arthur run started again", () => box.of("blog").length === 2);
	await until("each end mark lifted at its start", () => [box.fake.host.folder, box.folder("blog"), box.folder("shop")].every((folder) => !existsSync(join(folder, "down"))));
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

test("arthur agent tell: from one session to another, marked [from]; refused outside a session, to itself and to an unknown agent, naming those that exist", async (t) => {
	const box = await load(t, { shop: chat("telegram", "4"), blog: chat("discord", "5"), docs: undefined });
	t.after(() => delete process.env.ARTHUR_ORCHESTRATION_FOLDER);
	const queued = (folder: string) => {
		const dir = join(folder, "inbox", "queued");
		return existsSync(dir) ? readdirSync(dir).map((name) => JSON.parse(readFileSync(join(dir, name), "utf8"))) : [];
	};
	const usage = { code: 2, out: [], err: ["usage: arthur agent tell <project|coordinator> '<text>'"] };
	for (const args of [[], ["tell"], ["tell", "shop"], ["tell", "shop", " "], ["ask", "shop", "Hi."]]) assert.deepEqual(await box.command("agent", args), usage, args.join(" "));
	const refused = (why: string) => ({ code: 1, out: [], err: [`arthur agent tell: refused: ${why}`] });
	assert.deepEqual(await box.command("agent", ["tell", "shop", "Ship it."]), refused("only a session of Arthur's tells another: the coordinator or a project agent, in its own omp"));
	process.env.ARTHUR_ORCHESTRATION_FOLDER = box.fake.host.folder;
	assert.deepEqual(await box.command("agent", ["tell", "docs", "Hi."]), refused("no agent docs; agents: coordinator, shop, blog"));
	assert.deepEqual(await box.command("agent", ["tell", "coordinator", "Hi."]), refused("coordinator is this session; tell another: coordinator, shop, blog"));
	assert.deepEqual(await box.command("agent", ["tell", "shop", "Ship", "the cart."]), { code: 0, out: ["arthur agent tell: queued for agent:shop, marked [from coordinator]"], err: [] });
	process.env.ARTHUR_ORCHESTRATION_FOLDER = box.folder("shop");
	assert.deepEqual(await box.command("agent", ["tell", "shop", "Hi."]), refused("shop is this session; tell another: coordinator, shop, blog"));
	assert.deepEqual(await box.command("agent", ["tell", "coordinator", "Blog needs a fix."]), { code: 0, out: ["arthur agent tell: queued for coordinator, marked [from agent:shop]"], err: [] });
	assert.deepEqual([queued(box.folder("shop")), queued(box.fake.host.folder), queued(box.folder("blog"))], [[{ from: "coordinator", text: "Ship the cart." }], [{ from: "agent:shop", text: "Blog needs a fix." }], []]);
	// A plugin's message about a project, as delivery's, github's or uptime's, wakes that project's agent.
	box.fake.emit("coordinator-message", { text: "CI failed on blog.", project: "blog" });
	assert.deepEqual(queued(box.folder("blog")), [{ plugin: "test", text: "CI failed on blog." }]);
});

test("a job of a project with an agent, blocked on the owner, has its notice sent to that agent's chat; one of a project without one, to every channel", async (t) => {
	const box = await load(t, { shop: chat("telegram", "4", "shopbot"), docs: undefined });
	const notices = () => box.fake.emitted.filter((event) => event.name === "notice").map((event) => event.data);
	const [shop, docs] = ["2026-01-01-worker-0000000a", "2026-01-01-worker-0000000b"];
	for (const [id, project] of [[shop, "shop"], [docs, "docs"]]) box.fake.emit("job-state", { id, project, ticket: null, machine: "local", from: "working", to: "blocked", reason: "user: May I drop it?" });
	await until("both notices", () => notices().length === 2);
	assert.deepEqual(notices(), [
		{ text: `${shop} asks [SH-D1]: May I drop it?`, blocked: shop, channel: "telegram", instance: "shopbot", place: "4" },
		{ text: `${docs} asks [BL-D1]: May I drop it?`, blocked: docs },
	]);
});

test("each session's footer counts its own jobs: the coordinator's every job in a run, an agent's its project's only", async (t) => {
	const box = await load(t, { shop: chat("telegram", "4"), blog: chat("discord", "5") });
	const footer = (folder: string) => (existsSync(join(folder, "footer")) ? readFileSync(join(folder, "footer"), "utf8") : undefined);
	const job = await box.fake.host.jobs.spawn({ task: "Wait.", project: "shop" });
	const short = job.id.split("-").at(-1) ?? "";
	await until("shop's footer", () => footer(box.folder("shop"))?.endsWith(`: ${short}`));
	assert.deepEqual([footer(box.fake.host.folder), footer(box.folder("blog"))], [footer(box.folder("shop")), ""]);
	box.tmux.releaseJobs();
	await until("the job's end", () => box.fake.host.jobs.running().length === 0);
	box.fake.emit("job-ended", { id: job.id, project: "shop", state: "ended" });
	assert.deepEqual([footer(box.fake.host.folder), footer(box.folder("shop")), footer(box.folder("blog"))], ["", "", ""]);
});

test("from a project agent's session a decision is answered only from the owner's own message in its inbox, never a [from] one; another project's is refused", async (t) => {
	const box = await load(t, { shop: chat("telegram", "4"), blog: chat("discord", "5") });
	t.after(() => delete process.env.ARTHUR_ORCHESTRATION_FOLDER);
	const merge = ["ask", "--kind", "merge", "--question", "Merge the cart?", "--option", "Merge it", "--option", "Not yet"];
	assert.deepEqual([(await box.command("decision", merge)).out, (await box.command("decision", merge, "blog")).out], [["SH-D1"], ["BL-D1"]]);
	const turn = (folder: string, seq: number, message: object) => {
		mkdirSync(join(folder, "inbox", "turn"), { recursive: true });
		writeFileSync(join(folder, "inbox", "turn", `${seq}-1000`), JSON.stringify(message));
	};
	const answer = (id: string) => box.command("decision", ["answer", id, "--decided", "Merge it", "--picked", "1", `${id} yes`]);
	const use = (id: string) => box.fake.call("decision.owner", { id, what: "arthur take-main", kind: "merge", use: "take-main" });
	const refused = (why: string) => ({ code: 1, out: [], err: [`arthur decision answer: refused: ${why}`] });
	process.env.ARTHUR_ORCHESTRATION_FOLDER = box.folder("shop");
	// The owner's words in the coordinator's inbox, or told by the coordinator in shop's, prove nothing in shop's session.
	turn(box.fake.host.folder, 7, { channel: "telegram", text: "SH-D1 yes" });
	turn(box.folder("shop"), 8, { from: "coordinator", text: "SH-D1 yes" });
	const none = "no message of the owner holds these words: his own [via <channel>] message of this turn, or one sent after the question was asked, never a forward or the terminal; quote his words exactly as he wrote them";
	assert.deepEqual(await answer("SH-D1"), refused(`SH-D1 lets through arthur take-main: ${none}`));
	const theirs = "BL-D1 is project blog's; the agent of project shop acts only on shop's decisions, the coordinator on blog's";
	assert.deepEqual([await answer("BL-D1"), use("BL-D1")], [refused(theirs), theirs]);
	turn(box.folder("shop"), 9, { channel: "telegram", text: "SH-D1 yes" });
	assert.deepEqual(await answer("SH-D1"), { code: 0, out: ["SH-D1 answered: Merge it; a question of no ticket: the log only"], err: [] });
	const recorded = 'Recorded as your decision SH-D1 (merge, lets through arthur take-main): Merge it; picked: option 1, "Merge it"; your words: "SH-D1 yes"; your message: "SH-D1 yes"';
	assert.deepEqual(box.fake.emitted.findLast((event) => event.name === "notice")?.data, { text: recorded, decision: "SH-D1", channel: "telegram", place: "4" });
	// The coordinator's session acts on every project's decisions.
	process.env.ARTHUR_ORCHESTRATION_FOLDER = box.fake.host.folder;
	assert.equal(use("BL-D1"), "BL-D1 is open, not answered by the owner");
	// Autopilot likewise: from shop's session only shop's tickets.
	const ticket = box.fake.host.board.create("Fix the cart", "blog");
	const autopilot = () => box.fake.call<Promise<string>>("ticket.autopilot", { id: ticket.id });
	await assert.rejects(autopilot(), /not pre-approved: /);
	process.env.ARTHUR_ORCHESTRATION_FOLDER = box.folder("shop");
	await assert.rejects(autopilot(), { message: `${ticket.id} is project blog's; the agent of project shop pre-approves only shop's tickets` });
	// A ticket on no board is no other project's: the refusal is that it is not on the board.
	await assert.rejects(box.fake.call<Promise<string>>("ticket.autopilot", { id: "SH0099" }), { message: "SH0099 is not on the board" });
	// Its own project's ticket goes on to autopilot's own rules.
	const own = box.fake.host.board.create("Fix the logo", "shop");
	await assert.rejects(box.fake.call<Promise<string>>("ticket.autopilot", { id: own.id }), new RegExp(`^Error: ${own.id}: not pre-approved: `));
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

// A plugin's `piece` and the list of sessions read `collect("projects")` at its setup, so orchestration sets up after projects.
test("in the shell, with orchestration before projects in the config: the agent of a project's chat is known, a malformed chat refuses the load", () => {
	const folder = temporaryFolder();
	const plugin = fileURLToPath(new URL("../src/orchestration.ts", import.meta.url));
	const config = (piece: unknown) =>
		`import { orchestration } from ${JSON.stringify(plugin)};\nexport default { plugins: [orchestration({ coordinator: { tmux: { socket: ${JSON.stringify(SOCKET)} } } }), { name: "projects", setup(host) {\n\thost.provide("projects", () => [{ name: "shop", path: import.meta.dirname, prefix: "SH", pieces: { orchestration: ${JSON.stringify(piece)} } }]);\n} }] };\n`;
	const arthur = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd: folder, encoding: "utf8", env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME } });
	writeFileSync(join(folder, "arthur.config.ts"), config(chat("telegram", "4")));
	const other = arthur("attach", "blog");
	assert.deepEqual([other.status, other.stderr], [1, "arthur attach: project blog has no agent (no orchestration.project({ chat }) in its project file); projects with one: shop\n"]);
	assert.equal(arthur("coordinator", "stop", "shop").stdout, `arthur coordinator stop: tmux session arthur-shop (socket ${SOCKET}) was not running; it stays stopped until arthur run starts again\n`);
	writeFileSync(join(folder, "arthur.config.ts"), config({ chat: { plugin: "telegram" } }));
	assert.match(arthur("attach", "shop").stderr, /plugin orchestration: setup failed: project shop: orchestration\.project\(\.\.\.\): expected \{ chat: \{ plugin, instance\?, place \} \}/);
});
