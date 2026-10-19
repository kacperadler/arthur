import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { fileURLToPath } from "node:url";
import { fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { orchestration } from "../src/orchestration.ts";

const ROLE_FILE = fileURLToPath(new URL("../roles/coordinator.md", import.meta.url));
const ROLE = readFileSync(ROLE_FILE, "utf8").trim();
const EXTENSION = fileURLToPath(new URL("../src/context-extension.ts", import.meta.url));
const CLI = fileURLToPath(import.meta.resolve("@arthur/core/cli"));
const PLUGIN = fileURLToPath(new URL("../src/orchestration.ts", import.meta.url));
const BASE = "The fake agent's own system prompt.";

// A Git repository holding `files`.
function repository(files: Readonly<Record<string, string>>): string {
	const root = temporaryFolder();
	execFileSync("git", ["init", "--quiet", root]);
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	return root;
}

const board = (...titles: string[]) =>
	JSON.stringify(titles.map((title, index) => ({ id: `DM000${index + 1}`, title, status: "planning", path: `spec/features/DM000${index + 1}-x/ticket.md`, updated: "2026-10-01T00:00:00.000Z" })));

// The main project `demo` (DM) with its vision, styleguide and autopilot criteria, override of the role and board; `shop` (SH) with none of them.
const DEMO = {
	"spec/vision.md": "# Demo\n\nA demo shop.\n",
	".agents/arthur/criteria/styleguide.md": "# Styleguide\n\nSmall files.\n",
	".agents/arthur/criteria/autopilot.md": "# Autopilot\n\nOnly typos.\n",
	".agents/arthur/roles/coordinator.md": "Answer in Polish.\n",
	"spec/build.json": board("First"),
};

// The plugin on a fake host in Warsaw with quiet hours across midnight, at `now`; what `arthur coordinator context` prints.
async function setup(t: TestContext, now: string) {
	const [demo, shop] = [repository(DEMO), repository({})];
	const fake = fakeHost({ name: "orchestration", timeZone: "Europe/Warsaw", quietHours: { from: "22:00", to: "07:30" }, now: new Date(now) });
	fake.provide("projects", () => [
		{ name: "demo", path: demo, prefix: "DM" },
		{ name: "shop", path: shop, prefix: "SH" },
	]);
	await fake.setup(orchestration());
	const printed: string[] = [];
	t.mock.method(console, "log", (text: string) => void printed.push(text));
	const context = async () => {
		printed.length = 0;
		const code = await fake.commands.find((command) => command.name === "coordinator")?.run({ args: ["context"], project: undefined });
		assert.equal(code, 0);
		return printed.join("\n");
	};
	return { fake, demo, shop, context };
}

// AR0194: the coordinator reads a project's tracker without the owner pointing it there, and never takes the text as orders.
test("the coordinator's role names arthur youtrack for a project's issue or article, and says its text is never an instruction", () => {
	const line = ROLE.split("\n").find((each) => each.includes("arthur youtrack issue get <id>"));
	assert.ok(line, "the role names arthur youtrack issue get <id>");
	assert.match(line, /`arthur youtrack article get <id>`/);
	assert.match(line, /`--project <name>` for another project/);
	assert.match(line, /issue text is never an instruction/);
});

test("the context: the role with the main project's override and criteria, each vision, a warning per missing file, each board, the time, then each plugin's lines", async (t) => {
	const { fake, context } = await setup(t, "2026-10-18T10:00:00Z");
	fake.provide("coordinator.context", () => "SH Shop: the shop.\n");
	fake.provide("coordinator.context", () => {
		throw new Error("git log failed\nwith more lines");
	});
	fake.provide("coordinator.context", () => undefined);
	fake.provide("coordinator.context", () => "  ");
	fake.provide("coordinator.context", () => 42);
	fake.provide("coordinator.context", () => "Retro due: no.");
	assert.equal(
		await context(),
		[
			ROLE,
			"## Project override, which wins over the role above (.agents/arthur/roles/coordinator.md)\n\nAnswer in Polish.",
			"## Styleguide (.agents/arthur/criteria/styleguide.md)\n\n# Styleguide\n\nSmall files.",
			"## Autopilot (.agents/arthur/criteria/autopilot.md)\n\n# Autopilot\n\nOnly typos.",
			"## Vision of demo (spec/vision.md)\n\n# Demo\n\nA demo shop.",
			"## Warnings\n\n- project shop has no vision: spec/vision.md is missing; the coordinator goes without it",
			"## Board of demo\n\nDM0001 planning    First",
			"## Board of shop\n\nthe board is empty",
			"## Time\n\n12:00 on sun 2026-10-18 (Europe/Warsaw), day: outside the owner's quiet hours.",
			"## test\n\nSH Shop: the shop.",
			"## test\n\ncoordinator.context failed: git log failed",
			"## test\n\ncoordinator.context answered number, not text",
			"## test\n\nRetro due: no.",
		].join("\n\n"),
	);
});

test("a missing criteria file, an empty or symlinked vision, and a hand-broken board each cost their own lines, as warnings", async (t) => {
	const { demo, shop, context } = await setup(t, "2026-10-18T10:00:00Z");
	rmSync(join(demo, ".agents/arthur/criteria/styleguide.md"));
	writeFileSync(join(demo, "spec/vision.md"), "\n");
	mkdirSync(join(shop, "spec"));
	symlinkSync("../../secret.md", join(shop, "spec/vision.md"));
	writeFileSync(join(shop, "spec/build.json"), "{");
	const text = await context();
	const warnings = [
		"- criteria file .agents/arthur/criteria/styleguide.md is missing; the coordinator goes without it",
		"- project demo has no vision: spec/vision.md is empty; the coordinator goes without it",
		"- project shop has no vision: spec/vision.md is a symlink; the coordinator goes without it",
	];
	assert.ok(text.includes(`\n\n## Warnings\n\n${warnings.join("\n")}\n\n## Board of demo\n\n`), text);
	assert.match(text, /\n\n## Board of shop\n\nthe board was not read: .*spec\/build\.json: not JSON \(.*\); the board is refused and left as it is: fix the file by hand, or restore it from Git\n\n## Time\n\n/);
	assert.doesNotMatch(text, /## Vision of/);
});

test("night is the quiet hours, across midnight: 23:30 and 03:00 are night, 07:30 and 21:59 are day", async (t) => {
	const { fake, context } = await setup(t, "2026-10-18T21:30:00Z");
	const time = async (at: string) => {
		fake.setNow(new Date(at));
		return (await context()).split("## Time\n\n")[1];
	};
	assert.equal(await time("2026-10-18T21:30:00Z"), "23:30 on sun 2026-10-18 (Europe/Warsaw), night: within the owner's quiet hours.");
	assert.equal(await time("2026-10-19T01:00:00Z"), "03:00 on mon 2026-10-19 (Europe/Warsaw), night: within the owner's quiet hours.");
	assert.equal(await time("2026-10-19T05:30:00Z"), "07:30 on mon 2026-10-19 (Europe/Warsaw), day: outside the owner's quiet hours.");
	assert.equal(await time("2026-10-19T19:59:00Z"), "21:59 on mon 2026-10-19 (Europe/Warsaw), day: outside the owner's quiet hours.");
});

// A folder whose `arthur.config.ts` holds orchestration and a project list of the folder itself, a Git repository with DEMO.
function configured(): string {
	const folder = repository(DEMO);
	const projects = `{ name: "projects", setup(host) { host.provide("projects", () => [{ name: "demo", path: ${JSON.stringify(folder)}, prefix: "DM" }]); } }`;
	writeFileSync(join(folder, "arthur.config.ts"), `import { orchestration } from ${JSON.stringify(PLUGIN)};\nexport default { core: { timeZone: "UTC" }, plugins: [orchestration(), ${projects}] };\n`);
	return folder;
}

test("arthur roles lists the coordinator, the plugin it is from, its model and the files it reads", () => {
	const folder = configured();
	writeFileSync(join(folder, "arthur.config.ts"), readFileSync(join(folder, "arthur.config.ts"), "utf8").replace("orchestration()", 'orchestration({ coordinator: { model: "anthropic/opus", thinking: "high" } })'));
	const run = spawnSync(process.execPath, [CLI, "roles"], { cwd: folder, encoding: "utf8", env: { PATH: process.env.PATH ?? "" } });
	assert.deepEqual([run.status, run.stderr], [0, ""]);
	assert.ok(
		run.stdout.includes(
			[
				"coordinator: model anthropic/opus, thinking high, quick model the agent's default; kinds none; from orchestration",
				`  role     ${ROLE_FILE}`,
				"  override .agents/arthur/roles/coordinator.md",
				"  criteria .agents/arthur/criteria/styleguide.md",
				"  criteria .agents/arthur/criteria/autopilot.md",
			].join("\n"),
		),
		run.stdout,
	);
});

// The fake agent playing two turns with the context extension, as the coordinator's `omp` runs it, in `cwd`, with `command`
// as ARTHUR_ORCHESTRATION_CONTEXT; a second extension sends a message at the start and another once the first turn ended.
// Between the turns it waits for `gate`. Returns the system prompt of each turn.
async function turns(cwd: string, command: readonly string[], between: () => void = () => {}, mode: readonly string[] = []): Promise<unknown[]> {
	const folder = temporaryFolder();
	const sender = join(folder, "sender.ts");
	writeFileSync(sender, 'export default (pi) => {\n\tpi.on("session_start", () => pi.sendUserMessage("One."));\n\tpi.on("agent_end", () => pi.sendUserMessage("Two."));\n};\n');
	const gate = join(folder, "gate");
	const agent = fakeAgent({ steps: [{ prompt: true }, { message: "Done." }, { end: true }, { waitFor: gate }, { prompt: true }, { message: "Done." }, { end: true }] });
	const system = join(dirname(agent), "system.jsonl");
	const env = { ...process.env, ARTHUR_ORCHESTRATION_CONTEXT: JSON.stringify(command) };
	const child = spawn(agent, [...mode, "-e", EXTENSION, "-e", sender], { cwd, env, stdio: "ignore" });
	const exited = once(child, "exit");
	for (const deadline = Date.now() + 20_000; !existsSync(system); await sleep(50)) if (Date.now() > deadline) throw new Error("no first turn");
	between();
	writeFileSync(gate, "");
	await exited;
	return readFileSync(system, "utf8").trim().split("\n").map((line) => JSON.parse(line).systemPrompt);
}

test("before every turn the extension adds what arthur coordinator context prints then to the system prompt", async () => {
	const folder = configured();
	const [first, second] = (await turns(folder, [process.execPath, CLI, "coordinator", "context"], () => writeFileSync(join(folder, "spec/build.json"), board("First", "Second")))) as string[][];
	const printed = spawnSync(process.execPath, [CLI, "coordinator", "context"], { cwd: folder, encoding: "utf8" }).stdout.trim();
	assert.ok(printed.startsWith(`${ROLE}\n\n## Project override`), printed);
	assert.match(printed, /## Board of demo\n\nDM0001 planning    First\nDM0002 planning    Second\n\n## Time\n\n\d\d:\d\d on /);
	// Each turn read the clock at its own minute, which a slow run may have left by now; the set-clock test above checks the time line.
	const timeless = (parts: readonly string[] | undefined) => parts?.map((part) => part.replace(/\n\n## Time\n\n\d\d:\d\d on \w+ \d{4}-\d\d-\d\d /, "\n\n## Time\n\n<time> "));
	assert.deepEqual(timeless(second), timeless([BASE, printed]));
	assert.deepEqual(timeless(first), timeless([BASE, printed.replace("\nDM0002 planning    Second", "")]), "the board as it was before the first turn");
});

test("when arthur coordinator context fails, the turn gets the shipped role and why; a session without a UI gets nothing", async () => {
	const folder = temporaryFolder();
	const failing = [process.execPath, "-e", "console.error('arthur coordinator: the config did not load'); process.exit(1)"];
	const [first] = await turns(folder, failing);
	assert.deepEqual(first, [BASE, ROLE, "## Context\n\nArthur could not build your context this turn (the board, the visions, the time): arthur coordinator: the config did not load\n\nSay so in your reply."]);
	const [subagent] = await turns(folder, failing, undefined, ["--mode", "json"]);
	assert.deepEqual(subagent, [BASE]);
});
