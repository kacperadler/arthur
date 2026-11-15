import { parseArgs } from "node:util";
import type { Command, Host } from "@arthur/core/plugin";
import type { Line } from "./activity-line.ts";
import { readLines } from "./day-files.ts";

// `arthur log` and `/log` (spec/roadmap.md, entry 101): one day of the activity log, one line each, narrowed by the filters,
// the commands that only read hidden. docs/commands/log.md.

const USAGE = "usage: arthur log [--day YYYY-MM-DD|today|yesterday] [--user <u>] [--actor <a>] [--ticket <id>] [--job <id>] [--project <name>] [--all]";
const PHONE_USAGE = "usage: /log [today|yesterday|<date>] [<ticket id>] [job <id>]";
const PHONE_LINES = 30;
const TICKET = /^[A-Z]+\d{4,}$/;
// By name, or name and first word: what only reads, hidden unless `--all` so the actions stand out (`coordinator context` runs every turn).
const READ_ONLY = new Set(["board", "config check", "coordinator context", "decisions", "doctor", "findings", "health", "help", "jobs", "log", "plan", "projects", "resources", "retro-due", "review-needed", "roles", "stats", "task", "usage", "version"]);

type Filter = { readonly date: string; readonly user?: string; readonly actor?: string; readonly ticket?: string; readonly job?: string; readonly project?: string; readonly all?: boolean };

// `today`, `yesterday` or a real `YYYY-MM-DD`, in `core.timeZone`; undefined for any other word.
function day(word: string, clock: Host["clock"]): string | undefined {
	const today = clock.local().date;
	if (word === "today") return today;
	if (word === "yesterday") return new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
	const at = new Date(`${word}T00:00:00Z`);
	return /^\d{4}-\d{2}-\d{2}$/.test(word) && !Number.isNaN(at.getTime()) && at.toISOString().startsWith(word) ? word : undefined;
}

// `actor` is `who` or one of its own: `user:telegram` takes in `user:telegram/<instance>`, `job` every `job:<id>`.
const by = (actor: string, who: string) => actor === who || actor.startsWith(`${who}/`) || actor.startsWith(`${who}:`);

// A command that ran, or a channel's `/name`, that only reads.
function readOnly(line: Line): boolean {
	const words = line.text.split(" ");
	const [name, sub] = line.what.startsWith("command ") ? [line.what.slice(8), words[0]] : line.what === "phone-command" && words[0]?.startsWith("/") ? [words[0].slice(1), words[1]] : [];
	return name !== undefined && (READ_ONLY.has(name) || READ_ONLY.has(`${name} ${sub}`));
}

// The lines of `filter.date` every filter keeps, in order. `user`'s word: his own lines, every line `on` one of his messages, and
// every line of a job whose `job-started` was, on any day kept up to that date.
function kept(folder: string, filter: Filter): Line[] {
	const { date, actor, ticket, job, project, all } = filter;
	const user = filter.user === undefined ? undefined : `user:${filter.user.replace(/^user:/, "")}`;
	const [his, jobs] = [new Set<number>(), new Set<string>()];
	const word = (line: Line) => user === undefined || by(line.actor, user) || (Array.isArray(line.on) && line.on.some((seq) => his.has(seq))) || (line.job !== undefined && jobs.has(line.job));
	if (user !== undefined)
		for (const line of readLines(folder, undefined, date)) {
			if (by(line.actor, user)) his.add(line.seq);
			else if (line.what === "job-started" && line.job !== undefined && word(line)) jobs.add(line.job);
		}
	return readLines(folder, date, date).filter(
		(line) =>
			(all === true || !readOnly(line)) &&
			word(line) &&
			(actor === undefined || by(line.actor, actor)) &&
			(ticket === undefined || line.ticket === ticket) &&
			(job === undefined || line.job === job || (typeof line.job === "string" && line.job.endsWith(`-${job}`))) &&
			(project === undefined || line.project === project),
	);
}

const shown = (clock: Host["clock"], line: Line) =>
	`${clock.local(new Date(line.time)).time}  ${line.actor}  ${line.what}  ${line.text}${typeof line.cut === "number" ? `… (${line.cut} chars, event ${line.seq})` : ""}`.trimEnd();
const none = (date: string) => `no activity to show on ${date}`;

export function logCommand(host: Host): Command {
	return {
		name: "log",
		doc: new URL("../docs/commands/log.md", import.meta.url),
		phone: {
			about: "the activity log, the last 30 lines of today by default: /log yesterday, /log AR0012, /log job <id>",
			reply(text) {
				const words = text.split(/\s+/).filter((each) => each !== "");
				const at = words.indexOf("job");
				const job = at < 0 ? undefined : words[at + 1];
				const rest = at < 0 ? words : words.toSpliced(at, 2);
				const ticket = rest.find((each) => TICKET.test(each));
				const others = rest.filter((each) => each !== ticket);
				const date = day(others[0] ?? "today", host.clock);
				if ((at >= 0 && job === undefined) || others.length > 1 || date === undefined) return PHONE_USAGE;
				const lines = kept(host.folder, { date, ticket, job });
				if (lines.length === 0) return none(date);
				const head = lines.length > PHONE_LINES ? [`the last ${PHONE_LINES} of ${lines.length} lines on ${date}; arthur log shows them all`] : [];
				return [...head, ...lines.slice(-PHONE_LINES).map((line) => shown(host.clock, line))].join("\n");
			},
		},
		run({ args, project }) {
			let values: Omit<Filter, "date" | "project"> & { readonly day?: string };
			try {
				const string = { type: "string" } as const;
				({ values } = parseArgs({ args: [...args], options: { day: string, user: string, actor: string, ticket: string, job: string, all: { type: "boolean" } } }));
			} catch {
				return (console.error(USAGE), 2);
			}
			const date = day(values.day ?? "today", host.clock);
			if (date === undefined) return (console.error(USAGE), 2);
			const lines = kept(host.folder, { ...values, date, project });
			console.log(lines.length === 0 ? none(date) : lines.map((line) => shown(host.clock, line)).join("\n"));
		},
	};
}
