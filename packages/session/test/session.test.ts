import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { test } from "node:test";
import { temporaryFolder, until } from "@arthur/core/testing";
import { everyOption, type OptionTable } from "@arthur/core/option-table";
import { checkOptions } from "../src/session.ts";
import { DEFAULTS, table } from "../src/session-options.ts";
import { load } from "./session-setup.ts";

// The session plugin (session-setup.ts): when a compaction is asked for and dropped, its requests, its options.

test("compactOn left out compacts only at the slots: a turn's report of its context use is read and asks nothing", async (t) => {
	const box = await load(t, {}, "2026-10-18T07:59:00+02:00");
	await box.start();
	box.report("95");
	await box.consumed();
	assert.equal(box.request(), undefined);
	box.at("2026-10-18T08:00:00+02:00");
	await until("the slot's request", () => box.request() !== undefined);
	assert.equal(box.request()?.slot, "08:00");
});

test("compactOn context: a report at compactAtPercent or more asks for a compaction, one just below it nothing, and no compactAt slot asks", async (t) => {
	for (const [compactAtPercent, below, at] of [[80, "79.9", "80"], [1, "0.9", "1"], [99, "98.99", "99"]] as const) {
		const box = await load(t, { compactOn: "context", compactAtPercent, compactAt: ["13:00"], compactWaitSeconds: 60 }, "2026-10-18T12:59:00+02:00");
		// A report the last arthur run did not read is dropped at the start.
		box.report("100");
		await box.start();
		assert.equal(existsSync(join(box.fake.host.folder, "context-use")), false);
		box.at("2026-10-18T13:00:00+02:00");
		box.report(below);
		await box.consumed();
		assert.equal(box.request(), undefined, `${below} under ${compactAtPercent}, and 13:00 passed`);
		box.report(at);
		await until("the request", () => box.request() !== undefined);
		assert.deepEqual({ ...box.request(), asked: 0 }, { then: "compact", slot: `context ${at}%`, asked: 0, waitSeconds: 60 });
	}
});

test("compactOn both: a slot or a report asks, whichever comes first, and while one is asked for the other adds none", async (t) => {
	const box = await load(t, { compactOn: "both", compactAtPercent: 80, compactAt: ["13:00"], compactWaitSeconds: 600 }, "2026-10-18T12:59:00+02:00");
	await box.start();
	box.at("2026-10-18T13:00:00+02:00");
	await until("the slot's request", () => box.request() !== undefined);
	const slot = box.request();
	assert.equal(slot?.slot, "13:00");
	box.report("90");
	await box.consumed();
	assert.deepEqual(box.request(), slot, "a report while the slot's is asked for adds none");
	rmSync(box.file);
	box.report("90");
	await until("the report's request", () => box.request() !== undefined);
	const report = box.request();
	assert.equal(report?.slot, "context 90%");
	box.at("2026-10-19T13:00:00+02:00");
	box.report("10");
	await box.consumed();
	assert.deepEqual(box.request(), report, "the next day's slot while the report's is asked for adds none");
});

test("a repeated crossing asks once: no new request until a compaction is done or a report falls below compactAtPercent", async (t) => {
	const box = await load(t, { compactOn: "context", compactAtPercent: 80, compactWaitSeconds: 600 }, "2026-10-18T12:59:00+02:00");
	await box.start();
	const again = async (percent: string) => {
		box.report(percent);
		await box.consumed();
		return box.request()?.slot;
	};
	box.report("85");
	await until("the request", () => box.request() !== undefined);
	const first = box.request();
	assert.equal(await again("90"), "context 85%", "the same request");
	rmSync(box.file);
	assert.equal(await again("91"), undefined, "withdrawn without a compaction: not asked again");
	for (const line of ["compact: skipped, session busy for 600 s", "compact: failed: 500 from the model", "compact: done; the handoff is empty, so nothing is read back"]) {
		writeFileSync(box.file, JSON.stringify({ ...first, line }));
		await until("the outcome", () => box.out.at(-1) === `session: ${line}`);
		assert.equal(await again("92"), line.startsWith("compact: done") ? "context 92%" : undefined, line);
	}
	rmSync(box.file);
	assert.equal(await again("95"), undefined);
	assert.equal(await again("79"), undefined, "below: nothing asked, and asked again at the next crossing");
	assert.equal(await again("80"), "context 80%");
});

test("with no session running a slot does nothing: its request is dropped without a word after compactWaitSeconds", async (t) => {
	const box = await load(t, { compactAt: ["13:00"], compactWaitSeconds: 1 }, "2026-10-18T12:59:00+02:00");
	await box.start();
	box.at("2026-10-18T13:00:00+02:00");
	await until("the request", () => box.request() !== undefined);
	assert.deepEqual({ ...box.request(), asked: 0 }, { then: "compact", slot: "13:00", asked: 0, waitSeconds: 1 });
	await until("the request gone", () => box.request() === undefined);
	assert.deepEqual([box.out, box.err], [[], []]);
});

test("a slot missed while Arthur was down is skipped, not run late, and a request left by the last run is dropped", async (t) => {
	const box = await load(t, { compactAt: ["13:00"], compactWaitSeconds: 60 }, "2026-10-18T13:05:00+02:00");
	writeFileSync(box.file, JSON.stringify({ then: "compact", slot: "08:00", asked: Date.now(), waitSeconds: 60 }));
	await box.start();
	assert.equal(box.request(), undefined);
	await sleep(250);
	assert.equal(box.request(), undefined, "13:00 passed before the start");
	box.at("2026-10-19T12:59:00+02:00");
	await sleep(250);
	assert.equal(box.request(), undefined);
	box.at("2026-10-19T13:00:00+02:00");
	await until("the next day's request", () => box.request()?.slot === "13:00");
});

test("two slots close together never queue two compactions", async (t) => {
	const box = await load(t, { compactAt: ["13:00", "13:01", "13:02"], compactWaitSeconds: 600 }, "2026-10-18T12:00:00+02:00");
	await box.start();
	box.at("2026-10-18T13:00:00+02:00");
	await until("the request", () => box.request() !== undefined);
	const first = box.request();
	box.at("2026-10-18T13:01:00+02:00");
	await sleep(250);
	assert.deepEqual(box.request(), first, "13:01 while 13:00's still runs: no second");
	// The 13:00 compaction done; 13:01 was not kept for later, and 13:02 passing together with later times asks once.
	rmSync(box.file);
	await sleep(250);
	assert.equal(box.request(), undefined);
	box.at("2026-10-18T18:00:00+02:00");
	await until("one request", () => box.request() !== undefined);
	assert.equal(box.request()?.slot, "13:02");
	rmSync(box.file);
	await sleep(250);
	assert.equal(box.request(), undefined, "the next slot is tomorrow's 13:00");
});

test("daylight saving days: 02:30 in the spring gap comes at 03:00, and in the autumn repeat once", async (t) => {
	const spring = await load(t, { compactAt: ["02:30"], compactWaitSeconds: 600 }, "2026-03-29T00:00:00Z");
	await spring.start();
	spring.at("2026-03-29T00:59:00Z"); // 01:59 CET
	await sleep(250);
	assert.equal(spring.request(), undefined);
	spring.at("2026-03-29T01:00:00Z"); // 03:00 CEST, the first minute after the jump
	await until("the spring request", () => spring.request()?.slot === "02:30");
	const autumn = await load(t, { compactAt: ["02:30"], compactWaitSeconds: 600 }, "2026-10-25T00:00:00Z");
	await autumn.start();
	autumn.at("2026-10-25T00:30:00Z"); // 02:30 CEST, the first pass
	await until("the autumn request", () => autumn.request() !== undefined);
	rmSync(autumn.file);
	autumn.at("2026-10-25T01:30:00Z"); // 02:30 CET, the repeat
	await sleep(250);
	assert.equal(autumn.request(), undefined, "the repeat does not compact again");
	autumn.at("2026-10-26T01:30:00Z"); // the next day's 02:30 CET
	await until("the next day's request", () => autumn.request() !== undefined);
});

test("a request whose agent is gone, or a file that is not a request, is dropped", async (t) => {
	const box = await load(t, { compactAt: ["13:00"], compactWaitSeconds: 600 }, "2026-10-18T12:00:00+02:00");
	await box.start();
	const gone = spawnSync(process.execPath, ["-e", ""]).pid;
	writeFileSync(box.file, JSON.stringify({ then: "compact", slot: "13:00", asked: Date.now(), waitSeconds: 600, pid: gone }));
	await until("the request of a gone agent dropped", () => box.request() === undefined);
	assert.deepEqual([box.out, box.err], [[], []]);
	writeFileSync(box.file, "{ torn");
	await until("the torn file dropped", () => !existsSync(box.file));
	assert.deepEqual(box.err, [`session: ${box.file} is not a request, so it is dropped: { torn`]);
});

test("a file that is not a request, in a folder it cannot be removed from, is named once it is dropped, not at every tick", async (t) => {
	const box = await load(t, { compactAt: [] }, "2026-10-18T12:00:00+02:00");
	await box.start();
	// One that stays (its agent, this process, is alive) until the folder is read-only, then rewritten in place.
	writeFileSync(box.file, JSON.stringify({ then: "compact", slot: "13:00", asked: Date.now(), waitSeconds: 600, pid: process.pid }));
	chmodSync(dirname(box.file), 0o555);
	t.after(() => chmodSync(dirname(box.file), 0o755));
	writeFileSync(box.file, "{ torn");
	await until("the errors", () => box.err.length >= 2);
	await sleep(250);
	assert.deepEqual(box.err.map((line) => line.split(": EACCES")[0]), ["session: compaction failed", "session: restart failed"]);
	chmodSync(dirname(box.file), 0o755);
	await until("the file dropped", () => !existsSync(box.file));
	assert.deepEqual(box.err.slice(2), [`session: ${box.file} is not a request, so it is dropped: { torn`]);
});

test("in arthur run a tick that throws in an unwritable session folder is told once per error, the plugins go on, and the next tick works", async (t) => {
	const [folder, cli, plugin] = [temporaryFolder(), fileURLToPath(import.meta.resolve("@arthur/core/cli")), fileURLToPath(new URL("../src/session.ts", import.meta.url))];
	const [beats, sessionFolder] = [join(folder, "beats.txt"), join(folder, ".arthur", "session")];
	// No slot and no fresh start within the test: freshAt two hours ago is next tried in about 22 hours.
	const freshAt = new Date(Date.now() - 2 * 3600_000).toISOString().slice(11, 16);
	const beat = `{ name: "beat", setup() {}, start() { timer = setInterval(() => appendFileSync(${JSON.stringify(beats)}, "beat\\n"), 20); }, stop() { clearInterval(timer); } }`;
	const options = JSON.stringify({ compactAt: [], freshAt, restartGuard: false, probeLlm: false });
	writeFileSync(
		join(folder, "arthur.config.ts"),
		`import { appendFileSync } from "node:fs";\nimport { session } from ${JSON.stringify(plugin)};\nlet timer;\nexport default { core: { timeZone: "UTC" }, plugins: [{ name: "orchestration", setup() {} }, session(${options}, 100), ${beat}] };\n`,
	);
	const run = spawn(process.execPath, [cli, "run"], { cwd: folder, env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME } });
	const [out, err] = [[] as string[], [] as string[]];
	run.stdout.on("data", (chunk) => void out.push(String(chunk)));
	run.stderr.on("data", (chunk) => void err.push(String(chunk)));
	const [mark, request, failed, staged] = [join(sessionFolder, "restarted.json"), join(sessionFolder, "request.json"), join(sessionFolder, "turn-failed"), join(sessionFolder, "staged")];
	t.after(() => {
		for (const path of [sessionFolder, failed, mark]) if (existsSync(path)) chmodSync(path, 0o755);
		run.kill("SIGKILL");
	});
	const count = () => (existsSync(beats) ? readFileSync(beats, "utf8").split("\n").length - 1 : 0);
	await until("the start", () => out.join("").includes("started"));
	// Each tick throws: the restart's mark cannot be read, the compaction's outcome and the turn failure cannot be removed.
	writeFileSync(mark, "not a mark");
	chmodSync(mark, 0o000);
	writeFileSync(request, JSON.stringify({ then: "compact", slot: "13:00", asked: Date.now(), waitSeconds: 60, pid: process.pid }));
	const turn = join(failed, `${Date.now()}-1-1.txt`);
	mkdirSync(staged);
	writeFileSync(join(staged, basename(turn)), "529 overloaded");
	chmodSync(staged, 0o555);
	renameSync(staged, failed);
	chmodSync(sessionFolder, 0o555);
	writeFileSync(request, JSON.stringify({ then: "compact", slot: "13:00", asked: Date.now(), waitSeconds: 60, line: "compact: done; the handoff is empty, so nothing is read back" }));
	const told = () => err.join("").split("\n").filter((line) => line.startsWith("session: "));
	await until("each tick's error", () => told().length >= 3 || run.exitCode !== null);
	// Five ticks of 100 ms more, counted on the event loop the session's ticks run on; then each error is still told once.
	const after = count();
	await until("five more ticks", () => count() >= after + 25 || run.exitCode !== null);
	assert.equal(run.exitCode, null, err.join(""));
	const expected = [["compaction", request], ["restart", mark], ["turn notice", turn]] as const;
	assert.equal(told().length, 3, told().join("\n"));
	for (const [what, path] of expected) assert.ok(told().some((line) => line.startsWith(`session: ${what} failed: EACCES`) && line.includes(path)), `${what}: ${told().join("\n")}`);
	chmodSync(sessionFolder, 0o755);
	chmodSync(failed, 0o755);
	chmodSync(mark, 0o644);
	await until("the next ticks done", () => !existsSync(request) && !existsSync(mark) && readdirSync(failed).length === 0);
	assert.equal(out.join("").split("session: compact: done; the handoff is empty, so nothing is read back\n").length, 2, out.join(""));
	run.kill("SIGTERM");
	const [code] = await once(run, "exit");
	assert.equal(code, 0);
});

test("the options: compactAt times, compactOn, compactAtPercent, compactWaitSeconds, the fresh start's, restartGuard and probeLlm, each refused naming its path, and no unknown option", () => {
	assert.deepEqual(checkOptions({}), []);
	for (const compactOn of ["schedule", "context", "both"]) assert.deepEqual(checkOptions({ compactOn, compactAtPercent: 1 }), []);
	assert.deepEqual(checkOptions({ compactAtPercent: 99 }), []);
	for (const value of ["hourly", true, null, "Context"]) assert.deepEqual(checkOptions({ compactOn: value }), [{ path: "compactOn", problem: `expected "schedule", "context" or "both", got ${JSON.stringify(value)}` }]);
	for (const value of [0, 100, 50.5, "80", -1, null])
		assert.deepEqual(checkOptions({ compactAtPercent: value }), [{ path: "compactAtPercent", problem: `expected a whole number from 1 to 99, got ${JSON.stringify(value)}` }]);
	assert.deepEqual(checkOptions({ compactAt: [], compactWaitSeconds: 1, freshAt: "00:00", freshRetryMinutes: 1, freshUntil: "00:00", restartGuard: false, probeLlm: false }), []);
	assert.deepEqual(checkOptions({ compactAt: ["08:00", "23:59", "00:00"], compactWaitSeconds: 1800, freshAt: "23:00", freshRetryMinutes: 15, freshUntil: "03:00", restartGuard: true, probeLlm: true }), []);
	assert.deepEqual(checkOptions({ compactAt: "13:00", compactWaitSeconds: 0, probeSeconds: 60 }), [
		{ path: "probeSeconds", problem: "unknown option; options: compactAt, compactOn, compactAtPercent, compactWaitSeconds, freshAt, freshRetryMinutes, freshUntil, restartGuard, probeLlm" },
		{ path: "compactAt", problem: 'expected a list of times "HH:MM", got "13:00"' },
		{ path: "compactWaitSeconds", problem: "expected a whole number of seconds of at least 1, got 0" },
	]);
	for (const value of ["false", 0, null]) {
		assert.deepEqual(checkOptions({ restartGuard: value }), [{ path: "restartGuard", problem: `expected true or false, got ${JSON.stringify(value)}` }]);
		assert.deepEqual(checkOptions({ probeLlm: value }), [{ path: "probeLlm", problem: `expected true or false, got ${JSON.stringify(value)}` }]);
	}
	for (const [freshUntil, freshRetryMinutes] of [["3:00", 0], ["24:00", -15], [300, 1.5], [undefined, "15"]] as const)
		assert.deepEqual(checkOptions({ freshAt: "23:00", freshUntil, freshRetryMinutes }), [
			...(freshUntil === undefined ? [] : [{ path: "freshUntil", problem: `expected a time "HH:MM" from 00:00 to 23:59, got ${JSON.stringify(freshUntil)}` }]),
			{ path: "freshRetryMinutes", problem: `expected a whole number of minutes of at least 1, got ${JSON.stringify(freshRetryMinutes)}` },
		]);
	assert.deepEqual(checkOptions({ freshAt: "11pm" }), [{ path: "freshAt", problem: 'expected a time "HH:MM" from 00:00 to 23:59, got "11pm"' }]);
	assert.deepEqual(checkOptions({ compactAt: ["8:00", "24:00", 13, "13:00"], compactWaitSeconds: 1.5 }), [
		{ path: "compactAt[0]", problem: 'expected a time "HH:MM" from 00:00 to 23:59, got "8:00"' },
		{ path: "compactAt[1]", problem: 'expected a time "HH:MM" from 00:00 to 23:59, got "24:00"' },
		{ path: "compactAt[2]", problem: 'expected a time "HH:MM" from 00:00 to 23:59, got 13' },
		{ path: "compactWaitSeconds", problem: "expected a whole number of seconds of at least 1, got 1.5" },
	]);
});

test("arthur.config.example.ts gives session every option of its table, each one it accepts", () => {
	const example = readFileSync(new URL("../../../arthur.config.example.ts", import.meta.url), "utf8");
	const call = /\n\t\tsession\((\{[\s\S]*?\n\t\t\})\),\n/.exec(example);
	assert.ok(call, "the example calls session({ ... })");
	const options = Function(`return (${call[1]});`)() as Record<string, unknown>;
	assert.deepEqual(checkOptions(options), []);
	assert.deepEqual(Object.keys(options), Object.keys(table));
});

// Each default `table` writes as a value, by its path, parsed as JSON when it parses; `words` are the paths of those written as
// words for a person, left out.
function valueDefaults(table: OptionTable, words: readonly string[]): Record<string, unknown> {
	const value = (text: string): unknown => {
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	};
	return Object.fromEntries(everyOption(table).flatMap(({ path, entry }) => (entry.default === undefined || words.includes(path) ? [] : [[path, value(entry.default)]])));
}

test("each default the option table writes as a value is the one the code applies with nothing set", () => {
	assert.deepEqual(valueDefaults(table, []), DEFAULTS);
});
