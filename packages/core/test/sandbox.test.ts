import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { clock } from "../src/clock.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import { sandboxed, writable } from "../src/job-sandbox.ts";
import { jobRunner } from "../src/jobs.ts";
import { jobSlice, temporaryFolder } from "../src/testing.ts";

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

// `script` run by `sh -c` in the sandbox over `paths`, from `cwd`: its output, and the lines the log was told.
function inside(paths: readonly string[], script: string, cwd?: string): { readonly out: string; readonly log: readonly string[] } {
	const log: string[] = [];
	const [command, args] = sandboxed(paths, "sh", ["-c", script], (line) => log.push(line));
	return { out: spawnSync(command, args, { cwd, encoding: "utf8" }).stdout, log };
}

// Why this host runs a job's agent bare (not Linux, no python3, a kernel without Landlock); the tests of the sandbox skip there.
const bare = inside([], "true").log[0]?.match(/^no sandbox: (.*?);/)?.[1];

// Each `write` is a shell command; the line says whether it wrote.
const tries = (writes: Readonly<Record<string, string>>) =>
	Object.entries(writes)
		.map(([name, command]) => `if (${command}) 2>/dev/null; then echo '${name} written'; else echo '${name} refused'; fi`)
		.join("\n");

test("a write beneath a writable path passes; beside it, above it, through a link out of it, or moving a file out is refused", { skip: bare }, () => {
	const folder = temporaryFolder();
	const [open, shut] = [join(folder, "open"), join(folder, "shut")];
	mkdirSync(open);
	mkdirSync(shut);
	writeFileSync(join(shut, "kept"), "kept\n");
	writeFileSync(join(folder, "single"), "");
	symlinkSync(shut, join(open, "out"));
	const writes = {
		"a new file": "echo x > new",
		"a folder and a file in it": "mkdir sub && echo x > sub/file",
		"a rename and a removal": "mv sub/file moved && rm moved && rmdir sub",
		"the writable file": "echo x >> ../single",
		"a file beside": "echo x > ../shut/new",
		"an existing file beside": "echo x >> ../shut/kept",
		"a removal beside": "rm ../shut/kept",
		"a new file above": "echo x > ../new",
		"a file through a link out": "echo x > out/new",
		"a file moved out": "echo x > leaving && mv leaving ../shut/",
		"a file next to the writable file": "echo x > ../single-2",
	};
	const { out, log } = inside([open, join(folder, "single"), join(folder, "missing"), "/dev"], tries(writes), open);
	assert.deepEqual(out.trim().split("\n"), [
		"a new file written",
		"a folder and a file in it written",
		"a rename and a removal written",
		"the writable file written",
		"a file beside refused",
		"an existing file beside refused",
		"a removal beside refused",
		"a new file above refused",
		"a file through a link out refused",
		"a file moved out refused",
		"a file next to the writable file refused",
	]);
	assert.equal(readFileSync(join(shut, "kept"), "utf8"), "kept\n");
	assert.deepEqual(log, [`sandbox: the agent writes only in ${open}, ${join(folder, "single")}, ${join(folder, "missing")}, /dev, and opens no Unix socket`]);
});

test("in the sandbox a Unix socket is refused, a server's that listens as well; TCP still connects", { skip: bare }, async (t) => {
	const folder = temporaryFolder();
	const socket = join(folder, "server.sock");
	const [unix, tcp] = [createServer(), createServer()];
	t.after(() => [unix, tcp].forEach((server) => server.close()));
	await new Promise<void>((done) => unix.listen(socket, done));
	await new Promise<void>((done) => tcp.listen(0, "127.0.0.1", done));
	const address = tcp.address();
	const port = typeof address === "object" && address !== null ? address.port : 0;
	const connect = (target: string) => `node -e 'require("net").connect(${target}).on("connect", () => { console.log("connected"); process.exit(0); }).on("error", (error) => { console.log(error.code); process.exit(0); })'`;
	const script = `${connect(JSON.stringify(socket))}; ${connect(`${port}, "127.0.0.1"`)}`;
	assert.deepEqual(spawnSync("sh", ["-c", script], { encoding: "utf8" }).stdout.split("\n"), ["connected", "connected", ""], "outside the sandbox both connect");
	assert.deepEqual(inside([folder], script).out.split("\n"), ["EACCES", "connected", ""]);
});

test("python3 loads no module of the agent's folder before the sandbox is set", { skip: bare }, () => {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "ctypes.py"), `open(${JSON.stringify(join(folder, "loaded"))}, "w").close()\nraise SystemExit(0)\n`);
	const { out, log } = inside([folder], "echo started", folder);
	assert.equal(out, "started\n");
	assert.match(log[0] ?? "", /^sandbox: /);
	assert.equal(existsSync(join(folder, "loaded")), false);
});

test("an agent the sandbox's shell does not find starts bare, so it fails to start as it would without a sandbox", { skip: bare }, () => {
	const lines: string[] = [];
	const missing = join(temporaryFolder(), "omp");
	assert.deepEqual(sandboxed(["/tmp"], missing, ["-p"], (line) => lines.push(line)), [missing, ["-p"]]);
	assert.deepEqual(lines, [`no sandbox: the agent ${missing} is not there; the agent writes wherever Arthur's user can`]);
});

test("without python3, or where it cannot set up the sandbox, the agent runs as it is and the log says why", (t) => {
	const bin = temporaryFolder();
	const path = process.env.PATH;
	t.after(() => (process.env.PATH = path));
	process.env.PATH = bin;
	const lines: string[] = [];
	const note = (line: string) => lines.push(line);
	assert.deepEqual(sandboxed(["/tmp"], "omp", ["-p", "task"], note), ["omp", ["-p", "task"]]);
	writeFileSync(join(bin, "python3"), "#!/bin/sh\necho 'Traceback (most recent call last):' >&2\necho 'Landlock: Operation not supported' >&2\nexit 1\n", { mode: 0o755 });
	assert.deepEqual(sandboxed(["/tmp"], "omp", ["-p", "task"], note), ["omp", ["-p", "task"]]);
	writeFileSync(join(bin, "python3"), "#!/bin/sh\nexit 3\n", { mode: 0o755 });
	assert.deepEqual(sandboxed(["/tmp"], "omp", ["-p", "task"], note), ["omp", ["-p", "task"]]);
	const why = process.platform === "linux" ? ["python3: spawnSync python3 ENOENT", "Landlock: Operation not supported", "python3 exited 3"] : Array(3).fill(`${process.platform} has no Landlock`);
	assert.deepEqual(lines, why.map((reason) => `no sandbox: ${reason}; the agent writes wherever Arthur's user can`));
});

// A repository `acme` with a job's worktree on its branch, and the job's record in a home folder beside it.
function repository(): { readonly folder: string; readonly root: string; readonly home: string } {
	const folder = temporaryFolder();
	const root = join(folder, "acme");
	mkdirSync(root);
	git(root, "init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), "acme\n");
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "first");
	return { folder, root, home: join(folder, "home") };
}

test("writable: the worktree, the record, the Git folders a commit writes, the temporary folder, /dev, omp's state, and each extension's folder, made", () => {
	const { folder, root, home } = repository();
	const worktree = join(folder, ".arthur-worktrees", "2026-10-24-worker-0a1b2c3d");
	git(root, "worktree", "add", "--quiet", "-b", "arthur/2026-10-24-worker-0a1b2c3d", worktree);
	const record = join(home, "jobs", "2026-10-24-worker-0a1b2c3d");
	const extension = join("..", "..", "delivery", "src", "checks-extension.ts");
	const dotGit = join(root, ".git");
	assert.deepEqual(writable(record, worktree, `${extension}\n`), [worktree, record, join(dotGit, "worktrees", "2026-10-24-worker-0a1b2c3d"), join(dotGit, "objects"), join(dotGit, "refs"), join(dotGit, "logs"), tmpdir(), "/dev", join(homedir(), ".omp"), join(home, "delivery", "2026-10-24-worker-0a1b2c3d")]);
	assert.equal(existsSync(join(home, "delivery", "2026-10-24-worker-0a1b2c3d")), true);
	assert.deepEqual(writable(record, join(folder, "gone"), ""), [join(folder, "gone"), record, tmpdir(), "/dev", join(homedir(), ".omp")], "no Git folder for a worktree Git does not know");
});

// Waits until `predicate` holds, at most 20 seconds.
async function until<T>(what: string, predicate: () => T | undefined): Promise<T> {
	for (const start = Date.now(); Date.now() - start < 20_000; await sleep(20)) {
		const value = predicate();
		if (value !== undefined) return value;
	}
	throw new Error(`timed out waiting for ${what}`);
}

test("a job's agent writes its worktree, a commit on its branch, its record and the temporary folder; never the main checkout, the shared Git config or hooks, nor the home folder", { skip: bare }, async () => {
	const { folder, root, home } = repository();
	const temporary = join(folder, "tmp");
	mkdirSync(temporary);
	const agent = join(folder, "agent");
	const writes = {
		worktree: "echo x > new.txt",
		commit: "git add new.txt && git -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false commit --quiet -m sandboxed",
		record: 'echo x > "$ARTHUR_JOB/note"',
		temporary: 'echo x > "$TMPDIR/scratch"',
		"main checkout": `echo x >> '${join(root, "README.md")}'`,
		"shared Git config": "git config sandbox.test 1",
		"Git hooks": `echo x > '${join(root, ".git", "hooks", "pre-commit")}'`,
		"home folder": `echo x > '${join(home, "planted")}'`,
		"beside the repository": `echo x > '${join(folder, "planted")}'`,
	};
	writeFileSync(agent, `#!/bin/sh\n{\n${tries(writes)}\n} > results\n`, { mode: 0o755 });
	const time = clock("UTC", undefined, () => new Date("2026-10-24T08:00:00Z"));
	const jobs = jobRunner(home, root, join(root, "env"), { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, agent, time, eventBus(home), () => []);
	jobs.prepare("test", () => ({ TMPDIR: temporary }));
	const job = await jobs.spawn({ task: "Write." });
	await until("job-ended", () => readEvents(home, 1).find((event) => event.name === "job-ended"));
	const record = join(home, "jobs", job.id);
	const worktree = readFileSync(join(record, "worktree"), "utf8");
	assert.deepEqual(readFileSync(join(worktree, "results"), "utf8").trim().split("\n"), [
		"worktree written",
		"commit written",
		"record written",
		"temporary written",
		"main checkout refused",
		"shared Git config refused",
		"Git hooks refused",
		"home folder refused",
		"beside the repository refused",
	]);
	assert.equal(git(root, "log", "--format=%s", "-1", `arthur/${job.id}`), "sandboxed");
	assert.equal(readFileSync(join(record, "note"), "utf8"), "x\n");
	assert.equal(readFileSync(join(root, "README.md"), "utf8"), "acme\n");
	assert.match(readFileSync(join(record, "log"), "utf8"), new RegExp(`\\] sandbox: the agent writes only in ${worktree}, ${record}, .*${temporary}, /dev, `));
});
