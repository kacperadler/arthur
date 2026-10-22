import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { develop } from "../src/develop.ts";
import { checkOptions } from "../src/develop-options.ts";

// `arthur eval` against the fake host, the scenarios in a package folder of the test's own, the main project's checkout a
// temporary folder, and `omp` a fake of the test's: a shell script that acts on the turn's text as an agent would, through the
// `arthur` its PATH finds (the eval's stub) and the real CLI by its path. It notes its arguments and environment in `spy`, and
// the hour `date` reads and its system prompt on stderr. Orchestration's `coordinator.turn` is faked too: it answers what it was
// asked, as JSON, and refuses a turn that says so; and its `coordinator.checkoutContext`, which answers what it was asked and
// the copy's README.

const CLI = fileURLToPath(import.meta.resolve("@arthur/core/cli"));
const quote = (text: string) => `'${text.replaceAll("'", `'\\''`)}'`;
// The turn the fake `coordinator.turn` answers for an owner's message on `channel`.
const said = (text: string, channel = "telegram") => JSON.stringify(["message-received", { channel, parts: [{ kind: "text", text, mime: "text/plain" }] }]);

function fakeOmp(spy: string): string {
	const bin = temporaryFolder();
	const script = `#!/bin/sh
previous=""
for last; do
	[ "$previous" = --append-system-prompt ] && cp "$last" ${quote(join(spy, "prompt"))} && prompt=$last
	previous=$last
done
turn=$(cat "\${last#@}")
printf '%s\\n' "$@" > ${quote(join(spy, "args"))}
env > ${quote(join(spy, "env"))}
{ date +%H && cat "$prompt"; } >&2
case "$turn" in
*hang*) echo $$ >> ${quote(join(spy, "hanging"))} && exec sleep 600 ;;
*fail*) exit 3 ;;
*help*)
	n=0
	said() { n=$((n + 1)); arthur "$@" > ${quote(spy)}/help-$n 2> ${quote(spy)}/help-$n.err; echo "exit $?" >> ${quote(spy)}/help-$n; }
	said eval --help
	said help eval
	said --project shop eval --help
	said help nosuch
	said help eval twice
	said nosuch eval
	said nosuch --help
	said constructor --help
	said --help
	said help
	said ;;
esac
arthur ticket new Fix the login > ticket.txt
arthur merge AR0001 > /dev/null
arthur send report.png 2> send.txt
${quote(process.execPath)} ${quote(CLI)} version > real.txt 2>&1
printf 'noted\\n' > notes.md
git add --all && git commit --quiet --message notes
echo '{"type":"tool_execution_start","toolCallId":"t1","toolName":"bash","args":{"command":"sleep 1"}}'
echo '{"type":"tool_execution_start","toolCallId":"t2","toolName":"read","args":{"path":"notes.md"}}'
printf '%s\\n' '{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"Noted.\\n\\nAR0002 is the ticket."}],"stopReason":"stop"}}'
echo '{"type":"message_end","message":{"role":"assistant","content":[],"stopReason":"stop"}}'
echo 'not json'
echo '{"type":"agent_end"}'
`;
	writeFileSync(join(bin, "omp"), script, { mode: 0o755 });
	return bin;
}

type Scenario = Readonly<Record<string, unknown>> & { readonly fixture?: false };

// The answers the scenarios' stub gives, and what a run of the fake agent on "Note it." leaves behind; its reply is the last
// assistant message with text, its tool calls a bash command and a read.
const STUB = [{ match: "^arthur ticket new ", output: "AR0002", files: { "spec/AR0002.md": "# Fix the login\n" } }];
const PASSES = {
	files: { "ticket.txt": ["^AR0002$"], "spec/AR0002.md": ["^# Fix the login$"], "notes.md": ["^noted$"], "real.txt": ["^arthur: refused inside an eval session \\(ARTHUR_EVAL is set\\)"] },
	missing: ["nothing.md"],
	refs: { "refs/heads/main": "moved", "origin:refs/heads/main": "kept" },
	calls: ["^arthur ticket new Fix the login$", "^arthur merge AR0001$"],
	never: ["^arthur stop"],
	reply: { lines: 2, match: ["^Noted\\.$", "^AR0002 is the ticket\\.$"], never: ["sorry"] },
	tools: ["^bash rm ", '^read \\{"path":"README\\.md"\\}$'],
};

async function load(t: TestContext, list: Readonly<Record<string, Scenario>>, options: Readonly<Record<string, unknown>> = {}) {
	const pkg = join(temporaryFolder(), "develop");
	for (const [name, { fixture, ...scenario }] of Object.entries(list)) {
		mkdirSync(join(pkg, "evals", name), { recursive: true });
		writeFileSync(join(pkg, "evals", name, "scenario.json"), JSON.stringify(scenario));
		if (fixture !== false) {
			mkdirSync(join(pkg, "evals", name, "fixture"));
			writeFileSync(join(pkg, "evals", name, "fixture", "README.md"), "# Shop\n");
		}
	}
	const [root, spy, roles] = [temporaryFolder(), temporaryFolder(), temporaryFolder()];
	execFileSync("git", ["init", "--quiet", "--initial-branch=main", root]);
	execFileSync("git", ["-C", root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "first"]);
	writeFileSync(join(roles, "coordinator.md"), "# The coordinator\n");
	const fake = fakeHost({ name: "develop", options, code: [pkg] });
	fake.provide("projects", () => [{ name: "shop", path: root, prefix: "SH" }]);
	fake.provide("coordinator.turn", async (...asked: unknown[]) => {
		if (JSON.stringify(asked).includes("Refuse")) throw new Error("coordinator.turn: refused by the fake");
		return JSON.stringify(asked);
	});
	fake.provide("coordinator.checkoutContext", ({ root, at }: { readonly root: string; readonly at: Date }) => `# The coordinator\n\nContext of ${root} at ${at.toISOString()}: ${readFileSync(join(root, "README.md"), "utf8")}`);
	fake.host.jobs.registerRole({ name: "coordinator", file: pathToFileURL(join(roles, "coordinator.md")), criteria: [] });
	await fake.setup(develop(options));
	// The runs' folders go into a temporary folder of the test's, a file the stub must not write beside them too.
	const [PATH, TMPDIR, temp] = [process.env.PATH, process.env.TMPDIR, temporaryFolder()];
	process.env.PATH = `${fakeOmp(spy)}${delimiter}${PATH}`;
	process.env.TMPDIR = temp;
	t.after(() => {
		process.env.PATH = PATH;
		if (TMPDIR === undefined) delete process.env.TMPDIR;
		else process.env.TMPDIR = TMPDIR;
	});
	const command = fake.commands.find((each) => each.name === "eval");
	const evals = join(fake.host.folder, "evals");
	return {
		...{ fake, root, spy, pkg, temp, home: join(fake.host.folder, "..") },
		// The one eval folder's transcripts of `run`, e.g. `develop-one-1`.
		transcript: (run: string, file: string) => readFileSync(join(evals, readdirSync(evals)[0] ?? "", run, file), "utf8"),
		async eval(...args: string[]) {
			const [out, err] = [[] as string[], [] as string[]];
			t.mock.method(console, "log", (text: string) => out.push(text));
			t.mock.method(console, "error", (text: string) => err.push(text));
			try {
				const code = await command?.run({ args, project: undefined });
				return { code, out: out.slice(1), header: out[0] ?? "", err: err.join("\n") };
			} catch (error) {
				return { code: 1, out: [], header: "", err: (error as Error).message };
			} finally {
				t.mock.restoreAll();
			}
		},
	};
}

test("each run is scored by what it left behind; a missing fixture and a turn past its timeout fail alone while the others pass", async (t) => {
	const message = (text: string) => ({ turn: { message: text } });
	const eval_ = await load(t, {
		one: { ...message("Note it."), stub: STUB, expect: PASSES },
		lost: { ...message("Note it."), fixture: false },
		hang: { ...message("Then hang."), timeoutSeconds: 1, expect: { files: { "README.md": ["Shop"] } } },
		failing: { ...message("Then fail.") },
		odd: { ...message("Note it."), timeoutSeconds: 0 },
		mute: { ...message("Note it."), expect: { reply: { lines: 0 } } },
	});
	const started = Date.now();
	const answer = await eval_.eval("--runs", "2");
	assert.ok(Date.now() - started < 20_000, "the hanging turn was stopped at its timeout");
	for (const pid of readFileSync(join(eval_.spy, "hanging"), "utf8").trim().split("\n")) assert.throws(() => process.kill(Number(pid), 0), { code: "ESRCH" }, "its process is gone");
	assert.match(answer.header, /^arthur eval: model the agent's default, thinking the agent's default, 2 runs each; transcripts in .+\/develop\/evals\/[^/]+$/);
	const lost = `no fixture: ${join(eval_.pkg, "evals", "lost", "fixture")} is not a folder`;
	const odd = `${join(eval_.pkg, "evals", "odd", "scenario.json")}: timeoutSeconds: expected a whole number of seconds, 1 or more`;
	const mute = `${join(eval_.pkg, "evals", "mute", "scenario.json")}: expect.reply: expected { lines?: 1 or more, match?, never? }`;
	assert.deepEqual(answer, {
		code: 0,
		header: answer.header,
		out: [
			"develop/failing: 0/2 (no baseline)",
			"  run 1: the agent ended with exit code 3",
			"  run 2: the agent ended with exit code 3",
			"develop/hang: 0/2 (no baseline)",
			"  run 1: the turn ran past its timeout of 1 s and was stopped",
			"  run 2: the turn ran past its timeout of 1 s and was stopped",
			"develop/lost: 0/2 (no baseline)",
			`  run 1: ${lost}`,
			`  run 2: ${lost}`,
			"develop/mute: 0/2 (no baseline)",
			`  run 1: ${mute}`,
			`  run 2: ${mute}`,
			"develop/odd: 0/2 (no baseline)",
			`  run 1: ${odd}`,
			`  run 2: ${odd}`,
			"develop/one: 2/2 (no baseline)",
			"passed 2/12 runs; moved against the baseline: none",
		],
		err: "",
	});
	assert.equal(eval_.transcript("develop-one-1", "turn.md"), said("Note it."));
	assert.deepEqual(
		eval_.transcript("develop-one-2", "arthur.log").trim().split("\n").map((line) => JSON.parse(line)),
		[{ call: "arthur ticket new Fix the login", answer: 0 }, { call: "arthur merge AR0001", answer: -1 }, { call: "arthur send report.png", answer: -1 }],
	);
	assert.equal(eval_.transcript("develop-one-1", "failures"), "");
	assert.match(eval_.transcript("develop-hang-1", "failures"), /^the turn ran past its timeout of 1 s/);
	const args = readFileSync(join(eval_.spy, "args"), "utf8").split("\n");
	assert.deepEqual(args.slice(0, 5), ["-p", "--mode", "json", "--no-session", "--auto-approve"]);
	assert.equal(existsSync(args[args.indexOf("--append-system-prompt") + 1] ?? ""), false, "the run's folder is gone once scored");
	assert.equal(readdirSync(join(eval_.fake.host.folder, "evals")).length, 1);
});

test("the system prompt is orchestration's context for the run's own copy of the fixture at the scenario's hour, noon when left out; `date` in the session reads that hour", async (t) => {
	const note = { message: "Note it." };
	const wrong = [-1, 24, 1.5, "3", null];
	const eval_ = await load(t, {
		noon: { turn: note },
		late: { turn: note, hour: 23 },
		midnight: { turn: note, hour: 0 },
		...Object.fromEntries(wrong.map((hour, index) => [`wrong${index}`, { turn: note, hour }])),
	});
	const answer = await eval_.eval("--runs", "2");
	const refused = (index: number) => `${join(eval_.pkg, "evals", `wrong${index}`, "scenario.json")}: hour: expected a whole hour, 0 to 23`;
	assert.deepEqual(answer.out.slice(0, 3), ["develop/late: 2/2 (no baseline)", "develop/midnight: 2/2 (no baseline)", "develop/noon: 2/2 (no baseline)"]);
	assert.deepEqual(answer.out.slice(3, -1), wrong.flatMap((_, index) => [`develop/wrong${index}: 0/2 (no baseline)`, `  run 1: ${refused(index)}`, `  run 2: ${refused(index)}`]));
	// The fake host's clock is at 2026-01-01T00:00Z in UTC, the owner's zone: each hour within 12 hours of it.
	for (const [name, hour, at] of [["noon", "12", "2025-12-31T12:00:00.000Z"], ["late", "23", "2025-12-31T23:00:00.000Z"], ["midnight", "00", "2026-01-01T00:00:00.000Z"]] as const) {
		const runs = [1, 2].map((run) => /^(\d\d)\n# The coordinator\n\nContext of (.+) at (\S+): # Shop\n$/.exec(eval_.transcript(`develop-${name}-${run}`, "stderr"))?.slice(1));
		for (const seen of runs) assert.deepEqual([seen?.[0], seen?.[2]], [hour, at], `${name}: the session's hour and the context's instant`);
		for (const seen of runs) assert.match(seen?.[1] ?? "", /\/arthur-eval-[^/]+\/repo$/, `${name}: the context of the run's copy`);
		assert.notEqual(runs[0]?.[1], runs[1]?.[1], `${name}: each run's own copy`);
	}
});

test("a run fails on each expectation the files, the refs, the stub's log, the reply or the tool calls leave unmet, each named", async (t) => {
	const eval_ = await load(t, {
		wrong: {
			turn: { message: "Note it." },
			stub: STUB,
			expect: {
				files: { "ticket.txt": ["^AR0009$", "^AR0002$"], "absent.md": ["x"] },
				missing: ["notes.md"],
				refs: { "refs/heads/main": "kept", "origin:refs/heads/main": "moved", "refs/heads/feature": "moved" },
				calls: ["^arthur merge ", "^arthur ticket new "],
				never: ["^arthur (merge|send) "],
				reply: { lines: 1, match: ["^AR0009", "Noted"], never: ["\\bticket\\b", "^$"] },
				tools: ["^bash [\\s\\S]*\\bsleep\\b", "notes\\.md", "^write "],
			},
		},
	});
	const answer = await eval_.eval("--runs", "1");
	assert.equal(answer.out[0], "develop/wrong: 0/1 (no baseline)");
	const failures = answer.out.slice(1, -1).map((line) => line.replace(/^ {2}run 1: /, "").replace(/[0-9a-f]{7}/g, "<sha>"));
	assert.deepEqual(failures, [
		"ticket.txt does not match /^AR0009$/",
		"absent.md is missing",
		"notes.md exists",
		"refs/heads/main moved: <sha> to <sha>",
		"origin:refs/heads/main stayed at <sha>, expected to move",
		"refs/heads/feature is gone, expected to move",
		"no call matches /^arthur ticket new / after arthur merge AR0001",
		"arthur merge AR0001 matches /^arthur (merge|send) /",
		"arthur send report.png matches /^arthur (merge|send) /",
		"the reply has 2 lines, at most 1",
		"the reply does not match /^AR0009/",
		"the reply matches /\\bticket\\b/",
		"the reply matches /^$/",
		"the agent's bash sleep 1 matches /^bash [\\s\\S]*\\bsleep\\b/",
		'the agent\'s read {"path":"notes.md"} matches /notes\\.md/',
	]);
});

test("the stub never reaches Arthur's home: no variable names it, a file outside the run's repository is refused, the home is as it was", async (t) => {
	const eval_ = await load(t, { one: { turn: { message: "Note it." } } });
	const sentinel = join(eval_.home, "sentinel");
	writeFileSync(sentinel, "live\n");
	const listing = () => readdirSync(eval_.home, { recursive: true }).map(String).filter((path) => !path.startsWith(join("develop", "evals"))).sort();
	const before = listing();
	const scenario = join(eval_.pkg, "evals", "one", "scenario.json");
	const answers = [{ match: "^arthur send ", output: "sent", files: { "inside.md": "x", [sentinel]: "overwritten\n" } }, { match: "^arthur merge ", files: { "../../escaped.md": "x" } }];
	writeFileSync(scenario, JSON.stringify({ turn: { message: "Note it." }, stub: answers, expect: { missing: ["inside.md"], files: { "send.txt": [`^arthur \\(eval stub\\): refused to write ${sentinel}, outside the run's repository$`] } } }));
	process.env.ARTHUR_ORCHESTRATION_FOLDER = join(eval_.home, "orchestration");
	t.after(() => delete process.env.ARTHUR_ORCHESTRATION_FOLDER);
	const answer = await eval_.eval("--runs", "1");
	assert.deepEqual(answer.out, ["develop/one: 1/1 (no baseline)", "passed 1/1 runs; moved against the baseline: none"]);
	assert.equal(readFileSync(sentinel, "utf8"), "live\n");
	assert.deepEqual(listing(), before, "nothing else in the home changed");
	const log = eval_.transcript("develop-one-1", "arthur.log").trim().split("\n").map((line) => JSON.parse(line));
	assert.deepEqual(log.map((entry) => entry.refused ?? ""), ["", join(eval_.temp, "escaped.md"), sentinel]);
	assert.deepEqual(readdirSync(eval_.temp), [], "nothing written beside the run's folder, which is gone");
	const env = readFileSync(join(eval_.spy, "env"), "utf8").split("\n");
	assert.deepEqual(env.filter((line) => line.startsWith("ARTHUR_")).map((line) => line.split("=")[0]), ["ARTHUR_EVAL"]);
	assert.deepEqual(env.filter((line) => line.includes(eval_.home)), [], "no variable of the turn names the home");
});

test("a help call never takes an answer and no expectation counts it: it prints what the live CLI prints, a page, the list, or an unknown command or a wrong usage with exit code 2", async (t) => {
	const page = readFileSync(new URL("../docs/commands/eval.md", import.meta.url), "utf8");
	const eval_ = await load(t, {
		one: {
			turn: { message: "Read the help." },
			stub: [{ match: "^arthur(?! ticket new )", output: "stubbed", files: { "stubbed.md": "x\n" } }, ...STUB],
			expect: { never: ["--help", "^arthur help", "^arthur$"], calls: ["^arthur nosuch eval$", "^arthur ticket new "] },
		},
	});
	const answer = await eval_.eval("--runs", "1");
	assert.deepEqual(answer, { code: 0, header: answer.header, out: ["develop/one: 1/1 (no baseline)", "passed 1/1 runs; moved against the baseline: none"], err: "" });
	const usage = "usage: arthur <command> [args] [--project <name>]; arthur <command> --help; arthur help <command>\n";
	const names = "commands: eval, plugin\n";
	const [shown, list] = [[`${page}exit 0\n`, ""], [`${usage}${names}exit 0\n`, ""]];
	const unknown = (name: string) => ["exit 2\n", `arthur: unknown command ${name}\n${names}`];
	const printed = Array.from({ length: 11 }, (_, index) => [`help-${index + 1}`, `help-${index + 1}.err`].map((file) => readFileSync(join(eval_.spy, file), "utf8")));
	assert.deepEqual(
		printed,
		[shown, shown, shown, unknown("nosuch"), ["exit 2\n", `arthur: help takes one command name\n${usage}`], ["stubbed\nexit 0\n", ""], unknown("nosuch"), unknown("constructor"), list, list, list],
		"a page for a registered command, `--project <name>` left out; an unknown command refused; `help` of two words refused; the list for help alone; only a call that is no help answered",
	);
	const log = eval_.transcript("develop-one-1", "arthur.log").trim().split("\n").map((line) => JSON.parse(line));
	const helps = ["arthur eval --help", "arthur help eval", "arthur --project shop eval --help", "arthur help nosuch", "arthur help eval twice"];
	const after = ["arthur nosuch --help", "arthur constructor --help", "arthur --help", "arthur help", "arthur"];
	assert.deepEqual(log.slice(0, 12), [
		...helps.map((call) => ({ call, help: true })),
		{ call: "arthur nosuch eval", answer: 0 },
		...after.map((call) => ({ call, help: true })),
		{ call: "arthur ticket new Fix the login", answer: 1 },
	]);
});

test("the turn is the text orchestration's inbox hands over for its event (coordinator.turn), a plugin's message included; a refused one fails its scenario alone", async (t) => {
	const ended = { id: "2026-10-22-worker-0a1b2c3d", kind: "worker", state: "ended", reason: "finished", project: "other", records: { delivery: { ticket: "AC0001" } } };
	const asked = { id: "2026-10-22-worker-0a1b2c3e", kind: "worker", state: "blocked", reason: "user: may I?" };
	const eval_ = await load(t, {
		ended: { turn: { ended, result: "line 1\nline 2" } },
		asked: { turn: { ended: asked } },
		due: { turn: { scheduled: "morning", message: "Write the morning report.", procedure: "procedure.md" } },
		plain: { turn: { scheduled: "tea", message: "Tea." } },
		said: { turn: { message: "Merge AR0001.", channel: "signal" } },
		refused: { turn: { message: "Refuse it." } },
		told: { turn: { arthur: "[github] CI run 7 ended cancelled on arthur/2026-10-22-worker-0a1b2c3d." } },
		blank: { turn: { arthur: " " } },
		listed: { turn: { ended: { ...asked, records: ["delivery"] } } },
	});
	writeFileSync(join(eval_.pkg, "evals", "due", "procedure.md"), "Procedure: name what was built.\n");
	const answer = await eval_.eval("--runs", "1");
	assert.equal(answer.code, 0);
	const failed = (name: string, why: string) => [`develop/${name}: 0/1 (no baseline)`, `  run 1: ${join(eval_.pkg, "evals", name, "scenario.json")}: ${why}`];
	assert.deepEqual(answer.out, [
		"develop/asked: 1/1 (no baseline)",
		...failed("blank", "turn.arthur: expected a plugin's message, as text"),
		...["due", "ended"].map((name) => `develop/${name}: 1/1 (no baseline)`),
		...failed("listed", 'turn.ended: expected { id, kind, state: "ended" | "blocked", reason?, project?, records?: { <plugin>: <its record> } }'),
		"develop/plain: 1/1 (no baseline)",
		...failed("refused", "coordinator.turn: refused by the fake"),
		...["said", "told"].map((name) => `develop/${name}: 1/1 (no baseline)`),
		"passed 6/9 runs; moved against the baseline: none",
	]);
	// A job's end is of the main project unless it names one, its records passed on as they are.
	assert.equal(eval_.transcript("develop-ended-1", "turn.md"), JSON.stringify(["job-ended", Object.assign({ project: "shop" }, ended), "line 1\nline 2"]));
	assert.equal(eval_.transcript("develop-asked-1", "turn.md"), JSON.stringify(["job-ended", { project: "shop", ...asked }, null]));
	assert.equal(eval_.transcript("develop-due-1", "turn.md"), JSON.stringify(["coordinator-message", { text: "[scheduled morning] Write the morning report.\n\nProcedure: name what was built." }]));
	assert.equal(eval_.transcript("develop-plain-1", "turn.md"), JSON.stringify(["coordinator-message", { text: "[scheduled tea] Tea." }]));
	assert.equal(eval_.transcript("develop-said-1", "turn.md"), said("Merge AR0001.", "signal"));
	assert.equal(eval_.transcript("develop-told-1", "turn.md"), JSON.stringify(["coordinator-message", { text: "[github] CI run 7 ended cancelled on arthur/2026-10-22-worker-0a1b2c3d." }]));
});

test("pass rates against the stored baseline: --save-baseline keeps the scenarios left out, and the output names each one that moved", async (t) => {
	const eval_ = await load(t, { one: { turn: { message: "Note it." }, stub: STUB, expect: PASSES }, two: { turn: { message: "Then fail." } } }, { evals: { runs: 2, baseline: "evals/rates.json" } });
	const baseline = join(eval_.root, "evals", "rates.json");
	mkdirSync(join(eval_.root, "evals"));
	writeFileSync(baseline, JSON.stringify({ one: { passed: 1, runs: 2 }, two: { passed: 2, runs: 2 }, gone: { passed: 1, runs: 1 } }));
	const answer = await eval_.eval("develop/one", "develop/two", "--save-baseline");
	assert.deepEqual(answer.out, [
		"develop/one: 2/2 (no baseline)",
		"develop/two: 0/2 (no baseline)",
		"  run 1: the agent ended with exit code 3",
		"  run 2: the agent ended with exit code 3",
		"passed 2/4 runs; moved against the baseline: none",
		`baseline saved: ${baseline}`,
	]);
	writeFileSync(baseline, JSON.stringify({ "develop/one": { passed: 1, runs: 3 }, "develop/two": { passed: 1, runs: 1 }, gone: { passed: 1, runs: 1 } }));
	const moved = await eval_.eval("--save-baseline", "--runs", "1");
	assert.deepEqual(moved.out, [
		"develop/one: 1/1 (baseline 1/3, up)",
		"develop/two: 0/1 (baseline 1/1, down)",
		"  run 1: the agent ended with exit code 3",
		"passed 1/2 runs; moved against the baseline: develop/one (up, 1/3 to 1/1), develop/two (down, 1/1 to 0/1)",
		`baseline saved: ${baseline}`,
	]);
	assert.deepEqual(JSON.parse(readFileSync(baseline, "utf8")), { "develop/one": { passed: 1, runs: 1 }, "develop/two": { passed: 0, runs: 1 }, gone: { passed: 1, runs: 1 } });
	const same = await eval_.eval("develop/two");
	assert.deepEqual([same.out[0], same.out.at(-1)], ["develop/two: 0/2 (baseline 0/1, same)", "passed 0/2 runs; moved against the baseline: none"], "the rate, not the count; runs from evals.runs");
	const evals = join(eval_.fake.host.folder, "evals");
	const runs = readdirSync(evals).length;
	for (const [text, wrong] of [
		[JSON.stringify({ "develop/one": { passed: 3, runs: 1 } }), "develop/one"],
		[JSON.stringify({ "develop/one": { passed: 1, runs: 0 } }), "develop/one"],
		[JSON.stringify({ "develop/two": { passed: 1 } }), "develop/two"],
		["[]", "(the whole file)"],
	] as const) {
		writeFileSync(baseline, text);
		assert.deepEqual(await eval_.eval(), { code: 1, out: [], header: "", err: `${baseline} is not a baseline: ${wrong} is not { passed, runs }, passed 0 to runs` }, text);
	}
	writeFileSync(baseline, "{");
	assert.match((await eval_.eval()).err, /^Expected property name/);
	assert.equal(readdirSync(evals).length, runs, "a refused eval ran nothing");
});

test("refused before any run: wrong usage exits 2; no scenario, an unknown one, no project, no coordinator role exit 1", async (t) => {
	const eval_ = await load(t, { one: { turn: { message: "Note it." } } });
	const usage = "usage: arthur eval [<scenario>...] [--runs <n>] [--save-baseline]";
	for (const runs of ["0", "-1", "1.5", "x", ""]) assert.deepEqual(await eval_.eval(`--runs=${runs}`), { code: 2, out: [], header: "", err: `--runs "${runs}": a whole number of runs, 1 or more\n${usage}` }, runs);
	for (const args of [["--nope"], ["--runs"], ["--save-baseline=yes"]]) assert.deepEqual([(await eval_.eval(...args)).code, (await eval_.eval(...args)).err.split("\n").at(-1)], [2, usage], args.join(" "));
	assert.deepEqual((await eval_.eval("develop/one", "one", "develop/two")).err, "unknown scenario one, develop/two; scenarios: develop/one");
	assert.equal(existsSync(join(eval_.fake.host.folder, "evals")), false, "nothing ran");

	const empty = fakeHost({ name: "develop", code: [temporaryFolder()] });
	await empty.setup(develop());
	await assert.rejects(Promise.try(() => empty.commands.find((each) => each.name === "eval")?.run({ args: [], project: undefined })), /^Error: no scenario: no loaded package has evals\/<name>\/scenario.json$/);
	const roleless = fakeHost({ name: "develop", code: [eval_.pkg] });
	roleless.provide("projects", () => [{ name: "shop", path: eval_.root, prefix: "SH" }]);
	await roleless.setup(develop());
	await assert.rejects(Promise.try(() => roleless.commands.find((each) => each.name === "eval")?.run({ args: [], project: undefined })), /coordinator/);
	const projectless = fakeHost({ name: "develop", code: [eval_.pkg] });
	projectless.provide("projects", () => []);
	await projectless.setup(develop());
	await assert.rejects(Promise.try(() => projectless.commands.find((each) => each.name === "eval")?.run({ args: [], project: undefined })), /^Error: the project list is empty or not a list$/);
});

test("the options: evals.runs a whole number of 1 or more, evals.baseline a path inside the checkout; anything else refused", () => {
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ evals: { runs: 1, baseline: "evals/baseline.json" } }), []);
	assert.deepEqual(checkOptions({ evals: { runs: 0, baseline: "/etc/rates.json", dir: "eval" }, other: 1 }), [
		{ path: "other", problem: "unknown option; options: evals" },
		{ path: "evals.runs", problem: "expected a whole number of runs, 1 or more, got 0" },
		{ path: "evals.baseline", problem: 'expected a path inside the main project\'s checkout, such as evals/baseline.json, got "/etc/rates.json"' },
		{ path: "evals.dir", problem: "unknown key; keys: runs, baseline" },
	]);
	for (const baseline of ["../rates.json", "evals/../../x.json", " ", 3]) assert.equal(checkOptions({ evals: { baseline } }).length, 1, String(baseline));
	for (const runs of [1.5, "3", -1]) assert.equal(checkOptions({ evals: { runs } }).length, 1, String(runs));
	assert.deepEqual(checkOptions({ evals: [] }), [{ path: "evals", problem: "expected { runs, baseline }, got a list" }]);
});
