import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { basename, delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { type AgentRun, fakeAgent, fakeHost, jobSlice, temporaryFolder } from "@arthur/core/testing";
import { delivery } from "../src/delivery.ts";

const PATH = process.env.PATH ?? "";
const FOLDER = "spec/features/AC0001-shop";
const TICKET = `${FOLDER}/ticket.md`;
const PROCEDURE = readFileSync(new URL("../roles/coordinator/after-merge.md", import.meta.url), "utf8").trim();
const DONE = `nothing committed but the merge, nothing pushed or pruned\n\n${PROCEDURE}`;
// The project's own checks: `npm test` prints node --test's summary and fails while a file `broken` exists.
const TEST_JS = 'const broken = require("node:fs").existsSync("broken");\nconsole.log(`ℹ tests 2\\nℹ pass ${broken ? 1 : 2}`);\nprocess.exit(broken ? 1 : 0);\n';
const PACKAGE = JSON.stringify({ scripts: { check: 'node -e ""', test: "node test.js" } });
// The decision the fake `decision.owner` takes as the owner's; orchestration's own checks are its tests' (AR0355).
const OWNER = "AC-D1";

// The repository `acme` (prefix AC): AC0001 "Shop" planned, AC0002 waiting for it, AC0003 for it and AC0002, all on the
// board; the project's checks in package.json; a `bun.lock`, whose install is a fake `bun` that notes each call in `bun.log`.
// `projects.install` answers `answer` (`installAs` sets it, an Error thrown), each request noted in `installs` with main's HEAD;
// `decision.owner` answers as orchestration does, "" for OWNER, each request noted in `owner`.
// `worker(files)` runs a worker on AC0001 that commits `files`; `review(job, message, cost)` runs a review ending on `message`, costing `cost` USD;
// `merge(...args)` runs `arthur merge` as the CLI does, a throw being `arthur merge: <message>` and exit code 1; an `uncapped:`
// line, there only on a host without a user manager, goes to `uncapped`, apart from its other lines, and a `no sandbox:` line,
// there only on a host without the sandbox (merge-checks.test.ts tests it), nowhere; `hear(fn)` has `fn` see each line printed,
// as it is printed.
async function load(t: TestContext, options: Parameters<typeof delivery>[0] = {}) {
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
		if (asked.id === "") return `${asked.what} needs the owner's decision: arthur decision ask --kind merge --question '<what he decides>' --ticket AC0001, his answer recorded with arthur decision answer, then ${asked.what} --decision <its id>`;
		return asked.id === OWNER ? "" : `${asked.id} is not in the decision log of project acme`;
	});
	await fake.setup(delivery(options));
	const home = dirname(fake.host.folder);
	const ended = async (id: string) => {
		const state = join(home, "jobs", id, "state");
		for (const deadline = Date.now() + 15_000; !existsSync(state) || readFileSync(state, "utf8") !== "ended"; await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${id} to end`);
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
	const worker = async (changes: Readonly<Record<string, string>> = { "shop.ts": "export const shop = 1;\n" }, task = `Ticket: ${TICKET}`) => {
		agent({ steps: [{ message: "Done." }] });
		const job = await fake.host.jobs.spawn({ task });
		await ended(job.id);
		return { id: job.id, branch: job.branch ?? "", worktree: job.worktree, tip: commit(job.worktree, changes) };
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
		agent({ steps: [{ message, cost }] });
		const { out } = await run("review", [job]);
		await ended(out);
		return out;
	};
	const head = () => git(root, "rev-parse", "HEAD");
	const status = (id: string) => fake.host.board.get(id)?.status;
	return { root, fake, git, commit, take: () => run("take-main", ["--decision", OWNER]), worker, review, merge: (...args: string[]) => run("merge", args), run, head, status, bun, caches, failBun: () => writeFileSync(join(bin, "fail"), ""), home, installs, owner, installAs: (next: string | Error) => void (answer = next), uncapped, hear: (fn: (text: string) => void) => void (heard = fn) };
}

test("a branch with a PASS on its tip goes in: checks pass, its review filed, outcome.md written, the ticket merged, the tickets it unblocks named; the install's cache is the merge's own, gone after it", async (t) => {
	const { root, fake, git, worker, review, merge, head, status, bun, caches, installs } = await load(t);
	const job = await worker({ "shop.ts": "export const shop = 1;\n", "bun.lock": '{ "shop": 1 }\n' });
	const passed = await review(job.id, "Clean.\n\nPASS");
	const before = head();
	const merged = await merge(job.id.slice(-8));
	assert.equal(merged.code, undefined, merged.err);
	const hash = git(root, "rev-parse", "--short", "HEAD");
	assert.deepEqual(git(root, "log", "-1", "--format=%s%n%P"), `Merge AC0001: Shop\n${before} ${job.tip}`);
	assert.equal(
		merged.out,
		[
			`merged ${job.branch} into main: ${hash}`,
			"bun install --frozen-lockfile: passed.",
			"npm run check: passed.",
			"npm test: 2/2 passed.",
			`filed ${FOLDER}/review-1.md`,
			"- Findings: none; no findings.md on this ticket.",
			`wrote ${FOLDER}/outcome.md; rewrite What went in from the commit subjects listed there`,
			"AC0001 merged",
			"unblocked: AC0002",
			"wrote CHANGELOG.md: 1 merged ticket",
			DONE,
		].join("\n"),
	);
	assert.equal(bun(), "install --frozen-lockfile\n", "the project's install ran once");
	assert.deepEqual(caches().map((each) => [dirname(dirname(each)), basename(each), existsSync(dirname(each))]), [[fake.host.folder, "bun", false]], "a cache folder in the plugin's own, removed after the merge");
	assert.deepEqual(installs, [{ project: "acme", commit: "HEAD", head: git(root, "rev-parse", "HEAD") }], "asked of projects.install for the merge commit");
	assert.match(readFileSync(join(root, FOLDER, "review-1.md"), "utf8"), new RegExp(`^- Job: ${passed}\n- Branch: ${job.branch}\n`, "m"));
	const outcome = readFileSync(join(root, FOLDER, "outcome.md"), "utf8");
	assert.match(outcome, new RegExp(`^# AC0001 - Outcome\n\n- Merged: \\d{4}-\\d{2}-\\d{2}, \`${hash}\`\n- Branch: ${job.branch}\n- Reviews: review-1.md PASS\n- Cost: worker \\$\\d+\\.\\d{2}, reviews \\$\\d+\\.\\d{2}; review rounds 1\n`));
	assert.ok(
		outcome.endsWith(
			"\n## What went in\n\n- change shop.ts bun.lock\n\n## Checks on main\n\n- `bun install --frozen-lockfile`: passed.\n- `npm run check`: passed.\n- `npm test`: 2/2 passed.\n\n## Left open\n\n- Findings: none; no findings.md on this ticket.\n",
		),
		outcome,
	);
	assert.deepEqual([status("AC0001"), status("AC0002"), status("AC0003")], ["merged", "planned", "planned"]);
	assert.match(readFileSync(join(root, "CHANGELOG.md"), "utf8"), new RegExp(`\n## \\d{4}-\\d{2}-\\d{2}\n\n### Other\n\n- AC0001 Shop \\(${hash}\\)\n$`), "rebuilt from outcome.md");
	assert.deepEqual(fake.emitted.filter((event) => event.name === "ticket-moved").at(-1)?.data, { id: "AC0001", project: "acme", from: "done", to: "merged" });
	assert.equal((await merge(job.id)).err, `arthur merge: AC0001 is merged; a merge is of a ticket in-progress, review or done`);
});

test("a merge's start removes delivery's cache_ folders older than a day to the minute, as a killed merge leaves them, with what is in them; a younger one, maybe a running merge's, a project's folder named cache-*, another old folder and an old cache_ one below the top stay", async (t) => {
	const { fake, worker, merge, caches } = await load(t);
	const job = await worker({ "bun.lock": '{ "shop": 1 }\n' });
	// A folder below the top is aged before the one holding it, whose time each write in it moves.
	const aged = (name: string, seconds: number, file = join("bun", "deep", "left")) => {
		const path = join(fake.host.folder, name);
		mkdirSync(dirname(join(path, file)), { recursive: true });
		writeFileSync(join(path, file), "what was written there\n");
		const at = new Date(Date.now() - seconds * 1000);
		utimesSync(path, at, at);
		return path;
	};
	const day = 24 * 3600;
	const below = [aged(join("cache_Runnin", "cache_x"), 2 * day), aged(join("cache-shop", "cache_x"), 2 * day)];
	const [old, young, project, other] = [aged("cache_kiLLed", day + 30), aged("cache_Runnin", day - 30), aged("cache-shop", 2 * day, "last-merge"), aged("caches", 2 * day)];
	const merged = await merge(job.id, "--unreviewed", "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.deepEqual([old, young, project, other, ...below].map((path) => existsSync(path)), [false, true, true, true, true, true]);
	assert.match(basename(dirname(caches()[0] ?? "")), /^cache_[A-Za-z0-9]{6}$/, "the merge's own cache folder has the name the sweep removes");
});

test("a review filed and pruned before the merge, as its wake tells the coordinator, still has its cost in outcome.md", async (t) => {
	const { root, fake, home, worker, review, merge } = await load(t);
	const job = await worker();
	const passed = await review(job.id, "Clean.\n\nPASS", 0.37);
	assert.equal(fake.host.jobs.file("AC0001", passed), `${FOLDER}/review-1.md`);
	rmSync(join(home, "jobs", passed), { recursive: true });
	const merged = await merge(job.id);
	assert.equal(merged.code, undefined, merged.err);
	assert.match(readFileSync(join(root, FOLDER, "outcome.md"), "utf8"), /\n- Reviews: review-1\.md PASS\n- Cost: worker \$0\.00, reviews \$0\.37; review rounds 1\n/);
});

test("a review record kept before AR0474, with no cost, takes the cost from the core's record while it exists, and is n/a once that is pruned", async (t) => {
	const { root, fake, home, worker, review, merge } = await load(t);
	// The record as an Arthur before AR0474 kept it: the verdict without the cost.
	const costless = (id: string) => {
		const path = join(fake.host.folder, "reviews", `${id}.json`);
		const { cost, ...kept } = JSON.parse(readFileSync(path, "utf8"));
		assert.equal(cost, "0.3700", "settle kept the cost before it is taken away");
		writeFileSync(path, `${JSON.stringify(kept)}\n`);
	};
	const first = await worker();
	costless(await review(first.id, "Clean.\n\nPASS", 0.37));
	assert.equal((await merge(first.id)).err, "");
	assert.match(readFileSync(join(root, FOLDER, "outcome.md"), "utf8"), /\n- Cost: worker \$0\.00, reviews \$0\.37; review rounds 1\n/);
	const second = await worker({ "cart.ts": "export const cart = 1;\n" }, "Ticket: spec/features/AC0002-cart/ticket.md");
	const passed = await review(second.id, "Clean.\n\nPASS", 0.37);
	costless(passed);
	assert.equal(fake.host.jobs.file("AC0002", passed), "spec/features/AC0002-cart/review-1.md");
	rmSync(join(home, "jobs", passed), { recursive: true });
	assert.equal((await merge(second.id)).err, "");
	assert.match(readFileSync(join(root, "spec/features/AC0002-cart/outcome.md"), "utf8"), /\n- Cost: worker \$0\.00, reviews n\/a; review rounds 1\n/);
});

// The checks on main, of a branch whose `test` script notes its cgroup and forks a sleeper out of its process group, noting its pid.
async function forkingTest(t: TestContext) {
	const loaded = await load(t);
	const noted = temporaryFolder();
	const fork = `cat /proc/self/cgroup > '${noted}/cgroup' 2>/dev/null\nsetsid sh -c 'echo $$ > "${noted}/sleeper"; exec sleep 300' </dev/null >/dev/null 2>&1 &\nwhile [ ! -s '${noted}/sleeper' ]; do sleep 0.02; done\n`;
	const job = await loaded.worker({ "fork.sh": fork, "package.json": JSON.stringify({ scripts: { test: "sh fork.sh" } }) });
	await loaded.review(job.id, "Clean.\n\nPASS");
	const merged = await loaded.merge(job.id);
	assert.equal(merged.code, undefined, merged.err);
	const sleeper = Number(readFileSync(join(noted, "sleeper"), "utf8"));
	t.after(() => void spawnSync("kill", ["-9", String(sleeper)]));
	return { merged, uncapped: loaded.uncapped, sleeper, cgroup: readFileSync(join(noted, "cgroup"), "utf8") };
}
// A process that runs, not gone and no zombie.
const running = (pid: number) => !/^\d+ \(.*\) Z /.test(existsSync(`/proc/${pid}/stat`) ? readFileSync(`/proc/${pid}/stat`, "utf8") : `${pid} (gone) Z `);
const manager = spawnSync("systemctl", ["--user", "show-environment"]).status === 0;

test("each step on main runs in a scope of its own under the jobs' slice, and what it leaves running is gone once the merge printed its last line", { skip: !manager && "no systemd user manager" }, async (t) => {
	const { uncapped, sleeper, cgroup } = await forkingTest(t);
	assert.deepEqual(uncapped, []);
	assert.match(cgroup, new RegExp(`^0::/.*/${jobSlice.slice}\\.slice/arthur-merge-${process.pid}-\\d+\\.scope$`, "m"));
	assert.equal(running(sleeper), false, `the sleeper ${sleeper} still runs`);
});

test("without a user manager the steps on main run bare, which one uncapped line says, and pass as usual", async (t) => {
	const saved = { XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR, DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS };
	t.after(() => Object.assign(process.env, saved));
	process.env.XDG_RUNTIME_DIR = temporaryFolder();
	delete process.env.DBUS_SESSION_BUS_ADDRESS;
	const { merged, uncapped } = await forkingTest(t);
	assert.match(merged.out, /\nbun install --frozen-lockfile: passed\.\nnpm test: passed\.\n/);
	assert.equal(uncapped.length, 1, uncapped.join("\n"));
	assert.match(uncapped[0] ?? "", /^uncapped: no systemd scope \(.+\); the steps run bare, outside the jobs' slice, and what they leave behind is not killed$/);
});

test("the review's checkout and the merge run no hook and no fsmonitor that the repository's shared config names", async (t) => {
	const { root, git, worker, review, merge } = await load(t);
	const job = await worker();
	// Each hook these steps could run, and an fsmonitor, noting its name in `ran`, as a job's program may have set them.
	const [hooks, ran] = [temporaryFolder(), join(temporaryFolder(), "ran")];
	for (const name of ["post-checkout", "reference-transaction", "pre-merge-commit", "prepare-commit-msg", "commit-msg", "post-merge", "post-commit", "pre-push", "fsmonitor"])
		writeFileSync(join(hooks, name), `#!/bin/sh\necho ${name} >> '${ran}'\n`, { mode: 0o755 });
	git(root, "config", "core.hooksPath", hooks);
	git(root, "config", "core.fsmonitor", join(hooks, "fsmonitor"));
	await review(job.id, "PASS");
	const merged = await merge(job.id);
	assert.equal(merged.code, undefined, merged.err);
	assert.equal(existsSync(ran) ? readFileSync(ran, "utf8") : "", "");
	git(root, "commit", "--quiet", "--allow-empty", "-m", "control");
	assert.match(readFileSync(ran, "utf8"), /^fsmonitor$[^]*^commit-msg$/m, "a plain git call runs them");
});

test("replacements under refs/replace, as a job's git replace would write, change nothing the review, review-needed and the merge read", async (t) => {
	const { root, home, git, worker, review, merge, run } = await load(t);
	const job = await worker({ "docs.md": "# Docs\n" });
	const [before, files, empty] = [git(root, "rev-parse", "main"), git(root, "rev-parse", "main^{tree}"), git(root, "hash-object", "-w", "-t", "tree", "/dev/null")];
	const tree = git(root, "rev-parse", `${job.tip}^{tree}`);
	// Main's tip read as a child of the branch's tip with no file, the branch's tip as a commit of main's files alone: read
	// through them, the branch adds nothing to main, main's ticket is gone, and the review's checkout has no docs.md.
	git(root, "replace", before, git(root, "commit-tree", "-p", job.tip, "-m", "fake main", empty));
	git(root, "replace", job.tip, git(root, "commit-tree", "-m", "fake tip", files));
	const passed = await review(job.id, "PASS");
	const checkout = readFileSync(join(home, "jobs", passed, "worktree"), "utf8").trim();
	assert.equal(readFileSync(join(checkout, "docs.md"), "utf8"), "# Docs\n", "the review's checkout is the branch's own tip");
	assert.equal((await run("review-needed", [job.id])).out, "no review: 1 file, all docs (*.md)\nAC0001 moves to done.");
	const merged = await merge(job.id);
	assert.equal(merged.code, undefined, merged.err);
	assert.equal(git(root, "log", "-1", "--format=%s%n%P%n%T"), `Merge AC0001: Shop\n${before} ${job.tip}\n${tree}`);
	assert.deepEqual(git(root, "replace", "-l").split("\n").sort(), [before, job.tip].sort(), "the replacements are still there: each step read past them");
});

test("refused, main unchanged: the repository's own config sets a key that may name a program; one a failing check sets keeps main from its reset", async (t) => {
	const { root, git, worker, review, merge, head } = await load(t);
	const [ran, program] = [join(temporaryFolder(), "ran"), join(temporaryFolder(), "program")];
	writeFileSync(program, `#!/bin/sh\necho program >> '${ran}'\ncat\n`, { mode: 0o755 });
	// The branch gives every file a filter and a merge driver; its test, run on main after the merge, sets a credential helper.
	const plants = `require("node:child_process").execFileSync("git", ["config", "credential.helper", ${JSON.stringify(program)}]);\nprocess.exit(1);\n`;
	const job = await worker({ ".gitattributes": "* filter=x merge=x\n", "README.md": "# acme, merged\n", "test.js": plants });
	await review(job.id, "PASS");
	const before = head();
	const said = (key: string) => `${join(root, ".git", "config")} sets ${key}, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`;
	git(root, "config", "filter.x.smudge", program);
	assert.deepEqual(await merge(job.id), { code: 1, out: "", err: `arthur merge: ${said("filter.x.smudge")}; main is unchanged` });
	git(root, "config", "--unset", "filter.x.smudge");
	git(root, "config", "merge.x.driver", program);
	assert.equal((await merge(job.id)).err, `arthur merge: ${said("merge.x.driver")}; main is unchanged`);
	assert.deepEqual([head(), existsSync(ran)], [before, false]);
	git(root, "config", "--unset", "merge.x.driver");
	const merged = await merge(job.id);
	assert.equal(merged.err, `arthur merge: check failed on main (npm test), and main could not be reset to ${before.slice(0, 7)}: ${said("credential.helper")}`);
	assert.deepEqual([git(root, "rev-parse", "HEAD^2"), existsSync(ran)], [job.tip, false], "main keeps the merge");
});

test("refused, main unchanged: no PASS on the tip, a FAIL on it, a PASS on an older commit; --unreviewed lets it in with the owner's decision, and outcome.md says so", async (t) => {
	const { root, commit, worker, review, merge, head, status, owner } = await load(t);
	const job = await worker();
	const start = head();
	const unreviewed = (tip: string, why: string) =>
		`arthur merge: no PASS on ${job.branch}'s tip ${tip.slice(0, 7)}: ${why}; review it with arthur review ${job.id}, or merge it with --unreviewed --decision <the owner's decision id>; main is unchanged`;
	assert.deepEqual(await merge(job.id), { code: 1, out: "", err: unreviewed(job.tip, "no review of it has a verdict (last PASS: none)") });
	const failed = await review(job.id, "Missing a test.\n\nFAIL");
	assert.equal((await merge(job.id)).err, unreviewed(job.tip, `its newest review, ${failed}, says FAIL (last PASS: none)`));
	await review(job.id, "PASS");
	const tip = commit(job.worktree, { "late.ts": "export const late = 1;\n" });
	assert.equal((await merge(job.id)).err, unreviewed(tip, `no review of it has a verdict (last PASS: ${job.tip.slice(0, 7)})`));
	assert.equal(head(), start);
	// `decision.owner` holds --unreviewed: its refusal refuses the merge, main unchanged.
	assert.deepEqual(await merge(job.id, "--unreviewed"), { code: 1, out: "", err: "arthur merge: --unreviewed needs the owner's decision: arthur decision ask --kind merge --question '<what he decides>' --ticket AC0001, his answer recorded with arthur decision answer, then --unreviewed --decision <its id>; main is unchanged" });
	assert.deepEqual(await merge(job.id, "--decision", "AC-D9", "--unreviewed"), { code: 1, out: "", err: "arthur merge: AC-D9 is not in the decision log of project acme; main is unchanged" });
	assert.equal(head(), start);
	const merged = await merge(job.id, "--unreviewed", "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.equal(status("AC0001"), "merged");
	assert.match(readFileSync(join(root, FOLDER, "outcome.md"), "utf8"), new RegExp(`\n- Reviews: review-1.md FAIL, review-2.md PASS; merged unreviewed \\(--unreviewed\\): no PASS on ${job.branch}'s tip ${tip.slice(0, 7)}: `));
	const asked = { what: "--unreviewed", kind: "merge", ticket: "AC0001", job: job.id, use: `merge ${job.id}` };
	assert.deepEqual(owner, [{ ...asked, id: "" }, { ...asked, id: "AC-D9" }, { ...asked, id: OWNER }], "asked only with --unreviewed, of the job's ticket, for this merge");
});

test("arthur review-needed's no review for the tip is a PASS; for an older tip it is none", async (t) => {
	const { fake, commit, worker, run, merge } = await load(t);
	const job = await worker({ "docs.md": "# Docs\n" });
	assert.equal((await run("review-needed", [job.id])).out, "no review: 1 file, all docs (*.md)\nAC0001 moves to done.");
	const tip = commit(job.worktree, { "more.md": "# More\n" });
	const refused = new RegExp(`no PASS on ${job.branch}'s tip ${tip.slice(0, 7)}: no review of it has a verdict`);
	assert.match((await merge(job.id)).err, refused);
	await run("review-needed", [job.id]);
	writeFileSync(join(fake.host.folder, job.id, "review-needed"), "{ broken");
	assert.match((await merge(job.id)).err, refused, "a broken answer is no `no review`");
	await run("review-needed", [job.id]);
	const merged = await merge(job.id);
	assert.equal(merged.code, undefined, merged.err);
});

test("a merge conflict leaves main as it was: no merge in progress, the ticket where it was", async (t) => {
	const { root, git, worker, review, merge, head, status } = await load(t);
	const job = await worker({ "README.md": "# acme, the branch's\n" });
	await review(job.id, "PASS");
	writeFileSync(join(root, "README.md"), "# acme, main's\n");
	git(root, "commit", "--quiet", "-am", "main moves on");
	const before = head();
	assert.deepEqual(await merge(job.id), { code: 1, out: "", err: `arthur merge: ${job.branch} conflicts with main in README.md; merge aborted, main is unchanged` });
	assert.equal(head(), before);
	assert.equal(git(root, "status", "--porcelain", "--untracked-files=no"), "", "no merge left half done");
	assert.equal(existsSync(join(root, ".git", "MERGE_HEAD")), false);
	assert.equal(status("AC0001"), "done");
});

test("each merge that went in rebuilds CHANGELOG.md; the rebuilt file left uncommitted is no dirt for the next merge", async (t) => {
	const { root, git, worker, merge } = await load(t);
	const first = await worker();
	assert.equal((await merge(first.id, "--unreviewed", "--decision", OWNER)).err, "");
	git(root, "add", "CHANGELOG.md");
	git(root, "commit", "--quiet", "-m", "the changelog");
	const cart = await worker({ "cart.ts": "export const cart = 1;\n" }, "Ticket: spec/features/AC0002-cart/ticket.md");
	assert.match((await merge(cart.id, "--unreviewed", "--decision", OWNER)).out, /\nwrote CHANGELOG\.md: 2 merged tickets\n/);
	assert.match(git(root, "status", "--porcelain", "--untracked-files=no"), /^ ?M CHANGELOG\.md$/m, "rebuilt, not committed");
	const pay = await worker({ "pay.ts": "export const pay = 1;\n" }, "Ticket: spec/features/AC0003-pay/ticket.md");
	const merged = await merge(pay.id, "--unreviewed", "--decision", OWNER);
	assert.equal(merged.err, "");
	assert.match(readFileSync(join(root, "CHANGELOG.md"), "utf8"), /\n- AC0001 Shop \([0-9a-f]+\)\n- AC0002 Cart \([0-9a-f]+\)\n- AC0003 Pay \([0-9a-f]+\)\n$/);
});

test("only a merge puts code on main: a code commit since the last merge refuses the next, with --unreviewed, --auto or neither, naming it; spec/, CHANGELOG.md and *.md do not; with no record and no merge, from the root", async (t) => {
	const { root, fake, git, commit, take, worker, merge, head } = await load(t);
	const first = await worker();
	assert.equal((await merge(first.id, "--unreviewed", "--decision", OWNER)).err, "");
	commit(root, { "README.md": "# acme, a shop\n", "docs/guide.md": "# Guide\n" });
	assert.match(git(root, "show", "--name-only", "--format=", "HEAD"), /^CHANGELOG\.md\nREADME\.md\ndocs\/guide\.md\nspec\/build\.json\nspec\/features\/AC0001-shop\/outcome\.md$/);
	const cart = await worker({ "cart.ts": "export const cart = 1;\n" }, "Ticket: spec/features/AC0002-cart/ticket.md");
	assert.equal((await merge(cart.id, "--unreviewed", "--decision", OWNER)).err, "", "the commit after a merge, of spec/, CHANGELOG.md and *.md, is no code");
	const hand = git(root, "rev-parse", "--short", commit(root, { "hand.ts": "export const hand = 1;\n" }));
	commit(root, { "spec/notes.md": "# Notes\n" });
	const again = git(root, "rev-parse", "--short", commit(root, { "hand.ts": "export const hand = 2;\n" }));
	const pay = await worker({ "pay.ts": "export const pay = 1;\n" }, "Ticket: spec/features/AC0003-pay/ticket.md");
	const before = head();
	const refused = `arthur merge: main has 2 commits since its last merge that change code (${again}, ${hand}); only a merge puts code on main; the owner decides, and arthur take-main lifts it: main is unchanged`;
	assert.deepEqual(await merge(pay.id), { code: 1, out: "", err: refused });
	assert.deepEqual(await merge(pay.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: refused });
	assert.deepEqual(await merge(pay.id, "--auto"), { code: 1, out: "", err: refused });
	assert.deepEqual(await merge(pay.id, "--no-ci", "--decision", OWNER), { code: 1, out: "", err: refused });
	assert.equal(head(), before);
	assert.deepEqual(await take(), { code: undefined, out: `took main of acme as it is at ${before.slice(0, 7)}: the next arthur merge lists code commits from there`, err: "" });
	assert.equal((await merge(pay.id, "--unreviewed", "--decision", OWNER)).err, "");
	const loose = await worker({ "loose.ts": "export const loose = 1;\n" }, "No ticket here.");
	const start = git(root, "rev-list", "--max-parents=0", "HEAD");
	git(root, "reset", "--quiet", "--hard", start);
	rmSync(join(fake.host.folder, "acme", "last-merge"));
	assert.equal((await merge(loose.id, "--unreviewed", "--decision", OWNER)).err, `arthur merge: main has 1 commits since its last merge that change code (${git(root, "rev-parse", "--short", start)}); only a merge puts code on main; the owner decides, and arthur take-main lifts it: main is unchanged`);
});

test("a history of plain code commits, as squash or rebase merges leave it, refuses naming the newest 10 and how many more; arthur take-main lifts it", async (t) => {
	const { root, git, commit, take, worker, merge, head } = await load(t);
	const plain = Array.from({ length: 12 }, (_, n) => git(root, "rev-parse", "--short", commit(root, { [`plain${n}.ts`]: `export const plain = ${n};\n` }))).reverse();
	const job = await worker();
	const before = head();
	const refused = (named: string, n = 12) => `arthur merge: main has ${n} commits since its last merge that change code (${named}); only a merge puts code on main; the owner decides, and arthur take-main lifts it: main is unchanged`;
	assert.deepEqual(await merge(job.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: refused(`${plain.slice(0, 10).join(", ")} and 2 more`) });
	assert.equal(head(), before);
	git(root, "reset", "--quiet", "--keep", "HEAD~1");
	assert.equal((await merge(job.id, "--unreviewed", "--decision", OWNER)).err, refused(`${plain.slice(1, 11).join(", ")} and 1 more`, 11), "11 name 10 and 1 more");
	git(root, "reset", "--quiet", "--keep", "HEAD~1");
	assert.equal((await merge(job.id, "--unreviewed", "--decision", OWNER)).err, refused(plain.slice(2).join(", "), 10), "10 are named whole");
	assert.equal((await take()).code, undefined);
	assert.equal((await merge(job.id, "--unreviewed", "--decision", OWNER)).err, "");
});

test("a merge commit made on main outside arthur merge hides nothing: code before it or in it refuses the next merge; each merge that went in is recorded; a record HEAD no longer holds, or reaches only off its first-parent line, refuses until arthur take-main", async (t) => {
	const { root, fake, git, take, worker, merge, head } = await load(t);
	const record = join(fake.host.folder, "acme", "last-merge");
	const first = await worker();
	assert.equal((await merge(first.id, "--unreviewed", "--decision", OWNER)).err, "");
	const merged = head();
	assert.equal(readFileSync(record, "utf8"), `${merged}\n`, "the merge commit, written whole");
	assert.deepEqual(readdirSync(dirname(record)), ["last-merge"], "no temporary file left");
	const cart = await worker({ "cart.ts": "export const cart = 1;\n" }, "Ticket: spec/features/AC0002-cart/ticket.md");
	const refused = (commits: string) => `arthur merge: main has 1 commits since its last merge that change code (${commits}); only a merge puts code on main; the owner decides, and arthur take-main lifts it: main is unchanged`;
	// One code file committed alone, so `reset --keep` keeps the board's uncommitted moves (AC0002 in progress).
	const code = (path: string) => {
		writeFileSync(join(root, path), "export const code = 1;\n");
		git(root, "add", path);
		git(root, "commit", "--quiet", "-m", `add ${path}`);
		return git(root, "rev-parse", "--short", "HEAD");
	};
	// A job on main ends its code commit with a merge of its own, as the empty merge the owner was told to make.
	const hand = code("hand.ts");
	git(root, "merge", "--quiet", "--no-ff", "-m", "a job's own merge", git(root, "commit-tree", "-p", "HEAD", "-m", "empty", "HEAD^{tree}"));
	assert.deepEqual(await merge(cart.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: refused(hand) });
	// A job's `git merge --no-ff` of a branch of its own: the merge itself brings the code.
	git(root, "reset", "--quiet", "--keep", merged);
	git(root, "checkout", "--quiet", "-b", "side");
	code("side.ts");
	git(root, "checkout", "--quiet", "main");
	git(root, "merge", "--quiet", "--no-ff", "-m", "a job's merge of its branch", "side");
	assert.deepEqual(await merge(cart.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: refused(git(root, "rev-parse", "--short", "HEAD")) });
	// The recorded merge made a second parent: main's first-parent line runs through the job's code instead.
	git(root, "reset", "--quiet", "--keep", `${merged}^1`);
	code("off.ts");
	git(root, "merge", "--quiet", "--no-ff", "-m", "a merge that takes the recorded one as its second parent", merged);
	const before = head();
	const lift = "only a merge puts code on main; the owner decides, and arthur take-main lifts it: main is unchanged";
	assert.deepEqual(await merge(cart.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: `arthur merge: main's first-parent line no longer passes ${merged.slice(0, 7)}, the last merge arthur merge made; ${lift}` });
	assert.equal(head(), before);
	assert.equal(readFileSync(record, "utf8"), `${merged}\n`, "a refused merge records nothing");
	// Main reset below the recorded merge, its code ended with a job's own merge: the record is no ancestor of HEAD any more.
	git(root, "reset", "--quiet", "--keep", `${merged}^1`);
	code("below.ts");
	git(root, "merge", "--quiet", "--no-ff", "-m", "a job's own merge", git(root, "commit-tree", "-p", "HEAD", "-m", "empty", "HEAD^{tree}"));
	const below = head();
	assert.deepEqual(await merge(cart.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: `arthur merge: main no longer holds ${merged.slice(0, 7)}, the last merge arthur merge made; ${lift}` });
	assert.equal(head(), below);
	assert.equal(readFileSync(record, "utf8"), `${merged}\n`, "a refused merge records nothing");
	writeFileSync(record, `${"a".repeat(40)}\n`);
	assert.deepEqual(await merge(cart.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: `arthur merge: main no longer holds aaaaaaa, the last merge arthur merge made; ${lift}` }, "a full hash naming no commit here");
	// The owner keeps main as it is: arthur take-main records HEAD, and the branch goes in.
	assert.equal((await take()).code, undefined);
	assert.equal(readFileSync(record, "utf8"), `${below}\n`);
	assert.equal((await merge(cart.id, "--unreviewed", "--decision", OWNER)).err, "");
	assert.equal(readFileSync(record, "utf8"), `${head()}\n`, "the merge that went in recorded");
});

test("arthur take-main records main's HEAD only on the owner's merge decision of no ticket and no job; refused, it writes nothing; then the next merge goes in", async (t) => {
	const { root, fake, git, commit, take, worker, merge, run, head, owner } = await load(t);
	const record = join(fake.host.folder, "acme", "last-merge");
	const hand = git(root, "rev-parse", "--short", commit(root, { "hand.ts": "export const hand = 1;\n" }));
	const job = await worker();
	const refused = `arthur merge: main has 1 commits since its last merge that change code (${hand}); only a merge puts code on main; the owner decides, and arthur take-main lifts it: main is unchanged`;
	assert.deepEqual(await merge(job.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: refused });
	owner.length = 0;
	const none = await run("take-main", []);
	assert.equal(none.code, 1);
	assert.match(none.err, /^arthur take-main: arthur take-main needs the owner's decision: arthur decision ask --kind merge .*; nothing taken$/);
	assert.deepEqual(owner, [{ id: "", what: "arthur take-main", kind: "merge", use: `take-main acme ${head()}` }], "no ticket and no job");
	assert.deepEqual(await run("take-main", ["--decision", "AC-D9"]), { code: 1, out: "", err: "arthur take-main: AC-D9 is not in the decision log of project acme; nothing taken" });
	const usage = "usage: arthur take-main [--decision <id>] [--project <name>]";
	assert.deepEqual(await run("take-main", ["--decision"]), { code: 2, out: "", err: `arthur take-main: --decision needs a value\n${usage}` });
	assert.deepEqual(await run("take-main", ["--decision", "--now"]), { code: 2, out: "", err: `arthur take-main: --decision needs a value\n${usage}` });
	assert.deepEqual(await run("take-main", ["--now"]), { code: 2, out: "", err: `arthur take-main: unknown argument --now\n${usage}` });
	assert.deepEqual(await run("take-main", ["--decision", OWNER, "main"]), { code: 2, out: "", err: `arthur take-main: unknown argument main\n${usage}` });
	const command = fake.commands.find((each) => each.name === "take-main");
	assert.throws(() => command?.run({ args: ["--decision", OWNER], project: "nope" }), /^Error: no project nope in the project list$/);
	git(root, "config", "filter.x.smudge", "cat");
	assert.deepEqual(await take(), { code: 1, out: "", err: `arthur take-main: ${join(root, ".git", "config")} sets filter.x.smudge, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig; nothing taken` });
	git(root, "config", "--unset", "filter.x.smudge");
	assert.equal(existsSync(record), false, "a refused take writes nothing");
	mkdirSync(dirname(record), { recursive: true });
	writeFileSync(record, "HEAD\n");
	assert.equal((await merge(job.id, "--unreviewed", "--decision", OWNER)).err, refused, "a hand-edited record naming no full hash counts as none");
	assert.equal((await take()).code, undefined);
	assert.equal(readFileSync(record, "utf8"), `${head()}\n`);
	assert.equal((await merge(job.id, "--unreviewed", "--decision", OWNER)).err, "");
});

test("a failed check resets main and names it, pushing nothing; the board's moves stay, main's own install is put back over a fresh cache, nothing is written, both caches removed", async (t) => {
	const { root, fake, git, take, worker, review, merge, head, status, bun, caches, failBun, installs, uncapped } = await load(t);
	const pushes: unknown[] = [];
	fake.provide("github.push", (branch: unknown) => (pushes.push(branch), Promise.resolve("github: pushed")));
	const job = await worker({ broken: "", "bun.lock": '{ "broken": 1 }\n' });
	await review(job.id, "PASS");
	const before = head();
	const merged = await merge(job.id);
	assert.equal(merged.code, 1);
	assert.equal(merged.err, `arthur merge: check failed on main (npm test); main reset to ${before.slice(0, 7)}, branch kept`);
	assert.deepEqual(pushes, [{ project: "acme", branch: job.branch }], "the PASS pushed the branch; the failed merge pushed no main");
	assert.match(merged.out, /\nnpm test: failed, 1\/2 passed\.\n[\s\S]*ℹ pass 1\nreinstall of main's dependencies, bun install --frozen-lockfile: passed\.$/);
	assert.ok(uncapped.length <= 1, `one probe for the whole merge, the reinstall's runner included:\n${uncapped.join("\n")}`);
	assert.equal(bun(), "install --frozen-lockfile\ninstall --frozen-lockfile\n");
	assert.deepEqual(caches().map((each) => [dirname(dirname(each)), /^cache_/.test(basename(dirname(each))), existsSync(each)]), Array(2).fill([fake.host.folder, true, false]), "both caches in the plugin's folder, named as the sweep at a merge's start removes them, gone after the failed merge");
	assert.notEqual(dirname(caches()[1] ?? ""), dirname(caches()[0] ?? ""), "the reinstall's cache a fresh folder, not the one the branch's install wrote");
	const mergeCommit = git(root, "rev-parse", "ORIG_HEAD");
	assert.deepEqual(installs, [{ project: "acme", commit: "HEAD", head: mergeCommit }, { project: "acme", commit: "HEAD", head: before }], "asked again after the reset, for main's own");
	assert.equal(head(), before);
	assert.equal(readFileSync(join(root, "bun.lock"), "utf8"), "{}\n");
	assert.equal(git(root, "status", "--porcelain", "--untracked-files=no"), "M spec/build.json");
	assert.equal(status("AC0001"), "done", "the review's move to done is kept");
	assert.deepEqual(readdirSync(join(root, FOLDER)), ["ticket.md"], "no review filed, no outcome.md");
	assert.equal(existsSync(join(root, "CHANGELOG.md")), false, "no changelog for a merge that did not go in");
	writeFileSync(join(root, "package.json"), "{ not json");
	git(root, "commit", "--quiet", "-am", "a broken package.json");
	await take();
	assert.match((await merge(job.id)).err, /^arthur merge: check failed on main \(package\.json\); main reset to /);
	failBun();
	const install = await merge(job.id);
	assert.equal(
		install.err,
		`arthur merge: check failed on main (bun install --frozen-lockfile); main reset to ${head().slice(0, 7)}, branch kept, but reinstalling main's dependencies failed (bun install --frozen-lockfile): they still hold the branch's install`,
	);
	assert.doesNotMatch(install.out, /npm/, "a failed install ends the steps");
	assert.match(install.out, /error: lockfile had changes/);
});

test("a .git that what the checks left behind writes after their last sweep is removed after the reinstall's step, which sweeps against the merge's first look", async (t) => {
	const { root, worker, review, merge, hear } = await load(t);
	const job = await worker({ broken: "", "bun.lock": '{ "broken": 1 }\n' });
	await review(job.id, "PASS");
	// A process `npm test` left running, bare, that writes a repository once npm test's sweep is done: when its result is printed,
	// before the reinstall's runner exists, so a runner that took a look of its own then would count it as main's.
	hear((text) => void (text.startsWith("npm test: failed") && execFileSync("git", ["init", "-q", join(root, "late")])));
	const merged = await merge(job.id);
	assert.equal(merged.code, 1, merged.err);
	assert.match(merged.out, /\nremoved late\/\.git, which bun install --frozen-lockfile left: a git call in that folder would run its config outside any sandbox\nreinstall of main's dependencies, bun install --frozen-lockfile: passed\.$/);
	assert.deepEqual([existsSync(join(root, "late")), existsSync(join(root, "late", ".git"))], [true, false]);
});

test("a second merge of the project while the first runs its checks is refused naming the first, main unchanged; the lock goes with any end of the first, a dead holder's too", async (t) => {
	const { root, fake, git, worker, review, merge, head } = await load(t);
	const first = await worker({ broken: "" });
	const second = await worker({ "cart.ts": "export const cart = 1;\n" }, "Ticket: spec/features/AC0002-cart/ticket.md");
	assert.match((await merge(second.id)).err, /^arthur merge: no PASS on /, "a refused merge ends too");
	await review(first.id, "PASS");
	await review(second.id, "PASS");
	// `nvm.path` is asked as the checks on main begin, the first's merge commit HEAD: the second merge starts then.
	let during: Promise<unknown> | undefined;
	let armed = false;
	fake.provide("nvm.path", () => {
		if (armed && during === undefined) during = Promise.try(() => fake.commands.find((each) => each.name === "merge")?.run({ args: [second.id], project: undefined })).catch((error: Error) => error.message);
		return "";
	});
	const before = head();
	armed = true;
	const failed = await merge(first.id);
	assert.match(failed.err, /^arthur merge: check failed on main \(npm test\); main reset to /);
	assert.equal(await during, `a merge of ${first.id} is in progress on acme`);
	assert.equal(head(), before);
	assert.notEqual(spawnSync("git", ["-C", root, "merge-base", "--is-ancestor", second.tip, "HEAD"]).status, 0, "the second branch is not on main");
	// A merge of another process (this test's parent stands for it) that has not named its job yet: named by its pid.
	const lock = join(fake.host.folder, "acme", "merge.lock");
	writeFileSync(lock, `${process.ppid}`);
	assert.equal((await merge(second.id)).err, `arthur merge: a merge of pid ${process.ppid} is in progress on acme`);
	assert.equal(head(), before);
	// A merge killed while it held the lock left it: its pid is dead, so the next merge takes it over.
	writeFileSync(lock, `${spawnSync(process.execPath, ["-e", ""]).pid}`);
	const merged = await merge(second.id);
	assert.equal(merged.code, undefined, merged.err);
	assert.equal(git(root, "rev-parse", "HEAD^2"), second.tip);
	assert.deepEqual(readdirSync(join(fake.host.folder, "acme")), ["last-merge"], "no lock and no job named after the merge");
});

test("a step still running at merge.stepSeconds is killed and fails, though it ignores SIGTERM: main reset, main's own install put back", async (t) => {
	const { root, worker, review, merge, head, bun } = await load(t, { merge: { stepSeconds: 3 } });
	const noted = temporaryFolder();
	const slow = `require("node:fs").writeFileSync(${JSON.stringify(join(noted, "pid"))}, String(process.pid));\nprocess.on("SIGTERM", () => {});\nsetTimeout(() => {}, 60_000);\n`;
	const job = await worker({ "test.js": slow, "bun.lock": '{ "slow": 1 }\n' });
	await review(job.id, "PASS");
	const before = head();
	const merged = await merge(job.id);
	const pid = Number(readFileSync(join(noted, "pid"), "utf8"));
	t.after(() => void spawnSync("kill", ["-9", String(pid)]));
	assert.equal(merged.err, `arthur merge: check failed on main (npm test); main reset to ${before.slice(0, 7)}, branch kept`);
	assert.match(merged.out, /\nnpm run check: passed\.\nnpm test: failed, timed out after 3 s\.\n[\s\S]*\nreinstall of main's dependencies, bun install --frozen-lockfile: passed\.$/);
	assert.equal(bun(), "install --frozen-lockfile\ninstall --frozen-lockfile\n");
	assert.deepEqual([head(), readFileSync(join(root, "bun.lock"), "utf8")], [before, "{}\n"]);
	if (manager) assert.equal(running(pid), false, `the test's process ${pid} still runs`);
});

test("the install is the project's own, as projects.install answers: a custom command runs, none runs nothing though bun.lock changed, a throw fails the merge", async (t) => {
	const { root, worker, review, merge, head, status, bun, installAs } = await load(t);
	installAs("");
	const job = await worker({ "shop.ts": "export const shop = 1;\n", "bun.lock": '{ "shop": 1 }\n' });
	await review(job.id, "PASS");
	const none = await merge(job.id);
	assert.equal(none.code, undefined, none.err);
	assert.match(none.out, new RegExp(`^merged ${job.branch} into main: [0-9a-f]+\nnpm run check: passed\\.\nnpm test: 2/2 passed\\.\n`));
	assert.equal(bun(), "", "no install, though the merge changed bun.lock");
	installAs("bun run deps");
	const cart = "spec/features/AC0002-cart";
	const second = await worker({ "cart.ts": "export const cart = 1;\n" }, `Ticket: ${cart}/ticket.md`);
	await review(second.id, "PASS");
	const own = await merge(second.id);
	assert.equal(own.code, undefined, own.err);
	assert.match(own.out, new RegExp(`^merged ${second.branch} into main: [0-9a-f]+\nbun run deps: passed\\.\nnpm run check: passed\\.\n`));
	assert.equal(bun(), "run deps\n", "the project's own command, though no lockfile changed");
	assert.match(readFileSync(join(root, cart, "outcome.md"), "utf8"), /\n## Checks on main\n\n- `bun run deps`: passed\.\n/);
	const refusal = "project acme: two known lockfiles (bun.lock, package-lock.json) and no install; set install in its entry of arthur.config.ts";
	installAs(new Error(refusal));
	const pay = "spec/features/AC0003-pay";
	const third = await worker({ "pay.ts": "export const pay = 1;\n", "package-lock.json": "{}\n" }, `Ticket: ${pay}/ticket.md`);
	await review(third.id, "PASS");
	const before = head();
	const thrown = await merge(third.id);
	assert.equal(thrown.err, `arthur merge: check failed on main (install); main reset to ${before.slice(0, 7)}, branch kept`, "nothing ran, so nothing is reinstalled");
	assert.match(thrown.out, new RegExp(`^merged ${third.branch} into main: [0-9a-f]+\ninstall: failed, ${refusal.replace(/[()]/g, "\\$&")}\\.$`));
	assert.deepEqual([head(), bun(), status("AC0003")], [before, "run deps\n", "done"]);
});

test("with nvm.path provided, the install and checks run on its PATH, asked for main's checkout before them and again for the reinstall; a throw fails the merge", async (t) => {
	const { root, fake, git, take, worker, review, merge, head, status, installAs } = await load(t);
	// nvm's Node: a `node` that notes its arguments, then runs this Node.
	const node = temporaryFolder();
	writeFileSync(join(node, "node"), `#!/bin/sh\necho "$*" >> '${join(node, "node.log")}'\nexec '${process.execPath}' "$@"\n`, { mode: 0o755 });
	const ran = () => (existsSync(join(node, "node.log")) ? readFileSync(join(node, "node.log"), "utf8").split("\n") : []);
	const asked: unknown[] = [];
	let answer: string | Error = "";
	fake.provide("nvm.path", (request: { readonly root: string }) => {
		asked.push({ ...request, head: head() });
		if (answer instanceof Error) throw answer;
		return answer;
	});
	writeFileSync(join(root, "install.js"), 'console.log("installed");\n');
	git(root, "add", "install.js");
	git(root, "commit", "--quiet", "-m", "an install script");
	await take();
	installAs("node install.js");
	answer = `${node}${delimiter}${process.env.PATH}`;
	const job = await worker();
	await review(job.id, "PASS");
	const merged = await merge(job.id);
	assert.equal(merged.code, undefined, merged.err);
	assert.deepEqual(asked, [{ root, head: head() }], "asked once, for the merge commit, before the steps");
	assert.deepEqual([ran().includes("install.js"), ran().includes("-e "), ran().includes("test.js")], [true, true, true], ran().join("\n"));

	const cart = "spec/features/AC0002-cart";
	const second = await worker({ broken: "" }, `Ticket: ${cart}/ticket.md`);
	await review(second.id, "PASS");
	const before = head();
	const failing = await merge(second.id);
	assert.equal(failing.err, `arthur merge: check failed on main (npm test); main reset to ${before.slice(0, 7)}, branch kept`);
	assert.match(failing.out, /\nreinstall of main's dependencies, node install\.js: passed\.$/);
	assert.deepEqual(asked.slice(1), [{ root, head: git(root, "rev-parse", "ORIG_HEAD") }, { root, head: before }], "asked again for main's own after the reset");

	const refusal = `Node 99, which ${root}/.nvmrc names, is not installed on machine local; fix: nvm install 99 there`;
	answer = new Error(refusal);
	const calls = ran().length;
	const thrown = await merge(second.id);
	assert.equal(thrown.err, `arthur merge: check failed on main (node); main reset to ${before.slice(0, 7)}, branch kept`, "nothing ran, so nothing is reinstalled");
	assert.equal(thrown.out, `merged ${second.branch} into main: ${git(root, "rev-parse", "--short", "ORIG_HEAD")}\nnode: failed, ${refusal}.`);
	assert.deepEqual([head(), ran().length, status("AC0002")], [before, calls, "done"]);
});

test("refused before anything: wrong usage, no job, a read-only or running job, a gone branch, a detached or dirty main, nothing new, a ticket not mergeable", async (t) => {
	const { root, fake, git, worker, review, merge, head, status } = await load(t);
	const usage = "usage: arthur merge <job> [--auto | [--unreviewed] [--no-ci] --decision <id>]";
	assert.deepEqual(await merge(), { code: 2, out: "", err: `arthur merge: no job\n${usage}` });
	assert.equal((await merge("a", "b")).err, `arthur merge: one job; got 2\n${usage}`);
	assert.equal((await merge("a", "--force")).err, `arthur merge: unknown flag --force\n${usage}`);
	assert.deepEqual(await merge("a", "--no-ci"), { code: 1, out: "", err: "arthur merge: no job a; arthur jobs lists them" }, "--no-ci goes with a plain merge too");
	assert.deepEqual(await merge("a", "--auto", "--unreviewed"), { code: 2, out: "", err: `arthur merge: --auto merges only with a PASS, --unreviewed without one: one or the other\n${usage}` });
	assert.deepEqual(await merge("a", "--auto", "--no-ci"), { code: 2, out: "", err: `arthur merge: --auto merges only with CI passed, --no-ci without it on the owner's decision: one or the other\n${usage}` });
	assert.equal((await merge("a", "--auto", "--no-ci", "--decision", OWNER)).code, 2, "no decision lets --auto merge without CI");
	for (const args of [["--decision", OWNER], ["--auto", "--decision", OWNER]]) assert.equal((await merge("a", ...args)).err, `arthur merge: --decision goes with --unreviewed or --no-ci\n${usage}`, args.join(" "));
	for (const args of [["--unreviewed", "--decision"], ["--unreviewed", "--decision", "--no-ci"], ["--decision", "", "--unreviewed"], ["--no-ci", "--decision"]]) assert.equal((await merge("a", ...args)).err, `arthur merge: --decision needs a value\n${usage}`, args.join(" "));
	assert.equal((await merge("nope")).err, "arthur merge: no job nope; arthur jobs lists them");
	const job = await worker();
	const passed = await review(job.id, "PASS");
	assert.equal((await merge(passed)).err, `arthur merge: ${passed} is a review job, read-only: it has no branch to merge`);
	const start = head();
	writeFileSync(join(root, "README.md"), "# acme, edited\n");
	assert.equal((await merge(job.id)).err, "arthur merge: main has uncommitted changes in README.md; commit or stash them first; main is unchanged");
	git(root, "checkout", "--quiet", "README.md");
	git(root, "checkout", "--quiet", "--detach");
	assert.equal((await merge(job.id)).err, `arthur merge: ${root} has no branch checked out (a detached HEAD); check out its main branch first`);
	git(root, "checkout", "--quiet", "main");
	writeFileSync(join(root, FOLDER, "outcome.md"), "# by hand\n");
	assert.equal((await merge(job.id)).err, `arthur merge: ${FOLDER}/outcome.md already exists: AC0001 was merged before`);
	git(root, "clean", "--quiet", "--force", FOLDER);
	const two = await worker({ "two.ts": "export const two = 2;\n" }, `Ticket: ${TICKET}\nTicket: spec/features/AC0002-cart/ticket.md`);
	assert.equal((await merge(two.id)).err, `arthur merge: ${two.id}'s task names 2 tickets (${FOLDER}, spec/features/AC0002-cart); a merge is of one ticket's branch`);
	git(root, "update-ref", "-d", `refs/heads/${two.branch}`);
	assert.equal((await merge(two.id)).err, `arthur merge: ${two.branch} is not in ${root}: pruned, or not brought back from its machine`);
	fake.host.board.move("AC0001", "in-progress");
	fake.host.board.move("AC0001", "planning");
	assert.equal((await merge(job.id)).err, "arthur merge: AC0001 is planning; a merge is of a ticket in-progress, review or done");
	const none = await worker({}, "No ticket here.");
	assert.equal((await merge(none.id, "--unreviewed", "--decision", OWNER)).err, `arthur merge: ${none.branch} at ${start.slice(0, 7)} adds nothing to main (${start.slice(0, 7)}): nothing to merge`);
	assert.equal(head(), start);
	assert.equal(status("AC0001"), "planning");
	const gate = join(temporaryFolder(), "gate");
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ waitFor: gate }, { message: "done" }] }))}${delimiter}${process.env.PATH}`;
	const running = await fake.host.jobs.spawn({ task: "Still at it." });
	t.after(() => writeFileSync(gate, ""));
	assert.match((await merge(running.id)).err, new RegExp(`^arthur merge: ${running.id} is in a run \\((working|idle)\\); merge its branch once the run has ended$`));
});

test("merge.check: any text answer refuses with every answer, main unchanged and not pushed; none lets the branch in, a job naming no ticket included, and github.push pushes main", async (t) => {
	const { fake, git, root, worker, merge, head } = await load(t);
	const asked: unknown[] = [];
	const answers: (string | undefined)[] = ["the branch changes .nvmrc", undefined, "the owner holds this path"];
	for (const [at] of answers.entries()) fake.provide("merge.check", (job: unknown) => (asked.push(job), answers[at]));
	const pushes: unknown[] = [];
	fake.provide("github.push", (branch: unknown) => (pushes.push(branch), Promise.resolve("github: main not pushed to origin: [rejected] (non-fast-forward)")));
	const job = await worker({ "loose.ts": "export const loose = 1;\n" }, "No ticket here.");
	const start = head();
	assert.deepEqual(await merge(job.id, "--unreviewed", "--decision", OWNER), { code: 1, out: "", err: "arthur merge: refused by merge.check: the branch changes .nvmrc; the owner holds this path; main is unchanged" });
	assert.equal(head(), start);
	const record = fake.host.jobs.list().find((each) => each.id === job.id);
	assert.deepEqual(asked, [record, record, record], "asked with the job as arthur jobs holds it");
	assert.deepEqual(pushes, [], "a refused merge pushes nothing");
	answers.fill(undefined);
	const merged = await merge(job.id, "--unreviewed", "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.match(merged.out, new RegExp(`^merged ${job.branch} into main: [0-9a-f]+\nbun install --frozen-lockfile: passed\\.\nnpm run check: passed\\.\nnpm test: 2/2 passed\\.\nno ticket: no outcome\\.md, nothing moved\nwrote CHANGELOG\\.md: 0 merged tickets\n`));
	assert.ok(merged.out.endsWith(`wrote CHANGELOG.md: 0 merged tickets\ngithub: main not pushed to origin: [rejected] (non-fast-forward)\nnothing committed but the merge, nothing pruned\n\n${PROCEDURE}`), merged.out);
	assert.deepEqual(pushes, [{ project: "acme", branch: "main" }]);
	assert.equal(git(root, "log", "-1", "--format=%s"), `Merge ${job.branch}`);
});

// The run that built a branch as `github.ci` answers it (the github plugin's Run of GitHub's "List workflow runs for a
// workflow", every field, with `below`).
type CiRun = { id: number; attempt: number; sha: string; branch: string; status: string; conclusion: string | null; url: string; startedAt: string | null; below: number };
const ciRun = (sha: string, branch: string, more: Partial<CiRun> = {}): CiRun => ({ id: 7, attempt: 1, sha, branch, status: "completed", conclusion: "success", url: "https://github.com/acme/shop/actions/runs/7", startedAt: "2026-01-01T00:00:00Z", below: 0, ...more });

test("a plain merge asks github.ci: a run on the branch's own commits that ended other than success refuses, lifted by --no-ci with the owner's decision; a pending run, none, one on main, or github failing to tell merges", async (t) => {
	const { fake, worker, review, merge, head, owner } = await load(t);
	const asked: unknown[] = [];
	let answer: CiRun | undefined | Error;
	fake.provide("github.ci", async (request: unknown) => {
		asked.push(request);
		if (answer instanceof Error) throw answer;
		return answer;
	});
	const job = await worker();
	await review(job.id, "PASS");
	const start = head();
	answer = ciRun(job.tip, job.branch, { conclusion: "failure" });
	const why = `run 7, attempt 1, on ${job.tip.slice(0, 7)}, the tip, ended failure: https://github.com/acme/shop/actions/runs/7; why: arthur ci ${job.branch} --project acme`;
	assert.deepEqual(await merge(job.id), { code: 1, out: "", err: `arthur merge: arthur merge merges only with CI passed on the branch: ${why}; or merge it with --no-ci --decision <the owner's decision id>; main is unchanged` });
	assert.deepEqual(asked, [{ project: "acme", branch: job.branch }]);
	assert.equal(head(), start);
	answer = ciRun(job.tip, job.branch, { conclusion: "cancelled" });
	assert.match((await merge(job.id)).err, /, the tip, ended cancelled: /, "any end other than success refuses");
	// `decision.owner` holds --no-ci as it holds --unreviewed: its refusal refuses the merge before CI is asked, main unchanged.
	assert.deepEqual(await merge(job.id, "--no-ci"), { code: 1, out: "", err: "arthur merge: --no-ci needs the owner's decision: arthur decision ask --kind merge --question '<what he decides>' --ticket AC0001, his answer recorded with arthur decision answer, then --no-ci --decision <its id>; main is unchanged" });
	assert.deepEqual(await merge(job.id, "--decision", "AC-D9", "--no-ci"), { code: 1, out: "", err: "arthur merge: AC-D9 is not in the decision log of project acme; main is unchanged" });
	assert.equal(head(), start);
	const lifted = await merge(job.id, "--no-ci", "--decision", OWNER);
	assert.equal(lifted.code, undefined, lifted.err);
	assert.equal(asked.length, 2, "--no-ci asks no CI");
	const noCi = { what: "--no-ci", kind: "merge", ticket: "AC0001", job: job.id, use: `merge ${job.id}` };
	assert.deepEqual(owner, [{ ...noCi, id: "" }, { ...noCi, id: "AC-D9" }, { ...noCi, id: OWNER }], "asked only with --no-ci, of the job's ticket, for this merge");
	const runs: [string, (tip: string, branch: string) => CiRun | undefined | Error][] = [
		["queued", (tip, branch) => ciRun(tip, branch, { status: "queued", conclusion: null })],
		["in progress", (tip, branch) => ciRun(tip, branch, { status: "in_progress", conclusion: null })],
		["none", () => undefined],
		["failed on main", () => ciRun(start, "main", { conclusion: "failure", below: 1 })],
		["github could not tell", () => new Error("instance (unnamed): 401: the token in ARTHUR_GITHUB_TOKEN was refused: Bad credentials")],
	];
	for (const [at, [name, run]] of runs.entries()) {
		const each = await worker({ [`loose${at}.ts`]: `export const loose = ${at};\n` }, "No ticket here.");
		answer = run(each.tip, each.branch);
		const merged = await merge(each.id, "--unreviewed", "--decision", OWNER);
		assert.equal(merged.code, undefined, `${name}: ${merged.err}`);
		assert.deepEqual(asked.at(-1), { project: "acme", branch: each.branch }, name);
	}
	// Without a PASS and with CI failed, --unreviewed lifts only the PASS; both flags ask the owner's decision, one id for this merge.
	const both = await worker({ "both.ts": "export const both = 1;\n" }, "No ticket here.");
	answer = ciRun(both.tip, both.branch, { conclusion: "failure" });
	assert.match((await merge(both.id, "--unreviewed", "--decision", OWNER)).err, /merges only with CI passed on the branch: .*, ended failure: /);
	owner.length = 0;
	const merged = await merge(both.id, "--unreviewed", "--no-ci", "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	const asks = { kind: "merge", ticket: undefined, job: both.id, use: `merge ${both.id}`, id: OWNER };
	assert.deepEqual(owner, [{ ...asks, what: "--unreviewed" }, { ...asks, what: "--no-ci" }]);
});

test("findings go to findings.onMerge: none open makes no ticket, an open one's ticket gets the next id; without a provider they stay open, said once", async (t) => {
	const { root, fake, worker, review, merge, status } = await load(t);
	const findings = (folder: string, text: string) => writeFileSync(join(root, folder, "findings.md"), `# Findings\n\n${text}`);
	const entry = (n: number, state: string) => `## F${n}. Finding ${n}\n\n- What: something.\n- Status: ${state}\n\n`;
	const job = await worker({ [`${FOLDER}/findings.md`]: `# Findings\n\n${entry(1, "open")}` });
	await review(job.id, "PASS");
	const left = `- Findings: ${FOLDER}/findings.md left as it is, every open entry still open: no plugin provides findings.onMerge`;
	const merged = await merge(job.id);
	assert.equal(merged.out.split("\n").filter((line) => line.startsWith("- Findings:")).join("\n"), left, "said once");
	assert.ok(readFileSync(join(root, FOLDER, "outcome.md"), "utf8").endsWith(`\n## Left open\n\n${left}\n`));
	assert.match(readFileSync(join(root, FOLDER, "findings.md"), "utf8"), /- Status: open\n/);
	// The test as the findings plugin with its default: each open entry a planning ticket.
	const asked: unknown[] = [];
	fake.provide("findings.onMerge", (request: { readonly project: string; readonly ticket: string; readonly path: string; readonly root: string }) => {
		asked.push(request);
		const text = readFileSync(join(request.root, request.path), "utf8");
		const made = [...text.matchAll(/^## (F\d+)\. (.+)\n\n(?:- .+\n)*?- Status: open$/gm)].map(([, n, title]) => `${fake.host.board.create(title ?? "", request.project).id} (${n})`);
		return made.length === 0 ? "- Findings: none open; no ticket made." : `- Tickets from findings: ${made.join(", ")}.`;
	});
	fake.provide("findings.onMerge", () => {
		throw new Error("a second plugin broke");
	});
	const cart = "spec/features/AC0002-cart";
	const second = await worker({ "cart.ts": "export const cart = 1;\n" }, `Ticket: ${cart}/ticket.md`);
	findings(cart, entry(1, "fixed in abc1234") + entry(2, "dropped (not needed)"));
	await review(second.id, "PASS");
	const none = await merge(second.id);
	assert.equal(none.code, undefined, none.err);
	assert.match(none.out, /\n- Findings: none open; no ticket made\.\n- Findings: findings\.onMerge of test failed: a second plugin broke; spec\/features\/AC0002-cart\/findings\.md left as it is\n/);
	assert.deepEqual(asked, [{ project: "acme", ticket: "AC0002", path: `${cart}/findings.md`, root }]);
	assert.deepEqual(fake.host.board.list().map((ticket) => ticket.id), ["AC0001", "AC0002", "AC0003"], "no ticket made");
	const pay = "spec/features/AC0003-pay";
	const third = await worker({ "pay.ts": "export const pay = 1;\n" }, `Ticket: ${pay}/ticket.md`);
	findings(pay, entry(1, "fixed in abc1234") + entry(2, "open"));
	await review(third.id, "PASS");
	const made = await merge(third.id);
	assert.match(made.out, /\n- Tickets from findings: AC0004 \(F2\)\.\n/);
	assert.deepEqual([status("AC0003"), status("AC0004")], ["merged", "planning"], "the finding's ticket gets the next id after the board's");
	assert.match(readFileSync(join(root, pay, "outcome.md"), "utf8"), /\n## Left open\n\n- Tickets from findings: AC0004 \(F2\)\.\n- Findings: findings\.onMerge of test failed: /);
});

// A git with no identity anywhere, as on a fresh machine or runner: a user config that forbids guessing one (so a host with a
// full domain name makes up none), no system config, none in the environment; each variable put back after the test.
function noIdentityAnywhere(t: TestContext) {
	const names = ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL", "EMAIL"];
	const saved = names.map((name) => process.env[name]);
	t.after(() => names.forEach((name, at) => (saved[at] === undefined ? delete process.env[name] : (process.env[name] = saved[at]))));
	for (const name of names) delete process.env[name];
	const global = join(temporaryFolder(), "gitconfig");
	writeFileSync(global, "[user]\n\tuseConfigOnly = true\n");
	Object.assign(process.env, { GIT_CONFIG_GLOBAL: global, GIT_CONFIG_NOSYSTEM: "1" });
}

test("no git identity: arthur doctor's line per project says so and names the fix; arthur merge refuses before any check, main unchanged; Arthur sets none of its own", async (t) => {
	const { root, fake, git, worker, review, merge, head, status, installs } = await load(t);
	const doctor = async () => {
		const lists = fake.collect<readonly { readonly name: string; check(): Promise<string>; readonly costs: string; readonly fix: string }[]>("doctor");
		return Promise.all(lists.flat().map(async (each) => ({ name: each.name, said: await each.check(), costs: each.costs, fix: each.fix })));
	};
	const fix = `git config --global user.name "<your name>" and git config --global user.email "<your email>", or both with git -C ${root} config for this project alone`;
	assert.deepEqual(await doctor(), [{ name: "acme identity", said: "ok", costs: "arthur merge refuses every branch of acme: git has no author for the merge commit", fix }], "the repository's own identity is one");
	const job = await worker();
	await review(job.id, "PASS");
	noIdentityAnywhere(t);
	git(root, "config", "--unset", "user.name");
	git(root, "config", "--unset", "user.email");
	const author = new RegExp(`^missing: git var GIT_AUTHOR_IDENT in ${root}: fatal: .+$`);
	assert.match((await doctor())[0]?.said ?? "", author);
	const before = head();
	const refused = await merge(job.id);
	assert.equal(refused.code, 1);
	assert.match(refused.err, new RegExp(`^arthur merge: git has no identity for the merge commit: git var GIT_AUTHOR_IDENT in ${root}: fatal: .+; set one: ${fix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}; main is unchanged$`));
	assert.deepEqual([head(), status("AC0001"), installs], [before, "done", []], "refused before the merge and its checks");
	Object.assign(process.env, { GIT_AUTHOR_NAME: "a", GIT_AUTHOR_EMAIL: "a@example.com" });
	assert.match((await doctor())[0]?.said ?? "", new RegExp(`^missing: git var GIT_COMMITTER_IDENT in ${root}: fatal: `), "an author without a committer is no identity");
	delete process.env.GIT_AUTHOR_NAME;
	delete process.env.GIT_AUTHOR_EMAIL;
	execFileSync("git", ["-C", root, "config", "user.name", "Owner"]);
	execFileSync("git", ["-C", root, "config", "user.email", "owner@example.com"]);
	assert.equal((await doctor())[0]?.said, "ok", "a repository-local identity is one");
	const merged = await merge(job.id);
	assert.equal(merged.code, undefined, merged.err);
	assert.equal(git(root, "log", "-1", "--format=%an <%ae> %cn <%ce>"), "Owner <owner@example.com> Owner <owner@example.com>", "the merge commit is the owner's, none Arthur made");
});
