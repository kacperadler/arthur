import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "../src/testing.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const CORE_LIST = "commands: config, help, ticket\n";

// A plugin's commands as a config holds them: `echo` prints what it got and exits 3, `boom` throws, `gone` loses its doc file
// right after it registered it, before any `--help`.
const CONFIG = `import { rmSync } from "node:fs";
const doc = (name) => new URL("./" + name + ".md", import.meta.url);
export default { plugins: [{ name: "orchestration", setup(host) {
	host.commands.register({ name: "echo", doc: doc("echo"), run: ({ args, project }) => { console.log(JSON.stringify({ args, project })); return 3; } });
	host.commands.register({ name: "quiet", doc: doc("quiet"), run: () => {} });
	host.commands.register({ name: "boom", doc: doc("boom"), run: async () => { throw new Error("it broke"); } });
	host.commands.register({ name: "gone", doc: doc("gone"), run: () => {} });
	rmSync(doc("gone"));
} }] };
`;

function project(config: string = CONFIG): string {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "arthur.config.ts"), config);
	for (const name of ["echo", "quiet", "boom"]) writeFileSync(join(folder, `${name}.md`), `# arthur ${name}\n`);
	return folder;
}

function arthur(folder: string, ...args: string[]): { readonly status: number | null; readonly stdout: string; readonly stderr: string } {
	writeFileSync(join(folder, "gone.md"), "# arthur gone\n");
	return spawnSync(process.execPath, [CLI, ...args], { cwd: folder, encoding: "utf8", env: { PATH: process.env.PATH ?? "" } });
}

const ALL = "commands: boom, config, echo, gone, help, quiet, ticket\n";

test("a plugin's command runs with its arguments and exits with its code; --project goes to the command, not its arguments", () => {
	const folder = project();
	const run = arthur(folder, "echo", "a b", "--project", "acme", "-x", "");
	assert.deepEqual([run.status, run.stdout, run.stderr], [3, `${JSON.stringify({ args: ["a b", "-x", ""], project: "acme" })}\n`, ""]);
	const before = arthur(folder, "--project", "acme", "echo");
	assert.deepEqual([before.status, before.stdout], [3, `${JSON.stringify({ args: [], project: "acme" })}\n`]);
	assert.equal(arthur(folder, "echo").stdout, `${JSON.stringify({ args: [] })}\n`);
	assert.deepEqual([arthur(folder, "quiet").status, arthur(folder, "quiet").stdout], [0, ""]);
});

test("--help and arthur help print a command's doc file, the core's and a plugin's", () => {
	const folder = project();
	for (const args of [["echo", "--help"], ["help", "echo"], ["echo", "x", "--help", "--project", "acme"]])
		assert.deepEqual([arthur(folder, ...args).status, arthur(folder, ...args).stdout], [0, "# arthur echo\n"], args.join(" "));
	assert.match(arthur(folder, "help", "help").stdout, /^# arthur help\n/);
	assert.match(arthur(folder, "config", "--help").stdout, /^# arthur config check\n/);
});

test("arthur help, arthur --help and arthur alone list every command", () => {
	const folder = project();
	for (const args of [["help"], ["--help"], []]) {
		const run = arthur(folder, ...args);
		assert.deepEqual([run.status, run.stdout.split("\n")[1], run.stderr], [0, ALL.trim(), ""], args.join(" "));
	}
	assert.equal(arthur(folder, "help", "echo", "boom").status, 2);
});

test("an unknown command prints the list; a name differing only in case is unknown", () => {
	const folder = project();
	for (const args of [["nothing"], ["Echo"], ["ECHO", "--help"], ["help", "Echo"]]) {
		const run = arthur(folder, ...args);
		const name = args.at(-1) === "--help" ? args[0] : args.at(-1);
		assert.deepEqual([run.status, run.stdout, run.stderr], [2, "", `arthur: unknown command ${name}\n${ALL}`], args.join(" "));
	}
});

test("--help on a command whose doc file was deleted after load says so", () => {
	const folder = project();
	const run = arthur(folder, "gone", "--help");
	assert.deepEqual([run.status, run.stdout, run.stderr], [1, "", `arthur gone: its doc file ${join(folder, "gone.md")} was deleted after Arthur loaded\n`]);
	assert.equal(arthur(folder, "help", "gone").status, 1);
	assert.equal(arthur(folder, "gone").status, 0);
});

test("a command that throws prints its message, not a stack, and exits 1", () => {
	const run = arthur(project(), "boom");
	assert.deepEqual([run.status, run.stdout, run.stderr], [1, "", "arthur boom: it broke\n"]);
});

test("--project without a name, or twice, is wrong usage", () => {
	const folder = project();
	for (const [args, problem] of [
		[["echo", "--project"], "--project needs a project name"],
		[["echo", "--project", "--help"], "--project needs a project name"],
		[["--project", "a", "echo", "--project", "b"], "--project given twice: a, b"],
	] as const) {
		const run = arthur(folder, ...args);
		assert.deepEqual([run.status, run.stdout, run.stderr.split("\n")[0]], [2, "", `arthur: ${problem}`], args.join(" "));
	}
});

test("when the config does not load, the core's commands still run and a list of commands says why the others are missing", () => {
	const folder = project(CONFIG.replace('"orchestration"', '"schedule"'));
	const check = arthur(folder, "config", "check");
	assert.deepEqual([check.status, check.stderr], [0, ""]);
	const why = `only the core's commands are listed: arthur.config.ts did not load:\n${join(folder, "arthur.config.ts")}: plugins: orchestration is required and missing; add orchestration({ ... })\n`;
	const unknown = arthur(folder, "echo");
	assert.deepEqual([unknown.status, unknown.stderr], [2, `arthur: unknown command echo\n${CORE_LIST}${why}`]);
	const help = arthur(folder, "help");
	assert.deepEqual([help.status, help.stdout.split("\n")[1], help.stderr], [0, CORE_LIST.trim(), why]);
	const none = arthur(temporaryFolder(), "echo");
	assert.match(none.stderr, /did not load:\nconfig file not found: .*arthur\.config\.ts\n$/);
});

test("a plugin registering a core command's name refuses the load, and the list says so", () => {
	const folder = project(CONFIG.replace('name: "quiet"', 'name: "config"'));
	const run = arthur(folder, "help");
	assert.match(run.stderr, /plugin orchestration: setup failed: command config: registered by core and by orchestration/);
});

// One project in the config's folder, provided by the required plugin as the projects plugin will.
const BOARD = `export default { plugins: [{ name: "orchestration", setup(host) {
	host.provide("projects", () => [{ name: "demo", path: import.meta.dirname, prefix: "DM" }]);
} }] };
`;

test("arthur ticket creates, moves and lists tickets on the project's board, and logs each change as the core's event", () => {
	const folder = project(BOARD);
	const path = "spec/features/DM0001-board-from-the-shell/ticket.md";
	const created = arthur(folder, "ticket", "new", "Board", "from the shell");
	assert.deepEqual([created.status, created.stdout, created.stderr], [0, `DM0001 ${path}\n`, ""]);
	assert.match(readFileSync(join(folder, path), "utf8"), /^# DM0001 - Board from the shell\n/);
	const refused = arthur(folder, "ticket", "status", "DM0001", "planned");
	assert.deepEqual([refused.status, refused.stderr.split("\n")[0]], [1, `arthur ticket: DM0001: not planned: ${path} still holds the template's guidance, replace it first:`]);
	const moved = arthur(folder, "ticket", "status", "DM0001", "dropped");
	assert.deepEqual([moved.status, moved.stdout], [0, "DM0001 dropped\n"]);
	assert.equal(arthur(folder, "ticket", "new", "Next").stdout.split(" ")[0], "DM0002");
	assert.deepEqual(arthur(folder, "ticket", "all").stdout, "DM0001 dropped     Board from the shell\nDM0002 planning    Next\n");
	const log = readFileSync(join(folder, ".arthur", "events.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
	assert.deepEqual(
		log.map(({ plugin, name, data }) => [plugin, name, data.id]),
		[["core", "ticket-created", "DM0001"], ["core", "ticket-moved", "DM0001"], ["core", "ticket-created", "DM0002"]],
	);
	assert.equal(arthur(folder, "ticket", "all", "--project", "shop").stderr, "arthur ticket: unknown project shop; projects: demo\n");
});

test("arthur ticket: an empty board, wrong usage, and a config that does not load", () => {
	const folder = project(BOARD);
	assert.deepEqual([arthur(folder, "ticket", "all").stdout, existsSync(join(folder, "spec"))], ["the board is empty\n", false]);
	for (const args of [[], ["new"], ["status", "DM0001"], ["all", "x"], ["move", "DM0001", "done"]]) {
		const run = arthur(folder, "ticket", ...args);
		assert.deepEqual([run.status, run.stderr], [2, "usage: arthur ticket new <title>; arthur ticket status <id> <status>; arthur ticket all\n"], args.join(" "));
	}
	const broken = project(BOARD.replace('"orchestration"', '"schedule"'));
	const run = arthur(broken, "ticket", "new", "Lost");
	assert.deepEqual([run.status, run.stderr.split("\n")[0]], [1, "arthur ticket: the board needs the project list, and arthur.config.ts did not load:"]);
	assert.equal(existsSync(join(broken, "spec")), false);
	assert.match(arthur(folder, "ticket", "--help").stdout, /^# arthur ticket\n/);
});
