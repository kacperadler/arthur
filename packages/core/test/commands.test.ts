import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import type { Command } from "../src/commands.ts";
import { commandRegistry } from "../src/commands.ts";
import type { LoadedConfig } from "../src/config.ts";
import { loadPlugins } from "../src/host.ts";
import type { Host, Plugin } from "../src/plugin.ts";
import { fakeHost, temporaryFolder } from "../src/testing.ts";

const docs = temporaryFolder();

// A command with a doc page that exists; `phone` makes it a phone command.
function command(name: string, phone?: Command["phone"]): Command {
	const doc = pathToFileURL(join(docs, `${name}.md`));
	writeFileSync(doc, `# arthur ${name}\n`);
	return { name, doc, run: () => 0, phone };
}

function config(plugins: readonly Plugin[]): LoadedConfig {
	const folder = temporaryFolder();
	const jobs = { timeoutMinutes: 120, budgetUsd: 2, cpu: 1, memory: "70%" };
	const core = { home: join(folder, ".arthur"), envFile: join(folder, "env"), agent: { command: "omp" }, timeZone: "UTC", quietHours: undefined, jobs };
	return { path: join(folder, "arthur.config.ts"), core, plugins };
}

const plugin = (name: string, setup: (host: Host) => void): Plugin => ({ name, setup });

async function refusal(plugins: readonly Plugin[]): Promise<string> {
	try {
		await loadPlugins(config(plugins), {});
	} catch (error) {
		return (error as Error).message;
	}
	assert.fail("loadPlugins passed, expected a refusal");
}

test("plugins register their commands next to the core's, and each plugin sees every phone command", async () => {
	const commands = commandRegistry();
	commands.register("core", command("config"));
	let seen: unknown;
	await loadPlugins(
		config([
			plugin("orchestration", (host) => host.commands.register(command("jobs", { about: "running jobs", reply: () => "none" }))),
			plugin("telegram", (host) => void (seen = host.commands.phone())),
		]),
		{},
		commands,
	);
	assert.deepEqual(commands.names(), ["config", "jobs"]);
	assert.deepEqual(seen, [{ name: "jobs", about: "running jobs" }]);
});

test("two plugins registering one name are refused at load, naming both; the core's names count too", async () => {
	const twice = await refusal([plugin("orchestration", (host) => host.commands.register(command("jobs"))), plugin("session", (host) => host.commands.register(command("jobs")))]);
	assert.equal(twice, "plugin session: setup failed: command jobs: registered by orchestration and by session; a command belongs to one plugin");
	const commands = commandRegistry();
	commands.register("core", command("config"));
	await assert.rejects(loadPlugins(config([plugin("orchestration", (host) => host.commands.register(command("config")))]), {}, commands), {
		message: "plugin orchestration: setup failed: command config: registered by core and by orchestration; a command belongs to one plugin",
	});
});

test("a command without its doc file is refused at load, naming the plugin and the file", async () => {
	const missing = pathToFileURL(join(docs, "nowhere.md"));
	assert.equal(
		await refusal([plugin("orchestration", (host) => host.commands.register({ ...command("attach"), doc: missing }))]),
		`plugin orchestration: setup failed: command attach: its doc file ${join(docs, "nowhere.md")} does not exist`,
	);
	const none = { name: "attach", run: () => 0 } as unknown as Command;
	assert.equal(
		await refusal([plugin("orchestration", (host) => host.commands.register(none))]),
		'plugin orchestration: setup failed: command attach: no doc file; register it with doc: new URL("../docs/commands/attach.md", import.meta.url)',
	);
	const path = { ...command("attach"), doc: join(docs, "attach.md") } as unknown as Command;
	assert.match(await refusal([plugin("orchestration", (host) => host.commands.register(path))]), /command attach: no doc file/);
});

test("a name that is not lowercase letters, digits and dashes is refused", () => {
	const commands = commandRegistry();
	for (const name of ["Jobs", "", "-jobs", "jobs-", "/jobs", "two words"])
		assert.throws(() => commands.register("core", { ...command("valid"), name }), { message: `command ${JSON.stringify(name)}: expected a name of lowercase letters, digits and dashes` });
	commands.register("core", command("review-needed"));
	commands.register("core", command("retro2"));
	assert.deepEqual(commands.names(), ["retro2", "review-needed"]);
});

test("a phone command Telegram's menu cannot list is refused: a dash, over 32 characters, an about empty or over 256", async () => {
	const commands = commandRegistry();
	const about = (text: string): Command["phone"] => ({ about: text, reply: () => "ok" });
	const long = `a${"b".repeat(31)}`;
	assert.throws(() => commands.register("core", command("review-needed", about("tickets to review"))), {
		message: "command review-needed: a phone command's name has no dash and at most 32 characters, as a channel's menu needs",
	});
	assert.throws(() => commands.register("core", command(`${long}c`, about("too long a name"))), { message: /command a(b{31})c: a phone command's name has no dash/ });
	for (const [text, got] of [["", "0"], ["   ", "3"], ["x".repeat(257), "257"], [undefined, "none"]] as const)
		assert.throws(() => commands.register("core", command("jobs", about(text as string))), {
			message: `command jobs: a phone command's about has 1 to 256 characters, not only spaces; got ${got}`,
		});
	assert.equal(
		await refusal([plugin("orchestration", (host) => host.commands.register(command("retro-due", about("the retro"))))]),
		"plugin orchestration: setup failed: command retro-due: a phone command's name has no dash and at most 32 characters, as a channel's menu needs",
	);
	commands.register("core", command("review-needed"));
	commands.register("core", command(long, about("x")));
	commands.register("core", command("jobs", about("y".repeat(256))));
	assert.deepEqual(commands.names(), [long, "jobs", "review-needed"]);
	assert.deepEqual(commands.phone().map((entry) => entry.name), [long, "jobs"]);
});

test("route gives a phone command the text after its name, trimmed, and empty when there is none", async () => {
	const commands = commandRegistry();
	const texts: string[] = [];
	commands.register("core", command("steer", { about: "correct a job", reply: (text) => (texts.push(text), `ok ${texts.length}`) }));
	assert.equal(await commands.route("/steer AR1  stop\nnow "), "ok 1");
	assert.equal(await commands.route("/steer"), "ok 2");
	assert.equal(await commands.route("  /steer  "), "ok 3");
	assert.deepEqual(texts, ["AR1  stop\nnow", "", ""]);
});

test("route names an unknown command in one line with the phone commands; case and a command without phone do not match", async () => {
	const commands = commandRegistry();
	assert.equal(await commands.route("/jobs"), "unknown command /jobs; no phone commands");
	commands.register("core", command("jobs", { about: "running jobs", reply: () => "none" }));
	commands.register("core", command("board", { about: "the board", reply: () => "empty" }));
	commands.register("core", command("merge"));
	for (const text of ["/Jobs", "/JOBS all", "/merge AR1", "/job", "/", "jobs"])
		assert.equal(await commands.route(text), `unknown command ${text.split(" ")[0]}; phone commands: /board, /jobs`);
	assert.deepEqual(commands.phone(), [{ name: "board", about: "the board" }, { name: "jobs", about: "running jobs" }]);
});

test("a phone command that throws replies with one error line, not a stack", async () => {
	const commands = commandRegistry();
	commands.register("core", command("board", { about: "the board", reply: () => { throw new Error("board file broken\nat line 3"); } }));
	commands.register("core", command("jobs", { about: "running jobs", reply: () => Promise.reject("no jobs folder") }));
	assert.equal(await commands.route("/board all"), "/board failed: board file broken");
	assert.equal(await commands.route("/jobs"), "/jobs failed: no jobs folder");
});

test("the fake host records the commands a plugin registers, routes to them, and refuses like the real host", async () => {
	const fake = fakeHost({ name: "orchestration" });
	const jobs = command("jobs", { about: "running jobs", reply: (text) => `jobs ${text}` });
	fake.host.commands.register(jobs);
	assert.deepEqual(fake.commands, [jobs]);
	assert.equal(await fake.host.commands.route("/jobs all"), "jobs all");
	assert.deepEqual(fake.host.commands.phone(), [{ name: "jobs", about: "running jobs" }]);
	assert.throws(() => fake.host.commands.register(command("jobs")), { message: /command jobs: registered by orchestration and by orchestration/ });
	assert.throws(() => fake.host.commands.register({ ...command("attach"), doc: pathToFileURL(join(docs, "none.md")) }), { message: /does not exist/ });
	assert.deepEqual(fake.commands, [jobs]);
});
