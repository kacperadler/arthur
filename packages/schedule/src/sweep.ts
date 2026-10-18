import { readFileSync, realpathSync } from "node:fs";
import { normalize, relative, resolve } from "node:path";
import { describe } from "@arthur/core";
import type { Host } from "@arthur/core/plugin";
import { type Entry, entryProblems, isOneOff, type JobEntry, lastSlot } from "./entry.ts";
import { claim, lastClaimed, seen } from "./run-state.ts";

// The sweep (spec/roadmap.md, entry 39): every entry of the config and of the file whose slot has come and is not claimed yet
// is claimed once and run; a hand-broken entry or file is skipped and named, the others still run: docs/schedule.md.

// A slot run more than this after its time says it is late; a daily entry's first sweep still runs a slot this close before it.
const LATE_MS = 5 * 60_000;

// `file` as the option has it; it and each procedure are read from `root`, the folder `arthur run` runs in.
export function sweeper(host: Host, configured: readonly Entry[], file: string | undefined, root: string): () => Promise<void> {
	let said: readonly string[] = [];
	return async () => {
		const now = host.clock.now();
		const { entries, problems } = fromFile(file, root, configured);
		const jobs: { readonly id: string; readonly job: JobEntry; readonly late: string }[] = [];
		for (const entry of [...configured, ...entries]) {
			const slot = lastSlot(entry, host.clock.timeZone, now);
			if (slot === undefined) continue;
			const last = lastClaimed(host.folder, entry.id);
			// A daily entry never claimed runs only the slots from its first sweep on, so a new entry does not run late at once.
			if (last !== undefined ? slot.getTime() <= last : !isOneOff(entry) && slot.getTime() < seen(host.folder, entry.id, now) - LATE_MS) continue;
			const due = host.clock.local(slot);
			const late = now.getTime() - slot.getTime() > LATE_MS ? ` (late: due ${due.date} ${due.time})` : "";
			const procedure = entry.action?.procedure === undefined ? undefined : procedureText(root, entry.action.procedure);
			if (procedure !== undefined && "problem" in procedure) {
				problems.push(`${entry.id}: skipped until its procedure can be read: ${procedure.problem}`);
				continue;
			}
			if (!claim(host.folder, entry.id, slot, now)) continue;
			if (entry.action !== undefined) host.events.emit("coordinator-message", { text: `[scheduled ${entry.id}]${late} ${entry.action.message}${procedure === undefined ? "" : `\n\n${procedure.text}`}` });
			if (entry.job !== undefined) jobs.push({ id: entry.id, job: entry.job, late });
		}
		// Each problem is said once while it lasts: in the log and to every channel.
		for (const problem of problems.filter((each) => !said.includes(each))) {
			console.error(`schedule: ${problem}`);
			host.events.emit("notice", { text: `schedule: ${problem}` });
		}
		said = problems;
		for (const { id, job, late } of jobs) await start(host, id, job, late);
	};
}

function fromFile(file: string | undefined, root: string, configured: readonly Entry[]): { entries: Entry[]; problems: string[] } {
	const entries: Entry[] = [];
	const problems: string[] = [];
	if (file === undefined) return { entries, problems };
	let list: unknown;
	try {
		list = JSON.parse(readFileSync(resolve(root, file), "utf8"));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") problems.push(`${file}: none of its entries run: ${(error as Error).message}`);
		return { entries, problems };
	}
	if (!Array.isArray(list)) return { entries, problems: [`${file}: none of its entries run: expected a JSON list of entries, got ${describe(list)}`] };
	const ids = new Set(configured.map((entry) => entry.id));
	for (const [index, entry] of list.entries()) {
		const id = (entry as { readonly id?: unknown } | null)?.id;
		const name = `${file}[${index}]${typeof id === "string" ? ` ${JSON.stringify(id)}` : ""}: skipped`;
		const wrong = entryProblems(entry, "");
		if (wrong.length > 0) problems.push(`${name}, ${wrong.map(({ path, problem }) => (path === "" ? problem : `${path}: ${problem}`)).join("; ")}`);
		else if (ids.has(id as string)) problems.push(`${name}, its id is taken by ${configured.some((each) => each.id === id) ? "an entry of the config" : "an earlier entry of the file"}`);
		else {
			ids.add(id as string);
			entries.push(entry as Entry);
		}
	}
	return { entries, problems };
}

// A procedure's text as it reads now; a symlink anywhere below `root` on its path (its real path differs) is never read.
function procedureText(root: string, path: string): { readonly text: string } | { readonly problem: string } {
	const file = resolve(root, path);
	try {
		if (relative(realpathSync(root), realpathSync(file)) !== normalize(path)) return { problem: `${path} is or goes through a symlink, which is never read` };
		return { text: readFileSync(file, "utf8").trim() };
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
		host.events.emit("coordinator-message", { text: `[scheduled ${id}]${late} Its job (${what}) did not start: ${(error as Error).message}\nIts task: ${task}` });
	}
}
