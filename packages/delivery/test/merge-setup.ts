import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import type { TestContext } from "node:test";
import { type AgentRun, fakeAgent, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { delivery } from "../src/delivery.ts";

// The arthur merge test files' shared setup: a project with its board and checks, a fake host with delivery, and their helpers.

const PATH = process.env.PATH ?? "";
export const FOLDER = "spec/features/AC0001-shop";
export const TICKET = `${FOLDER}/ticket.md`;
export const PROCEDURE = readFileSync(new URL("../roles/coordinator/after-merge.md", import.meta.url), "utf8").trim();
export const DONE = `\n${PROCEDURE}`;
// The project's own checks: `npm test` prints node --test's summary and fails while a file `broken` exists.
const TEST_JS = 'const broken = require("node:fs").existsSync("broken");\nconsole.log(`ℹ tests 2\\nℹ pass ${broken ? 1 : 2}`);\nprocess.exit(broken ? 1 : 0);\n';
export const PACKAGE = JSON.stringify({ scripts: { check: 'node -e ""', test: "node test.js" } });
// The decision the fake `decision.owner` takes as the owner's; orchestration's own checks are its tests' (AR0355).
export const OWNER = "AC-D1";

// The repository `acme` (prefix AC): AC0001 "Shop" planned, AC0002 waiting for it, AC0003 for it and AC0002, all on the
// board; the project's checks in package.json; a `bun.lock`, whose install is a fake `bun` that notes each call in `bun.log`.
// `projects.install` answers `answer` (`installAs` sets it, an Error thrown), each request noted in `installs` with main's HEAD;
// `decision.owner` answers as orchestration does, "" for OWNER, each request noted in `owner`.
// `worker(files, task, message)` runs a worker on AC0001 that commits `files` and ends on `message`; `review(job, message, cost)` runs a review ending on `message`, costing `cost` USD;
// `merge(...args)` runs `arthur merge` as the CLI does, a throw being `arthur merge: <message>` and exit code 1; an `uncapped:`
// line, there only on a host without a user manager, goes to `uncapped`, apart from its other lines, and a `no sandbox:` line,
// there only on a host without the sandbox (merge-checks.test.ts tests it), nowhere; `hear(fn)` has `fn` see each line printed,
// as it is printed.
export async function load(t: TestContext, options: Parameters<typeof delivery>[0] = {}) {
	const root = join(temporaryFolder(), "acme");
	const tickets = [["AC0001", "Shop"], ["AC0002", "Cart", ["AC0001"]], ["AC0003", "Pay", ["AC0001", "AC0002"]]] as const;
	const files: Record<string, string> = { "package.json": PACKAGE, "test.js": TEST_JS, "bun.lock": "{}\n", "README.md": "# acme\n" };
	for (const [id, title] of tickets) files[`spec/features/${id}-${title.toLowerCase()}/ticket.md`] = `# ${id} - ${title}\n\n\`\`\`json\n{ "id": "${id}" }\n\`\`\`\n`;
	const board = tickets.map(([id, title, after]) => ({ id, title, status: "planned", path: `spec/features/${id}-${title.toLowerCase()}/ticket.md`, updated: "2026-01-01T00:00:00Z", ...(after && { after }) }));
	files["spec/build.json"] = JSON.stringify(board);
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	const git = (at: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", at, ...args], { encoding: "utf8" }).trim();
	git(root, "init", "--quiet", "--initial-branch=main");
	git(root, "config", "user.name", "t");
	git(root, "config", "user.email", "t@example.com");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	// A merge of the owner's own, so no commit has code since one: main as `arthur merge` finds it in a project merged before
	// delivery recorded its last merge (AR0441). `take()` takes main as it is as docs/commands/merge.md tells the owner now.
	git(root, "merge", "--quiet", "--no-ff", "-m", "Take main as it is", git(root, "commit-tree", "-p", "HEAD", "-m", "main as it is", "HEAD^{tree}"));
	const bin = temporaryFolder();
	writeFileSync(join(bin, "bun"), `#!/bin/sh\necho "$@" >> '${join(bin, "bun.log")}'\nmkdir -p "$BUN_INSTALL_CACHE_DIR" && echo "$BUN_INSTALL_CACHE_DIR" >> '${join(bin, "caches")}'\n[ ! -e '${join(bin, "fail")}' ] || { echo 'error: lockfile had changes' >&2; exit 1; }\n`, { mode: 0o755 });
	const bun = () => (existsSync(join(bin, "bun.log")) ? readFileSync(join(bin, "bun.log"), "utf8") : "");
	// The cache folder each install used, a line each, made by the fake `bun` in it as a real one would.
	const caches = () => (existsSync(join(bin, "caches")) ? readFileSync(join(bin, "caches"), "utf8").trim().split("\n") : []);
	t.after(() => {
		process.env.PATH = PATH;
	});
	const agent = (run: AgentRun) => {
		process.env.PATH = [dirname(fakeAgent(run)), bin, PATH].join(delimiter);
	};
	const fake = fakeHost({ name: "delivery", root });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	const installs: unknown[] = [];
	let answer: string | Error = "bun install --frozen-lockfile";
	fake.provide("projects.install", (request: { readonly project: string; readonly commit: string }) => {
		installs.push({ ...request, head: git(root, "rev-parse", "HEAD") });
		if (answer instanceof Error) throw answer;
		return answer;
	});
	const owner: unknown[] = [];
	fake.provide("decision.owner", (asked: { readonly id: string; readonly what: string }) => {
		owner.push(asked);
		if (asked.id === "") return `${asked.what} needs the owner's decision: arthur decision ask --kind merge${asked.what.startsWith("--") ? ` --what ${asked.what}` : ""} --question '<what he decides>' --ticket AC0001, his answer recorded with arthur decision answer, then ${asked.what} --decision <its id>`;
		return asked.id === OWNER ? "" : `${asked.id} is not in the decision log of project acme`;
	});
	await fake.setup(delivery(options));
	const home = dirname(fake.host.folder);
	const ended = async (id: string) => {
		const state = join(home, "jobs", id, "state");
		await until(`${id} to end`, () => existsSync(state) && readFileSync(state, "utf8") === "ended");
		fake.emit("job-ended", { id, state: "ended" });
	};
	const commit = (worktree: string, changes: Readonly<Record<string, string>>) => {
		for (const [path, text] of Object.entries(changes)) {
			mkdirSync(dirname(join(worktree, path)), { recursive: true });
			writeFileSync(join(worktree, path), text);
		}
		git(worktree, "add", "--all");
		if (Object.keys(changes).length > 0) git(worktree, "commit", "--quiet", "-m", `change ${Object.keys(changes).join(" ")}`);
		return git(worktree, "rev-parse", "HEAD");
	};
	const worker = async (changes: Readonly<Record<string, string>> = { "shop.ts": "export const shop = 1;\n" }, task = `Ticket: ${TICKET}`, message = "Done.") => {
		agent({ steps: [{ message }] });
		const job = await fake.host.jobs.spawn({ task });
		await ended(job.id);
		return { id: job.id, branch: job.branch ?? "", worktree: job.worktree, tip: commit(job.worktree, changes) };
	};
	// A worker whose task names the ticket at `path` instead, never on the board, with a commit main lacks.
	const aside = async (path: string) => {
		const job = await worker({ "aside.ts": "export const aside = 1;\n" }, "No ticket here.");
		writeFileSync(join(home, "jobs", job.id, "task"), `Ticket: ${path}`);
		return job;
	};
	const uncapped: string[] = [];
	let heard = (_text: string) => {};
	const run = async (name: string, args: readonly string[]) => {
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => (heard(text), (text.startsWith("uncapped: ") ? uncapped : text.startsWith("no sandbox: ") ? [] : out).push(text)));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => fake.commands.find((each) => each.name === name)?.run({ args, project: undefined })).catch((error: Error) => (err.push(`arthur ${name}: ${error.message}`), 1));
		t.mock.restoreAll();
		return { code, out: out.join("\n"), err: err.join("\n") };
	};
	const review = async (job: string, message: string, cost = 0) => {
		// The worker's checks passed on its tip, as delivery's extension records them, so a review starts (AR0580).
		const tip = git(root, "rev-parse", `arthur/${job}`);
		mkdirSync(join(fake.host.folder, job), { recursive: true });
		writeFileSync(join(fake.host.folder, job, "checks"), `check pass ${tip} clean\ntest pass 2/2 ${tip} clean\n`);
		agent({ steps: [{ message, cost }] });
		const { out } = await run("review", [job]);
		await ended(out);
		return out;
	};
	const head = () => git(root, "rev-parse", "HEAD");
	const status = (id: string) => fake.host.board.get(id)?.status;
	return { root, fake, git, commit, take: () => run("take-main", ["--decision", OWNER]), worker, aside, ended, review, merge: (...args: string[]) => run("merge", args), run, head, status, bun, caches, failBun: () => writeFileSync(join(bin, "fail"), ""), home, installs, owner, installAs: (next: string | Error) => void (answer = next), uncapped, hear: (fn: (text: string) => void) => void (heard = fn) };
}

// The checks on main, of a branch whose `test` script notes its cgroup and forks a sleeper out of its process group, noting its pid.
export async function forkingTest(t: TestContext) {
	const loaded = await load(t);
	const noted = temporaryFolder();
	// Pass or fail, the sleeper goes at the test's end; a merge that throws before it is read would leave it otherwise.
	t.after(() => void (existsSync(join(noted, "sleeper")) && spawnSync("kill", ["-9", readFileSync(join(noted, "sleeper"), "utf8").trim()])));
	const fork = `cat /proc/self/cgroup > '${noted}/cgroup' 2>/dev/null\nsetsid sh -c 'echo $$ > "${noted}/sleeper"; exec sleep 300' </dev/null >/dev/null 2>&1 &\nwhile [ ! -s '${noted}/sleeper' ]; do sleep 0.02; done\n`;
	const job = await loaded.worker({ "fork.sh": fork, "package.json": JSON.stringify({ scripts: { test: "sh fork.sh" } }) });
	await loaded.review(job.id, "Clean.\n\nPASS");
	const merged = await loaded.merge(job.id, "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	const sleeper = Number(readFileSync(join(noted, "sleeper"), "utf8"));
	return { merged, uncapped: loaded.uncapped, sleeper, cgroup: readFileSync(join(noted, "cgroup"), "utf8") };
}
// A process that runs, not gone and no zombie.
export const running = (pid: number) => !/^\d+ \(.*\) Z /.test(existsSync(`/proc/${pid}/stat`) ? readFileSync(`/proc/${pid}/stat`, "utf8") : `${pid} (gone) Z `);
export const manager = spawnSync("systemctl", ["--user", "show-environment"]).status === 0;

// A `git` first on PATH until the test ends that writes `keys` into a repository's own config right after Arthur's config check
// (@arthur/core/git-config) first lists it, as a job's program would between that check and the git call (AR0392).
export function plantAfterCheck(t: TestContext, keys: readonly (readonly [string, string])[]): void {
	const folder = temporaryFolder();
	const quote = (word: string) => `'${word.replaceAll("'", "'\\''")}'`;
	const real = quote(execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim());
	const plant = keys.map(([key, value]) => `${real} -C "$2" config ${quote(key)} ${quote(value)}\n`).join("");
	const now = `[ "$3 $4 $5" = "config --list --show-scope" ] && mkdir ${quote(join(folder, "planted"))} 2>/dev/null`;
	writeFileSync(join(folder, "git"), `#!/bin/sh\n${real} "$@"\ncode=$?\nif ${now}; then\n${plant}fi\nexit $code\n`, { mode: 0o755 });
	process.env.PATH = [folder, process.env.PATH].join(delimiter);
	t.after(() => void (process.env.PATH = process.env.PATH?.split(delimiter).filter((each) => each !== folder).join(delimiter)));
}

// The run that built a branch as `github.ci` answers it (the github plugin's Run of GitHub's "List workflow runs for a
// workflow", every field, with `below`).
export type CiRun = { id: number; attempt: number; sha: string; branch: string; status: string; conclusion: string | null; url: string; startedAt: string | null; below: number };
export const ciRun = (sha: string, branch: string, more: Partial<CiRun> = {}): CiRun => ({ id: 7, attempt: 1, sha, branch, status: "completed", conclusion: "success", url: "https://github.com/acme/shop/actions/runs/7", startedAt: "2026-01-01T00:00:00Z", below: 0, ...more });

// A git with no identity anywhere, as on a fresh machine or runner: a user config that forbids guessing one (so a host with a
// full domain name makes up none), no system config, none in the environment; each variable put back after the test.
export function noIdentityAnywhere(t: TestContext) {
	const names = ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL", "EMAIL"];
	const saved = names.map((name) => process.env[name]);
	t.after(() => names.forEach((name, at) => (saved[at] === undefined ? delete process.env[name] : (process.env[name] = saved[at]))));
	for (const name of names) delete process.env[name];
	const global = join(temporaryFolder(), "gitconfig");
	writeFileSync(global, "[user]\n\tuseConfigOnly = true\n");
	Object.assign(process.env, { GIT_CONFIG_GLOBAL: global, GIT_CONFIG_NOSYSTEM: "1" });
}
