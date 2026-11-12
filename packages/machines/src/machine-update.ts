import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { insideJob } from "@arthur/core/inside-job";
import type { Host } from "@arthur/core/plugin";
import type { MachineEntry } from "./machine-options.ts";

// `arthur machines update [<name>]` (spec/roadmap.md, entry 106): `arthur update <commit>` on each listed machine, or the one
// named, through `host.jobs.run`, `<commit>` the HEAD of this core's checkout, so each gets the version here, not the newest
// release. docs/commands/machines.md, "Updating".

// `arthur update` there fetches and runs `npm ci`; past this it is killed.
const LIMIT_SECONDS = 600;

const lastLine = (text: string) => text.trim().split("\n").at(-1) ?? "";

// One line per machine, in the list's order, each updated in parallel; the exit code, 1 when any was not updated.
export async function updateMachines(host: Host, list: readonly MachineEntry[], named: string | undefined): Promise<number> {
	const job = insideJob(dirname(host.folder));
	if (job !== undefined) {
		console.error(`arthur machines update: refused inside a job ${job}: a job runs only the commands its role needs; put what the coordinator should do in your final message`);
		return 1;
	}
	const picked = list.filter((machine) => named === undefined || machine.name === named);
	if (picked.length === 0) throw new Error(named === undefined ? "no machine to update: the list of the machines plugin is empty" : `no machine ${named}; machines: ${list.map((machine) => machine.name).join(", ") || "none"}`);
	const core = host.code[0] ?? "";
	const head = spawnSync("git", ["-C", core, "rev-parse", "--verify", "HEAD"], { encoding: "utf8" });
	if (head.status !== 0) throw new Error(`this core, ${core}, is not in a Git checkout: arthur machines update brings each machine to the commit it is at`);
	const commit = head.stdout.trim();
	const ran = await Promise.all(picked.map((machine) => host.jobs.run(machine.name, ["arthur", "update", commit], LIMIT_SECONDS)));
	for (const [index, { code, stdout, stderr }] of ran.entries()) {
		const { name, ssh } = picked[index]!;
		const said = lastLine(stderr) || `exit code ${code}`;
		if (code === 0) console.log(`${name}: ${stdout.trim().split("\n")[0]}`);
		else if (code === 255) console.log(`${name}: offline, skipped: ssh ${ssh}: ${said}`);
		// Killed before its own rollback could run: its `npm ci` may be half done there.
		else if (code === null) console.log(`${name}: cut before arthur update ended there (${said}), maybe during its npm ci: run arthur update ${commit} there by hand`);
		else console.log(`${name}: not updated: ${said}`);
	}
	return ran.every((run) => run.code === 0) ? 0 : 1;
}
