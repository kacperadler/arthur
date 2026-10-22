import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Host, Project } from "@arthur/core/plugin";
import type { Answer, Ask, Entry, Revoke } from "./decision-log.ts";
import { section } from "./plans.ts";

// Decision classes (spec/roadmap.md, entry 97): a proposal is an `ask` of kind `class` in the decision log, approved by the
// owner's answer picking option 1 and refused by one picking 2, the later answer or `revoke` counting. An approved class
// answers each later question of its kind that names all its words, of its ticket's kind when it has one, by policy: an
// answer whose words are `by policy: <class id>`. docs/commands/decision.md, "Classes".

export const CLASS = "class";
export const OPTIONS = ["Approve the class", "Refuse it"];
const POLICY = /^by policy: ([A-Z]+-D\d+)$/;

export type Class = { readonly kind: string; readonly match: string; readonly decided: string; readonly backedBy: readonly string[]; readonly ticketKind?: string; readonly agreed: number; readonly scored: number };
export type ClassState = { readonly ask: Ask; readonly class: Class; readonly state: "proposed" | "approved" | "refused" | "revoked" | "closed"; readonly since?: string; readonly answered: readonly string[] };

// The class that answered, for an answer given by policy.
export const policyOf = (answer: Answer | undefined) => POLICY.exec(answer?.words ?? "")?.[1];
export const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

// What is wrong with a record of a class (a proposal, its revoke, an answer by policy) as the log holds it, if anything;
// `asked` holds each id asked above it, with its kind.
export function classProblem(each: Readonly<Record<string, unknown>>, asked: ReadonlyMap<string, string>, kinds: readonly string[]): string | undefined {
	if (each.record === "revoke") return asked.get(String(each.id)) !== CLASS ? `a revoke of ${each.id}, which is no class` : typeof each.words === "string" && each.words !== "" ? undefined : "no words";
	if (each.record === "answer") {
		// An answer by policy names a class proposed above it, and never answers a proposal: that is the owner's word alone.
		const policy = POLICY.exec(String(each.words))?.[1];
		if (policy === undefined) return undefined;
		if (asked.get(String(each.id)) === CLASS) return `${each.id}, a class, approved by policy: only the owner approves a class`;
		return asked.get(policy) === CLASS ? undefined : `an answer by policy of ${policy}, which is no class above it`;
	}
	if (each.kind !== CLASS) return "class" in each ? "a class on a question of no class" : undefined;
	const proposed = each.class;
	if (typeof proposed !== "object" || proposed === null || Array.isArray(proposed)) return "a class proposal with no class";
	const { kind, match, decided, ticketKind, backedBy, agreed, scored } = proposed as Readonly<Record<string, unknown>>;
	if (!kinds.includes(String(kind))) return `class kind ${JSON.stringify(kind)}`;
	if (![match, decided, ticketKind ?? "-"].every((value) => typeof value === "string" && value !== "")) return "a class without its match or decision";
	if (!Array.isArray(backedBy) || backedBy.length === 0 || !backedBy.every((id) => typeof id === "string")) return "a class backed by no decision";
	return Number.isInteger(agreed) && Number.isInteger(scored) ? undefined : "a class without its agreement rate";
}

// The answer by policy to a question just asked, when one approved class matches it; `classes` every class that matches.
export function byPolicy(entries: readonly Entry[], ask: Ask, ticketKind: string | undefined): { readonly answers: readonly Answer[]; readonly classes: readonly string[] } {
	const named = new Set(words(ask.question));
	const matched = classStates(entries).filter((each) => each.state === "approved" && each.class.kind === ask.kind && words(each.class.match).every((word) => named.has(word)) && (each.class.ticketKind === undefined || each.class.ticketKind === ticketKind));
	const [one] = matched;
	const answers = matched.length === 1 && one !== undefined ? [{ record: "answer", id: ask.id, time: ask.time, decided: one.class.decided, words: `by policy: ${one.ask.id}` } satisfies Answer] : [];
	return { answers, classes: matched.map((each) => each.ask.id) };
}

// Every class the log proposes, in the order proposed, with where it stands and the questions it answered.
export function classStates(entries: readonly Entry[]): ClassState[] {
	return entries.flatMap((ask) => {
		if (ask.record !== "ask" || ask.class === undefined) return [];
		const said = entries.filter((each): each is Answer | Revoke => each.id === ask.id && (each.record === "revoke" || (each.record === "answer" && policyOf(each) === undefined)));
		const last = said.at(-1);
		const closed = entries.some((each) => each.record === "close" && each.id === ask.id);
		const state = last === undefined ? (closed ? "closed" : "proposed") : last.record === "revoke" ? "revoked" : last.picked === 1 ? "approved" : "refused";
		const answered = entries.flatMap((each) => (each.record === "answer" && policyOf(each) === ask.id ? [each.id] : []));
		return [{ ask, class: ask.class, state, ...(last === undefined ? {} : { since: last.time }), answered }];
	});
}

// The `- Kind:` under a ticket's Goal, when the ticket is on the board and says it.
export function ticketKind(host: Host, project: Project, id: string | undefined): string | undefined {
	const ticket = id === undefined ? undefined : host.board.get(id);
	const file = ticket === undefined ? "" : join(project.path, ticket.path);
	if (!existsSync(file)) return undefined;
	return section(readFileSync(file, "utf8"), "Goal").flatMap((line) => /^- Kind:(.*)$/.exec(line)?.[1]?.trim() || [])[0];
}

// A class in one line: `plan questions naming "approve plan" (feature tickets) → <decided>`.
export const described = (each: Class) => `${each.kind} questions naming "${each.match}"${each.ticketKind === undefined ? "" : ` (${each.ticketKind} tickets)`} → ${each.decided}`;
