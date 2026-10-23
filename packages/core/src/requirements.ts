import { execFile } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { userInfo } from "node:os";
import { basename } from "node:path";
import { ownHome } from "./own-home.ts";
import type { Requirement } from "./plugin.ts";

// The core's own requirements for `arthur doctor` (spec/roadmap.md, entry 80): git, Node 24 or newer, the agent binary and a
// writable home, each critical; the CPU and memory controllers delegated to the user manager (entry 13), not critical.
// docs/commands/doctor.md.

type Ran = { readonly ok: boolean; readonly stdout: string; readonly said: string };

// One command, cut after 10 s; `said`: why it failed, its first line on stderr, else what ended it.
function ran(command: string, args: readonly string[]): Promise<Ran> {
	const { promise, resolve } = Promise.withResolvers<Ran>();
	execFile(command, args, { encoding: "utf8", timeout: 10_000 }, (error, stdout, stderr) => {
		const why = error?.code === "ENOENT" ? `${command} not found on PATH` : error?.killed ? "no answer within 10 s" : `exit code ${error?.code}`;
		resolve({ ok: error === null, stdout, said: stderr.trim().split("\n")[0] || why });
	});
	return promise;
}

// `home` and `agent` as the config holds them (`core.home`, `core.agent.command`); `node`, the version that runs this.
export function coreRequirements(home: string, agent: string, node = process.versions.node): Requirement[] {
	const user = userInfo().username;
	let manager = true;
	return [
		{
			name: "git",
			check: async () => {
				const git = await ran("git", ["--version"]);
				return git.ok ? "ok" : `missing: ${git.said}`;
			},
			costs: "no worktree, so no job, and no ticket board",
			fix: "sudo apt-get install -y git (docs/setup.md, step 2)",
			critical: true,
		},
		{
			name: "node",
			check: () => (Number(node.split(".")[0]) >= 24 ? "ok" : `missing: Node ${node} runs arthur; it needs 24 or newer`),
			costs: "Arthur's code may not run",
			fix: "nvm install 24 && nvm alias default 24, then write ~/.config/arthur.env again (docs/setup.md, steps 2 and 8)",
			critical: true,
		},
		{
			name: basename(agent),
			// Found, never run: no model is asked.
			check: async () => ((await ran("sh", ["-c", 'command -v "$0"', agent])).ok ? "ok" : `missing: ${agent} not found on PATH`),
			costs: "no coordinator and no job",
			fix: `install ${agent} on the PATH arthur run has (docs/setup.md, steps 2 and 8)`,
			critical: true,
		},
		{
			name: "home",
			check: () => {
				try {
					ownHome(home);
					accessSync(home, constants.W_OK);
					return "ok";
				} catch (error) {
					return `missing: ${home} is not writable (${(error as NodeJS.ErrnoException).code ?? String(error)})`;
				}
			},
			costs: "nothing is kept: no job record, no event log, no plugin's state",
			fix: `sudo chown -R ${user} ${home}, or set core.home in arthur.config.ts to a folder ${user} can write`,
			critical: true,
		},
		{
			name: "controllers",
			check: async () => {
				const environment = await ran("systemctl", ["--user", "show-environment"]);
				manager = environment.ok;
				if (!manager) return `missing: no systemd user manager, so no job scope and no user service (${environment.said})`;
				const shown = await ran("systemctl", ["show", `user@${process.getuid?.()}.service`, "-p", "DelegateControllers", "--value"]);
				if (!shown.ok) return `missing: systemctl show user@${process.getuid?.()}.service: ${shown.said}`;
				const delegated = shown.stdout.trim().split(/\s+/);
				return ["cpu", "memory"].every((name) => delegated.includes(name)) ? "ok" : `missing: the user manager has the controllers "${shown.stdout.trim()}", not cpu and memory`;
			},
			costs: "jobs run without the joint limit of core.jobs.cpu and core.jobs.memory, and what a job leaves behind is not killed at its end",
			// The fix of this run's reason.
			get fix() {
				return manager ? "delegate them (docs/setup.md, step 10), then reboot" : `sudo loginctl enable-linger ${user}; none on macOS or in a container, where jobs run bare`;
			},
		},
	];
}
