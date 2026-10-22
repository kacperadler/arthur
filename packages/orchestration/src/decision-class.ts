import type { Host, Project } from "@arthur/core/plugin";
import { redact } from "./credential.ts";
import { CLASS, type Class, classStates, described, OPTIONS, policyOf, ticketKind, words } from "./decision-classes.ts";
import { ask, change, type Decision, decisions, KINDS, oneLine, readLog, type Revoke } from "./decision-log.ts";

// `arthur decision class propose|revoke` and `arthur decisions --classes` (spec/roadmap.md, entry 97): a class proposed from
// the owner's answered decisions, with the agreement of the coordinator's recommendations with his picks on them, and
// revoked on his word. docs/commands/decision.md, "Classes".

const same = (a: string, b: string) => oneLine(a).toLowerCase() === oneLine(b).toLowerCase();

// Records a proposal as a question of kind `class`; its id and the class as recorded.
export function propose(host: Host, project: Project, given: { readonly kind: string; readonly match: string; readonly decided: string; readonly backedBy: readonly string[] }): { readonly id: string; readonly class: Class; readonly unwritten?: string } {
	const { kind, backedBy } = given;
	if (kind === CLASS) throw new Error(`--kind ${CLASS}: a class never approves a class; one of ${KINDS.join(", ")}`);
	if (!KINDS.includes(kind)) throw new Error(`kind ${JSON.stringify(kind)}: one of ${KINDS.join(", ")}`);
	const [match, decided] = [oneLine(given.match), oneLine(given.decided)];
	if (words(match).length === 0) throw new Error("--match names no word: the words every question of the class names");
	if (decided === "") throw new Error("no --decided: the class's decision in one English line");
	if (backedBy.length === 0) throw new Error("backed by no decision: --backed-by <id>... names the owner's answered decisions, each his same answer");
	const all = decisions(readLog(project));
	const backing = [...new Set(backedBy)].map((id): Decision => {
		const found = all.find((each) => each.ask.id === id);
		if (found === undefined) throw new Error(`${id} is not in the decision log of project ${project.name}`);
		const last = found.answers.at(-1);
		if (last === undefined) throw new Error(`${id} is ${found.state}, not answered by the owner`);
		if (policyOf(last) !== undefined) throw new Error(`${id} was answered by policy (${policyOf(last)}), not by the owner`);
		if (found.ask.kind !== kind) throw new Error(`${id} is a ${found.ask.kind} question, not ${kind}`);
		if (!same(last.decided, decided)) throw new Error(`${id} decided "${last.decided}", not the class's "${decided}"`);
		const named = words(found.ask.question);
		if (!words(match).every((word) => named.includes(word))) throw new Error(`${id} does not name every word of --match "${match}": ${oneLine(found.ask.question)}`);
		return found;
	});
	// The evals' case of each decision: the recommendation scored against the owner's pick; one without both is not scored.
	const scored = backing.flatMap(({ ask: { recommend, options }, answers }) => {
		const picked = answers.at(-1)?.picked;
		if (recommend === undefined || picked === undefined) return [];
		return [typeof recommend === "number" ? recommend === picked : same(recommend, options[picked - 1] ?? "")];
	});
	const kinds = new Set(backing.map((each) => ticketKind(host, project, each.ask.ticket)));
	const [shared] = kinds;
	const made: Class = { kind, match: redact(match), decided: redact(decided), backedBy: backing.map((each) => each.ask.id), ...(kinds.size === 1 && shared !== undefined ? { ticketKind: shared } : {}), agreed: scored.filter(Boolean).length, scored: scored.length };
	const asked = ask(host, project, { kind: CLASS, question: `Pre-approve a class: ${described(made)}, by policy, without asking you?`, options: OPTIONS, recommend: 1, class: made });
	return { id: asked.id, class: made, ...(asked.unwritten === undefined ? {} : { unwritten: asked.unwritten }) };
}

// The evidence for a class: its backing decisions and their agreement rate.
export const evidence = (each: Class) => `backed by ${each.backedBy.join(", ")}; the recommendation agreed with the owner's pick on ${each.agreed} of ${each.scored}${each.backedBy.length > each.scored ? ` (${each.backedBy.length - each.scored} with no recommendation or pick, not scored)` : ""}`;

// Records the owner's revoke of class `id`.
export function revoke(host: Host, project: Project, id: string, said: string): { readonly unwritten?: string } {
	if (said.trim() === "") throw new Error(`no words: arthur decision class revoke ${id} <the owner's words>`);
	return change(host, project, (entries, time) => {
		if (!entries.some((each) => each.id === id)) throw new Error(`${id} is not in the decision log of project ${project.name}`);
		const found = classStates(entries).find((each) => each.ask.id === id);
		if (found === undefined) throw new Error(`${id} is no class; arthur decisions --classes lists them`);
		if (found.state === "revoked") throw new Error(`${id} is revoked already, on ${found.since?.slice(0, 10)}`);
		return [{ record: "revoke", id, time, words: redact(said.trim()) } satisfies Revoke];
	});
}

// `arthur decisions --classes`: each class, where it stands, its evidence and the questions it answered.
export function classList(project: Project): string {
	const all = classStates(readLog(project));
	if (all.length === 0) return "no classes yet";
	return all.map(({ ask, class: each, state, since, answered }) => `${ask.id} ${state}${since === undefined ? "" : ` ${since.slice(0, 10)}`}: ${described(each)}; ${evidence(each)}; answered by policy: ${answered.length === 0 ? "none" : answered.join(", ")}`).join("\n");
}
