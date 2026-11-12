import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import type { TestContext } from "node:test";
import { setImmediate as tick } from "node:timers/promises";
import { type AgentRun, fakeAgent, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { delivery } from "../src/delivery.ts";

// The arthur review test files' shared setup: two projects, a worker and a reviewer on the fake host, and a fake merge for arthur run.

export const PATH = process.env.PATH ?? "";
export const FOLDER = "spec/features/AC0001-shop";
export const TICKET = `${FOLDER}/ticket.md`;
export const OTHER = "spec/features/AC0002-other/ticket.md";
export const PROCEDURE = readFileSync(new URL("../roles/coordinator/review-limit.md", import.meta.url), "utf8").trim();
// The worker's rule (packages/core/roles/worker.md), word for word: omp ends a bash call at 300 s when it names no timeout (AR0566).
export const TIMEOUT_RULE = "\n- Run each check (the project's tests, its type check) in one bash call with a `timeout` of 1800 seconds: a call ends at its timeout, 300 seconds when it names none, and a check it kills gives no result. A suite that needs longer gets up to 3600.\n";

// The repository `acme` (prefix AC): ticket AC0001, labelled os=macos, and AC0002, both planned; the repository `beta` (prefix
// BE), whose HEAD holds AC0001's ticket file and no board entry; delivery set up on the fake host with its project list, and
// with `start` started as `arthur run` starts it, so it hands a FAIL back. `worker(task, file)` runs a worker on AC0001 and
// commits a file on its branch (`<job>.ts` by default), as a worker would; `review(message, ...args)` runs `arthur review` with
// the fake agent playing a reviewer whose final message is `message`; `setAutoMerge` sets acme's piece, `delivery.project({ autoMerge })`.
export async function load(t: TestContext, { start = false } = {}) {
	const root = join(temporaryFolder(), "acme");
	for (const [path, json] of [[TICKET, '{ "id": "AC0001", "requires": { "os": "macos" } }'], [OTHER, '{ "id": "AC0002" }']] as const) {
		mkdirSync(join(root, dirname(path)), { recursive: true });
		writeFileSync(join(root, path), `# ${dirname(path)}\n\n\`\`\`json\n${json}\n\`\`\`\n\n## Goal\n\nA change.\n`);
	}
	const entry = (id: string, path: string) => ({ id, title: id, status: "planned", path, updated: "2026-01-01T00:00:00Z" });
	writeFileSync(join(root, "spec/build.json"), JSON.stringify([entry("AC0001", TICKET), entry("AC0002", OTHER)]));
	const git = (at: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", at, ...args], { encoding: "utf8" }).trim();
	git(root, "init", "--quiet", "--initial-branch=main");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	const other = join(dirname(root), "beta");
	mkdirSync(join(other, FOLDER), { recursive: true });
	writeFileSync(join(other, TICKET), readFileSync(join(root, TICKET)));
	writeFileSync(join(other, "spec/build.json"), "[]");
	git(other, "init", "--quiet", "--initial-branch=main");
	git(other, "add", "--all");
	git(other, "commit", "--quiet", "-m", "first");
	t.after(() => {
		process.env.PATH = PATH;
	});
	// Each merge delivery started in this test that still runs is killed with its process group (its own session), its `sh` and `arthur merge`.
	t.after(() => {
		const runs = join(fake.host.folder, "merge-runs");
		for (const name of existsSync(runs) ? readdirSync(runs) : []) {
			const { pid } = JSON.parse(readFileSync(join(runs, name, "run.json"), "utf8"));
			if (pid > 0)
				try {
					process.kill(-pid, "SIGKILL");
				} catch {}
		}
	});
	// Put first on `PATH`, before whatever a test put there (a fake ssh).
	const agent = (run: AgentRun) => {
		process.env.PATH = `${dirname(fakeAgent(run))}${delimiter}${process.env.PATH}`;
	};
	const fake = fakeHost({ name: "delivery", root });
	let autoMerge: boolean | undefined;
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC", pieces: autoMerge === undefined ? {} : delivery.project({ autoMerge }) }, { name: "beta", path: other, prefix: "BE", pieces: {} }]);
	const plugin = delivery();
	await fake.setup(plugin);
	if (start) await plugin.start?.();
	const home = dirname(fake.host.folder);
	const state = (id: string) => (existsSync(join(home, "jobs", id, "state")) ? readFileSync(join(home, "jobs", id, "state"), "utf8") : "");
	const ended = async (id: string) => {
		await until(`${id} to end`, () => state(id) === "ended");
		fake.emit("job-ended", { id, state: "ended" });
	};
	const worker = async (task = `Ticket: ${TICKET}`, file?: string) => {
		agent({ steps: [{ message: "Done.\nTicket: spec/features/AC0002-other/ticket.md was not touched." }] });
		const job = await fake.host.jobs.spawn({ task });
		await ended(job.id);
		const path = file ?? `${job.id}.ts`;
		writeFileSync(join(job.worktree, path), "export const shop = 1;\n");
		git(job.worktree, "add", path);
		git(job.worktree, "commit", "--quiet", "-m", "shop");
		return { id: job.id, branch: job.branch ?? "", commit: git(root, "rev-parse", job.branch ?? "") };
	};
	const [command] = fake.commands;
	// `arthur review` as the CLI runs it: a throw is `arthur review: <message>` and exit code 1.
	const review = async (message: string, ...args: string[]) => {
		agent({ steps: [{ message }] });
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => command?.run({ args, project: undefined })).catch((error: Error) => (err.push(`arthur review: ${error.message}`), 1));
		t.mock.restoreAll();
		const id = out[0] ?? "";
		if (code === undefined && id !== "") await ended(id);
		return { id, code, err: err.join("\n") };
	};
	const status = (id: string) => fake.host.board.get(id)?.status;
	// A job's record file, and the step of a worker's hand-back (none without one).
	const field = (id: string, name: string) => (existsSync(join(home, "jobs", id, name)) ? readFileSync(join(home, "jobs", id, name), "utf8") : undefined);
	const step = (id: string) => {
		const path = join(fake.host.folder, "hand-backs", `${id}.json`);
		const record: unknown = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
		return typeof record === "object" && record !== null && "step" in record ? record.step : undefined;
	};
	return { root, other, fake, git, worker, review, status, home, state, ended, agent, field, step, plugin, setAutoMerge: (value: boolean | undefined) => void (autoMerge = value) };
}

export const reviews = (fake: { readonly host: { readonly jobs: { list(): readonly { readonly id: string; readonly kind: string }[] } } }) =>
	fake.host.jobs.list().filter((each) => each.kind === "review").map((each) => each.id);

// `arthur` as `arthur run` starts it for a merge: the core's CLI in the folder the test then runs in, as `arthur run` runs in its
// config's. That config loads a fake `merge`, which notes its arguments, waits for the file `gate` if `answer` names one, prints
// `out` and `err` and exits `code` as `answer` sets.
export function fakeMerge(t: TestContext) {
	const folder = temporaryFolder();
	const [log, answer] = [join(folder, "asked"), join(folder, "answer.json")];
	writeFileSync(join(folder, "merge.md"), "# arthur merge\n");
	const wait = "while (gate !== undefined && !existsSync(gate)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);";
	const merge = `{ name: "merge", doc: new URL("./merge.md", import.meta.url), run({ args }) { appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + "\\n"); const { out, err, code, gate } = JSON.parse(readFileSync(${JSON.stringify(answer)}, "utf8")); ${wait} process.stdout.write(out); process.stderr.write(err); return code; } }`;
	writeFileSync(join(folder, "arthur.config.ts"), `import { appendFileSync, existsSync, readFileSync } from "node:fs";\nexport default { plugins: [{ name: "orchestration", setup() {} }, { name: "fake", setup(host) { host.commands.register(${merge}); } }] };\n`);
	const cwd = process.cwd();
	process.chdir(folder);
	t.after(() => process.chdir(cwd));
	return {
		answer: (out: string, err: string, code: number, gate?: string) => writeFileSync(answer, JSON.stringify({ out, err, code, gate })),
		asked: () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []),
	};
}

export const told = (fake: { readonly emitted: readonly { readonly name: string; readonly data: unknown }[] }) =>
	fake.emitted.flatMap(({ name, data }) => (name === "coordinator-message" && typeof data === "object" && data !== null && "text" in data ? [String(data.text)] : []));

// The causes delivery forwarded for a job, as `<folder>/<job>/forwarded` keeps them; read once the event's handler has run.
export const forwarded = async (folder: string, id: string) => {
	await tick();
	return existsSync(join(folder, id, "forwarded")) ? readFileSync(join(folder, id, "forwarded"), "utf8") : "";
};

// The hand-back's continue of a worker whose tip's checks did not pass, after the refusal.
export const RUN_CHECKS =
	"Commit your work, then run the project's check, test and mutate scripts (npm run check, npm test, npm run mutate) on the committed tip, change nothing after them, name each mutant that survives in your final message, and end: Arthur reviews the branch when you end.";
