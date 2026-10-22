import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Host, Project } from "@arthur/core/plugin";
import { evidence } from "./decision-class.ts";
import { classStates, described, policyOf } from "./decision-classes.ts";
import { type Decision, decisionLine, type Entry, oneLine, ticketLines } from "./decision-log.ts";
import { section } from "./plans.ts";

// What `arthur decisions` prints of a question (spec/roadmap.md, entries 96 and 97): one line of the list, or the whole of
// it, a class's proposal with its evidence, revokes and where it stands; and its lines under the ticket's Decisions.

// One line of `arthur decisions`: the question, then where it stands.
export function line(host: Host, project: Project, decision: Decision): string {
	const { ask, answers, closes, state } = decision;
	const [answered, closed] = [answers.at(-1), closes.at(-1)];
	const now = answered !== undefined ? `answered ${answered.time.slice(0, 10)}: ${answered.decided}` : closed !== undefined ? `closed ${closed.time.slice(0, 10)}: ${closed.reason}` : state;
	const { edited, missing } = ticketCheck(host, project, decision);
	const note = `${edited.length > 0 ? `; edited by hand under the Decisions of ${ask.ticket}` : ""}${missing ? `; its line under the Decisions of ${ask.ticket} is missing` : ""}`;
	return `${ask.id} ${ask.time.slice(0, 10)} ${ask.kind}${ask.ticket === undefined ? "" : ` ${ask.ticket}`}: ${oneLine(ask.question)} — ${now}${note}`;
}

// `arthur decisions <id>`: everything the log holds of one question.
export function whole(host: Host, project: Project, decision: Decision, entries: readonly Entry[]): string {
	const { ask, answers, closes, state } = decision;
	const option = (n: number | undefined) => (n === undefined ? "" : `${n} (${ask.options[n - 1] ?? "no such option"})`);
	const lines = [`${ask.id}: ${ask.kind}, asked ${ask.time}${ask.ticket === undefined ? "" : `, ticket ${ask.ticket}`}${ask.job === undefined ? "" : `, job ${ask.job}`}`, `Question: ${ask.question}`];
	if (ask.class !== undefined) lines.push(`Class: ${described(ask.class)}; ${evidence(ask.class)}`);
	if (ask.options.length > 0) lines.push(`Options: ${ask.options.map((each, at) => `${at + 1}. ${each}`).join("; ")}`);
	if (ask.recommend !== undefined) lines.push(`Recommended: ${typeof ask.recommend === "number" ? option(ask.recommend) : ask.recommend}`);
	for (const each of answers) lines.push(`Answered ${each.time}: ${each.decided}${each.picked === undefined ? "" : `; picked ${option(each.picked)}`}${policyOf(each) === undefined ? `; the owner: "${each.words}"` : `; by policy (${policyOf(each)})`}`);
	for (const each of closes) lines.push(`Closed ${each.time}: ${each.reason}`);
	for (const each of entries) if (each.record === "revoke" && each.id === ask.id) lines.push(`Revoked ${each.time}: the owner: "${each.words}"`);
	const held = classStates(entries).find((each) => each.ask.id === ask.id);
	if (held !== undefined) lines.push(`Now: the class is ${held.state}; answered by policy: ${held.answered.length === 0 ? "none" : held.answered.join(", ")}`);
	else lines.push(`Now: ${state === "answered" && answers.length > 1 ? "answered, the later answer counts" : state}`);
	const { edited, missing } = ticketCheck(host, project, decision);
	for (const each of edited) lines.push(`Edited by hand under the Decisions of ${ask.ticket}, kept as it is: ${each}`);
	if (missing) lines.push(`Its line under the Decisions of ${ask.ticket} is missing; the next arthur decision writes it.`);
	return lines.join("\n");
}

// The question's lines under its ticket's Decisions that differ from what the owner's answers write, and whether one is
// missing, an answer by policy's included, whose line names its class and is found by its whole text.
function ticketCheck(host: Host, project: Project, { ask, answers }: Decision): { readonly edited: readonly string[]; readonly missing: boolean } {
	const ticket = answers.length === 0 || ask.ticket === undefined ? undefined : host.board.get(ask.ticket);
	const file = ticket === undefined ? "" : join(project.path, ticket.path);
	if (!existsSync(file)) return { edited: [], missing: false };
	const text = readFileSync(file, "utf8");
	const found = ticketLines(text, ask.id);
	const written = answers.filter((each) => policyOf(each) === undefined).map(decisionLine);
	const policy = answers.filter((each) => policyOf(each) !== undefined).some((each) => !section(text, "Decisions").includes(decisionLine(each)));
	return { edited: found.filter((each, at) => each !== written[at]), missing: found.length < written.length || policy };
}
