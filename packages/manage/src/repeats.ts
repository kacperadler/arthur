import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Host, Project } from "@arthur/core/plugin";
import { counted, cut, examples, issues, share, tally } from "./repeats-issues.ts";

// `arthur repeats` (AR0562): what the owner decides again and again, read from the decision log orchestration parses
// (`decision.entries`): the decisions by kind and by who answered, the repeated shapes with the class that covers each or the
// one that could, the standing grants, the owner's overrides and the class matches that hold the words but not the phrase; then
// the recurring issues of the ticket history (repeats-issues.ts). Read only, without a model. docs/commands/repeats.md.

type Class = { readonly kind: string; readonly match: string; readonly decided: string; readonly ticketKind?: string };
export type Ask = { readonly record: "ask"; readonly id: string; readonly time: string; readonly kind: string; readonly question: string; readonly options: readonly string[]; readonly recommend?: number | string; readonly ticket?: string; readonly job?: string; readonly class?: Class };
type Answer = { readonly record: "answer"; readonly id: string; readonly decided: string; readonly picked?: number; readonly words: string };
type Entry = Ask | Answer | { readonly record: "close" | "revoke"; readonly id: string };
type Source = "policy" | "standing grant" | "owner" | "closed" | "open";
type Asked = { readonly ask: Ask; readonly answer?: Answer; readonly source: Source; readonly agreed?: boolean };
type State = { readonly id: string; readonly class: Class; readonly state: string };

const SOURCES: readonly Source[] = ["policy", "standing grant", "owner", "closed", "open"];
// The owner's blanket grants as the coordinator quotes them when it answers under one, English and Polish.
const GRANT = /do not ask|don'?t ask|not ask me|always go with|just merge|by yourself|nie pytaj|go with (?:your |all )?recommendation/i;
const POLICY = /^by policy: ([A-Z]+-D\d+)$/;
const DECISION = /\b[A-Z]+-D\d+\b/g;
// A shape repeats from this many asks on; a ready class needs as many owner answers with the same decision.
const REPEATED = 3;
// The sections whose lines a page shows in red: where the recommendation or a class went wrong.
export const RED = ["The owner's overrides of the recommendation", "Loose class matches"];

const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
// A text's words with parentheses and ids left out and each number one `#`: `Accept 1665` and `Accept 1677` are one option.
const tokens = (text: string) => text.replace(/\([^)]*\)/g, " ").replace(/\b[A-Z]+-?D?\d+\b/g, " ").replace(/\$?\d[\d.,]*%?/g, " # ").toLowerCase().match(/[\p{L}#]+/gu) ?? [];
const fresh = (list: readonly Asked[]) => list.filter((each) => each.source === "owner" || each.source === "standing grant");

// Who answered: a class by policy; a standing grant, words that quote one and name not the question's own id; else the owner.
function asked(ask: Ask, entries: readonly Entry[]): Asked {
	const answer = entries.findLast((each): each is Answer => each.record === "answer" && each.id === ask.id);
	if (answer === undefined) return { ask, source: entries.some((each) => each.record === "close" && each.id === ask.id) ? "closed" : "open" };
	if (POLICY.test(answer.words)) return { ask, answer, source: "policy" };
	const own = Array.from(answer.words.matchAll(DECISION), (found) => found[0]).includes(ask.id);
	return { ask, answer, source: GRANT.test(answer.words) && !own ? "standing grant" : "owner", ...(typeof ask.recommend === "number" && answer.picked !== undefined ? { agreed: answer.picked === ask.recommend } : {}) };
}

// Each class with where it stands: the later of the owner's answers to it and a revoke counts.
function classes(entries: readonly Entry[]): State[] {
	return entries.flatMap((ask) => {
		if (ask.record !== "ask" || ask.class === undefined) return [];
		const last = entries.findLast((each) => each.id === ask.id && (each.record === "revoke" || (each.record === "answer" && !POLICY.test(each.words))));
		const closed = entries.some((each) => each.record === "close" && each.id === ask.id);
		const state = last === undefined ? (closed ? "closed" : "proposed") : last.record === "answer" && last.picked === 1 ? "approved" : last.record === "revoke" ? "revoked" : "refused";
		return [{ id: ask.id, class: ask.class, state }];
	});
}

// The digest of `project`, the main one when undefined, from `since` on: a date (YYYY-MM-DD, by each ask's own date) or a
// decision id; `host.board.list` refuses an unknown project.
export function repeats(host: Pick<Host, "board" | "call">, project: string | undefined, since?: string): string {
	const tickets = host.board.list(project);
	const projects = host.board.projects();
	const where = (project === undefined ? projects[0] : projects.find((each) => each.name === project)) as Project;
	const entries = host.call<readonly Entry[]>("decision.entries", { project: where.name });
	const all = entries.filter((each): each is Ask => each.record === "ask");
	const date = since !== undefined && /^\d/.test(since);
	const from = since === undefined ? 0 : all.findIndex((each) => (date ? each.time.slice(0, 10) >= since : each.id === since));
	if (from === -1 && since !== undefined && !date) throw new Error(`no decision ${since} in the log of project ${where.name}`);
	const asks = from === -1 ? [] : all.slice(from).map((ask) => asked(ask, entries));
	// Of a ticket on the board, the `- Kind:` its file states, for a class of one ticket kind.
	const kindOf = (id: string | undefined) => {
		const file = join(where.path, tickets.find((each) => each.id === id)?.path ?? "-");
		return existsSync(file) ? /^- Kind:[ \t]*(\S.*)$/m.exec(readFileSync(file, "utf8"))?.[1]?.trim() : undefined;
	};
	const day = since === undefined || date ? since : asks[0]?.ask.time.slice(0, 10);
	return [
		`# Repeats of ${where.name}\n\nSince ${since ?? "the start"}.`,
		...(asks.length === 0 ? ["## Decisions\n\nNone in the log."] : decided(asks, classes(entries), where.name, kindOf)),
		issues(where, tickets, asks.map((each) => each.ask), day),
	].join("\n\n");
}

function decided(asks: readonly Asked[], states: readonly State[], project: string, kindOf: (ticket: string | undefined) => string | undefined): string[] {
	const questions = asks.filter((each) => each.ask.kind !== "class");
	const scored = (list: readonly Asked[]) => fresh(list).filter((each) => each.agreed !== undefined);
	const agreement = (list: readonly Asked[]) => share(scored(list).filter((each) => each.agreed).length, scored(list).length);
	const sources = SOURCES.filter((source) => source !== "open" || asks.some((each) => each.source === "open"));
	const split = (list: readonly Asked[], whole?: number) => sources.map((source) => `${source} ${whole === undefined ? list.filter((each) => each.source === source).length : share(list.filter((each) => each.source === source).length, whole)}`).join(", ");
	const [first, last] = [asks[0]?.ask, asks.at(-1)?.ask];
	const count = (source: Source) => asks.filter((each) => each.source === source).length;
	const kinds = [...tally(questions, (each) => each.ask.kind)].sort((a, b) => b[1] - a[1]).map(([name]) => {
		const of = questions.filter((each) => each.ask.kind === name);
		return `- ${name}: ${of.length} ask${of.length === 1 ? "" : "s"}; ${split(of)}; agreement ${agreement(of)}`;
	});
	const names = (state: State, ask: Ask) =>
		state.class.kind === ask.kind && words(state.class.match).every((word) => words(ask.question).includes(word)) && (state.class.ticketKind === undefined || kindOf(ask.ticket) === state.class.ticketKind);
	const groups = [...Map.groupBy(questions, ({ ask }) => `${ask.kind}: ${ask.options.length > 0 ? ask.options.map((option) => tokens(option).slice(0, 2).join(" ")).join(" / ") : tokens(ask.question).slice(0, 4).join(" ")}`)];
	const shapes = groups.filter(([, list]) => list.length >= REPEATED).sort((a, b) => b[1].length - a[1].length).map(([name, list], index) => {
		const covering = states.map((state) => ({ ...state, names: list.filter((each) => names(state, each.ask)).length })).filter((state) => state.names > 0);
		// The owner's picks by the option's first 2 words, as the shape names it: `Accept 1665` and `Accept 1677` are one pick.
		const picked = fresh(list).filter((each) => each.answer?.picked !== undefined);
		const picks = [...Map.groupBy(picked, ({ ask, answer }) => tokens(ask.options[(answer?.picked ?? 0) - 1] ?? "").slice(0, 2).join(" ") || `option ${answer?.picked}`)].map(([label, of]) => `"${label}" ${of.length}`);
		return `### ${index + 1}. \`${name}\`: ${list.length} asks\n\n${[
			`- First asked: ${list[0]?.ask.id}, "${cut(list[0]?.ask.question ?? "")}"`,
			`- Answered: ${split(list)}`,
			`- Picks: ${picks.join(", ") || "none"}`,
			`- Agreement with the recommendation: ${agreement(list)}`,
			`- Examples: ${examples(list.map((each) => each.ask.id))}`,
			`- Class: ${covering.map((state) => `${state.id} ${state.state}${state.class.ticketKind === undefined ? "" : ` (${state.class.ticketKind} tickets)`}, names ${state.names} of ${list.length}`).join("; ") || "none"}`,
			`- Candidate: ${candidate(list, covering, picks.length, project)}`,
		].join("\n")}`;
	});
	const overrides = scored(questions).filter((each) => !each.agreed);
	const option = (each: Asked, n: number | string | undefined) => `${n}, "${cut(each.ask.options[Number(n) - 1] ?? "", 60)}"`;
	const loose = questions.flatMap(({ ask, answer }) => {
		const by = POLICY.exec(answer?.words ?? "")?.[1];
		const match = states.find((state) => state.id === by)?.class.match;
		if (match === undefined || ` ${words(ask.question).join(" ")} `.includes(` ${words(match).join(" ")} `)) return [];
		return [`- ${ask.id} answered by ${by}, whose words "${match}" it names apart, not as one phrase: "${cut(ask.question)}"`];
	});
	return [
		`## Decisions by kind and by who answered\n\n${first?.id} to ${last?.id}, ${first?.time.slice(0, 10)} to ${last?.time.slice(0, 10)}: ${asks.length} asks, ${asks.length - count("closed") - count("open")} answered, ${count("closed")} closed, ${count("open")} open.`,
		[...kinds, `- All ${questions.length} but the class proposals: ${split(questions, questions.length)}; agreement ${agreement(questions)}`, `- Classes, as they stand now: ${states.map((each) => `${each.id} ${each.state}`).join(", ") || "none"}`].join("\n"),
		`Policy: answered by a class. Standing grant: the answer quotes one of the owner's blanket grants ("do not ask", "always go with your recommendation", "just merge") and names not the question's own id. Owner: any other answer. Agreement: the answers by the owner or a grant that picked the recommended option, of those with both.`,
		`## Repeated shapes\n\nA shape is the kind and each option's first 2 words (parentheses, ids and numbers left out), or the question's first 4 words when it offers none; each with ${REPEATED} or more asks.`,
		...(shapes.length === 0 ? ["none"] : shapes),
		`## Standing grants\n\n${grants(questions.filter((each) => each.source === "standing grant")).join("\n") || "none"}`,
		`## ${RED[0]}\n\n${share(overrides.length, scored(questions).length)} scored answers picked another option than the recommended one${overrides.length === 0 ? "." : `:\n${overrides.map((each) => `- ${each.ask.id} ${each.ask.kind}: picked ${option(each, each.answer?.picked)} over ${option(each, each.ask.recommend)}: "${cut(each.ask.question)}"`).join("\n")}`}`,
		`## ${RED[1]}\n\n${loose.join("\n") || "none"}`,
	];
}

// What a shape needs: nothing when an approved class names every ask; a code default when the owner's picks split; a ready
// proposal when 3 or more of his answers decided the same; else why no class fits.
function candidate(list: readonly Asked[], covering: readonly (State & { readonly names: number })[], picks: number, project: string): string {
	const covered = covering.find((state) => state.state === "approved" && state.names === list.length);
	if (covered !== undefined) return `covered by ${covered.id}`;
	if (picks > 1) return "picks split: a code default";
	if (fresh(list).length === 0) return "no answer by the owner or a grant to back a class";
	const [best = []] = [...Map.groupBy(fresh(list), (each) => words(each.answer?.decided ?? "").join(" ")).values()].sort((a, b) => b.length - a.length);
	if (best.length < REPEATED) return "decided texts differ: one fresh owner answer backs a class";
	const common = [...new Set(words(list[0]?.ask.question ?? ""))].filter((word) => list.every((each) => words(each.ask.question).includes(word)));
	if (common.length === 0) return "no word common to every question: no class matches them all";
	const quote = (text: string) => `'${text.replace(/'/g, "'\\''")}'`;
	return `\`arthur decision class propose --project ${project} --kind ${list[0]?.ask.kind} --match ${quote(common.join(" "))} --decided ${quote(best[0]?.answer?.decided ?? "")} --backed-by ${best.map((each) => each.ask.id).join(" ")}\``;
}

// The answers under each standing grant: those naming another decision go under it (the group it began, if any), the others
// under the first answer whose words begin as theirs do.
function grants(standing: readonly Asked[]): string[] {
	const groups: { named?: string; plain: string; list: Asked[] }[] = [];
	for (const each of standing) {
		const said = each.answer?.words ?? "";
		const named = Array.from(said.matchAll(DECISION), (found) => found[0]).find((id) => id !== each.ask.id);
		const plain = cut(said, Infinity).toLowerCase();
		const group = groups.find((one) => (named === undefined ? one.named === undefined && (plain.startsWith(one.plain) || one.plain.startsWith(plain)) : one.named === named || one.list[0]?.ask.id === named));
		if (group === undefined) groups.push({ ...(named === undefined ? {} : { named }), plain, list: [each] });
		else group.list.push(each);
	}
	return groups.map(({ named, list }) => `- ${named === undefined ? `first ${list[0]?.ask.id}` : `under ${named}`}, "${cut(list[0]?.answer?.words ?? "")}": ${list.length} answer${list.length === 1 ? "" : "s"} (${counted(tally(list, (each) => each.ask.kind))}): ${examples(list.map((each) => each.ask.id))}`);
}
