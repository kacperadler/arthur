import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { type FakeHost, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { type ManageOptions, manage } from "../src/manage.ts";

// The manage plugin against the fake host: `arthur health`, `/health` and the rounds under `arthur run`, over the project
// acme, a real repository whose board is committed, and the lines the test provides to `health` as another plugin would.

const START = new Date("2026-01-01T12:00:00Z");
const ALL_WELL = "All well: nothing that should have happened by now is missing.";
const STALLED = "AC0001 is in-progress with no job in a run for 4 h: Shop";
const TICKET = "spec/features/AC0001-shop/ticket.md";

async function until(what: string, predicate: () => boolean): Promise<void> {
	for (const end = Date.now() + 20_000; !predicate(); await sleep(20)) if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
}

// The repository acme with its board, ticket AC0001 in `status` since 08:00, all committed.
function repository(status = "done") {
	const root = join(temporaryFolder(), "acme");
	mkdirSync(join(root, "spec/features/AC0001-shop"), { recursive: true });
	writeFileSync(join(root, TICKET), "# AC0001 - Shop\n");
	writeFileSync(join(root, "spec/build.json"), JSON.stringify([{ id: "AC0001", title: "Shop", status, path: TICKET, updated: "2026-01-01T08:00:00Z" }]));
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", root, ...args]);
	git("init", "--quiet", "--initial-branch=main");
	git("add", "--all");
	git("commit", "--quiet", "-m", "board");
	return root;
}

// Manage set up on a fake host at START with `options`, acme its one project; stopped at the end. `run(...args)` runs
// `arthur health` as the CLI does, with what it printed.
async function load(t: TestContext, options: ManageOptions = {}, root = repository()) {
	const fake = fakeHost({ name: "manage", options, now: START });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	const plugin = manage(options);
	await fake.setup(plugin);
	t.after(() => plugin.stop?.());
	const command = fake.commands.find((each) => each.name === "health");
	const run = async (...args: string[]) => {
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => command?.run({ args, project: undefined })).finally(() => t.mock.restoreAll());
		return { code: code ?? 0, out: out.join("\n"), err: err.join("\n") };
	};
	return { fake, plugin, run, root };
}

const notices = (fake: FakeHost) =>
	fake.emitted.flatMap((event) => (event.name === "notice" && typeof event.data === "object" && event.data !== null && "text" in event.data ? [String(event.data.text)] : []));

test("nothing wrong prints one line saying so, in the shell and on a channel; any argument is wrong usage", async (t) => {
	const { fake, run } = await load(t);
	assert.deepEqual(await run(), { code: 0, out: ALL_WELL, err: "" });
	assert.equal(await fake.host.commands.route("/health"), ALL_WELL);
	assert.equal(await fake.host.commands.route("/health now"), "usage: /health");
	assert.deepEqual(await run("now"), { code: 2, out: "", err: "usage: arthur health" });
});

test("one line per problem, manage's own and each plugin's in setup order; a provider that throws costs its line only, named", async (t) => {
	const { fake, run } = await load(t, {}, repository("in-progress"));
	fake.provide("health", () => [" github: CI token missing ", "", 3]);
	fake.provide("health", () => {
		throw new Error("no repository\nat line 2");
	});
	fake.provide("health", () => "uptime: shop.example is down");
	assert.deepEqual(await run(), { code: 0, out: [STALLED, "github: CI token missing", "test: health failed: no repository", "uptime: shop.example is down"].join("\n"), err: "" });
});

test("one of manage's own checks that throws costs its line only; the rest are still checked", async (t) => {
	const root = repository("in-progress");
	const { run } = await load(t, {}, root);
	// The checkout's Git folder gone: the board cannot be read from Git, the board file still can.
	renameSync(join(root, ".git"), join(root, "git-gone"));
	const { out } = await run();
	assert.deepEqual(out.split("\n"), [STALLED, `manage: the board of acme could not be checked: git status failed in ${root}`]);
});

test("health.everyMinutes: each round sends only its new lines as one notice; a problem seen the round before is not sent again", async (t) => {
	let [lines, asked] = [["github: CI token missing"], 0];
	const { fake, plugin } = await load(t, { health: { everyMinutes: 1 } }, repository("in-progress"));
	fake.provide("health", () => (asked++, lines));
	await plugin.start?.();
	assert.deepEqual(notices(fake), [`Health:\n- ${STALLED}\n- github: CI token missing`], "the first round, at the start");
	const round = async (minutes: number) => {
		const before = asked;
		fake.setNow(new Date(START.getTime() + minutes * 60_000));
		await until(`the round at ${minutes} min`, () => asked > before);
	};
	await round(1);
	assert.equal(asked, 2, "one round a minute, not one a tick");
	await round(61);
	assert.equal(notices(fake).length, 1, "the same problems an hour older are not new");
	lines = ["github: CI token missing", "github: 3 runs failed"];
	await round(62);
	assert.deepEqual(notices(fake).slice(1), ["Health:\n- github: 3 runs failed"]);
	lines = ["github: 4 runs failed"];
	await round(63);
	assert.equal(notices(fake).length, 2, "a count that changed is the same problem");
	lines = ["github: CI token missing", "github: 4 runs failed"];
	await round(64);
	assert.deepEqual(notices(fake).slice(2), ["Health:\n- github: CI token missing"], "gone a round, then back: not twice in a row");
	assert.deepEqual(JSON.parse(readFileSync(join(fake.host.folder, "health.json"), "utf8")), { problems: [STALLED.replace("4 h", "# h"), "github: CI token missing", "github: # runs failed"] });
});

test("a restart sends no problem the last round before it saw; a file broken by hand is none seen", async (t) => {
	const root = repository("in-progress");
	const first = await load(t, { health: { everyMinutes: 30 } }, root);
	await first.plugin.start?.();
	first.plugin.stop?.();
	assert.deepEqual(notices(first.fake), [`Health:\n- ${STALLED}`]);
	const again = await load(t, { health: { everyMinutes: 30 } }, root);
	copyFileSync(join(first.fake.host.folder, "health.json"), join(again.fake.host.folder, "health.json"));
	again.fake.setNow(new Date(START.getTime() + 2 * 3_600_000));
	await again.plugin.start?.();
	again.plugin.stop?.();
	assert.deepEqual(notices(again.fake), [], "the same problem, 2 h older, after the restart");
	const broken = await load(t, { health: { everyMinutes: 30 } }, root);
	writeFileSync(join(broken.fake.host.folder, "health.json"), '{"problems": "AC#');
	await broken.plugin.start?.();
	assert.deepEqual(notices(broken.fake), [`Health:\n- ${STALLED}`]);
});

test("without health.everyMinutes no round runs: arthur run sends nothing and writes nothing", async (t) => {
	const { fake, plugin, run } = await load(t, {}, repository("in-progress"));
	await plugin.start?.();
	assert.deepEqual(notices(fake), []);
	assert.equal(existsSync(join(fake.host.folder, "health.json")), false);
	assert.equal((await run()).out, STALLED, "arthur health still answers");
	assert.equal(existsSync(join(fake.host.folder, "health.json")), false, "arthur health reads only");
});
