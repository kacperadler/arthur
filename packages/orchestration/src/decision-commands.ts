import { dirname } from "node:path";
import { insideJob } from "@arthur/core/inside-job";
import type { Command, Host, Project } from "@arthur/core/plugin";
import { classList, evidence, propose, revoke } from "./decision-class.ts";
import { described } from "./decision-classes.ts";
import { answer, ask, close, DECISION_ID, type Decision, decisions, KINDS, readLog } from "./decision-log.ts";
import { line, whole } from "./decision-views.ts";

// `arthur decision ask|answer|close|class`, the one writer of the decision log besides the plugin itself, refused inside a
// job, and `arthur decisions`, which lists, searches and prints it (spec/roadmap.md, entries 96 and 97):
// docs/commands/decision.md and decisions.md.

const USAGE = [
	"usage: arthur decision ask --kind <kind> --question <text> [--ticket <id>] [--job <id>] [--what --unreviewed|--no-ci]... [--option <text>]... [--recommend <n or text>]",
	"       arthur decision answer <id> --decided <one line> [--picked <n>] <the owner's words>",
	"       arthur decision close <id> <reason>",
	"       arthur decision class propose --kind <kind> --match <text> --decided <one line> --backed-by <id>...",
	"       arthur decision class revoke <id> <the owner's words>",
].join("\n");
const LIST = "usage: arthur decisions [<words>] [--open] [--kind <kind>] [--ticket <id>], arthur decisions <id>, or arthur decisions --classes";

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

// The project a decision id's prefix names; decision-use.ts reads it too.
export function projectOf(host: Host, id: string): Project {
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
			const job = insideJob(dirname(host.folder));
			if (job !== undefined) {
				console.error(`arthur decision: refused inside a job ${job}: a job never records the owner's word; end your run with Blocked: user <question> instead`);
				return 1;
			}
			const [verb = "", ...rest] = args;
			const sub = verb === "class" ? (rest[0] ?? "") : "";
			const read = verb === "ask" ? parse(rest, ["--kind", "--question", "--ticket", "--job", "--what", "--option", "--recommend"], ["--what", "--option"]) : sub === "propose" ? parse(rest.slice(1), ["--kind", "--match", "--decided", "--backed-by"], ["--backed-by"]) : parse(sub === "" ? rest : rest.slice(1), verb === "answer" ? ["--decided", "--picked"] : []);
			// `ask` takes no words, and `--what` only a merge flag with --kind merge (AR0533); `propose` only the ids after --backed-by, the others an id first.
			const words = read === undefined ? false : sub === "propose" ? read.words.length === 0 || read.flags["--backed-by"] !== undefined : (verb === "ask") === (read.words.length === 0) && (read.flags["--what"] ?? []).every((flag) => read.flags["--kind"]?.[0] === "merge" && ["--unreviewed", "--no-ci"].includes(flag));
			if (read === undefined || !words || !["ask", "answer", "close", "class"].includes(verb) || (verb === "class" && !["propose", "revoke"].includes(sub))) {
				console.error(USAGE);
				return 2;
			}
			const named = sub === "" ? verb : `class ${sub}`;
			const one = (flag: string) => read.flags[flag]?.[0];
			// The record is in the log; a ticket line it could not write is told, and exits 1.
			const done = (line: string, unwritten: string | undefined) => {
				console.log(line);
				if (unwritten !== undefined) console.error(`arthur decision ${named}: ${unwritten}`);
				return unwritten === undefined ? 0 : 1;
			};
			try {
				if (verb === "ask") {
					const [recommend, ticket, job, what] = [one("--recommend"), one("--ticket")?.toUpperCase(), one("--job"), read.flags["--what"]];
					const optional = { ...(recommend === undefined ? {} : { recommend: /^\d+$/.test(recommend) ? Number(recommend) : recommend }), ...(ticket === undefined ? {} : { ticket }), ...(job === undefined ? {} : { job }), ...(what === undefined ? {} : { what }) };
					const { id, policy, classes, unwritten } = ask(host, projectNamed(host, project), { kind: one("--kind") ?? "", question: one("--question") ?? "", options: read.flags["--option"] ?? [], ...optional });
					// `by policy: <class id>` or `by recommendation: <grant id>` (silent.ts).
					const by = policy === undefined ? "" : `\n${id} answered ${policy.words.replace(/^(by \w+): /, "$1 (")}): ${policy.decided}; act on it as on the owner's answer, and say so in your reply`;
					return done(`${id}${by}${classes.length > 1 ? `\n${id} goes to the owner: it matches classes ${classes.join(" and ")}` : ""}`, unwritten);
				}
				if (sub === "propose") {
					const backedBy = [...(read.flags["--backed-by"] ?? []), ...read.words].map((id) => id.toUpperCase());
					const proposed = propose(host, projectNamed(host, project), { kind: one("--kind") ?? "", match: one("--match") ?? "", decided: one("--decided") ?? "", backedBy });
					const { id } = proposed;
					return done(`${id}\n${described(proposed.class)}; ${evidence(proposed.class)}\nAsk the owner with ${id}; his answer: arthur decision answer ${id} --picked 1 (approve) or 2 (refuse) --decided '<one line>' '<his words>'`, proposed.unwritten);
				}
				const id = (read.words[0] ?? "").toUpperCase();
				const where = projectOf(host, id);
				const said = read.words.slice(1).join(" ");
				if (sub === "revoke") return done(`${id} revoked: its questions go to the owner again`, revoke(host, where, id, said).unwritten);
				if (verb === "answer") {
					const { answer: given, ask: asked, unwritten } = answer(host, where, id, { decided: one("--decided"), picked: one("--picked"), words: said });
					const note = asked.class !== undefined ? `; the class is ${given.picked === 1 ? "approved: its questions are answered by policy from now on" : "refused: its questions go to the owner"}` : asked.ticket === undefined ? "; a question of no ticket: the log only" : unwritten === undefined ? `; its line is under the Decisions of ${asked.ticket}` : "";
					return done(`${id} answered: ${given.decided}${note}`, unwritten);
				}
				const reason = said.trim();
				if (reason === "") throw new Error(`no reason: arthur decision close ${id} <reason>`);
				const found = decisions(readLog(where)).find((each) => each.ask.id === id);
				if (found === undefined) throw new Error(`${id} is not in the decision log of project ${where.name}`);
				const closed = found.state === "open" ? close(host, where, (each) => each.id === id, reason) : undefined;
				if (closed === undefined || closed.ids.length === 0) throw new Error(`${id} is ${found.state === "open" ? "no longer open" : found.state}; a close ends an open question`);
				return done(`${id} closed: ${reason}`, closed.unwritten);
			} catch (error) {
				console.error(`arthur decision ${named}: refused: ${firstLine(error)}`);
				return 1;
			}
		},
	};
	const list: Command = {
		name: "decisions",
		doc: new URL("../docs/commands/decisions.md", import.meta.url),
		inJob: true,
		run({ args, project }) {
			const read = parse(args, ["--kind", "--ticket"], [], ["--open", "--classes"]);
			if (read === undefined || (read.flags["--classes"] !== undefined && (read.words.length > 0 || Object.keys(read.flags).length > 1))) {
				console.error(LIST);
				return 2;
			}
			const [kind, ticket] = [read.flags["--kind"]?.[0], read.flags["--ticket"]?.[0]?.toUpperCase()];
			try {
				if (read.flags["--classes"] !== undefined) {
					console.log(classList(projectNamed(host, project)));
					return 0;
				}
				const id = read.words.length === 1 && Object.keys(read.flags).length === 0 ? (read.words[0] ?? "").toUpperCase() : "";
				if (DECISION_ID.test(id)) {
					const where = projectOf(host, id);
					const entries = readLog(where);
					const found = decisions(entries).find((each) => each.ask.id === id);
					if (found === undefined) throw new Error(`${id} is not in the decision log of project ${where.name}`);
					console.log(whole(host, where, found, entries));
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
