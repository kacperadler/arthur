import { readFileSync, realpathSync } from "node:fs";
import { relative, resolve } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { type Entry, isId, isOneOff, type JobEntry, lastSlot } from "./entry.ts";
import { owners, readEntries } from "./entry-file.ts";
import type { Registered } from "./register.ts";
import { claim, lastClaimed, seen } from "./run-state.ts";

// The sweep (spec/roadmap.md, entries 39 and 40): every entry of the config, of the plugins and of the file whose slot has come
// and is not claimed yet is claimed once and run; a hand-broken entry or file is skipped and named, the others still run:
// docs/commands/schedule.md.

// A slot run more than this after its time says it is late; a daily entry's first sweep still runs a slot this close before it.
const LATE_MS = 5 * 60_000;

// `file` as the option has it; it and each procedure of the config and the file are read from `root`, the folder `arthur run`
// runs in; a registered entry's procedure from its plugin's package folder. `registered` is read anew at every sweep.
export function sweeper(host: Host, configured: readonly Entry[], registered: readonly Registered[], file: string | undefined, root: string): () => Promise<void> {
	let said: readonly string[] = [];
	return async () => {
		const now = host.clock.now();
		const { entries, problems } = readEntries(file, root, owners(configured, registered));
		const jobs: { readonly id: string; readonly job: JobEntry; readonly late: string }[] = [];
		const runs: { readonly id: string; readonly run: () => Promise<void>; readonly late: string }[] = [];
		for (const entry of [...configured, ...registered, ...entries]) {
			const slot = lastSlot(entry, host.clock.timeZone, now);
			if (slot === undefined) continue;
			const last = lastClaimed(host.folder, entry.id);
			// A daily entry never claimed runs only the slots from its first sweep on, so a new entry does not run late at once.
			if (last !== undefined ? slot.getTime() <= last : !isOneOff(entry) && slot.getTime() < seen(host.folder, entry.id, now) - LATE_MS) continue;
			const due = host.clock.local(slot);
			const late = now.getTime() - slot.getTime() > LATE_MS ? ` (late: due ${due.date} ${due.time})` : "";
			const procedure = entry.action?.procedure === undefined ? undefined : procedureText("code" in entry ? (entry as Registered).code : root, entry.action.procedure);
			if (procedure !== undefined && "problem" in procedure) {
				problems.push(`${entry.id}: skipped until its procedure can be read: ${procedure.problem}`);
				continue;
			}
			if (!claim(host.folder, entry.id, slot, now)) continue;
			if (entry.action !== undefined) host.events.emit("coordinator-message", { text: scheduled(entry.id, entry.action.message, procedure?.text, late) });
			if (entry.job !== undefined) jobs.push({ id: entry.id, job: entry.job, late });
			const { run } = entry as Registered;
			if (run !== undefined) runs.push({ id: entry.id, run, late });
		}
		// Each problem is said once while it lasts: in the log and to every channel.
		for (const problem of problems.filter((each) => !said.includes(each))) {
			console.error(`schedule: ${problem}`);
			host.events.emit("notice", { text: `schedule: ${problem}` });
		}
		said = problems;
		for (const { id, job, late } of jobs) await start(host, id, job, late);
		// A plugin's own code, in turn; its failure goes to every channel, the slot staying claimed.
		for (const { id, run, late } of runs)
			await Promise.try(run).catch((error: unknown) => {
				const text = `schedule: ${id}${late}: its run failed: ${error instanceof Error ? error.message : String(error)}`;
				console.error(text);
				host.events.emit("notice", { text });
			});
	};
}

// The text the coordinator gets for an action due: `[scheduled <id>]`, the late mark when late, its message and, after a blank
// line, its procedure's text.
function scheduled(id: string, message: string, procedure: string | undefined, late: string): string {
	return `[scheduled ${id}]${late} ${message}${procedure === undefined ? "" : `\n\n${procedure.trim()}`}`;
}

// What `schedule.message` answers (`arthur eval` asks it): the text of an entry's action due on time, as the sweep words it.
export function dueMessage(id: unknown, message: unknown, procedure: unknown): string {
	if (!isId(id)) throw new Error(`schedule.message: expected an entry's id, got ${JSON.stringify(id)}`);
	if (typeof message !== "string" || message.trim() === "") throw new Error(`schedule.message: expected the action's message, non-empty text, got ${JSON.stringify(message)}`);
	if (procedure !== undefined && typeof procedure !== "string") throw new Error(`schedule.message: expected the procedure's text or nothing, got ${JSON.stringify(procedure)}`);
	return scheduled(id, message, procedure, "");
}

// A procedure's text as it reads now; a symlink anywhere below `folder` on its path (its real path differs) is never read.
function procedureText(folder: string, path: string): { readonly text: string } | { readonly problem: string } {
	const file = resolve(folder, path);
	try {
		if (relative(realpathSync(folder), realpathSync(file)) !== relative(folder, file)) return { problem: `${path} is or goes through a symlink, which is never read` };
		return { text: readFileSync(file, "utf8") };
	} catch (error) {
		return { problem: `${path}: ${(error as Error).message}` };
	}
}

async function start(host: Host, id: string, { task, kind, project }: JobEntry, late: string): Promise<void> {
	try {
		const started = await host.jobs.spawn({ task, kind, project });
		console.log(`schedule: ${id}${late}: started job ${started.id}${started.failed === undefined ? "" : `, which failed: ${started.failed}`}`);
	} catch (error) {
		const what = `kind ${kind ?? "worker"}${project === undefined ? "" : `, project ${project}`}`;
		host.events.emit("coordinator-message", { text: scheduled(id, `Its job (${what}) did not start: ${(error as Error).message}\nIts task: ${task}`, undefined, late) });
	}
}
