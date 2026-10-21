import type { Board } from "./board.ts";
import { FEATURE, taskTickets } from "./board-jobs.ts";
import { findJob } from "./job-records.ts";
import { current, field, inRun, told } from "./job-state.ts";

// `arthur ticket file [<id>] <job>` (spec/roadmap.md, entries 28 and 62): the final message of a job that finished, filed by the
// `file` of its kind, which the plugin owning the kind registers: in ticket `<id>`'s folder, or, for a job whose task names no
// ticket (an audit), where its kind keeps it: docs/commands/ticket.md, "file".

// What a kind's `file` gets: `root` the project's folder, the ticket (its `ticket.md` path from `root`) when one was named, and
// the job, `base` the commit it started from, `result` its final message. It writes the file and returns its path from `root`; a
// throw refuses the filing.
export type Filing = {
	readonly root: string;
	readonly ticket?: { readonly id: string; readonly path: string };
	readonly job: { readonly id: string; readonly kind: string; readonly base: string; readonly result: string };
};
export type File = (filing: Filing) => string;

// `filer` is the `file` of a kind, undefined for a kind that files nothing; `id` the ticket, undefined for none; `query` is the
// job's full id or the end `arthur jobs` shows.
export function fileJob(home: string, board: Board, filer: (kind: string) => File | undefined, id: string | undefined, query: string): string {
	const ticket = id === undefined ? undefined : board.get(id);
	if (id !== undefined && ticket === undefined) throw new Error(`${id} is not on the board`);
	const job = findJob(home, query);
	const read = field(home, job);
	const kind = read("kind");
	const file = filer(kind);
	if (file === undefined) throw new Error(`${job} is a ${kind} job, and no plugin files that kind`);
	const now = current(home, job);
	if (inRun(now)) throw new Error(`${job} is in a run (${told(now)}); file it once it has ended`);
	if (now.state !== "ended" || now.reason !== "finished") throw new Error(`${job} ended ${told(now)}, not finished: its result is unfinished and is never filed; prune it`);
	const named = [...new Set(taskTickets(read("task")).flatMap((path) => FEATURE.exec(path)?.[1] ?? []))];
	const project = ticket?.project ?? read("project");
	if (ticket === undefined && named.length > 0) throw new Error(`${job}'s task names ${named.join(", ")}; file it in its ticket: arthur ticket file ${named[0]} ${job}`);
	if (ticket !== undefined && (read("project") !== project || !named.includes(ticket.id))) throw new Error(`${job}'s task names ${named.join(", ") || "no ticket"} of project ${read("project")}, not ${ticket.id}`);
	const root = board.projects().find((each) => each.name === project)?.path ?? "";
	return file({ root, ...(ticket === undefined ? {} : { ticket: { id: ticket.id, path: ticket.path } }), job: { id: job, kind, base: read("base"), result: read("result") } });
}
