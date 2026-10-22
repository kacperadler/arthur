import { readFileSync } from "node:fs";
import type { Command, Host, Project } from "@arthur/core/plugin";
import { answer, ask, close, DECISION_ID, type Decision, decisionLine, decisions, KINDS, oneLine, readLog, ticketFile, ticketLines } from "./decision-log.ts";

// `arthur decision ask|answer|close`, the one writer of the decision log besides the plugin itself, refused inside a job, and
// `arthur decisions`, which lists, searches and prints it (spec/roadmap.md, entry 96): docs/commands/decision.md and decisions.md.

const USAGE = [
	"usage: arthur decision ask --kind <kind> --question <text> [--ticket <id>] [--job <id>] [--option <text>]... [--recommend <n or text>]",
	"       arthur decision answer <id> --decided <one line> [--picked <n>] <the owner's words>",
	"       arthur decision close <id> <reason>",
].join("\n");
const LIST = "usage: arthur decisions [<words>] [--open] [--kind <kind>] [--ticket <id>], or arthur decisions <id>";

type Read = { readonly flags: Readonly<Record<string, readonly string[]>>; readonly words: readonly string[] };

// `args` as the flags `takes` names, each with one value, those in `many` given any number of times, and `bare` without a
// value; the rest are words. Undefined for a flag not named, without its value, or given twice.
function parse(args: readonly string[], takes: readonly string[], many: readonly string[] = [], bare: readonly string[] = []): Read | undefined {
	const flags: Record<string, string[]> = {};
	const words: string[] = [];
	for (let at = 0; at < args.length; at++) {
		const arg = args[at] ?? "";
		if (!arg.startsWith("--")) words.push(arg);
		else if (bare.includes(arg) && flags[arg] === undefined) flags[arg] = [];
		else if (!takes.includes(arg) || at + 1 >= args.length || (flags[arg] !== undefined && !many.includes(arg))) return undefined;
		else flags[arg] = [...(flags[arg] ?? []), args[++at] ?? ""];
	}
	return { flags, words };
}

const firstLine = (error: unknown) => (error instanceof Error ? error.message : String(error)).split("\n")[0];

// A project by its name, the main one when undefined.
function projectNamed(host: Host, name: string | undefined): Project {
	const projects = host.board.projects();
	const found = name === undefined ? projects[0] : projects.find((each) => each.name === name);
	if (found === undefined) throw new Error(`unknown project ${name}; projects: ${projects.map((each) => each.name).join(", ")}`);
	return found;
}

// The project a decision id's prefix names.
function projectOf(host: Host, id: string): Project {
	const prefix = DECISION_ID.exec(id)?.[1];
	if (prefix === undefined) throw new Error(`${id} is no decision id: <prefix>-D<number>, as arthur decision ask printed it`);
	const projects = host.board.projects();
	const found = projects.find((each) => each.prefix === prefix);
	if (found === undefined) throw new Error(`${id}: no project has the prefix ${prefix}; prefixes: ${projects.map((each) => each.prefix).join(", ")}`);
	return found;
}

export function decisionCommands(host: Host): Command[] {
	const decision: Command = {
		name: "decision",
		doc: new URL("../docs/commands/decision.md", import.meta.url),
		run({ args, project }) {
			if (process.env.ARTHUR_JOB) {
				console.error("arthur decision: refused inside a job (ARTHUR_JOB is set): a job never records the owner's word; end your run with Blocked: user <question> instead");
				return 1;
			}
			const [verb = "", ...rest] = args;
			const read = verb === "ask" ? parse(rest, ["--kind", "--question", "--ticket", "--job", "--option", "--recommend"], ["--option"]) : parse(rest, verb === "answer" ? ["--decided", "--picked"] : []);
			if (read === undefined || !["ask", "answer", "close"].includes(verb) || (verb === "ask") !== (read.words.length === 0)) {
				console.error(USAGE);
				return 2;
			}
			const one = (flag: string) => read.flags[flag]?.[0];
			// The record is in the log; a ticket line it could not write is told, and exits 1.
			const done = (line: string, unwritten: string | undefined) => {
				console.log(line);
				if (unwritten !== undefined) console.error(`arthur decision ${verb}: ${unwritten}`);
				return unwritten === undefined ? 0 : 1;
			};
			try {
				if (verb === "ask") {
					const [recommend, ticket, job] = [one("--recommend"), one("--ticket")?.toUpperCase(), one("--job")];
					const given = { kind: one("--kind") ?? "", question: one("--question") ?? "", options: read.flags["--option"] ?? [] };
					const optional = { ...(recommend === undefined ? {} : { recommend: /^\d+$/.test(recommend) ? Number(recommend) : recommend }), ...(ticket === undefined ? {} : { ticket }), ...(job === undefined ? {} : { job }) };
					const asked = ask(host, projectNamed(host, project), { ...given, ...optional });
					return done(asked.id, asked.unwritten);
				}
				const id = (read.words[0] ?? "").toUpperCase();
				const where = projectOf(host, id);
				const words = read.words.slice(1).join(" ");
				if (verb === "answer") {
					const said = answer(host, where, id, { decided: one("--decided"), picked: one("--picked"), words });
					return done(`${id} answered: ${said.answer.decided}${said.ask.ticket === undefined ? "; a question of no ticket: the log only" : said.unwritten === undefined ? `; its line is under the Decisions of ${said.ask.ticket}` : ""}`, said.unwritten);
				}
				const reason = words.trim();
				if (reason === "") throw new Error(`no reason: arthur decision close ${id} <reason>`);
				const found = decisions(readLog(where)).find((each) => each.ask.id === id);
				if (found === undefined) throw new Error(`${id} is not in the decision log of project ${where.name}`);
				const closed = found.state === "open" ? close(host, where, (each) => each.id === id, reason) : undefined;
				if (closed === undefined || closed.ids.length === 0) throw new Error(`${id} is ${found.state === "open" ? "no longer open" : found.state}; a close ends an open question`);
				return done(`${id} closed: ${reason}`, closed.unwritten);
			} catch (error) {
				console.error(`arthur decision ${verb}: refused: ${firstLine(error)}`);
				return 1;
			}
		},
	};
	const list: Command = {
		name: "decisions",
		doc: new URL("../docs/commands/decisions.md", import.meta.url),
		run({ args, project }) {
			const read = parse(args, ["--kind", "--ticket"], [], ["--open"]);
			if (read === undefined) {
				console.error(LIST);
				return 2;
			}
			const [kind, ticket] = [read.flags["--kind"]?.[0], read.flags["--ticket"]?.[0]?.toUpperCase()];
			try {
				const id = read.words.length === 1 && Object.keys(read.flags).length === 0 ? (read.words[0] ?? "").toUpperCase() : "";
				if (DECISION_ID.test(id)) {
					const where = projectOf(host, id);
					const found = decisions(readLog(where)).find((each) => each.ask.id === id);
					if (found === undefined) throw new Error(`${id} is not in the decision log of project ${where.name}`);
					console.log(whole(host, where, found));
					return 0;
				}
				if (kind !== undefined && !KINDS.includes(kind)) throw new Error(`--kind ${kind}: one of ${KINDS.join(", ")}`);
				const where = projectNamed(host, project);
				const all = decisions(readLog(where));
				const wanted = read.words.map((word) => word.toLowerCase());
				const text = ({ ask, answers }: Decision) => [ask.question, ...ask.options, ...answers.flatMap((each) => [each.decided, each.words])].join("\n").toLowerCase();
				const shown = all.filter((each) => (read.flags["--open"] === undefined || each.state === "open") && (kind === undefined || each.ask.kind === kind) && (ticket === undefined || each.ask.ticket === ticket) && wanted.every((word) => text(each).includes(word)));
				console.log(all.length === 0 ? "no decisions yet" : shown.length === 0 ? "no decision matches" : shown.map((each) => line(host, where, each)).join("\n"));
				return 0;
			} catch (error) {
				console.error(`arthur decisions: ${firstLine(error)}`);
				return 1;
			}
		},
	};
	return [decision, list];
}

// One line of `arthur decisions`: the question, then where it stands.
function line(host: Host, project: Project, decision: Decision): string {
	const { ask, answers, closes, state } = decision;
	const [answered, closed] = [answers.at(-1), closes.at(-1)];
	const now = answered !== undefined ? `answered ${answered.time.slice(0, 10)}: ${answered.decided}` : closed !== undefined ? `closed ${closed.time.slice(0, 10)}: ${closed.reason}` : state;
	const { edited, missing } = ticketCheck(host, project, decision);
	const note = `${edited.length > 0 ? `; edited by hand under the Decisions of ${ask.ticket}` : ""}${missing ? `; its line under the Decisions of ${ask.ticket} is missing` : ""}`;
	return `${ask.id} ${ask.time.slice(0, 10)} ${ask.kind}${ask.ticket === undefined ? "" : ` ${ask.ticket}`}: ${oneLine(ask.question)} — ${now}${note}`;
}

// `arthur decisions <id>`: everything the log holds of one question.
function whole(host: Host, project: Project, decision: Decision): string {
	const { ask, answers, closes, state } = decision;
	const option = (n: number | undefined) => (n === undefined ? "" : `${n} (${ask.options[n - 1] ?? "no such option"})`);
	const lines = [`${ask.id}: ${ask.kind}, asked ${ask.time}${ask.ticket === undefined ? "" : `, ticket ${ask.ticket}`}${ask.job === undefined ? "" : `, job ${ask.job}`}`, `Question: ${ask.question}`];
	if (ask.options.length > 0) lines.push(`Options: ${ask.options.map((each, at) => `${at + 1}. ${each}`).join("; ")}`);
	if (ask.recommend !== undefined) lines.push(`Recommended: ${typeof ask.recommend === "number" ? option(ask.recommend) : ask.recommend}`);
	for (const each of answers) lines.push(`Answered ${each.time}: ${each.decided}${each.picked === undefined ? "" : `; picked ${option(each.picked)}`}; the owner: "${each.words}"`);
	for (const each of closes) lines.push(`Closed ${each.time}: ${each.reason}`);
	lines.push(`Now: ${state === "answered" && answers.length > 1 ? "answered, the later answer counts" : state}`);
	const { edited, missing } = ticketCheck(host, project, decision);
	for (const each of edited) lines.push(`Edited by hand under the Decisions of ${ask.ticket}, kept as it is: ${each}`);
	if (missing) lines.push(`Its line under the Decisions of ${ask.ticket} is missing; the next arthur decision writes it.`);
	return lines.join("\n");
}

// The question's lines under its ticket's Decisions that differ from what its answers write, and whether one is missing.
function ticketCheck(host: Host, project: Project, { ask, answers }: Decision): { readonly edited: readonly string[]; readonly missing: boolean } {
	const file = answers.length === 0 ? undefined : ticketFile(host, project, ask);
	if (file === undefined) return { edited: [], missing: false };
	const found = ticketLines(readFileSync(file, "utf8"), ask.id);
	const written = answers.map(decisionLine);
	return { edited: found.filter((each, at) => each !== written[at]), missing: found.length < written.length };
}
