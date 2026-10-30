import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host, Project } from "@arthur/core/plugin";
import { redact } from "./credential.ts";
import { policyOf } from "./decision-classes.ts";
import { queued } from "./decision-lock.ts";
import { type Answer, ask, close, type Decision, decisions, readLog } from "./decision-log.ts";

// What the plugin records in the decision log by itself (spec/roadmap.md, entry 96): the question of a job blocked on the
// owner, asked as kind `job` (blocked-notice.ts names its id in the notice); a close once what an open question waits on is
// gone, its job continued or ended, its ticket merged or dropped; and the wake's line naming the id to answer, or the
// decision of the class that answered it by policy (entry 97), with which the plugin continues the job by itself (AR0583).

// The project a job or a ticket of `name` belongs to; undefined without a project list, or for a name not in it.
function eventProject(host: Host, name: unknown): Project | undefined {
	return host.collect("projects").length === 0 ? undefined : host.board.projects().find((each) => each.name === name);
}

// The question of job `job`'s block on `reason` (`user: <question>`) in the log of `where`: an earlier one of the job is no answer to it.
function question(host: Host, where: Project, job: unknown, reason: string): Decision | undefined {
	const asked = redact(reason.slice("user: ".length).trim(), host.secrets);
	return decisions(readLog(where)).findLast((each) => each.ask.kind === "job" && each.ask.job === job && each.ask.question === asked);
}

// Continues job `id` with the decision a class gave its question `decision`, once: `<folder>/continued/<decision>`, made whole or
// not at all, marks it. Only a job blocked at the end of its run; one a plugin holds in its run goes on at its `job-ended`. A
// continue that fails reaches the coordinator, naming why.
function continueByPolicy(host: Host, id: string, decision: string, answer: Answer | undefined): void {
	const [policy, job] = [policyOf(answer), host.jobs.list().find((each) => each.id === id)];
	if (policy === undefined || answer === undefined || job?.state !== "blocked" || job.hold !== "") return;
	mkdirSync(join(host.folder, "continued"), { recursive: true });
	try {
		writeFileSync(join(host.folder, "continued", decision), "", { flag: "wx" });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") return;
		throw error;
	}
	const told = (why: unknown) =>
		host.events.emit("coordinator-message", { text: `${id} was not continued by policy (${policy}): ${(why instanceof Error ? why.message : String(why)).split("\n")[0]}; arthur continue ${id} '${answer.decided}' continues it with that decision.` });
	host.jobs.continue(id, answer.decided).then((failed) => failed === undefined || told(failed), told);
}

// A job's question as askOfJob records it, with the answer of the class that answered it by policy, if one did.
export type JobQuestion = { readonly id: string; readonly policy?: Answer };
// Records a job's question; undefined when its project has no log to hold it. `again`, after a crash that may have asked it
// already: the job's open question of these words, if there is one, is not asked twice. Under `queued`'s lock: at once when
// it is free, else a promise of it.
export function askOfJob(host: Host, data: Readonly<Record<string, unknown>>, question: string, again = false): JobQuestion | undefined | Promise<JobQuestion> {
	const project = eventProject(host, data.project);
	if (project === undefined) return undefined;
	const ticket = typeof data.ticket === "string" && host.board.get(data.ticket)?.project === project.name ? data.ticket : undefined;
	return queued(host, project, (lock) => {
		const words = redact(question.trim(), host.secrets);
		const open = again ? decisions(readLog(project)).findLast((each) => each.state === "open" && each.ask.kind === "job" && each.ask.job === String(data.id) && each.ask.question === words) : undefined;
		if (open !== undefined) return open.ask;
		const asked = ask(host, project, { kind: "job", question, options: [], job: String(data.id), ...(ticket === undefined ? {} : { ticket }) }, lock);
		continueByPolicy(host, String(data.id), asked.id, asked.policy);
		return asked;
	});
}

export function decisionHooks(host: Host): void {
	host.events.on("job-state", (event) => {
		const { id, project, to } = (event.data ?? {}) as Readonly<Record<string, unknown>>;
		const where = to === "working" || to === "idle" || to === "ended" ? eventProject(host, project) : undefined;
		// Read without the lock first: most jobs have no question open.
		const open = (each: { readonly kind: string; readonly job?: string }) => each.kind === "job" && each.job === id;
		if (where !== undefined && decisions(readLog(where)).some((each) => each.state === "open" && open(each.ask))) return queued(host, where, (lock) => void close(host, where, open, to === "ended" ? "job ended" : "job continued", lock));
	});
	host.events.on("ticket-moved", (event) => {
		const { id, project, to } = (event.data ?? {}) as Readonly<Record<string, unknown>>;
		const where = to === "merged" || to === "dropped" ? eventProject(host, project) : undefined;
		if (where !== undefined && decisions(readLog(where)).some((each) => each.state === "open" && each.ask.ticket === id)) return queued(host, where, (lock) => void close(host, where, (each) => each.ticket === id, `ticket ${String(to)}`, lock));
	});
	// The run's end of a job a plugin held when its question was answered by policy.
	host.events.on("job-ended", (event) => {
		const { id, project, reason } = (event.data ?? {}) as Readonly<Record<string, unknown>>;
		const where = typeof reason === "string" && reason.startsWith("user: ") ? eventProject(host, project) : undefined;
		const last = where === undefined ? undefined : question(host, where, id, String(reason));
		if (last !== undefined) continueByPolicy(host, String(id), last.ask.id, last.answers.at(-1));
	});
	// A wake must not fail: a log broken by hand costs this line only.
	host.provide("coordinator.wake", (job: Readonly<Record<string, unknown>>) => {
		if (job.state !== "blocked" || typeof job.reason !== "string" || !job.reason.startsWith("user: ")) return undefined;
		let [where, last]: [Project | undefined, Decision | undefined] = [undefined, undefined];
		try {
			where = eventProject(host, job.project);
			last = where === undefined ? undefined : question(host, where, job.id, job.reason);
		} catch (error) {
			return `Its question is not in the decision log: ${(error instanceof Error ? error.message : String(error)).split("\n")[0]}`;
		}
		// Recorded after this wake when another process held the log's lock (decision-lock.ts).
		if (where !== undefined && last === undefined) return `Its question was not in the decision log yet: arthur decisions --kind job --project ${where.name} shows its id. Open, record the owner's answer first, arthur decision answer <its id> --decided '<the decision in one line>' '<his words>', then arthur continue ${String(job.id)} '<his answer>'; answered by policy, the plugin continues the job with that decision by itself: say so in your reply.`;
		const [open, answered] = [last?.state === "open" ? last.ask.id : undefined, last?.answers.at(-1)];
		const policy = policyOf(answered);
		if (open !== undefined) return `Its question is decision ${open}: record the owner's answer first, arthur decision answer ${open} --decided '<the decision in one line>' '<his words>', then arthur continue ${String(job.id)} '<his answer>'.`;
		if (policy === undefined || answered === undefined) return undefined;
		const head = `Its question is decision ${last?.ask.id}, answered by policy (${policy}): ${answered.decided}.`;
		if (existsSync(join(host.folder, "continued", String(last?.ask.id)))) return `${head} The job is continued by policy (${policy}) with that decision; a continue that fails comes as a message of its own. Say so in your reply.`;
		return `${head} The job was not continued by itself, since no record of it is blocked on that question; say so in your reply.`;
	});
}
