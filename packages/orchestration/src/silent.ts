import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { CLASS } from "./decision-classes.ts";
import type { Answer, Ask } from "./decision-log.ts";

// The silent mode (spec/roadmap.md, entry 47, AR0127): `arthur silent` and `/silent`, its state in `<folder>/silent.json`, the
// reply it holds (inbox.ts, `held`), the notice it holds (`coordinator.silent`, which every channel asks) and its line in the
// coordinator's context; with `--recommend`, the owner's grant (AR0583), which answers an ask by its recommendation
// (decision-log.ts): docs/commands/silent.md.

// A grant's id, `G<the number of the event that recorded it>`, and its bounds, every one given holding.
type Grant = { readonly id: string; readonly until?: string; readonly usage?: number; readonly tickets?: readonly string[] };
type State = { readonly since: string; readonly seq: number; readonly work: string; readonly grant?: Grant } | "broken" | undefined;

const [FILE, ASK] = ["silent.json", "silent-ask"];
const USAGE = "usage: arthur silent [on '<the work; its stop condition>' | off | ask]";
const GRANT = "       arthur silent on '<the work>' [--until <HH:MM>] [--usage <percent>] [--tickets <id>,...] --recommend";
const BOUNDS = ["--until", "--usage", "--tickets"];

// No file is off; a file that does not parse, or holds something else (a grant without its id, a bound of another type), counts as on.
function silentState(folder: string): State {
	let text: string;
	try {
		text = readFileSync(join(folder, FILE), "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
	try {
		const state = JSON.parse(text) as Exclude<State, string>;
		const grant = state?.grant;
		const kept = grant === undefined || (typeof grant?.id === "string" && Array.isArray(grant.tickets ?? []) && [grant.until ?? "", ...(grant.tickets ?? [])].every((each) => typeof each === "string") && !Number.isNaN(Date.parse(grant.until ?? "0")) && ["undefined", "number"].includes(typeof grant.usage));
		if (typeof state?.since === "string" && Number.isSafeInteger(state.seq) && typeof state.work === "string" && kept) return state;
	} catch {}
	return "broken";
}

// The answer an ask gets from the grant in force, none or one: an ask with `--recommend`, but a class's proposal, a budget
// question (the kind `--budget 0` takes) or a merge question (`--unreviewed`, `--no-ci`, `arthur take-main`: the owner's own
// decision, decision-use.ts); before `until`, the usage `models.usage` reads under `usage` percent, of one of `tickets`.
export function byRecommendation(host: Host, ask: Ask): Answer[] {
	const state = silentState(host.folder);
	const grant = typeof state === "object" ? state.grant : undefined;
	const decided = typeof ask.recommend === "number" ? ask.options[ask.recommend - 1] : ask.recommend;
	if (grant === undefined || decided === undefined || [CLASS, "budget", "merge"].includes(ask.kind)) return [];
	if (grant.until !== undefined && !(host.clock.now().getTime() < Date.parse(grant.until))) return [];
	if (grant.tickets !== undefined && !(ask.ticket !== undefined && grant.tickets.includes(ask.ticket))) return [];
	const [used] = grant.usage === undefined ? [] : host.collect<unknown>("models.usage");
	if (grant.usage !== undefined && !(typeof used === "number" && used < grant.usage)) return [];
	return [{ record: "answer", id: ask.id, time: ask.time, decided, words: `by recommendation: ${grant.id}` }];
}

// The grant that answered, for an answer given by recommendation; never one decision-use.ts or a class takes as the owner's.
export const recommendedBy = (answer: Answer | undefined) => /^by recommendation: (.+)$/.exec(answer?.words ?? "")?.[1];

// `on`'s words: the work, and with `--recommend` the grant's bounds by flag; undefined for a flag without its value or given
// twice, or a bound without `--recommend`.
function onArgs(args: readonly string[]): { readonly work: string; readonly bounds?: Readonly<Record<string, string>> } | undefined {
	const [words, flags]: [string[], Record<string, string>] = [[], {}];
	for (let at = 0; at < args.length; at++) {
		const arg = args[at] ?? "";
		if (arg !== "--recommend" && !BOUNDS.includes(arg)) words.push(arg);
		else if (arg in flags || (arg !== "--recommend" && at + 1 >= args.length)) return undefined;
		else flags[arg] = arg === "--recommend" ? "" : (args[++at] ?? "");
	}
	const { "--recommend": recommend, ...bounds } = flags;
	if (recommend === undefined && Object.keys(bounds).length > 0) return undefined;
	return { work: words.join(" ").trim(), ...(recommend === undefined ? {} : { bounds }) };
}

// The grant's bounds as kept, or why they are refused: at least one; `--until` a time of day, kept as its next instant;
// `--usage` a whole percent from 1 to 100, with a plugin that reads the usage (`models.usage`); `--tickets` ticket ids.
function grantOf(host: Host, bounds: Readonly<Record<string, string>>): Omit<Grant, "id"> | string {
	const { "--until": until, "--usage": usage, "--tickets": tickets } = bounds;
	const ids = tickets?.split(",").map((id) => id.trim().toUpperCase());
	if (Object.keys(bounds).length === 0) return "--recommend needs a bound: --until <HH:MM>, --usage <percent> or --tickets <id>,...";
	if (until !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(until)) return `--until ${until}: a time of day, HH:MM`;
	if (usage !== undefined && !(/^\d+$/.test(usage) && Number(usage) >= 1 && Number(usage) <= 100)) return `--usage ${usage}: a whole percent from 1 to 100`;
	if (usage !== undefined && host.collect("models.usage").length === 0) return "--usage needs the models plugin, which reads the usage (models.usage)";
	if (ids !== undefined && !ids.every((id) => /^[A-Z]+\d+$/.test(id))) return `--tickets ${tickets}: ticket ids, comma-separated`;
	return { ...(until === undefined ? {} : { until: host.clock.next(until).toISOString() }), ...(usage === undefined ? {} : { usage: Number(usage) }), ...(ids === undefined ? {} : { tickets: ids }) };
}

// The grant in words, for `on`'s answer and the context.
function granted(host: Host, grant: Grant): string {
	const at = grant.until === undefined ? undefined : host.clock.local(new Date(grant.until));
	const bounds = [...(at === undefined ? [] : [`until ${at.time} on ${at.day} ${at.date}`]), ...(grant.usage === undefined ? [] : [`while usage is under ${grant.usage}%`]), ...(grant.tickets === undefined ? [] : [`for ${grant.tickets.join(", ")}`])];
	return `the owner's grant ${grant.id}: an arthur decision ask with --recommend is answered by its recommendation ${bounds.join(", ")}; never a merge question, a budget question or a class's proposal`;
}

// Whether the reply written to `outbox/<name>`, of a turn holding no owner message, is held: silent is on, and `arthur silent
// ask` did not run before the reply was written (the name starts with that time in ms); one ask lets one reply through.
export function held(folder: string, name: string): boolean {
	if (silentState(folder) === undefined) return false;
	const asked = existsSync(join(folder, ASK)) ? Number(readFileSync(join(folder, ASK), "utf8")) : Number.NaN;
	if (!(Number(name.split("-")[0]) >= asked)) return true;
	rmSync(join(folder, ASK), { force: true });
	return false;
}

// The notice of a job blocked on the owner (blocked-notice.ts) carries `blocked`; while silent is on, every other is held.
const holds = (notice: unknown) => typeof (notice as { blocked?: unknown } | undefined)?.blocked !== "string";

export function silentMode(host: Host): void {
	const { folder } = host;
	const answer = (verb: string, work: string, grant?: Omit<Grant, "id">): string | undefined => {
		const state = silentState(folder);
		if (verb === "") return answer(state === undefined ? "on" : "off", "");
		if (verb === "ask") {
			if (state === undefined) return "silent: off";
			writeFileSync(join(folder, ASK), String(Date.now()));
			return "silent: on; the reply of this turn goes to the owner";
		}
		if (verb === "on") {
			// From off, an ask left behind goes; while on, since when and the event number stay. A grant is the one given, its
			// event in the log for good; without one, the grant before goes.
			if (typeof state !== "object") rmSync(join(folder, ASK), { force: true });
			const kept = typeof state === "object" ? state : { since: host.clock.now().toISOString(), seq: host.events.read(1).at(-1)?.seq ?? 0 };
			const given = grant === undefined ? undefined : { id: `G${host.events.emit("silent-grant", { work, ...grant }).seq}`, ...grant };
			writeFileSync(join(folder, `${FILE}.new`), `${JSON.stringify({ since: kept.since, seq: kept.seq, work, ...(given === undefined ? {} : { grant: given }) })}\n`);
			renameSync(join(folder, `${FILE}.new`), join(folder, FILE));
			return given === undefined ? "silent: on" : `silent: on; ${granted(host, given)}`;
		}
		if (verb !== "off") return undefined;
		if (state === undefined) return "silent: off";
		rmSync(join(folder, FILE), { force: true });
		rmSync(join(folder, ASK), { force: true });
		return `silent: off, ${state === "broken" ? `${join(folder, FILE)} did not parse, so what happened meanwhile is unknown` : meanwhile(host, state.seq)}`;
	};
	host.commands.register({
		name: "silent",
		doc: new URL("../docs/commands/silent.md", import.meta.url),
		run({ args }) {
			const [verb = "", ...rest] = args;
			const on = verb === "on" ? onArgs(rest) : undefined;
			const grant = on?.bounds === undefined ? undefined : grantOf(host, on.bounds);
			if (typeof grant === "string") {
				console.error(`arthur silent: refused: ${grant}`);
				return 1;
			}
			const said = on !== undefined ? answer(verb, on.work, grant) : verb !== "on" && rest.length === 0 ? answer(verb, "") : undefined;
			console[said === undefined ? "error" : "log"](said ?? `${USAGE}\n${GRANT}`);
			return said === undefined ? 2 : 0;
		},
		phone: {
			about: "Silent mode on or off: while on, only the end of delegated work, a decision and your answers reach you",
			reply: (text) => {
				const [, verb = "", work = ""] = /^(\S*)\s*([\s\S]*)$/.exec(text.trim()) ?? [];
				return (verb === "on" || work === "" ? answer(verb, work.trim()) : undefined) ?? USAGE.replace("arthur silent", "/silent");
			},
		},
	});
	host.provide("coordinator.silent", (notice: unknown) => silentState(folder) !== undefined && holds(notice));
}

// The context's `## Silent` section, empty while off.
export function silentContext(host: Host): string {
	const state = silentState(host.folder);
	if (state === undefined) return "";
	if (state === "broken") return `On: ${join(host.folder, FILE)} does not parse, so it counts as on; \`arthur silent off\` removes it.`;
	const { date, time, day } = host.clock.local(new Date(state.since));
	const grant = state.grant === undefined ? "" : `\nWhile it holds, ${granted(host, state.grant)}.`;
	return `On since ${time} on ${day} ${date}, for: ${state.work || "nothing named; the owner turned it on"}.${grant}`;
}

// What happened since event `seq`, built without the model: the jobs that ended, by state; the tickets merged; the notices held.
function meanwhile(host: Host, seq: number): string {
	const ended = new Map<string, string[]>();
	const [merged, notices] = [[] as string[], [] as string[]];
	for (const { name, data } of host.events.read(seq + 1)) {
		const each = (data ?? {}) as Readonly<Record<string, unknown>>;
		if (name === "job-ended") {
			const state = each.state === "blocked" ? "blocked" : String(each.reason ?? each.state).split(":")[0] || "ended";
			ended.set(state, [...(ended.get(state) ?? []), String(each.id)]);
		}
		if (name === "ticket-moved" && each.to === "merged") merged.push(String(each.id));
		if (name === "notice" && typeof each.text === "string" && holds(data)) notices.push(`- ${each.text}`);
	}
	const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
	const parts = [
		...(ended.size === 0 ? [] : [`${count([...ended.values()].flat().length, "job")} ended: ${[...ended].map(([state, ids]) => `${ids.length} ${state} (${ids.join(", ")})`).join(", ")}`]),
		...(merged.length === 0 ? [] : [`${count(merged.length, "ticket")} merged: ${merged.join(", ")}`]),
		...(notices.length === 0 ? [] : [`${count(notices.length, "notice")} held:\n${notices.join("\n")}`]),
	];
	return parts.length === 0 ? "nothing happened meanwhile" : `meanwhile: ${parts.join("; ")}`;
}
