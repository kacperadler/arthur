import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { clock } from "../src/clock.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import { sandboxed, stepSandbox, writable } from "../src/job-sandbox.ts";
import { jobRunner } from "../src/jobs.ts";
import { fakeAgent, jobSlice, temporaryFolder } from "../src/testing.ts";

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

// `script` run by `sh -c` in the sandbox over `paths`, reading every file but `hidden`, from `cwd`: its output, and the lines the log was told.
function inside(paths: readonly string[], script: string, cwd?: string, hidden: readonly string[] = []): { readonly out: string; readonly log: readonly string[] } {
	const log: string[] = [];
	const [command, args] = sandboxed(paths, hidden, "sh", (line) => log.push(line))(["-c", script]);
	return { out: spawnSync(command, args, { cwd, encoding: "utf8" }).stdout, log };
}

// Why this host runs a job's agent bare (not Linux, no python3, a kernel without Landlock or a seccomp filter); the tests of the
// sandbox skip there, and only there: a sandbox that cannot start `sh` here is a failure.
const bare = inside([], "true").log[0]?.match(/^no sandbox: ((?:\w+ has no Landlock|python3|Landlock|seccomp)\b.*?);/)?.[1];

// omp's session lock (AR0406) as `python3 <file> <name>` takes it: a Unix datagram socket bound to an abstract name; refused, it
// fails as omp does, `Session persistence failed`, and exits 1. A test's names are its own, never omp's `omp-file-lock-<hash>`.
const lock = join(temporaryFolder(), "lock.py");
writeFileSync(lock, `import socket, sys\ntry: socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM | socket.SOCK_CLOEXEC).bind("\\0arthur-test-" + sys.argv[1])\nexcept OSError as error: sys.exit(f"Session persistence failed: Failed to acquire native file lock for {sys.argv[1]}: {error.strerror}")\n`);

// Which Unix socket kinds `sh -c` opens, a line each, and why the tests that need a Unix socket of this process (the lock, a
// server, systemd-run's bus) skip where the sandbox is set up: this process cannot open one itself, as in a job's own sandbox.
const sockets = `for kind in stream seqpacket; do python3 -c "import socket; socket.socket(socket.AF_UNIX, socket.SOCK_$(echo $kind | tr a-z A-Z))" 2>/dev/null && echo "$kind opened" || echo "$kind refused"; done`;
const unconfined = spawnSync("sh", ["-c", `python3 '${lock}' probe-${process.pid} && ${sockets}`], { encoding: "utf8" }).stdout === "stream opened\nseqpacket opened\n";
const locked = bare ?? (unconfined ? undefined : "this process cannot make a Unix socket itself (it runs in a job's sandbox)");

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
	assert.deepEqual(log, [`sandbox: the agent writes only in ${open}, ${join(folder, "single")}, ${join(folder, "missing")}, /dev, and opens no Unix socket but a datagram one`]);
});

test("a hidden path reads nowhere: not by its path, nor made later; a file beside it reads, a file made later in a folder above it does not", { skip: bare }, () => {
	const folder = temporaryFolder();
	const [open, shut] = [join(folder, "open"), join(folder, "shut")];
	mkdirSync(join(open, "kept"), { recursive: true });
	mkdirSync(shut);
	writeFileSync(join(open, "kept", "file"), "kept\n");
	writeFileSync(join(shut, "env"), "secret\n");
	writeFileSync(join(shut, "other"), "other\n");
	const reads = {
		"the hidden file": `cat '${join(shut, "env")}'`,
		"a file beside it": `cat '${join(shut, "other")}'`,
		"a file in a folder beside the path": `cat '${join(open, "kept", "file")}'`,
		"a hidden path made later": `mkdir '${join(open, "later")}' && echo x > '${join(open, "later", "env")}' && cat '${join(open, "later", "env")}'`,
		"a file made later in a folder above it": `echo x > '${join(open, "new")}' && cat '${join(open, "new")}'`,
	};
	const script = Object.entries(reads).map(([name, command]) => `if (${command}) >/dev/null 2>&1; then echo '${name} read'; else echo '${name} refused'; fi`).join("\n");
	const { out, log } = inside([open, "/dev"], script, folder, [join(shut, "env"), join(open, "later", "env")]);
	assert.deepEqual(out.trim().split("\n"), [
		"the hidden file refused",
		"a file beside it read",
		"a file in a folder beside the path read",
		"a hidden path made later refused",
		"a file made later in a folder above it refused",
	]);
	assert.deepEqual(log, [`sandbox: the agent writes only in ${open}, /dev, reads every file but ${join(shut, "env")}, ${join(open, "later", "env")}, and opens no Unix socket but a datagram one`]);
});

test("in the sandbox a Unix socket is refused, a server's that listens as well; TCP still connects", { skip: locked }, async (t) => {
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

test("in the sandbox omp's session lock binds its Unix datagram socket; a Unix stream or seqpacket socket is still refused", { skip: locked }, () => {
	assert.deepEqual(inside([], `python3 '${lock}' inside-${process.pid} && echo locked; ${sockets}`).out.split("\n"), ["locked", "stream refused", "seqpacket refused", ""]);
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
	assert.deepEqual(sandboxed(["/tmp"], [], missing, (line) => lines.push(line))(["-p"]), [missing, ["-p"]]);
	assert.deepEqual(lines, [`no sandbox: the agent ${missing} is not there; the agent writes wherever Arthur's user can`]);
});

test("without python3, or where it cannot set up the sandbox, the agent runs as it is and the log says why", (t) => {
	const bin = temporaryFolder();
	const path = process.env.PATH;
	t.after(() => (process.env.PATH = path));
	process.env.PATH = bin;
	const lines: string[] = [];
	const note = (line: string) => lines.push(line);
	assert.deepEqual(sandboxed(["/tmp"], [], "omp", note)(["-p", "task"]), ["omp", ["-p", "task"]]);
	writeFileSync(join(bin, "python3"), "#!/bin/sh\necho 'Traceback (most recent call last):' >&2\necho 'Landlock: Operation not supported' >&2\nexit 1\n", { mode: 0o755 });
	assert.deepEqual(sandboxed(["/tmp"], [], "omp", note)(["-p", "task"]), ["omp", ["-p", "task"]]);
	writeFileSync(join(bin, "python3"), "#!/bin/sh\nexit 3\n", { mode: 0o755 });
	assert.deepEqual(sandboxed(["/tmp"], [], "omp", note)(["-p", "task"]), ["omp", ["-p", "task"]]);
	const why = process.platform === "linux" ? ["python3: spawnSync python3 ENOENT", "Landlock: Operation not supported", "python3 exited 3"] : Array(3).fill(`${process.platform} has no Landlock`);
	assert.deepEqual(lines, why.map((reason) => `no sandbox: ${reason}; the agent writes wherever Arthur's user can`));
});

test("without python3, the install and each step of a plugin's sandbox run bare too, the install's log and the plugin told once why; a step's caches are still its own", (t) => {
	const path = process.env.PATH;
	t.after(() => (process.env.PATH = path));
	process.env.PATH = temporaryFolder();
	const lines: string[] = [];
	const note = (line: string) => lines.push(line);
	assert.deepEqual(sandboxed(["/tmp"], [], "sh", note, "the install")(["-c", "npm ci"]), ["sh", ["-c", "npm ci"]]);
	const cache = join(temporaryFolder(), "merge", "cache");
	const step = stepSandbox("/tmp", cache, { envFile: "/nowhere/env", home: "/nowhere/home", config: "/nowhere/arthur.config.ts" }, note);
	process.env.PATH = path;
	const ran = spawnSync(...step('echo "$npm_config_cache $XDG_CACHE_HOME"'), { encoding: "utf8" });
	assert.deepEqual([ran.stdout, existsSync(cache)], [`${join(cache, "npm")} ${cache}\n`, true]);
	const why = process.platform === "linux" ? "python3: spawnSync python3 ENOENT" : `${process.platform} has no Landlock`;
	assert.deepEqual(lines, [`no sandbox: ${why}; the install writes wherever Arthur's user can`, `no sandbox: ${why}; each step writes wherever Arthur's user can`]);
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

test("a merge step writes main's checkout but not its Git config, hooks or info, Arthur's home, config or env file, a new top-level entry, nor through a link", { skip: bare }, (t) => {
	const { folder, root } = repository();
	const [home, config, envFile, gitConfig] = [join(root, "ops", ".arthur"), join(root, "arthur.config.ts"), join(root, "env"), join(root, ".git", "config")];
	mkdirSync(join(root, "src"));
	mkdirSync(join(root, "ops", "notes"), { recursive: true });
	mkdirSync(home);
	writeFileSync(config, "export default {};\n");
	symlinkSync(".git", join(root, "linked"));
	const before = readFileSync(gitConfig, "utf8");
	// The temporary folder, which a step writes, moved beside the checkout, which the test's own temporary folder holds.
	const temporary = process.env.TMPDIR;
	t.after(() => (temporary === undefined ? delete process.env.TMPDIR : (process.env.TMPDIR = temporary)));
	process.env.TMPDIR = join(folder, "tmp");
	mkdirSync(process.env.TMPDIR);
	const lines: string[] = [];
	const cache = join(home, "delivery", "cache-1");
	const step = stepSandbox(root, cache, { envFile, home, config }, (line) => lines.push(line));
	const writes = {
		"a file in a folder": "echo x > src/made",
		"a top-level file in place": "echo x >> README.md",
		"beside the home": "echo x > ops/notes/made",
		"a Git object": "echo x | git hash-object -w --stdin >/dev/null",
		"its cache in the home": 'mkdir -p "$npm_config_cache/_npx" && echo x > "$XDG_CACHE_HOME/made"',
		"a new top-level file": "echo x > made",
		"a Git hook": "printf '#!/bin/sh\\ntouch planted\\n' > .git/hooks/post-commit && chmod +x .git/hooks/post-commit",
		"the Git config": "git config core.fsmonitor 'touch planted'",
		"the Git info": "echo '*' > .git/info/exclude",
		"a hook through a link": "echo x > linked/hooks/post-commit",
		"the home": "echo x > ops/.arthur/made",
		"the config": `echo x >> '${config}'`,
		"the env file": `echo X=1 > '${envFile}'`,
		"a new folder beside the home": "mkdir ops/made",
	};
	const ran = spawnSync(...step(tries(writes)), { cwd: root, encoding: "utf8" });
	assert.deepEqual(ran.stdout.trim().split("\n"), Object.keys(writes).map((name, at) => `${name} ${at < 5 ? "written" : "refused"}`));
	assert.deepEqual([existsSync(join(cache, "npm", "_npx")), readFileSync(join(cache, "made"), "utf8")], [true, "x\n"]);
	const planted = spawnSync(...step("echo x > .git/hooks/post-commit; git config core.fsmonitor 'touch planted'"), { cwd: root, encoding: "utf8" });
	assert.deepEqual([planted.status, planted.stderr.match(/Permission denied/g)?.length], [255, 2], planted.stderr);
	assert.equal(readFileSync(gitConfig, "utf8"), before);
	assert.deepEqual([existsSync(join(root, ".git", "hooks", "post-commit")), existsSync(join(root, "made")), existsSync(join(home, "made")), existsSync(envFile)], [false, false, false, false]);
	assert.equal(readFileSync(config, "utf8"), "export default {};\n");
	assert.equal(readFileSync(join(root, "src", "made"), "utf8"), "x\n");
	assert.match(spawnSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" }).stdout, /^ M README\.md$/m);
	// An env file in a folder not there leaves the rest writable; a home that is the checkout keeps all of it.
	for (const [arthur, result] of [[{ envFile: join(root, "missing", "env"), home, config }, "written"], [{ envFile, home: root, config }, "refused"]] as const) {
		const again = spawnSync(...stepSandbox(root, cache, arthur, (line) => lines.push(line))(tries({ "a file in a folder": "echo y > src/made" })), { cwd: root, encoding: "utf8" });
		assert.equal(again.stdout, `a file in a folder ${result}\n`, arthur.home);
	}
	assert.deepEqual(lines, []);
});

// Waits until `predicate` holds, at most 20 seconds.
async function until<T>(what: string, predicate: () => T | undefined): Promise<T> {
	for (const start = Date.now(); Date.now() - start < 20_000; await sleep(20)) {
		const value = predicate();
		if (value !== undefined) return value;
	}
	throw new Error(`timed out waiting for ${what}`);
}

test("a job's agent writes its worktree, a commit on its branch, its record and the temporary folder; never the main checkout, the shared Git config or hooks, nor the home folder", { skip: locked }, async () => {
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

test("a sandboxed job's agent takes omp's session lock, so a review whose final message ends PASS ends finished with that verdict", { skip: locked }, async () => {
	const { folder, root, home } = repository();
	const agent = join(folder, "agent");
	writeFileSync(agent, `#!/bin/sh\npython3 '${lock}' job-${process.pid} || exit 1\nexec '${fakeAgent({ steps: [{ message: "Clean.\n\nPASS\n" }] })}' "$@"\n`, { mode: 0o755 });
	const time = clock("UTC", undefined, () => new Date("2026-10-24T08:00:00Z"));
	const jobs = jobRunner(home, root, join(root, "env"), { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, agent, time, eventBus(home), () => []);
	jobs.registerKind("delivery", { name: "judged", readOnly: true, role: "worker", verdicts: ["PASS", "FAIL"] });
	const job = await jobs.spawn({ task: "Judge.", kind: "judged" });
	const ended = await until("job-ended", () => readEvents(home, 1).find((event) => event.name === "job-ended"));
	const log = readFileSync(join(home, "jobs", job.id, "log"), "utf8");
	assert.match(log, /\] sandbox: the agent writes only in /);
	assert.doesNotMatch(log, /Session persistence failed/);
	assert.deepEqual(ended.data, { id: job.id, kind: "judged", project: "acme", state: "ended", reason: "finished" });
});

// A runner process plays `arthur run`: started with a secret in its environment, as the daemon is with the env file's, it runs
// the same `jobRunner`, wrapper and sandbox, spawns one job, its prepare's variables `RUNNER_PID` and `env`, and lives on while
// its stdin is open.
const runner = `
import { clock } from ${JSON.stringify(import.meta.resolve("../src/clock.ts"))};
import { eventBus } from ${JSON.stringify(import.meta.resolve("../src/events.ts"))};
import { jobRunner } from ${JSON.stringify(import.meta.resolve("../src/jobs.ts"))};
const [home, root, agent, slice, env] = JSON.parse(process.argv[1]);
const time = clock("UTC", undefined, () => new Date("2026-10-24T08:00:00Z"));
const jobs = jobRunner(home, root, root + "/env", { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, ...slice }, agent, time, eventBus(home), () => []);
jobs.prepare("test", () => ({ RUNNER_PID: String(process.pid), ...env }));
await jobs.spawn({ task: "Read." });
process.stdin.resume();
`;

test("a sandboxed job's command cannot read the environment of the arthur run that spawned it, which holds a secret", { skip: bare }, async (t) => {
	const { folder, root, home } = repository();
	const agent = join(folder, "agent");
	writeFileSync(agent, `#!/bin/sh\n{ tr '\\0' '\\n' < "/proc/$RUNNER_PID/environ" || echo refused; } > "$ARTHUR_JOB/read" 2>&1\n`, { mode: 0o755 });
	const child = spawn(process.execPath, ["--input-type=module", "-e", runner, JSON.stringify([home, root, agent, jobSlice])], { env: { ...process.env, ARTHUR_TEST_TOKEN: "shell-t0ken" }, stdio: ["pipe", "inherit", "inherit"] });
	t.after(() => child.kill("SIGKILL"));
	await until("job-ended", () => readEvents(home, 1).find((event) => event.name === "job-ended"));
	assert.match(readFileSync(`/proc/${child.pid}/environ`, "utf8"), /(^|\0)ARTHUR_TEST_TOKEN=shell-t0ken\0/, "a process outside the sandbox reads the secret");
	const [id = ""] = readdirSync(join(home, "jobs"));
	const record = join(home, "jobs", id);
	const read = readFileSync(join(record, "read"), "utf8");
	assert.match(read, /Permission denied/);
	assert.match(read, /refused/);
	assert.doesNotMatch(read, /shell-t0ken/);
	assert.match(readFileSync(join(record, "log"), "utf8"), /\] sandbox: the agent writes only in /);
});

test("a job's install runs in its sandbox: it writes its worktree and its own caches in the record, never the shared ones (~/.npm/_npx) nor beside them, and reads neither the arthur run's environment nor the env file", { skip: bare }, async (t) => {
	const { folder, root, home } = repository();
	writeFileSync(join(root, "env"), "ARTHUR_SECRET_TOKEN=s3cret-t0ken\n");
	// The arthur run's own HOME, with the shared caches an install wrote before AR0454: npm's `_npx`, and pnpm's in XDG_CACHE_HOME.
	const [user, shared, temporary] = [join(folder, "user"), join(folder, "cache"), join(folder, "tmp")];
	mkdirSync(join(user, ".npm", "_npx"), { recursive: true });
	mkdirSync(join(shared, "pnpm"), { recursive: true });
	mkdirSync(temporary);
	// What an `npx` planted in the shared cache would be, as Node's own mkdir reports it, then where npm's cache is.
	const npx = join(folder, "npx.cjs");
	writeFileSync(npx, 'const { join } = require("node:path");\ntry {\n\trequire("node:fs").mkdirSync(join(require("node:os").homedir(), ".npm", "_npx", "x"));\n\tconsole.log("written");\n} catch (error) {\n\tconsole.log(error.code);\n}\nconsole.log(process.env.npm_config_cache);\n');
	const reads = `{ tr '\\0' '\\n' < "/proc/$RUNNER_PID/environ" || echo refused; } > environ 2>&1; { cat '${join(root, "env")}' || echo refused; } > env 2>&1`;
	const writes = tries({ worktree: "echo x > made", "own npm cache": 'mkdir -p "$npm_config_cache/_npx/x"', "shared pnpm cache": `echo x > '${join(shared, "pnpm", "store")}'`, beside: `echo x > '${join(folder, "planted")}'` });
	const env = { TMPDIR: temporary, XDG_CACHE_HOME: shared, ARTHUR_INSTALL: `${reads}\n'${process.execPath}' '${npx}' > npx\n{\n${writes}\n} > writes` };
	const agent = join(folder, "agent");
	writeFileSync(agent, "#!/bin/sh\necho ran > ran\n", { mode: 0o755 });
	const child = spawn(process.execPath, ["--input-type=module", "-e", runner, JSON.stringify([home, root, agent, jobSlice, env])], { env: { ...process.env, HOME: user, ARTHUR_TEST_TOKEN: "shell-t0ken" }, stdio: ["pipe", "inherit", "inherit"] });
	t.after(() => child.kill("SIGKILL"));
	await until("job-ended", () => readEvents(home, 1).find((event) => event.name === "job-ended"));
	assert.match(readFileSync(`/proc/${child.pid}/environ`, "utf8"), /(^|\0)ARTHUR_TEST_TOKEN=shell-t0ken\0/, "a process outside the sandbox reads the secret");
	const [id = ""] = readdirSync(join(home, "jobs"));
	const record = join(home, "jobs", id);
	const worktree = readFileSync(join(record, "worktree"), "utf8");
	const read = (name: string) => readFileSync(join(worktree, name), "utf8");
	assert.equal(read("ran"), "ran\n", "the install passed, so the agent ran");
	for (const name of ["environ", "env"]) {
		assert.match(read(name), /Permission denied\nrefused\n$/, name);
		assert.doesNotMatch(read(name), /shell-t0ken|s3cret-t0ken/, name);
	}
	assert.equal(read("npx"), `EACCES\n${join(record, "cache", "npm")}\n`);
	assert.deepEqual(readdirSync(join(user, ".npm", "_npx")), [], "nothing planted in the shared npx cache");
	assert.deepEqual(read("writes").split("\n"), ["worktree written", "own npm cache written", "shared pnpm cache refused", "beside refused", ""]);
	assert.deepEqual([existsSync(join(record, "cache", "npm", "_npx", "x")), existsSync(join(shared, "pnpm", "store"))], [true, false]);
	const log = readFileSync(join(record, "log"), "utf8");
	const [install, agentWrites] = ["the install", "the agent"].map((who) => log.match(new RegExp(`\\] sandbox: ${who} writes only in (.*), reads every file but ${join(root, "env")}, `))?.[1]);
	assert.equal(install, agentWrites, "the install writes no path the agent does not");
	assert.match(install ?? "", new RegExp(`^${worktree}, ${record}, `));
});

test("an install that empties the record's guarded list does not unhide the env file: the agent still cannot read it", { skip: bare }, async (t) => {
	const { folder, root, home } = repository();
	writeFileSync(join(root, "env"), "ARTHUR_SECRET_TOKEN=s3cret-t0ken\n");
	const env = { ARTHUR_INSTALL: `for guarded in '${join(home, "jobs")}'/*/guarded; do : > "$guarded"; done` };
	const agent = join(folder, "agent");
	writeFileSync(agent, `#!/bin/sh\n{ cat '${join(root, "env")}' || echo refused; } > "$ARTHUR_JOB/read" 2>&1\n`, { mode: 0o755 });
	const child = spawn(process.execPath, ["--input-type=module", "-e", runner, JSON.stringify([home, root, agent, jobSlice, env])], { stdio: ["pipe", "inherit", "inherit"] });
	t.after(() => child.kill("SIGKILL"));
	await until("job-ended", () => readEvents(home, 1).find((event) => event.name === "job-ended"));
	const [id = ""] = readdirSync(join(home, "jobs"));
	const record = join(home, "jobs", id);
	assert.equal(readFileSync(join(record, "guarded"), "utf8"), "", "the install emptied the guarded list");
	assert.match(readFileSync(join(record, "read"), "utf8"), /Permission denied\nrefused\n$/);
	for (const name of readdirSync(record, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())) {
		assert.doesNotMatch(readFileSync(join(name.parentPath, name.name), "utf8"), /s3cret-t0ken/, name.name);
	}
});

// A config in `folder` with the env file `envFile` and the home `home`: orchestration, `secret`, whose `leak` prints its token,
// and `plain`, whose `plain` needs none; both commands run inside a job.
function tokenConfig(folder: string, envFile: string, home: string): string {
	const doc = `new URL(${JSON.stringify(pathToFileURL(join(folder, "command.md")).href)})`;
	const command = (name: string, run: string) => `host.commands.register({ name: "${name}", doc: ${doc}, inJob: true, run: () => console.log(${run}) })`;
	return `export default { core: { home: ${JSON.stringify(home)}, envFile: ${JSON.stringify(envFile)}, timeZone: "UTC" }, plugins: [
	{ name: "orchestration", setup() {} },
	{ name: "secret", options: { tokenEnv: "ARTHUR_SECRET_TOKEN" }, setup(host) { ${command("leak", '"leaked " + host.env.ARTHUR_SECRET_TOKEN')}; } },
	{ name: "plain", setup(host) { ${command("plain", '"plain ran"')}; } },
] };
`;
}

test("a sandboxed job reads no token of the env file: not by its path, a link, nor arthur with a config and home of its own and ARTHUR_JOB cleared", { skip: bare }, async () => {
	const { folder, root, home } = repository();
	const envFile = join(folder, "private", "arthur-env");
	mkdirSync(dirname(envFile));
	writeFileSync(envFile, "ARTHUR_SECRET_TOKEN=s3cret-t0ken\n");
	writeFileSync(join(folder, "command.md"), "# arthur command\n");
	writeFileSync(join(folder, "arthur.config.ts"), tokenConfig(folder, envFile, home));
	writeFileSync(join(folder, "own.config.ts"), tokenConfig(folder, envFile, "./home"));
	const cli = join(import.meta.dirname, "..", "src", "cli.ts");
	const arthur = (cwd: string, name: string) => spawnSync(process.execPath, [cli, name], { cwd, encoding: "utf8", env: { PATH: process.env.PATH ?? "" } });
	assert.equal(arthur(folder, "plain").stdout, "plain ran\n", "the plugins' folders made as arthur run makes them");
	const temporary = join(folder, "tmp");
	mkdirSync(temporary);
	const node = `'${process.execPath}' '${cli}'`;
	const reads = {
		file: `cat '${envFile}'`,
		link: `ln -s '${envFile}' "$TMPDIR/link" && cat "$TMPDIR/link"`,
		hard: `ln '${envFile}' "$TMPDIR/hard" && cat "$TMPDIR/hard"`,
		plain: `cd '${folder}' && ${node} plain`,
		leak: `cd '${folder}' && ${node} leak`,
		attack: `mkdir own && cp '${join(folder, "own.config.ts")}' own/arthur.config.ts && cd own && env -u ARTHUR_JOB ${node} leak`,
	};
	const agent = join(folder, "agent");
	writeFileSync(agent, `#!/bin/sh\n${Object.entries(reads).map(([name, command]) => `(${command}) > "$ARTHUR_JOB/${name}" 2>&1`).join("\n")}\n`, { mode: 0o755 });
	const time = clock("UTC", undefined, () => new Date("2026-10-24T08:00:00Z"));
	const jobs = jobRunner(home, root, envFile, { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, agent, time, eventBus(home), () => []);
	jobs.prepare("test", () => ({ TMPDIR: temporary }));
	const job = await jobs.spawn({ task: "Read." });
	await until("job-ended", () => readEvents(home, 1).find((event) => event.name === "job-ended"));
	const record = join(home, "jobs", job.id);
	const out = Object.fromEntries(Object.keys(reads).map((name) => [name, readFileSync(join(record, name), "utf8")]));
	for (const [name, text] of Object.entries(out)) assert.doesNotMatch(text, /s3cret-t0ken/, name);
	assert.match(out.file ?? "", /Permission denied/);
	assert.match(out.link ?? "", /Permission denied/);
	assert.match(out.hard ?? "", /^ln: /);
	const skipped = "arthur: inside a job, not loaded: secret: each names an env variable, and a job's CLI reads no env file\n";
	assert.equal(out.plain, `${skipped}plain ran\n`);
	assert.match(out.leak ?? "", new RegExp(`^${skipped}arthur: unknown command leak\n`));
	assert.match(out.attack ?? "", new RegExp(`^arthur: unknown command leak\n[\\s\\S]*${envFile}: cannot be read \\(EACCES\\)`));
	assert.match(readFileSync(join(record, "log"), "utf8"), new RegExp(`\\] sandbox: the agent writes only in .*, reads every file but ${envFile}, `));
	const worktree = readFileSync(join(record, "worktree"), "utf8");
	assert.equal(arthur(join(worktree, "own"), "leak").stdout, "leaked s3cret-t0ken\n", "outside the sandbox the same command reads the token");
});
