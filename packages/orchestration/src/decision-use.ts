import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { projectOf } from "./decision-commands.ts";
import { policyOf } from "./decision-classes.ts";
import { type Decision, decisions, readLog } from "./decision-log.ts";
import { recommendedBy } from "./silent.ts";

// What only the owner's recorded decision lets through (AR0355): `arthur merge`, a plain one (AR0665) or with `--unreviewed` or `--no-ci` (AR0503),
// which delivery asks of `decision.owner`; `arthur ticket status <id> planned`, which the core asks (AR0665); and `--budget 0` of `arthur spawn` or
// `arthur continue` on a paid model, the `decision` the core hands `beforeSpawn`. docs/commands/decision.md, "What only the owner's decision lets through".

// `what` the flag (`--` first) or the command, `kind` the question's kind, `use` what uses it; `ticket` the job's, `job` the job, none before a spawn.
export type Use = { readonly id: string; readonly what: string; readonly kind: string; readonly ticket?: string; readonly job?: string; readonly use: string };

export function decisionUse(host: Host): void {
	host.provide("decision.owner", (asked: Use) => refusal(host, asked));
	host.jobs.beforeSpawn(({ decision, tickets, id }) => {
		if (decision === undefined) return undefined;
		const [ticket] = tickets.flatMap((path) => /(?:^|\/)spec\/features\/([A-Z]+\d{4,})-/.exec(path)?.[1] ?? []);
		return refusal(host, { id: decision, what: "--budget 0", kind: "budget", ticket, job: id, use: id === undefined ? "spawn" : `continue ${id}` }) || undefined;
	});
}

// Why `asked` may not go on, "" when it may: its id names a question of its kind, of its ticket or job, that the owner answered himself, the later
// answer counting, naming his message (AR0664) and, for a plan or merge, picking option 1, its approval (AR0677); for a merge flag, with `what` among
// its `--what` (AR0533); no other use took it. A pass marks it used in `<folder>/used/<id>`; only the same merge, or move to planned, passes it again.
function refusal(host: Host, { id, what, kind, ticket, job, use }: Use): string {
	const [flag, approves] = [use.startsWith("merge ") && what.startsWith("--"), kind === "plan" || kind === "merge"];
	const of = `${approves ? " --option '<the approval>'" : ""}${ticket !== undefined ? ` --ticket ${ticket}` : job !== undefined ? ` --job ${job}` : ""}`;
	if (id === "") return `${what} needs the owner's decision: arthur decision ask --kind ${kind}${flag ? ` --what ${what}` : ""} --question '<what he decides>'${of}, his answer recorded with arthur decision answer${approves ? " <its id> --picked 1" : ""}, then ${what} --decision <its id>`;
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
	if (recommendedBy(answers.at(-1)) !== undefined) return `${upper} was answered by recommendation (${recommendedBy(answers.at(-1))}), the owner's grant, not by the owner`;
	if (answers.at(-1)?.message === undefined) return `${upper} was answered without the owner's message behind it (recorded before AR0664): ask him again`;
	if (ask.ticket !== ticket || (ticket === undefined && ask.job !== job)) {
		const theirs = ask.ticket !== undefined ? `ticket ${ask.ticket}` : ask.job !== undefined ? `job ${ask.job}` : "no ticket and no job";
		return `${upper} is of ${theirs}, not of ${ticket !== undefined ? `ticket ${ticket}` : job !== undefined ? `job ${job}` : "a spawn of no ticket"}`;
	}
	const picked = answers.at(-1)?.picked;
	if (approves && picked !== 1) return `${upper} picked option ${picked ?? "none"}, not option 1, its approval "${ask.options[0] ?? ""}"`;
	if (flag && !(ask.what ?? []).includes(what)) return `${upper} lets through ${ask.what?.join(" and ") || "no merge flag"}, not ${what}: ask the owner for ${what} with arthur decision ask --kind merge --what ${what}`;
	const mark = join(host.folder, "used", upper);
	mkdirSync(join(host.folder, "used"), { recursive: true });
	try {
		writeFileSync(mark, use, { flag: "wx" });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		const held = readFileSync(mark, "utf8");
		if (!/^(merge|planned) /.test(use) || held !== use) return `${upper} was used already (${held}); ask the owner again`;
	}
	return "";
}
