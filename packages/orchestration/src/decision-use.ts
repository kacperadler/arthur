import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { projectOf } from "./decision-commands.ts";
import { policyOf } from "./decision-classes.ts";
import { type Decision, decisions, readLog } from "./decision-log.ts";

// What only the owner's recorded decision lets through (AR0355): `arthur merge --unreviewed`, which delivery asks of
// `decision.owner`, and `--budget 0` of `arthur spawn` or `arthur continue` on a paid model, the `decision` the core hands
// `beforeSpawn`. docs/commands/decision.md, "What only the owner's decision lets through".

// `what` the flag, `kind` the question's kind, `use` what uses it; `ticket` the job's, `job` the job, none before a spawn.
export type Use = { readonly id: string; readonly what: string; readonly kind: string; readonly ticket?: string; readonly job?: string; readonly use: string };

export function decisionUse(host: Host): void {
	host.provide("decision.owner", (asked: Use) => refusal(host, asked));
	host.jobs.beforeSpawn(({ decision, tickets, id }) => {
		if (decision === undefined) return undefined;
		const [ticket] = tickets.flatMap((path) => /(?:^|\/)spec\/features\/([A-Z]+\d{4,})-/.exec(path)?.[1] ?? []);
		return refusal(host, { id: decision, what: "--budget 0", kind: "budget", ticket, job: id, use: id === undefined ? "spawn" : `continue ${id}` }) || undefined;
	});
}

// Why `asked` may not go on, "" when it may: its id names a question of its kind, of its ticket (else its job, else neither),
// that the owner answered himself, the later answer counting, and no other use took it. A pass marks the id used in
// `<folder>/used/<id>`, created whole or not at all; only the same merge again passes it then: a job's branch goes in once.
function refusal(host: Host, { id, what, kind, ticket, job, use }: Use): string {
	if (id === "") return `${what} needs the owner's decision: arthur decision ask --kind ${kind} --question '<what he decides>'${ticket !== undefined ? ` --ticket ${ticket}` : job !== undefined ? ` --job ${job}` : ""}, his answer recorded with arthur decision answer, then ${what} --decision <its id>`;
	const upper = id.toUpperCase();
	let found: Decision | undefined;
	try {
		const where = projectOf(host, upper);
		found = decisions(readLog(where)).find((each) => each.ask.id === upper);
		if (found === undefined) return `${upper} is not in the decision log of project ${where.name}`;
	} catch (error) {
		return (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";
	}
	const { ask, state, answers } = found;
	if (ask.kind !== kind) return `${upper} is a ${ask.kind} question, not ${kind}: ${what} takes a ${kind} decision`;
	if (state !== "answered") return `${upper} is ${state}, not answered by the owner`;
	const policy = policyOf(answers.at(-1));
	if (policy !== undefined) return `${upper} was answered by policy (${policy}), not by the owner`;
	if (ask.ticket !== ticket || (ticket === undefined && ask.job !== job)) {
		const theirs = ask.ticket !== undefined ? `ticket ${ask.ticket}` : ask.job !== undefined ? `job ${ask.job}` : "no ticket and no job";
		return `${upper} is of ${theirs}, not of ${ticket !== undefined ? `ticket ${ticket}` : job !== undefined ? `job ${job}` : "a spawn of no ticket"}`;
	}
	const mark = join(host.folder, "used", upper);
	mkdirSync(join(host.folder, "used"), { recursive: true });
	try {
		writeFileSync(mark, use, { flag: "wx" });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		const held = readFileSync(mark, "utf8");
		if (!use.startsWith("merge ") || held !== use) return `${upper} was used already (${held}); ask the owner again`;
	}
	return "";
}
