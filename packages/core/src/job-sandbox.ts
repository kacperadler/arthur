import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { sshFolders } from "./job-place.ts";

// The sandbox a job's agent runs in (AR0376): what it may write, and the command that starts it there; docs/commands/spawn.md,
// "The sandbox". The worktree guard (worktree-guard.ts) keeps honest mistakes apart; this is the bound for what it cannot read.

// Run by `python3 -I -c` (isolated: no module from the worktree, no PYTHON variable) with the writable paths, `--`, the hidden
// paths, `--`, then the agent's command line: a Landlock ruleset (Linux 5.13 on) under which the agent and every process it
// starts write only beneath the writable paths (a missing one is skipped; a file takes only its own writes) and, when a path is
// hidden, read every file but it: Landlock only grants, so each folder from `/` to its real path grants reads on every entry but
// the next part (a symlink, an entry that does not open, a part made later and a folder at or beneath a hidden path get none),
// a seccomp filter that refuses io_uring (whose sockets seccomp does not see) and a new Unix socket but a datagram one (omp's
// session lock), so no local daemon runs a command outside it, and `no_new_privs`; then it execs the agent. Its refusal ends stderr.
const SCRIPT = `import ctypes, os, platform, stat, struct, sys
libc = ctypes.CDLL(None, use_errno=True)
libc.syscall.restype = libc.prctl.restype = ctypes.c_long
wide = lambda *args: [ctypes.c_long(arg) if isinstance(arg, int) else arg for arg in args]
def fail(what): sys.exit(f"{what}: {os.strerror(ctypes.get_errno())}")
cut = sys.argv.index("--")
end = sys.argv.index("--", cut + 1)
paths, hidden, argv = sys.argv[1:cut], sys.argv[cut + 1:end], sys.argv[end + 1:]
abi = libc.syscall(*wide(444, 0, 0, 1))
if abi < 1: fail("Landlock")
files = 1 << 1 | (1 << 14 if abi >= 3 else 0)
dirs = files | sum(1 << bit for bit in range(4, 13)) | (1 << 13 if abi >= 2 else 0)
handled = ctypes.c_uint64(dirs | (1 << 2 if hidden else 0))
ruleset = libc.syscall(*wide(444, ctypes.byref(handled), 8, 0))
if ruleset < 0: fail("Landlock")
rule = ctypes.create_string_buffer(12)
grant = lambda fd, mask: struct.pack_into("=Qi", rule, 0, mask, fd) or libc.syscall(*wide(445, ruleset, 1, rule, 0))
for path in paths:
	try: fd = os.open(path, os.O_PATH | os.O_CLOEXEC)
	except FileNotFoundError: continue
	if grant(fd, dirs if stat.S_ISDIR(os.fstat(fd).st_mode) else files) < 0: fail(f"Landlock: {path}")
	os.close(fd)
walk, reals = {}, [os.path.realpath(path) for path in hidden]
for parts in (real.split("/") for real in reals):
	for at in range(1, len(parts)): walk.setdefault("/".join(parts[:at]) or "/", set()).add(parts[at])
for folder, skip in walk.items():
	if any(folder == real or folder.startswith(real.rstrip("/") + "/") for real in reals): continue
	try: entries = [entry for entry in os.scandir(folder) if entry.name not in skip and not entry.is_symlink()]
	except OSError: continue
	for entry in entries:
		try: fd = os.open(entry.path, os.O_PATH | os.O_NOFOLLOW | os.O_CLOEXEC)
		except OSError: continue
		grant(fd, 1 << 2)
		os.close(fd)
arch, socket = {"x86_64": (0xC000003E, 41), "aarch64": (0xC00000B7, 198)}.get(platform.machine(), (0, 0))
if arch == 0: sys.exit(f"seccomp: no filter for {platform.machine()}")
program = [(0x20, 0, 0, 4), (0x15, 0, 10, arch), (0x20, 0, 0, 0), (0x35, 8, 0, 0x40000000), (0x15, 7, 0, 425), (0x15, 0, 5, socket), (0x20, 0, 0, 16), (0x15, 0, 3, 1), (0x20, 0, 0, 24), (0x54, 0, 0, 0xF), (0x15, 0, 1, 2), (6, 0, 0, 0x7FFF0000), (6, 0, 0, 0x50000 | 13)]
code = ctypes.create_string_buffer(b"".join(struct.pack("=HBBI", *op) for op in program))
fprog = ctypes.create_string_buffer(struct.pack("=HxxxxxxQ", len(program), ctypes.addressof(code)))
if libc.prctl(*wide(38, 1, 0, 0, 0)) != 0: fail("no_new_privs")
if libc.syscall(*wide(446, ruleset, 0)) < 0: fail("Landlock")
if libc.prctl(*wide(22, 2, ctypes.addressof(fprog), 0, 0)) != 0: fail("seccomp")
try: os.execvp(argv[0], argv)
except OSError as error: sys.exit(f"{argv[0]}: {error.strerror}")
`;

// Where the agent of the job whose record is `record` may write: its worktree and record, the Git folders a commit on its
// branch writes (the worktree's own, and the objects, refs and logs of the repository; not its config or hooks), the
// temporary folder, `/dev` (`/dev/null`, a terminal), omp's own state (`~/.omp`, its sessions and logins), and for each
// extension a plugin registered (`extensions`, the record's, paths from the core's `src/`) `<home>/<its package's folder>/<id>`,
// made here, where it records what the agent did.
export function writable(record: string, worktree: string, extensions: string): string[] {
	const git = spawnSync("git", ["-C", worktree, "rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"], { encoding: "utf8" });
	const [own = "", common = ""] = git.status === 0 ? git.stdout.trim().split("\n") : [];
	const repository = common === "" ? [] : [...(own === common ? [] : [own]), ...["objects", "refs", "logs"].map((name) => join(common, name))];
	const home = dirname(dirname(record));
	const plugins = extensions.split("\n").filter(Boolean).map((path) => join(home, basename(dirname(dirname(resolve(import.meta.dirname, path)))), basename(record)));
	for (const folder of plugins) mkdirSync(folder, { recursive: true });
	return [worktree, record, ...repository, tmpdir(), "/dev", join(homedir(), ".omp"), ...plugins];
}

// What the agent of the job whose record is `record` may not read: the env file its `guarded` file names (job-place.ts), if any,
// and the user's `~/.ssh` (AR0508, `sshFolders`), taken from no record, which the agent writes; job-place.ts and spawn.md say why.
export function hidden(record: string): string[] {
	const text = existsSync(join(record, "guarded")) ? readFileSync(join(record, "guarded"), "utf8") : "";
	return [...text.split("\n").filter((line) => line.startsWith("env /")).map((line) => line.slice(4)), ...sshFolders()];
}

// The sandbox over `paths`, reading every file but `hidden`, for `agent`, `who` in the log's line (`note`): a function from its
// arguments to the command and arguments that start it there. On a host where it cannot be set up it throws `no sandbox: <why>;
// set core.jobs.unsandboxed: true ...` (`noSandbox`), unless `unsandboxed` (that option; a plugin's steps) lets it start the
// agent's own, the log told why; so does an agent the sandbox's shell does not find, which then fails to start as it would bare.
export function sandboxed(paths: readonly string[], hidden: readonly string[], agent: string, note: (line: string) => void, who = "the agent", unsandboxed = false): (argv: readonly string[]) => [string, string[]] {
	const why = noSandbox(paths, agent);
	if (why !== undefined && !unsandboxed && why !== `the agent ${agent} is not there`) throw new Error(`no sandbox: ${why}; set core.jobs.unsandboxed: true in arthur.config.ts to run ${who} with the writes of Arthur's user`);
	const reads = hidden.length === 0 ? "" : `, reads every file but ${hidden.join(", ")}`;
	note(why === undefined ? `sandbox: ${who} writes only in ${paths.join(", ")}${reads}, and opens no Unix socket but a datagram one` : `no sandbox: ${why}; ${who} writes wherever Arthur's user can`);
	return (argv) => (why === undefined ? ["python3", ["-I", "-c", SCRIPT, ...paths, "--", ...hidden, "--", agent, ...argv]] : [agent, [...argv]]);
}

// Why the sandbox over `paths` cannot start `agent` here, undefined where it can; the probe hides nothing, as the walk of a crowded folder above a hidden path costs.
export function noSandbox(paths: readonly string[], agent: string): string | undefined {
	const probe = process.platform === "linux" ? spawnSync("python3", ["-I", "-c", SCRIPT, ...paths, "--", "--", "/bin/sh", "-c", 'command -v "$1" || exit 127', "sh", agent], { encoding: "utf8" }) : undefined;
	return probe === undefined ? `${process.platform} has no Landlock`
		: probe.error !== undefined ? `python3: ${probe.error.message}`
		: probe.status === 0 ? undefined
		: probe.status === 127 ? `the agent ${agent} is not there`
		: probe.stderr.trim().split("\n").at(-1) || `python3 exited ${probe.status ?? probe.signal}`;
}

// `env`'s arguments that run `sh -c <command>` with Git's signing off (`unsigned`) and the package managers' caches in `folder`, a
// cache of its own (AR0454): npm's (`npm_config_cache`), bun's (`BUN_INSTALL_CACHE_DIR`), pnpm's and uv's (`XDG_CACHE_HOME`), pnpm's store
// (`$PNPM_HOME/store`) and composer's, never the shared ones, where branch code would leave what a later process outside any sandbox runs (`~/.npm/_npx`).
export const cached = (folder: string, command: string): string[] => [`npm_config_cache=${join(folder, "npm")}`, `BUN_INSTALL_CACHE_DIR=${join(folder, "bun")}`, `XDG_CACHE_HOME=${folder}`, `PNPM_HOME=${join(folder, "pnpm-home")}`, `COMPOSER_CACHE_DIR=${join(folder, "composer")}`, ...Object.entries(unsigned(process.env)).map(([name, value]) => `${name}=${value}`), "sh", "-c", command];
// Git's commit and tag signing off (AR0516), after the config entries `env` gives Git, which stay: a job's agent, its install and a merge step read no key in `~/.ssh` (AR0508), so they commit unsigned; Arthur's merge commit, made outside, stays signed.
export const unsigned = (env: NodeJS.ProcessEnv, given = Number.parseInt(env.GIT_CONFIG_COUNT ?? "", 10) || 0): Record<string, string> => ({ GIT_CONFIG_COUNT: `${given + 2}`, [`GIT_CONFIG_KEY_${given}`]: "commit.gpgSign", [`GIT_CONFIG_VALUE_${given}`]: "false", [`GIT_CONFIG_KEY_${given + 1}`]: "tag.gpgSign", [`GIT_CONFIG_VALUE_${given + 1}`]: "false" });

// The sandbox of branch code a plugin runs outside a job (`Host.sandbox`, delivery's checks on main): `sh -c <command>` writing
// only in the checkout `folder` as `checkout` says, the cache folder `cache` (made here), which its caches use, the temporary
// folder and `/dev`, reading every file but the env file `arthur.envFile` and the user's `~/.ssh`; `note` is told only where it
// cannot be set up, once, and each command then runs bare, its caches in `cache` all the same.
export function stepSandbox(folder: string, cache: string, arthur: { readonly envFile: string; readonly home: string; readonly config: string }, note: (line: string) => void): (command: string) => [string, string[]] {
	mkdirSync(cache, { recursive: true });
	const paths = [...checkout(folder, [arthur.home, arthur.config, arthur.envFile]), cache, tmpdir(), "/dev"];
	const start = sandboxed(paths, [arthur.envFile, ...sshFolders()], "env", (line) => void (line.startsWith("no sandbox: ") && note(line)), "each step", true);
	return (command) => start(cached(cache, command));
}

// What a step may write of the checkout `folder` (AR0457): of its Git folder only the objects, refs, logs and index, never its
// config, hooks or info, where a step would plant what the owner's next git call runs outside any sandbox; of the rest each entry
// but the Git folder and the `kept` paths inside it (Arthur's home, config and env file), and in each folder on the way to one,
// each entry but the next part. So `folder` itself and those folders take no new entry; a symlink is none (the sandbox would grant its target).
function checkout(folder: string, kept: readonly string[]): string[] {
	const git = spawnSync("git", ["-C", folder, "rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"], { encoding: "utf8" });
	const [own = "", common = ""] = git.status === 0 ? git.stdout.trim().split("\n") : [];
	const repository = common === "" ? [] : [...["objects", "refs", "logs"].map((name) => join(common, name)), join(own, "index")];
	const real = (path: string): string => (existsSync(path) || dirname(path) === path ? realpathSync(path) : join(real(dirname(path)), basename(path)));
	const top = real(folder);
	const parts = [join(folder, ".git"), own, common, ...kept].filter(Boolean).map((path) => relative(top, real(path)));
	if (parts.includes("")) return repository;
	const walk = new Map<string, Set<string>>([[top, new Set()]]);
	for (const names of parts.filter((path) => path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path)).map((path) => path.split(sep))) {
		for (const [at, name] of names.entries()) {
			const above = join(top, ...names.slice(0, at));
			walk.set(above, (walk.get(above) ?? new Set()).add(name));
		}
	}
	const entries = [...walk].flatMap(([path, skip]) => (existsSync(path) ? readdirSync(path, { withFileTypes: true }) : []).filter((entry) => !skip.has(entry.name) && !entry.isSymbolicLink()).map((entry) => join(path, entry.name)));
	return [...entries, ...repository];
}
