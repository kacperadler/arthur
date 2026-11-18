import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { temporaryFolder, until } from "@arthur/core/testing";
import { fakeNpm } from "./fake-npm.ts";

// The merge tests' fake npm (fake-npm.ts), held against the real one on PATH: both answer the same to what a merge runs.

// `wait` ends on its own after 10 s, so a failed test leaves no process for long.
const SCRIPTS = {
	check: "echo checked; echo warned >&2",
	test: "echo tested; exit 3",
	"commit-msg": "printf '[%s]'",
	term: "kill -TERM $$",
	wait: "trap 'echo caught; exit 5' TERM; echo ready; n=0; while [ $n -lt 100 ]; do sleep 0.1; n=$((n + 1)); done",
};
const banner = (name: keyof typeof SCRIPTS) => `\n> ${name}\n> ${SCRIPTS[name]}\n\n`;
// No "new version of npm" notice on the real one's stderr.
const env = { ...process.env, npm_config_update_notifier: "false" };

// A project with SCRIPTS, the fake npm's path, and its calls.
function load() {
	const project = temporaryFolder();
	writeFileSync(join(project, "package.json"), JSON.stringify({ scripts: SCRIPTS }));
	const bin = temporaryFolder();
	return { project, calls: fakeNpm(bin), fake: join(bin, "npm") };
}

test("the fake npm answers as the real one: the script's output after npm's two lines, none of them with --silent, the arguments after -- handed on as they are, the script's exit status, its death by a signal", () => {
	const { project, calls, fake } = load();
	const cases = [
		[["run", "check"], { status: 0, signal: null, stdout: `${banner("check")}checked\n`, stderr: "warned\n" }],
		[["test"], { status: 3, signal: null, stdout: `${banner("test")}tested\n`, stderr: "" }],
		[["run", "--silent", "commit-msg", "--", "a b", "c'd", ""], { status: 0, signal: null, stdout: "[a b][c'd][]", stderr: "" }],
		[["run", "term"], { status: null, signal: "SIGTERM", stdout: banner("term"), stderr: "" }],
	] as const;
	for (const [args, answer] of cases)
		for (const npm of [fake, "npm"]) {
			const { status, signal, stdout, stderr } = spawnSync(npm, args, { cwd: project, env, encoding: "utf8" });
			assert.deepEqual({ status, signal, stdout, stderr }, answer, `${npm} ${args.join(" ")}`);
		}
	assert.equal(calls(), "run check\ntest\nrun --silent commit-msg -- a b c'd \nrun term\n", "each call of the fake noted, none of the real one");
});

test("a SIGTERM sent to npm while its script runs is the script's to handle, for the fake as for the real one: npm ends when the script does, on its status", async (t) => {
	const { project, fake } = load();
	for (const npm of [fake, "npm"]) {
		const child = spawn(npm, ["run", "wait"], { cwd: project, env, stdio: ["ignore", "pipe", "inherit"] });
		t.after(() => child.kill("SIGKILL"));
		let out = "";
		child.stdout.on("data", (chunk: Buffer) => (out += chunk));
		await until(`${npm} to run the script`, () => out.endsWith("ready\n"));
		child.kill("SIGTERM");
		const [status, signal] = await once(child, "close");
		assert.deepEqual({ status, signal, out }, { status: 5, signal: null, out: `${banner("wait")}ready\ncaught\n` }, npm);
	}
});
