import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { withLock } from "@arthur/core/lock";
import type { Host, Project } from "@arthur/core/plugin";
import { withDecision, write } from "./autopilot.ts";
import { CLASS, type Class, classProblem, policyOf } from "./decision-classes.ts";
import { logLock } from "./decision-lock.ts";
import { section } from "./plans.ts";

// The decision log (spec/roadmap.md, entries 96 and 97): each project's `spec/decisions.jsonl`, one record a line, `ask`,
// `answer`, `close` or a class's `revoke`, appended only here, under a lock, the whole file written to a temporary name and
// renamed. An answer to a question of a ticket becomes a dated line under the ticket's Decisions, written after the log; a
// crash between the two is repaired by the next write. A question an approved class matches is answered by policy in the
// same write (decision-classes.ts), else by its recommendation under the owner's grant (silent.ts). docs/commands/decision.md.

export const KINDS = ["job", "question", "plan", "review", "budget", "merge"];
export const FILE = "spec/decisions.jsonl";
export const DECISION_ID = /^([A-Z]+)-D(\d+)$/;
// The longest Decisions line; a longer one has the owner's words cut.
export const LINE = 400;

export type Ask = { readonly record: "ask"; readonly id: string; readonly time: string; readonly project: string; readonly kind: string; readonly question: string; readonly options: readonly string[]; readonly recommend?: number | string; readonly ticket?: string; readonly job?: string; readonly what?: readonly string[]; readonly class?: Class };
// `message` the number of the owner's channel message that holds his words (decision-proof.ts), on his own answers since AR0664.
export type Answer = { readonly record: "answer"; readonly id: string; readonly time: string; readonly decided: string; readonly picked?: number; readonly words: string; readonly message?: number };
export type Close = { readonly record: "close"; readonly id: string; readonly time: string; readonly reason: string };
export type Revoke = { readonly record: "revoke"; readonly id: string; readonly time: string; readonly words: string };
export type Entry = Ask | Answer | Close | Revoke;
// A question with its answers and closes; the later answer counts, and outranks a close.
export type Decision = { readonly ask: Ask; readonly answers: readonly Answer[]; readonly closes: readonly Close[]; readonly state: "open" | "answered" | "closed" };

export const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

// Every record of the log, none when it does not exist; a line that is not a record (a hand edit) throws, naming it.
export function readLog(project: Project): Entry[] {
	const file = join(project.path, FILE);
	const text = existsSync(file) ? readFileSync(file, "utf8") : "";
	if (text === "") return [];
	// Each id asked, with its kind.
	const asked = new Map<string, string>();
	return (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n").flatMap((line, at) => {
		let value: unknown;
		try {
			value = JSON.parse(line);
		} catch {}
		const why = problem(value, asked, project.prefix);
		if (why !== undefined) throw new Error(`${file} line ${at + 1} is not a decision record (${why}); only arthur decision writes the log: undo the hand edit (git diff -- ${FILE}); nothing was written`);
		const entry = value as Entry;
		if (entry.record === "ask") asked.set(entry.id, entry.kind);
		return [entry];
	});
}

function problem(value: unknown, asked: ReadonlyMap<string, string>, prefix: string): string | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return "not a JSON object";
	const each = value as Readonly<Record<string, unknown>>;
	const text = (key: string) => typeof each[key] === "string" && each[key] !== "";
	if (!["ask", "answer", "close", "revoke"].includes(String(each.record))) return `record ${JSON.stringify(each.record)}, not ask, answer, close or revoke`;
	if (typeof each.id !== "string" || DECISION_ID.exec(each.id)?.[1] !== prefix) return `id ${JSON.stringify(each.id)}, not ${prefix}-D<number>`;
	if (!text("time") || Number.isNaN(Date.parse(String(each.time)))) return "no time";
	if (each.record === "ask") {
		if (asked.has(each.id)) return `a second ask of ${each.id}`;
		if (!KINDS.includes(String(each.kind)) && each.kind !== CLASS) return `kind ${JSON.stringify(each.kind)}`;
		if (!text("question") || !text("project")) return "no question or project";
		if ([each.options, each.what ?? []].some((list) => !Array.isArray(list) || !list.every((one) => typeof one === "string"))) return "options or what not a list of texts";
		if (["ticket", "job"].some((key) => key in each && !text(key))) return "a ticket or job not a text";
		if ("recommend" in each && !(text("recommend") || Number.isInteger(each.recommend))) return "recommend neither a number nor a text";
		return classProblem(each, asked, KINDS);
	}
	if (!asked.has(each.id)) return `no ask of ${each.id} above it`;
	if (each.record === "close") return text("reason") ? undefined : "no reason";
	if (each.record === "answer" && !(text("decided") && text("words") && ["picked", "message"].every((key) => !(key in each) || Number.isSafeInteger(each[key])))) return "no decided or words, or picked or message not a number";
	return classProblem(each, asked, KINDS);
}

// The questions in the order they were asked, each with what came after it.
export function decisions(entries: readonly Entry[]): Decision[] {
	return entries.flatMap((ask) => {
		if (ask.record !== "ask") return [];
		const answers = entries.filter((each): each is Answer => each.record === "answer" && each.id === ask.id);
		const closes = entries.filter((each): each is Close => each.record === "close" && each.id === ask.id);
		return [{ ask, answers, closes, state: answers.length > 0 ? "answered" : closes.length > 0 ? "closed" : "open" }];
	});
}

// Now in `timeZone`, with its offset: `2026-10-22T08:40:00+02:00`.
export function stamp(host: Host): string {
	const format = new Intl.DateTimeFormat("en-CA", { timeZone: host.clock.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "longOffset" });
	const part = Object.fromEntries(format.formatToParts(host.clock.now()).map((each) => [each.type, each.value]));
	const offset = part.timeZoneName === "GMT" ? "+00:00" : String(part.timeZoneName).slice(3);
	return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}:${part.second}${offset}`;
}

// Under the log's lock, taken by `lock` (decision-lock.ts): the log read and checked, `make`'s records appended, then every
// answer's ticket line missing written; one that cannot be written never stops the log: `unwritten` says so, the next write retries.
export function change<T extends Entry>(host: Host, project: Project, make: (entries: readonly Entry[], time: string) => readonly T[], lock = withLock): { readonly added: T[]; readonly unwritten?: string } {
	return lock(logLock(host, project), () => {
		const entries = readLog(project);
		const added = [...make(entries, stamp(host))];
		const file = join(project.path, FILE);
		if (added.length > 0) {
			mkdirSync(dirname(file), { recursive: true });
			const draft = join(dirname(file), `.decisions.jsonl.${process.pid}`);
			const text = existsSync(file) ? readFileSync(file, "utf8") : "";
			writeFileSync(draft, `${text}${text === "" || text.endsWith("\n") ? "" : "\n"}${added.map((each) => `${JSON.stringify(each)}\n`).join("")}`);
			renameSync(draft, file);
		}
		return { added, unwritten: repair(host, project, [...entries, ...added]) };
	});
}

// The Decisions line an answer writes into its question's ticket; one given by policy names its class, never the owner.
export function decisionLine(answer: Answer): string {
	const policy = policyOf(answer);
	if (policy !== undefined) return `- ${answer.time.slice(0, 10)}: ${answer.decided}; pre-approved by policy (${policy})`;
	const head = `- ${answer.time.slice(0, 10)}: ${answer.decided}; the owner: "`;
	const words = oneLine(answer.words);
	if (`${head}${words}" (${answer.id})`.length <= LINE) return `${head}${words}" (${answer.id})`;
	const tail = `…" (${answer.id}, cut: arthur decisions ${answer.id} prints it whole)`;
	let end = Math.max(0, LINE - head.length - tail.length);
	if (/[\uD800-\uDBFF]/.test(words[end - 1] ?? "")) end--;
	return `${head}${words.slice(0, end)}${tail}`;
}

// The lines under a ticket's Decisions that name decision `id`.
export const ticketLines = (text: string, id: string) => section(text, "Decisions").filter((line) => line.startsWith("- ") && new RegExp(`\\(${id}(\\)|, cut: )`).test(line));

// Each answer's ticket line that a crash left out, written in the log's order; a line a human edited is never rewritten. A
// line by policy names no question, so it is found by its whole text. Why one was not written, if so.
function repair(host: Host, project: Project, entries: readonly Entry[]): string | undefined {
	const paths = Object.fromEntries(host.board.list(project.name).map((each) => [each.id, join(project.path, each.path)]));
	const tickets: Record<string, string> = {};
	for (const { ask, state } of decisions(entries)) if (state === "answered" && ask.ticket !== undefined && paths[ask.ticket] !== undefined) tickets[ask.id] = ask.ticket;
	const notes: string[] = [];
	for (const ticket of new Set(Object.values(tickets))) {
		const file = paths[ticket] ?? "";
		if (!existsSync(file)) continue;
		try {
			const text = readFileSync(file, "utf8");
			const [seen, lines]: [Record<string, number>, string[]] = [{}, section(text, "Decisions")];
			const missing = entries.filter((each): each is Answer => {
				if (each.record !== "answer" || tickets[each.id] !== ticket) return false;
				const key = policyOf(each) === undefined ? each.id : decisionLine(each);
				seen[key] = (seen[key] ?? 0) + 1;
				return seen[key] > (key === each.id ? ticketLines(text, each.id).length : lines.filter((line) => line === key).length);
			});
			if (missing.length > 0) write(file, missing.reduce((said, each) => withDecision(said, decisionLine(each)), text));
		} catch (error) {
			notes.push(`a line under the Decisions of ${ticket} was not written (${(error as Error).message.split("\n")[0]}); the next arthur decision writes it`);
		}
	}
	return notes.length === 0 ? undefined : notes.join("; ");
}
