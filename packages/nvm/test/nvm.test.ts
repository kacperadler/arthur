import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { Requirement } from "@arthur/core/plugin";
import { type FakeHost, fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { checkOptions } from "../src/nvm-options.ts";
import { nvm } from "../src/nvm.ts";

// The nvm plugin against the fake host and a fake `$NVM_DIR/nvm.sh`, whose `nvm which <version>` answers the newest
// `versions/node/v<version>*/bin/node` there as nvm does, and says what nvm says of a version not installed.

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
// What `arthur init` writes into a repository: the major version of the Node it runs on.
const MAJOR = process.versions.node.split(".")[0] ?? "";
const CLI = fileURLToPath(import.meta.resolve("@arthur/core/cli"));

function repository(files: Readonly<Record<string, string>>): string {
	const root = temporaryFolder();
	git(root, "init", "--quiet", "--initial-branch=main");
	for (const [path, text] of Object.entries({ "README.md": "# demo\n", ...files })) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	return root;
}

// nvm in `folder` with each of `versions` installed, its `node` this Node; each call of `nvm` noted in `folder/calls`.
function fakeNvm(folder: string, versions: readonly string[]): string {
	mkdirSync(folder, { recursive: true });
	for (const version of versions) {
		mkdirSync(join(folder, "versions/node", `v${version}`, "bin"), { recursive: true });
		symlinkSync(process.execPath, join(folder, "versions/node", `v${version}`, "bin/node"));
	}
	// As nvm, it finds its versions through NVM_DIR, which it cannot guess when dash sources it.
	writeFileSync(
		join(folder, "nvm.sh"),
		`nvm() {
  echo "$*" >> "$NVM_DIR/calls"
  case "$1" in
  --version) echo 0.40.8 ;;
  which)
    found=$(for d in "$NVM_DIR"/versions/node/v"$2" "$NVM_DIR"/versions/node/v"$2".*; do [ -x "$d/bin/node" ] && echo "$d/bin/node"; done | sort -V | tail -n 1)
    [ -n "$found" ] && { echo "$found"; return 0; }
    echo "N/A: version \\"v$2\\" is not yet installed." >&2
    echo >&2
    echo "You need to run \\\`nvm install $2\\\` to install and use it." >&2
    return 1 ;;
  esac
}
`,
	);
	return folder;
}

// The agent as `omp` on PATH: it notes its environment in its worktree, then plays the fake agent.
const bin = temporaryFolder();
const agent = fakeAgent({ steps: [{ message: "Done." }] });
writeFileSync(join(bin, "omp"), `#!/bin/sh\nenv > "$PWD/.agent-env"\nexec '${agent}' "$@"\n`, { mode: 0o755 });

// The fake `ssh`: it notes each call in `ssh.log` and runs the command in the folder `machine` names, as ssh runs one in a
// login's home there: HOME that folder, no NVM_DIR, `<machine>/bin` first on PATH, where `arthur` is this core.
const sshLog = join(bin, "ssh.log");
writeFileSync(
	join(bin, "ssh"),
	`#!/bin/sh
printf '%s\\n' "$*" >> '${sshLog}'
machine=$(cat '${join(bin, "machine")}')
while [ $# -gt 0 ]; do case "$1" in -o|-p|-l) shift 2;; -*) shift;; *) break;; esac; done
shift
cd "$machine" && HOME="$machine" PATH="$machine/bin:$MACHINE_PATH" exec env -u NVM_DIR sh -c "$*"
`,
	{ mode: 0o755 },
);
process.env.PATH = [bin, process.env.PATH].join(delimiter);
// The machine's PATH has no `arthur` but its own: not the one `npm test` puts on this PATH.
process.env.MACHINE_PATH = (process.env.PATH ?? "").split(delimiter).filter((folder) => !folder.includes("node_modules")).join(delimiter);

// The plugin loaded on `root`, nvm in `nvmDir`; `before` is a prepare that runs before nvm's. The prepare after it notes what it gets.
async function load(root: string, nvmDir: string, before?: () => Readonly<Record<string, string>>) {
	process.env.NVM_DIR = nvmDir;
	const fake = fakeHost({ name: "nvm", root });
	if (before !== undefined) fake.host.jobs.prepare(before);
	await fake.setup(nvm());
	const after: Readonly<Record<string, string>>[] = [];
	fake.host.jobs.prepare((_job, env) => void after.push(env));
	return { fake, after, home: dirname(fake.host.folder) };
}

async function until(what: string, predicate: () => boolean): Promise<void> {
	for (const start = Date.now(); Date.now() - start < 20_000; await sleep(20)) if (predicate()) return;
	throw new Error(`timed out waiting for ${what}`);
}

const ended = (home: string, id: string) => existsSync(join(home, "jobs", id, "state")) && readFileSync(join(home, "jobs", id, "state"), "utf8") === "ended";
const pathOf = (worktree: string) => /^PATH=(.*)$/m.exec(readFileSync(join(worktree, ".agent-env"), "utf8"))?.[1];

test("the Node an .nvmrc of arthur init names goes first on the job's PATH, which the agent and the prepares after nvm's get", async () => {
	const nvmDir = fakeNvm(temporaryFolder(), [`${MAJOR}.9.0`, `${MAJOR}.21.0`, "22.1.0"]);
	const { fake, after, home } = await load(repository({ ".nvmrc": `${MAJOR}\n` }), nvmDir);
	const job = await fake.host.jobs.spawn({ task: "Build it." });
	assert.equal(job.failed, undefined);
	await until("the job's end", () => ended(home, job.id));
	const node = join(nvmDir, "versions/node", `v${MAJOR}.21.0`, "bin");
	assert.equal(pathOf(job.worktree), `${node}${delimiter}${process.env.PATH}`);
	assert.deepEqual(after, [{ PATH: `${node}${delimiter}${process.env.PATH}` }]);
	assert.deepEqual(readFileSync(join(nvmDir, "calls"), "utf8").split("\n").filter(Boolean), [`which ${MAJOR}`]);
});

test("nvm's bin goes before the PATH a prepare before it returned; the first line not blank or a comment is the version", async () => {
	const nvmDir = fakeNvm(temporaryFolder(), ["22.1.0"]);
	const { fake, after } = await load(repository({ ".nvmrc": "# the LTS we ship\n\n  22  \n24\n" }), nvmDir, () => ({ PATH: "/opt/tools/bin:/usr/bin" }));
	await fake.host.jobs.spawn({ task: "Build it." });
	assert.deepEqual(after, [{ PATH: `${join(nvmDir, "versions/node/v22.1.0/bin")}:/opt/tools/bin:/usr/bin` }]);
});

test("no .nvmrc: no variable, the job runs on the machine's default Node, and nvm is not asked", async () => {
	const nvmDir = fakeNvm(temporaryFolder(), [`${MAJOR}.21.0`]);
	const { fake, after, home } = await load(repository({}), nvmDir);
	const job = await fake.host.jobs.spawn({ task: "Build it." });
	await until("the job's end", () => ended(home, job.id));
	assert.deepEqual([after, pathOf(job.worktree), existsSync(join(nvmDir, "calls"))], [[{}], process.env.PATH, false]);
});

// Each refusal of the spawn, its message after `plugin nvm: prepare failed: `; nothing of the job is left.
async function refused(files: Readonly<Record<string, string>>, nvmDir: string): Promise<string> {
	const { fake, home } = await load(repository(files), nvmDir);
	const message = await fake.host.jobs.spawn({ task: "Build it." }).then(
		() => "spawned",
		(error: Error) => error.message,
	);
	assert.deepEqual(existsSync(join(home, "jobs")) ? readdirSync(join(home, "jobs")) : [], [], "no record is left");
	const [prefix, suffix] = ["plugin nvm: prepare failed: ", "; the job's worktree and record were removed"];
	assert.ok(message.startsWith(prefix) && message.endsWith(suffix), message);
	return message.slice(prefix.length, -suffix.length);
}

test("a version not installed refuses the spawn, naming the version, the machine and nvm install; nothing is downloaded", async () => {
	const nvmDir = fakeNvm(temporaryFolder(), [`${MAJOR}.21.0`]);
	const message = await refused({ ".nvmrc": "99\n" }, nvmDir);
	assert.match(message, /^Node 99, which \/.+\/\.nvmrc names, is not installed on machine local; fix: nvm install 99 there$/);
	assert.deepEqual(readFileSync(join(nvmDir, "calls"), "utf8").split("\n").filter(Boolean), ["which 99"]);
});

test("an empty .nvmrc, or one of comments and blank lines only, is refused, naming the file", async () => {
	const nvmDir = fakeNvm(temporaryFolder(), [`${MAJOR}.21.0`]);
	for (const text of ["", "# pick one\n   \n"])
		assert.match(await refused({ ".nvmrc": text }, nvmDir), /^\/.+\/\.nvmrc on machine local names no Node version; write the project's, such as 24$/);
	assert.equal(existsSync(join(nvmDir, "calls")), false);
});

test("an unreadable .nvmrc is refused, naming the file and why", async () => {
	const message = await refused({ ".nvmrc/inside": "24\n" }, fakeNvm(temporaryFolder(), [`${MAJOR}.21.0`]));
	assert.match(message, /^\/.+\/\.nvmrc on machine local is unreadable: cat: \.nvmrc: Is a directory$/);
});

test("nvm missing on the machine is refused, naming the machine and the install", async () => {
	const empty = temporaryFolder();
	const message = await refused({ ".nvmrc": "24\n" }, empty);
	const install = "curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash";
	assert.equal(message.replace(/which \/\S+\/\.nvmrc needs/, "which <worktree>/.nvmrc needs"), `nvm is missing on machine local (no ${empty}/nvm.sh), which <worktree>/.nvmrc needs; fix: ${install}, then nvm install 24 there`);
});

// A machine `gpu` in a folder of its own, its home `HOME` there, reached through the fake ssh; `arthur` there is this core.
function machine(fake: FakeHost): { readonly folder: string; readonly there: string } {
	const folder = temporaryFolder();
	writeFileSync(join(bin, "machine"), folder);
	mkdirSync(join(folder, "bin"));
	writeFileSync(join(folder, "bin/arthur"), `#!/bin/sh\nexec '${process.execPath}' '${CLI}' "$@"\n`, { mode: 0o755 });
	const there = join(folder, "arthur-home");
	fake.host.jobs.registerMachine({ name: "gpu", ssh: "gpu", home: there, labels: {} });
	return { folder, there };
}

test("a job on another machine resolves the version there, with nvm in ~/.nvm, and gets that machine's PATH", async () => {
	const nvmDir = fakeNvm(temporaryFolder(), [`${MAJOR}.21.0`]);
	const { fake, after } = await load(repository({ ".nvmrc": `${MAJOR}\n` }), nvmDir);
	const { folder, there } = machine(fake);
	fakeNvm(join(folder, ".nvm"), [`${MAJOR}.9.0`]);
	const job = await fake.host.jobs.spawn({ task: "Build it.", machine: "gpu" });
	assert.equal(job.failed, undefined);
	await until("the job's end there", () => ended(there, job.id));
	const path = `${join(folder, ".nvm/versions/node", `v${MAJOR}.9.0`, "bin")}:${folder}/bin:${process.env.MACHINE_PATH}`;
	assert.deepEqual([pathOf(job.worktree), after], [path, [{ PATH: path }]]);
	assert.equal(existsSync(join(nvmDir, "calls")), false, "this machine's nvm is not asked");

	rmSync(join(folder, ".nvm"), { recursive: true });
	await assert.rejects(fake.host.jobs.spawn({ task: "Build it.", machine: "gpu" }), { message: /^plugin nvm: prepare failed: nvm is missing on machine gpu \(no .+\/\.nvm\/nvm\.sh\), which / });
});

test("its doctor line per machine: nvm's version, else what is missing there; never critical", async () => {
	const nvmDir = fakeNvm(temporaryFolder(), []);
	const { fake } = await load(repository({}), nvmDir);
	const { folder } = machine(fake);
	const lines = async () => {
		const [requirements = []] = fake.collect<readonly Requirement[]>("doctor");
		return Promise.all(requirements.map(async (each) => [each.name, await each.check(), each.costs, each.fix, each.critical]));
	};
	const install = "curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash";
	assert.deepEqual(await lines(), [
		["local", "ok (nvm 0.40.8)", "a job on local of a project with .nvmrc is refused", install, false],
		["gpu", `missing: no ${folder}/.nvm/nvm.sh`, "a job on gpu of a project with .nvmrc is refused", `on gpu: ${install}`, false],
	]);
	fakeNvm(join(folder, ".nvm"), []);
	process.env.NVM_DIR = temporaryFolder();
	assert.deepEqual((await lines()).map(([name, check]) => `${name}: ${check}`), [`local: missing: no ${process.env.NVM_DIR}/nvm.sh`, "gpu: ok (nvm 0.40.8)"]);
});

test("an option but enabled is refused", () => {
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ version: "24" }), [{ path: "version", problem: "unknown option; nvm has no options but enabled" }]);
});
