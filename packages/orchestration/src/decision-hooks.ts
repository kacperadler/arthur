import type { Host, Project } from "@arthur/core/plugin";
import { policyOf } from "./decision-classes.ts";
import { type Answer, ask, close, type Decision, decisions, readLog } from "./decision-log.ts";

// What the plugin records in the decision log by itself (spec/roadmap.md, entry 96): the question of a job blocked on the
// owner, asked as kind `job` (blocked-notice.ts names its id in the notice); a close once what an open question waits on is
// gone, its job continued or ended, its ticket merged or dropped; and the wake's line naming the id to answer, or the
// decision of the class that answered it by policy (entry 97).

// The project a job or a ticket of `name` belongs to; undefined without a project list, or for a name not in it.
function eventProject(host: Host, name: unknown): Project | undefined {
	return host.collect("projects").length === 0 ? undefined : host.board.projects().find((each) => each.name === name);
}

// A job's question as askOfJob records it, with the answer of the class that answered it by policy, if one did.
export type JobQuestion = { readonly id: string; readonly policy?: Answer };
// Records a job's question; undefined when its project has no log to hold it.
export function askOfJob(host: Host, data: Readonly<Record<string, unknown>>, question: string): JobQuestion | undefined {
	const project = eventProject(host, data.project);
	if (project === undefined) return undefined;
	const ticket = typeof data.ticket === "string" && host.board.get(data.ticket)?.project === project.name ? data.ticket : undefined;
	return ask(host, project, { kind: "job", question, options: [], job: String(data.id), ...(ticket === undefined ? {} : { ticket }) });
}

export function decisionHooks(host: Host): void {
	host.events.on("job-state", (event) => {
		const { id, project, to } = (event.data ?? {}) as Readonly<Record<string, unknown>>;
		const where = to === "working" || to === "idle" || to === "ended" ? eventProject(host, project) : undefined;
		// Read without the lock first: most jobs have no question open.
		const open = (each: { readonly kind: string; readonly job?: string }) => each.kind === "job" && each.job === id;
		if (where !== undefined && decisions(readLog(where)).some((each) => each.state === "open" && open(each.ask))) close(host, where, open, to === "ended" ? "job ended" : "job continued");
	});
	host.events.on("ticket-moved", (event) => {
		const { id, project, to } = (event.data ?? {}) as Readonly<Record<string, unknown>>;
		const where = to === "merged" || to === "dropped" ? eventProject(host, project) : undefined;
		if (where !== undefined && decisions(readLog(where)).some((each) => each.state === "open" && each.ask.ticket === id)) close(host, where, (each) => each.ticket === id, `ticket ${String(to)}`);
	});
	// A wake must not fail: a log broken by hand costs this line only.
	host.provide("coordinator.wake", (job: Readonly<Record<string, unknown>>) => {
		if (job.state !== "blocked" || typeof job.reason !== "string" || !job.reason.startsWith("user: ")) return undefined;
		let last: Decision | undefined;
		try {
			const where = eventProject(host, job.project);
			last = where === undefined ? undefined : decisions(readLog(where)).findLast((each) => each.ask.kind === "job" && each.ask.job === job.id);
		} catch (error) {
			return `Its question is not in the decision log: ${(error instanceof Error ? error.message : String(error)).split("\n")[0]}`;
		}
		const [open, answered] = [last?.state === "open" ? last.ask.id : undefined, last?.answers.at(-1)];
		const policy = policyOf(answered);
		if (open !== undefined) return `Its question is decision ${open}: record the owner's answer first, arthur decision answer ${open} --decided '<the decision in one line>' '<his words>', then arthur continue ${String(job.id)} '<his answer>'.`;
		if (policy === undefined || answered === undefined) return undefined;
		return `Its question is decision ${last?.ask.id}, answered by policy (${policy}): ${answered.decided}. Act on it as on the owner's answer, arthur continue ${String(job.id)} '<that decision>', and say so in your reply.`;
	});
}
