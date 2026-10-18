import type { Board } from "./board.ts";
import { FEATURE, taskTickets } from "./board-jobs.ts";
import { findJob } from "./job-records.ts";
import { current, field, inRun, told } from "./job-state.ts";

// `arthur ticket file <id> <job>` (spec/roadmap.md, entry 28): the final message of a job that finished on a ticket, filed in the
// ticket's folder by the `file` of its kind, which the plugin owning the kind registers: docs/commands/ticket.md, "file".

// What a kind's `file` gets: the ticket (its `ticket.md` path from `root`, the project's folder) and the job, `base` the commit it
// started from, `result` its final message. It writes the file and returns its path from `root`; a throw refuses the filing.
export type Filing = {
	readonly ticket: { readonly id: string; readonly path: string; readonly root: string };
	readonly job: { readonly id: string; readonly kind: string; readonly base: string; readonly result: string };
};
export type File = (filing: Filing) => string;

// `filer` is the `file` of a kind, undefined for a kind that files nothing; `query` is the job's full id or the end `arthur jobs` shows.
export function fileJob(home: string, board: Board, filer: (kind: string) => File | undefined, id: string, query: string): string {
	const ticket = board.get(id);
	if (ticket === undefined) throw new Error(`${id} is not on the board`);
	const job = findJob(home, query);
	const read = field(home, job);
	const kind = read("kind");
	const file = filer(kind);
	if (file === undefined) throw new Error(`${job} is a ${kind} job, and no plugin files that kind`);
	const now = current(home, job);
	if (inRun(now)) throw new Error(`${job} is in a run (${told(now)}); file it once it has ended`);
	if (now.state !== "ended" || now.reason !== "finished") throw new Error(`${job} ended ${told(now)}, not finished: its result is unfinished and is never filed; prune it`);
	const named = [...new Set(taskTickets(read("task")).flatMap((path) => FEATURE.exec(path)?.[1] ?? []))];
	if (read("project") !== ticket.project || !named.includes(ticket.id)) throw new Error(`${job}'s task names ${named.join(", ") || "no ticket"} of project ${read("project")}, not ${ticket.id}`);
	const root = board.projects().find((each) => each.name === ticket.project)?.path ?? "";
	return file({ ticket: { id: ticket.id, path: ticket.path, root }, job: { id: job, kind, base: read("base"), result: read("result") } });
}
