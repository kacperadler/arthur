import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

// The sandbox a job's agent runs in (AR0376): what it may write, and the command that starts it there; docs/commands/spawn.md,
// "The sandbox". The worktree guard (worktree-guard.ts) keeps honest mistakes apart; this is the bound for what it cannot read.

// Run by `python3 -I -c` (isolated: no module from the worktree, no PYTHON variable) with the writable paths, `--`, then the
// agent's command line: a Landlock ruleset (Linux 5.13 on) under which the agent and every process it starts write only
// beneath those paths (a missing one is skipped; a file takes only its own writes), a seccomp filter that refuses a new Unix
// socket (the user manager's bus, a tmux server, any local daemon that would run a command outside the sandbox) and io_uring
// (whose sockets seccomp does not see), and `no_new_privs`; then it execs the agent. Its own refusal is its last line on stderr.
const SCRIPT = `import ctypes, os, platform, stat, struct, sys
libc = ctypes.CDLL(None, use_errno=True)
libc.syscall.restype = libc.prctl.restype = ctypes.c_long
wide = lambda *args: [ctypes.c_long(arg) if isinstance(arg, int) else arg for arg in args]
def fail(what): sys.exit(f"{what}: {os.strerror(ctypes.get_errno())}")
cut = sys.argv.index("--")
paths, argv = sys.argv[1:cut], sys.argv[cut + 1:]
abi = libc.syscall(*wide(444, 0, 0, 1))
if abi < 1: fail("Landlock")
files = 1 << 1 | (1 << 14 if abi >= 3 else 0)
dirs = files | sum(1 << bit for bit in range(4, 13)) | (1 << 13 if abi >= 2 else 0)
handled = ctypes.c_uint64(dirs)
ruleset = libc.syscall(*wide(444, ctypes.byref(handled), 8, 0))
if ruleset < 0: fail("Landlock")
for path in paths:
	try: fd = os.open(path, os.O_PATH | os.O_CLOEXEC)
	except FileNotFoundError: continue
	rule = ctypes.create_string_buffer(struct.pack("=Qi", dirs if stat.S_ISDIR(os.fstat(fd).st_mode) else files, fd))
	if libc.syscall(*wide(445, ruleset, 1, rule, 0)) < 0: fail(f"Landlock: {path}")
	os.close(fd)
arch, socket = {"x86_64": (0xC000003E, 41), "aarch64": (0xC00000B7, 198)}.get(platform.machine(), (0, 0))
if arch == 0: sys.exit(f"seccomp: no filter for {platform.machine()}")
program = [(0x20, 0, 0, 4), (0x15, 0, 7, arch), (0x20, 0, 0, 0), (0x35, 5, 0, 0x40000000), (0x15, 4, 0, 425), (0x15, 0, 2, socket), (0x20, 0, 0, 16), (0x15, 1, 0, 1), (6, 0, 0, 0x7FFF0000), (6, 0, 0, 0x50000 | 13)]
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

// The command and arguments that start `agent` with `argv` in the sandbox over `paths`, the log told which (`note`); on a
// host where it cannot be set up (not Linux, no `python3`, a kernel without Landlock), or for an agent the sandbox's shell
// does not find, which then fails to start as it would bare, the agent's own, the log told why.
export function sandboxed(paths: readonly string[], agent: string, argv: readonly string[], note: (line: string) => void): [string, string[]] {
	const prefix = ["-I", "-c", SCRIPT, ...paths, "--"];
	const probe = process.platform === "linux" ? spawnSync("python3", [...prefix, "/bin/sh", "-c", 'command -v "$1" || exit 127', "sh", agent], { encoding: "utf8" }) : undefined;
	const why =
		probe === undefined ? `${process.platform} has no Landlock`
		: probe.error !== undefined ? `python3: ${probe.error.message}`
		: probe.status === 0 ? undefined
		: probe.status === 127 ? `the agent ${agent} is not there`
		: probe.stderr.trim().split("\n").at(-1) || `python3 exited ${probe.status ?? probe.signal}`;
	note(why === undefined ? `sandbox: the agent writes only in ${paths.join(", ")}, and opens no Unix socket` : `no sandbox: ${why}; the agent writes wherever Arthur's user can`);
	return why === undefined ? ["python3", [...prefix, agent, ...argv]] : [agent, [...argv]];
}
