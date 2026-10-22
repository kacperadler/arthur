import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import type { Host } from "@arthur/core/plugin";
import type { MachineEntry } from "./machine-options.ts";

// One machine's check (spec/roadmap.md, entries 30, 34, 69 and 80): its address private, then one command over the core's SSH
// that answers its os, arch and Arthur's version, compared with its labels and this core's version, its free CPU and memory,
// the `tools` labels `command -v` does not find there, and `df -Pk` of the paths the round names for it; and the same of
// `local`'s tools labels. docs/commands/machines.md.

// `free` is the line `node -e` printed of the machine's free CPU and memory, `disk` df's exit code and output (its errors in
// it), with paths only: both read by the resources plugin, not here.
export type Disk = { readonly code: number; readonly output: string };
export type Report =
	| { readonly online: true; readonly os: string; readonly arch: string; readonly version: string; readonly free: string; readonly disk?: Disk; readonly missing: readonly string[] }
	| { readonly online: false; readonly reason: string; readonly fix: string };

// Each tool label is a command name; one not found is said on a line of its own, after the free CPU and memory.
const TOOLS = 'for tool do command -v "$tool" >/dev/null || echo "missing $tool"; done';
// `$1` of SCRIPT, the machine's free CPU and memory as the resources plugin's own check measures them (its machine-free.ts): one
// JSON line of its cores, the cores its processes kept busy over one second, and its free and total memory in bytes.
const FREE = `const os = require("node:os"); const busy = () => os.cpus().reduce((sum, { times: t }) => sum + t.user + t.nice + t.sys + t.irq, 0); const [before, start] = [busy(), performance.now()]; setTimeout(() => console.log(JSON.stringify({ cores: os.availableParallelism(), load: Math.max(0, (busy() - before) / (performance.now() - start)), free: os.freemem(), total: os.totalmem() })), 1000)`;
// The first `$n` arguments as the resources plugin's own df reads them (its machine-disk.ts): `missing` for a path not there,
// else df's header and the line of its filesystem; it stops at df's first failure.
const DF = 'for path do [ "$n" -gt 0 ] || break; n=$((n - 1)); if [ -e "$path" ]; then df -Pk "$path" || exit; else echo missing; fi; done';
// `$2` the number of paths, then the paths, then the tools labels; df's answer last, after `disk <its exit code>`, only with paths.
const SCRIPT = `uname -sm && arthur version && node -e "$1" || exit; n=$2; shift 2; disk=$(${DF} 2>&1); code=$?; shift "$n"; ${TOOLS}; [ "$n" -eq 0 ] || printf "disk %s\\n%s\\n" "$code" "$disk"`;
const missing = (lines: readonly string[]) => lines.flatMap((line) => (line.startsWith("missing ") ? [line.slice("missing ".length)] : []));

// The private network Arthur reaches its machines on: loopback, RFC 1918, and Tailscale's.
const PRIVATE = new BlockList();
for (const [address, prefix] of [["127.0.0.0", 8], ["10.0.0.0", 8], ["172.16.0.0", 12], ["192.168.0.0", 16], ["100.64.0.0", 10]] as const) PRIVATE.addSubnet(address, prefix, "ipv4");
PRIVATE.addAddress("::1", "ipv6");
PRIVATE.addSubnet("fd7a:115c:a1e0::", 48, "ipv6");

// `uname -s` and `uname -m` as the labels name them, which are Node's `process.platform` and `process.arch` words.
const OS: Readonly<Record<string, string>> = { Linux: "linux", Darwin: "macos" };
const ARCH: Readonly<Record<string, string>> = { x86_64: "x64", amd64: "x64", aarch64: "arm64", arm64: "arm64" };

const lastLine = (text: string) => text.trim().split("\n").at(-1) ?? "";

// The first address `ssh -G <ssh>` resolves to that is not private, undefined when each is; throws when none is found.
export async function publicAddress(host: Host, ssh: string): Promise<string | undefined> {
	const ran = await host.jobs.run("local", ["ssh", "-G", ssh]);
	const name = /^hostname (\S+)$/m.exec(ran.stdout)?.[1];
	if (ran.code !== 0 || name === undefined) throw new Error(`ssh -G ${ssh}: ${lastLine(ran.stderr) || `exit code ${ran.code}`}`);
	const addresses = isIP(name) === 0 ? (await lookup(name, { all: true })).map((found) => found.address) : [name];
	return addresses.find((address) => !PRIVATE.check(address, isIP(address) === 6 ? "ipv6" : "ipv4"));
}

// The fix of ssh's own failure, by its line: a refused key, a host key not known or changed, or a machine that does not answer.
function sshFix(said: string, ssh: string): string {
	if (/permission denied/i.test(said)) return `ssh-copy-id ${ssh}`;
	if (/host key|host identification/i.test(said)) return `compare ssh-keyscan ${ssh} with the key the machine itself shows, then add it to ~/.ssh/known_hosts`;
	return `bring ${ssh} onto the private network (tailscale up there), then ssh ${ssh} true`;
}

// At most `limitSeconds`, the ssh there killed past it; df reads `paths` there in the same call. Never throws.
export async function checkMachine(host: Host, machine: MachineEntry, ours: string, limitSeconds: number, paths: readonly string[]): Promise<Report> {
	const offline = (reason: string, fix: string): Report => ({ online: false, reason, fix });
	const started = Date.now();
	try {
		const address = await publicAddress(host, machine.ssh);
		if (address !== undefined) return offline(`ssh ${machine.ssh} resolves to ${address}, not a private address`, `reach ${machine.ssh} by its Tailscale name or a private address`);
	} catch (error) {
		return offline(error instanceof Error ? error.message : String(error), `make ${machine.ssh} a Host of ~/.ssh/config or a name that resolves (Tailscale's MagicDNS)`);
	}
	const left = limitSeconds - (Date.now() - started) / 1000;
	if (left <= 0) return offline(`check timed out after ${limitSeconds} s`, `ssh ${machine.ssh} true, by hand`);
	const ran = await host.jobs.run(machine.name, ["sh", "-c", SCRIPT, "sh", FREE, String(paths.length), ...paths, ...(machine.labels?.tools ?? [])], left);
	const said = lastLine(ran.stderr) || `exit code ${ran.code}`;
	if (ran.code === null) return offline(`check timed out after ${limitSeconds} s`, `ssh ${machine.ssh} true, by hand`);
	if (ran.code === 255) return offline(`ssh ${machine.ssh}: ${said}`, sshFix(said, machine.ssh));
	if (ran.code === 127) return offline(`arthur is not there (${said})`, "install Arthur's core there at this commit, arthur on the PATH of a command over ssh (docs/deploy.md)");
	if (ran.code !== 0) return offline(`uname -sm && arthur version && node -e failed there: ${said}`, `ssh ${machine.ssh} 'uname -sm && arthur version && node -v', by hand`);
	const [system = "", theirs = "", free = "", ...rest] = ran.stdout.trim().split("\n").map((line) => line.trim());
	const words = system.split(/\s+/);
	const [uname = "", hardware = ""] = [words[0], words.at(-1)];
	const [os, arch] = [OS[uname] ?? uname.toLowerCase(), ARCH[hardware] ?? hardware];
	const { os: wantOs, arch: wantArch } = machine.labels ?? {};
	if ((wantOs !== undefined && wantOs !== os) || (wantArch !== undefined && wantArch !== arch)) {
		const labels = [wantOs && `os ${wantOs}`, wantArch && `arch ${wantArch}`].filter(Boolean).join(", ");
		return offline(`its labels say ${labels}; the machine says ${os} ${arch}`, `set the labels of ${machine.name} in arthur.config.ts to what ssh ${machine.ssh} reaches`);
	}
	if (theirs !== ours) return offline(`it runs arthur ${theirs || "(no version)"}, this one is ${ours}; both need the same version`, "update Arthur there to this commit (docs/deploy.md)");
	const at = rest.findIndex((line) => /^disk \d+$/.test(line));
	const disk = at === -1 ? {} : { disk: { code: Number(rest[at]?.slice("disk ".length)), output: rest.slice(at + 1).join("\n") } };
	return { online: true, os, arch, version: ours, free, ...disk, missing: missing(at === -1 ? rest : rest.slice(0, at)) };
}

// The `tools` that `command -v` does not find on the PATH of `arthur run`, by the loop of a listed machine's check; the
// reason when the loop fails or is cut at `limitSeconds` (`timed out after <n> s`).
export async function missingHere(host: Host, tools: readonly string[], limitSeconds: number): Promise<readonly string[] | string> {
	const ran = await host.jobs.run("local", ["sh", "-c", TOOLS, "sh", ...tools], limitSeconds);
	return ran.code === 0 ? missing(ran.stdout.split("\n")) : `the check of its tools failed: ${lastLine(ran.stderr) || `exit code ${ran.code}`}`;
}
