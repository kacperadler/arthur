import { rmSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { type Entry, entryProblems, isId, isOneOff, lastSlot } from "./entry.ts";
import { changeEntries, owners, readEntries } from "./entry-file.ts";
import type { Registered } from "./register.ts";
import { lastClaimed } from "./run-state.ts";

// `arthur schedule [list]`, `add` and `remove` (spec/roadmap.md, entry 40): every entry with where it comes from and its next
// run; `add` and `remove` change the entries of the `file` option only: docs/commands/schedule.md.

export type Schedule = { readonly host: Host; readonly configured: readonly Entry[]; readonly registered: readonly Registered[]; readonly file: string | undefined; readonly root: string };

const USAGE =
	"usage: arthur schedule [list]; arthur schedule add <id> <at> [--days <day,...>] (--message <text> [--procedure <path>] | --task <text> [--kind <kind>] [--project <name>]); arthur schedule remove <id>";
const FLAGS: readonly string[] = ["days", "message", "procedure", "task", "kind"];

type Flags = { readonly words: readonly string[]; readonly values: Readonly<Record<string, string>> };

// Writes its output; a refusal throws, wrong usage is exit code 2. `project` is the core's `--project`, a job's project.
export function scheduleCommand(schedule: Schedule, args: readonly string[], project: string | undefined): number {
	const [verb = "list", ...rest] = args;
	const parsed = verb === "add" ? flags(rest) : undefined;
	const wrong =
		typeof parsed === "string"
			? parsed
			: !["list", "add", "remove"].includes(verb)
				? `unknown verb ${verb}`
				: verb === "list" && rest.length > 0
					? "list takes no arguments"
					: verb === "remove" && rest.length !== 1
						? "remove takes one id"
						: verb !== "add" && project !== undefined
							? "--project is for add only"
							: undefined;
	if (wrong !== undefined) {
		console.error(`arthur schedule: ${wrong}\n${USAGE}`);
		return 2;
	}
	if (verb === "list") console.log(list(schedule));
	else if (verb === "remove") remove(schedule, rest[0] as string);
	else add(schedule, parsed as Flags, project);
	return 0;
}

function flags(args: readonly string[]): Flags | string {
	const words: string[] = [];
	const values: Record<string, string> = {};
	for (let index = 0; index < args.length; index++) {
		const arg = args[index] as string;
		const name = arg.slice(2);
		if (!arg.startsWith("--")) words.push(arg);
		else if (!FLAGS.includes(name)) return `add takes no ${arg}`;
		else if (name in values) return `${arg} given twice`;
		else if (index + 1 === args.length) return `${arg} needs a value`;
		else values[name] = args[++index] as string;
	}
	return words.length === 2 ? { words, values } : "add takes an id and a time";
}

function list({ host, configured, registered, file, root }: Schedule): string {
	const { entries, problems } = readEntries(file, root, owners(configured, registered));
	const lines = [
		...configured.map((entry) => line(host, entry, "config")),
		...registered.map((entry) => line(host, entry, `plugin ${entry.plugin}, option ${entry.option}`)),
		...entries.map((entry) => line(host, entry, file as string)),
		...problems,
	];
	return lines.length > 0 ? lines.join("\n") : `no entries${file === undefined ? "" : `; arthur schedule add puts one in ${file}`}`;
}

// Two lines: the id, where it comes from, when it runs and its next run; then what it does.
function line(host: Host, entry: Entry, source: string): string {
	const local = (at: Date) => `${host.clock.local(at).date} ${host.clock.local(at).time}`;
	const once = isOneOff(entry);
	const when = once ? `once at ${entry.at.replace("T", " ")}` : `${entry.days?.join(", ") ?? "every day"} at ${entry.at}`;
	const next = !once
		? `next ${local(host.clock.next(entry.at, entry.days))}`
		: lastClaimed(host.folder, entry.id) !== undefined
			? "ran"
			: lastSlot(entry, host.clock.timeZone, host.clock.now()) !== undefined
				? "due: runs at the next sweep of arthur run"
				: `next ${entry.at.replace("T", " ")}`;
	const { action, job } = entry;
	const what =
		action !== undefined
			? `message: ${action.message}${action.procedure === undefined ? "" : ` (procedure ${action.procedure})`}`
			: `job (kind ${job?.kind ?? "worker"}${job?.project === undefined ? "" : `, project ${job.project}`}): ${job?.task}`;
	return `${entry.id} (${source}): ${when}, ${next}\n  ${what}`;
}

function add({ host, configured, registered, file, root }: Schedule, { words, values }: Flags, project: string | undefined): void {
	const [id, at] = words;
	const { days, message, procedure, task, kind } = values;
	if (file === undefined) throw new Error(`cannot add ${id}: schedule has no file option; set it in arthur.config.ts, such as file: "spec/schedule.json"`);
	const action = message !== undefined || procedure !== undefined ? { action: { message, procedure } } : {};
	const job = task !== undefined || kind !== undefined || project !== undefined ? { job: { task, kind, project } } : {};
	// As the file will hold it: a flag not given is no key.
	const entry = JSON.parse(JSON.stringify({ id, at, ...(days === undefined ? {} : { days: days.split(",") }), ...action, ...job }));
	const problems = entryProblems(entry, "");
	if (problems.length > 0) throw new Error(`cannot add ${id}: ${problems.map((each) => `${each.path}: ${each.problem}`).join("; ")}`);
	const owner = owners(configured, registered).get(id as string);
	if (owner !== undefined) throw new Error(`cannot add ${id}: its id is taken by ${owner}`);
	changeEntries(file, root, host.folder, (list) => {
		if (list.some((each) => (each as { readonly id?: unknown } | null)?.id === id)) throw new Error(`cannot add ${id}: its id is taken by an entry of ${file}`);
		return [...list, entry];
	});
	console.log(`added ${line(host, entry, file)}`);
}

function remove({ host, configured, registered, file, root }: Schedule, id: string): void {
	if (!isId(id)) throw new Error(`cannot remove ${JSON.stringify(id)}: expected the id of an entry; arthur schedule list shows them`);
	const made = registered.find((entry) => entry.id === id);
	if (made !== undefined) throw new Error(`cannot remove ${id}: plugin ${made.plugin} makes it from its option ${made.option}; change or turn off that option in arthur.config.ts`);
	const index = configured.findIndex((entry) => entry.id === id);
	if (index !== -1) throw new Error(`cannot remove ${id}: it is schedule.entries[${index}] in arthur.config.ts; remove it there`);
	const missing = new Error(`no entry ${id}${file === undefined ? "" : ` in ${file}`}; arthur schedule list shows every entry`);
	if (file === undefined) throw missing;
	changeEntries(file, root, host.folder, (list) => {
		const kept = list.filter((each) => (each as { readonly id?: unknown } | null)?.id !== id);
		if (kept.length === list.length) throw missing;
		return kept;
	});
	// Its run state goes too, so an entry added later under this id is a new one.
	rmSync(join(host.folder, id), { recursive: true, force: true });
	console.log(`removed ${id} from ${file}`);
}
