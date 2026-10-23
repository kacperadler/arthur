import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "../src/testing.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const CORE_LIST = "commands: config, continue, doctor, help, jobs, prune, remote-job, roles, run, send, setup, spawn, steer, stop, stopall, ticket, version\n";

// A plugin's commands as a config holds them, with the projects `acme` and `shop` in the config's folder: `echo` prints what it
// got and exits 3, `boom` throws, `gone` loses its doc file right after it registered it, before any `--help`.
const CONFIG = `import { rmSync } from "node:fs";
const doc = (name) => new URL("./" + name + ".md", import.meta.url);
export default { plugins: [{ name: "orchestration", setup(host) {
	host.provide("projects", () => [{ name: "acme", path: import.meta.dirname, prefix: "AC" }, { name: "shop", path: import.meta.dirname, prefix: "SH" }]);
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

const ALL = "commands: boom, config, continue, doctor, echo, gone, help, jobs, prune, quiet, remote-job, roles, run, send, setup, spawn, steer, stop, stopall, ticket, version\n";

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

test("a --project name Arthur does not know is refused before the command runs, naming the known projects", () => {
	const folder = project();
	for (const [args, refusal] of [
		[["echo", "--project", "blog"], "arthur echo: unknown project blog"],
		[["--project", "Acme", "echo"], "arthur echo: unknown project Acme"],
		[["version", "--project", "blog"], "arthur version: unknown project blog"],
	] as const) {
		const run = arthur(folder, ...args);
		assert.deepEqual([run.status, run.stdout, run.stderr], [1, "", `${refusal}; projects: acme, shop\n`], args.join(" "));
	}
	assert.equal(arthur(folder, "echo", "--project", "shop").stdout, `${JSON.stringify({ args: [], project: "shop" })}\n`);
	const unlisted = project(CONFIG.replace(/\thost\.provide\("projects".*\n/, ""));
	const outside = arthur(unlisted, "echo", "--project", "acme");
	assert.deepEqual([outside.status, outside.stdout, outside.stderr], [1, "", `arthur echo: unknown project acme; no plugin provides the project list and ${unlisted} is not in a Git repository\n`]);
	assert.equal(arthur(unlisted, "echo").status, 3);
	spawnSync("git", ["init", "-q", unlisted]);
	const repository = basename(unlisted);
	const other = arthur(unlisted, "echo", "--project", "acme");
	assert.deepEqual([other.status, other.stdout, other.stderr], [1, "", `arthur echo: unknown project acme; the only project is ${repository}\n`]);
	assert.equal(arthur(unlisted, "echo", "--project", repository).status, 3);
});

test("when the config does not load, the core's commands still run and a list of commands says why the others are missing", () => {
	const folder = project(CONFIG.replace('"orchestration"', '"schedule"'));
	const check = arthur(folder, "config", "check");
	const refusal = `${join(folder, "arthur.config.ts")}: plugins: orchestration is required and missing; add orchestration({ ... })`;
	assert.deepEqual([check.status, check.stdout, check.stderr], [1, `${refusal}\nno enabled plugin names an env variable\n`, ""]);
	const why = `only the core's commands are listed: arthur.config.ts did not load:\n${refusal}\n`;
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

// One project in the config's folder, provided by the required plugin as the projects plugin will, and `board`, which prints
// the whole board through `host.board` as the orchestration plugin's `arthur board all` does.
const BOARD = `export default { plugins: [{ name: "orchestration", setup(host) {
	host.provide("projects", () => [{ name: "demo", path: import.meta.dirname, prefix: "DM" }]);
	host.commands.register({ name: "board", doc: new URL("./quiet.md", import.meta.url), run: () => console.log(host.board.full()) });
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
	assert.deepEqual(arthur(folder, "board", "all").stdout, "DM0002 planning    -        Next\nDM0001 dropped     -        Board from the shell\n");
	const log = readFileSync(join(folder, ".arthur", "events.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
	assert.deepEqual(
		log.map(({ plugin, name, data }) => [plugin, name, data.id]),
		[["core", "ticket-created", "DM0001"], ["core", "ticket-moved", "DM0001"], ["core", "ticket-created", "DM0002"]],
	);
	assert.equal(arthur(folder, "ticket", "new", "Elsewhere", "--project", "shop").stderr, "arthur ticket: unknown project shop; projects: demo\n");
});

test("arthur ticket: an empty board, wrong usage, and a config that does not load", () => {
	const folder = project(BOARD);
	assert.deepEqual([arthur(folder, "board", "all").stdout, existsSync(join(folder, "spec"))], ["the board is empty\n", false]);
	for (const args of [[], ["new"], ["status", "DM0001"], ["all"], ["move", "DM0001", "done"], ["after"], ["file"], ["file", "DM0001", "a", "b"]]) {
		const run = arthur(folder, "ticket", ...args);
		assert.deepEqual([run.status, run.stderr], [2, "usage: arthur ticket new <title>; arthur ticket status <id> <status>; arthur ticket status <id> planned --autopilot [--budget <usd>]; arthur ticket after <id> [<id>...]; arthur ticket file [<id>] <job>\n"], args.join(" "));
	}
	const unknown = arthur(folder, "ticket", "file", "DM0001", "2026-01-01-plan-0000beef");
	assert.deepEqual([unknown.status, unknown.stderr], [1, "arthur ticket: DM0001 is not on the board\n"], "file reads the board, then the job");
	const alone = arthur(folder, "ticket", "file", "0000beef");
	assert.deepEqual([alone.status, alone.stderr], [1, `arthur ticket: 0000beef: no such job in ${join(folder, ".arthur", "jobs")}\n`], "one word is the job, of no ticket");
	const broken = project(BOARD.replace('"orchestration"', '"schedule"'));
	const run = arthur(broken, "ticket", "new", "Lost");
	assert.deepEqual([run.status, run.stderr.split("\n")[0]], [1, "arthur ticket: the board needs the project list, and arthur.config.ts did not load:"]);
	assert.equal(existsSync(join(broken, "spec")), false);
	assert.match(arthur(folder, "ticket", "--help").stdout, /^# arthur ticket\n/);
});

test("arthur ticket with an empty word, in new, status or after, is refused with exit 2; the board is left as it was", () => {
	const folder = project(BOARD);
	for (const title of ["One", "Two"]) arthur(folder, "ticket", "new", title);
	const before = arthur(folder, "board", "all").stdout;
	for (const args of [["status", "", "planned"], ["status", "DM0001", ""], ["new", ""], ["new", "Three", ""], ["after", "", "DM0001"], ["after", "DM0002", ""], ["after", "DM0002", "DM0001", ""], ["file", "DM0001", ""], ["file", "", "x"]]) {
		const run = arthur(folder, "ticket", ...args);
		assert.deepEqual([run.status, run.stderr], [2, "usage: arthur ticket new <title>; arthur ticket status <id> <status>; arthur ticket status <id> planned --autopilot [--budget <usd>]; arthur ticket after <id> [<id>...]; arthur ticket file [<id>] <job>\n"], args.join(" "));
	}
	assert.equal(arthur(folder, "board", "all").stdout, before);
});

test("arthur ticket after: the board shows what a ticket waits for until it waits for nothing", () => {
	const folder = project(BOARD);
	for (const title of ["One", "Two"]) arthur(folder, "ticket", "new", title);
	assert.deepEqual(arthur(folder, "ticket", "after", "DM0002", "DM0001").stdout, "DM0002 after DM0001\n");
	const cycle = arthur(folder, "ticket", "after", "DM0001", "DM0002");
	assert.deepEqual([cycle.status, cycle.stderr], [1, "arthur ticket: DM0001 cannot wait for itself: DM0001 after DM0002 after DM0001\n"]);
	assert.deepEqual(arthur(folder, "board").stdout, "DM0001 planning    -        One\nDM0002 planning    -        Two  after DM0001\n");
	assert.deepEqual(arthur(folder, "ticket", "after", "DM0002").stdout, "DM0002 after nothing\n");
});

test("arthur ticket status <id> planned --autopilot asks ticket.autopilot with the id and --budget, prints its line, and exits 1 on its refusal", () => {
	const folder = project(`export default { plugins: [{ name: "orchestration", setup(host) {
	host.provide("projects", () => [{ name: "demo", path: import.meta.dirname, prefix: "DM" }]);
	host.provide("ticket.autopilot", async (request) => {
		if (request.id === "DM0009") throw new Error("DM0009: not pre-approved: its kind is feature");
		return "asked " + JSON.stringify(request);
	});
} }] };
`);
	const run = (...args: string[]) => {
		const done = arthur(folder, "ticket", "status", ...args);
		return [done.status, done.stdout, done.stderr];
	};
	assert.deepEqual(run("DM0001", "planned", "--autopilot"), [0, 'asked {"id":"DM0001"}\n', ""]);
	assert.deepEqual(run("DM0001", "--autopilot", "planned", "--budget", "2.5"), [0, 'asked {"id":"DM0001","budgetUsd":2.5}\n', ""]);
	assert.deepEqual(run("DM0001", "planned", "--autopilot", "--budget", "0"), [0, 'asked {"id":"DM0001","budgetUsd":0}\n', ""], "budget 0 is the plugin's to refuse");
	assert.deepEqual(run("DM0009", "planned", "--autopilot"), [1, "", "arthur ticket: DM0009: not pre-approved: its kind is feature\n"]);
	const usage =
		"usage: arthur ticket new <title>; arthur ticket status <id> <status>; arthur ticket status <id> planned --autopilot [--budget <usd>]; arthur ticket after <id> [<id>...]; arthur ticket file [<id>] <job>\n";
	for (const [args, problem] of [
		[["DM0001", "dropped", "--autopilot"], "--autopilot sets one ticket planned"],
		[["DM0001", "--autopilot"], "--autopilot sets one ticket planned"],
		[["DM0001", "DM0002", "planned", "--autopilot"], "--autopilot sets one ticket planned"],
		[["DM0001", "planned", "--autopilot", "--budget"], "--budget needs a value"],
		[["DM0001", "planned", "--autopilot", "--budget", "-1"], "--budget needs a number of 0 or more, got -1"],
		[["DM0001", "planned", "--autopilot", "--budget", "x"], "--budget needs a number of 0 or more, got x"],
		[["DM0001", "planned", "--autopilot", "--budget", "1", "--budget", "2"], "--budget given twice"],
		[["DM0001", "planned", "--autopilot", "--model", "x"], "unknown flag --model"],
	] as const)
		assert.deepEqual(run(...args), [2, "", `arthur ticket: ${problem}\n${usage}`], args.join(" "));
	// --budget without --autopilot is no move's flag.
	assert.deepEqual(run("DM0001", "planned", "--budget", "1"), [2, "", usage]);
});

// Two channels as plugins provide `channel.send`: each checks the message and answers its send, which writes what it sent in
// `<channel>.json` beside the config; `phone` refuses a file whose name ends in `bad`, `pager` fails the send of one ending in `down`.
const CHANNELS = `import { writeFileSync } from "node:fs";
const channel = (name, refuse, fail) => ({ name, setup(host) {
	host.provide("channel.send", (message) => {
		if (message.files.some((file) => file.endsWith(refuse))) throw new Error("refused " + refuse + "\\nsecond line");
		return async () => {
			if (message.files.some((file) => file.endsWith(fail))) throw new Error("the send failed");
			writeFileSync(new URL("./" + name + ".json", import.meta.url), JSON.stringify(message));
			return "sent " + message.files.length;
		};
	});
} });
export default { plugins: [{ name: "orchestration", setup() {} }, channel("phone", "bad", "never"), channel("pager", "never", "down")] };
`;

test("arthur send asks every channel and sends only once all took the message: files from the working folder, the caption and the place", () => {
	const folder = project(CHANNELS);
	const sent = (name: string) => (existsSync(join(folder, `${name}.json`)) ? JSON.parse(readFileSync(join(folder, `${name}.json`), "utf8")) : undefined);
	const run = arthur(folder, "send", "a.png", "/tmp/b.mp4", "--caption", "Screens.", "--place", "12");
	assert.deepEqual([run.status, run.stdout, run.stderr], [0, "phone: sent 2\npager: sent 2\n", ""]);
	for (const name of ["phone", "pager"]) assert.deepEqual(sent(name), { files: [join(folder, "a.png"), "/tmp/b.mp4"], caption: "Screens.", place: "12" }, name);
	const refused = arthur(folder, "send", "c.png", "d.bad");
	assert.deepEqual([refused.status, refused.stdout, refused.stderr], [1, "", "arthur send: nothing sent:\nphone: refused bad\nphone: second line\n"]);
	assert.deepEqual(sent("pager").files, [join(folder, "a.png"), "/tmp/b.mp4"], "no channel sent, the one that took it included");
	const failed = arthur(folder, "send", "e.down");
	assert.deepEqual([failed.status, failed.stdout, failed.stderr], [1, "phone: sent 1\n", "arthur send: pager: the send failed\n"]);
});

test("arthur send: no channel enabled says so; no file or a flag without its value is wrong usage", () => {
	const none = project(`export default { plugins: [{ name: "orchestration", setup() {} }] };\n`);
	const run = arthur(none, "send", "a.png");
	assert.deepEqual([run.status, run.stderr], [1, "arthur send: no channel is enabled: no plugin provides channel.send; enable one, such as telegram, in arthur.config.ts\n"]);
	const usage = "usage: arthur send <file>... [--caption <text>] [--place <id>]";
	for (const [args, problem] of [
		[[], "no file"],
		[["--caption", "Hi."], "no file"],
		[["a.png", "--caption"], "--caption needs a value"],
		[["a.png", "--place", "1", "--place", "2"], "--place given twice"],
		[["a.png", "--album"], "unknown flag --album"],
	] as const)
		assert.deepEqual([arthur(none, "send", ...args).status, arthur(none, "send", ...args).stderr], [2, `arthur send: ${problem}\n${usage}\n`], args.join(" "));
});

test("inside an eval session (ARTHUR_EVAL set) every command refuses, naming why, before it runs; set empty, it runs", () => {
	const folder = project();
	const stub = "/tmp/arthur-eval-x/bin/arthur";
	const inEval = (value: string, ...args: string[]) => {
		writeFileSync(join(folder, "gone.md"), "# arthur gone\n");
		return spawnSync(process.execPath, [CLI, ...args], { cwd: folder, encoding: "utf8", env: { PATH: process.env.PATH ?? "", ARTHUR_EVAL: value } });
	};
	for (const args of [["echo", "x"], ["boom"], ["help"], [], ["echo", "--help"], ["version"], ["ticket", "new", "A"], ["--project", "nope", "echo"]]) {
		const run = inEval(stub, ...args);
		assert.deepEqual([run.status, run.stdout, run.stderr], [1, "", `arthur: refused inside an eval session (ARTHUR_EVAL is set): arthur there is the eval's recording stub, ${stub}\n`], args.join(" "));
	}
	assert.equal(existsSync(join(folder, ".arthur")), false, "nothing was written in the home folder");
	assert.deepEqual([inEval("", "echo", "x").status, inEval("", "echo", "x").stdout], [3, `${JSON.stringify({ args: ["x"] })}\n`]);
});

test("inside a job (ARTHUR_JOB set) a command without inJob refuses before it runs and writes nothing; one with it, and --help, run; set empty, all run", () => {
	const folder = project(CONFIG.replace('name: "quiet", doc: doc("quiet")', 'name: "quiet", doc: doc("quiet"), inJob: true'));
	const record = "/home/arthur/.arthur/jobs/2026-10-23-worker-0a1b2c3d";
	const inJob = (value: string, ...args: string[]) => {
		writeFileSync(join(folder, "gone.md"), "# arthur gone\n");
		return spawnSync(process.execPath, [CLI, ...args], { cwd: folder, encoding: "utf8", env: { PATH: process.env.PATH ?? "", ARTHUR_JOB: value } });
	};
	assert.equal(arthur(folder, "quiet").status, 0, "the home folder as a live one has it");
	const home = () => readdirSync(join(folder, ".arthur"), { recursive: true, encoding: "utf8" }).sort().map((path) => (statSync(join(folder, ".arthur", path)).isFile() ? `${path}: ${readFileSync(join(folder, ".arthur", path), "utf8")}` : path));
	const before = home();
	for (const args of [["echo", "x"], ["boom"], ["--project", "acme", "echo"], ["ticket", "new", "A"], ["spawn", "Fix it."], ["send", "a.png"], ["stop", "x"], ["stopall"], ["steer", "x", "y"], ["continue", "x", "y"], ["prune", "--all"], ["run"], ["setup"], ["config", "check"], ["doctor"], ["remote-job", "stop", "/home/arthur/.arthur", "x"]]) {
		const run = inJob(record, ...args);
		const name = args[0] === "--project" ? args[2] : args[0] === "remote-job" ? "remote-job stop" : args[0];
		const refusal = `arthur ${name}: refused inside a job 2026-10-23-worker-0a1b2c3d: a job runs only the commands its role needs; put what the coordinator should do in your final message\n`;
		assert.deepEqual([run.status, run.stdout, run.stderr], [1, "", refusal], args.join(" "));
	}
	assert.deepEqual([home(), existsSync(join(folder, "spec"))], [before, false], "nothing was written in the home folder or the board");
	for (const [args, out] of [[["quiet"], ""], [["echo", "--help"], "# arthur echo\n"], [["help", "echo"], "# arthur echo\n"], [["version"], /^[0-9a-f]{12}\n$/], [["jobs"], "no jobs\n"], [["remote-job", "records", join(folder, ".arthur")], "{}\n"]] as const) {
		const run = inJob(`${record}/`, ...args);
		assert.deepEqual([run.status, run.stderr], [0, ""], args.join(" "));
		if (typeof out === "string") assert.equal(run.stdout, out, args.join(" "));
		else assert.match(run.stdout, out, args.join(" "));
	}
	assert.match(inJob(record, "help").stdout, /^usage: arthur /);
	assert.deepEqual([inJob("", "echo", "x").status, inJob("", "echo", "x").stdout], [3, `${JSON.stringify({ args: ["x"] })}\n`]);
});
