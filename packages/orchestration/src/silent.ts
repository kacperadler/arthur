import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { CLASS } from "./decision-classes.ts";
import type { Answer, Ask } from "./decision-log.ts";
import { type Session, sessionOf } from "./sessions.ts";
import { ASK, DAY_MS, endOf, FILE, type Grant, holds, meanwhile, silentState, turnOff, when } from "./silent-end.ts";

// The silent mode (spec/roadmap.md, entry 47, AR0127): `arthur silent` and `/silent`, its state in `<folder>/silent.json`
// (silent-end.ts, with its end), the reply it holds (inbox.ts, `held`), the notice it holds (`coordinator.silent`, which every
// channel asks) and its line in the coordinator's context; with `--recommend`, on the phone only (AR0664), the owner's grant
// (AR0583), which answers an ask by its recommendation (decision-log.ts): docs/commands/silent.md.

const USAGE = "usage: arthur silent [on '<the work; its stop condition>' [--until <HH:MM>] | off | ask]";
const GRANT = "       /silent on <the work> [--until <HH:MM>] [--usage <percent>] [--tickets <id>,...] --recommend, the owner's grant, on his phone only";
const BOUNDS = ["--until", "--usage", "--tickets"];

// The answer an ask gets from the grant in force, none or one: an ask with `--recommend`, but a class's proposal or a plan,
// budget (`--budget 0`) or merge question (`--unreviewed`, `--no-ci`, `arthur take-main`): the owner's own decision (AR-D603,
// decision-use.ts); before the mode's end and `until`, the usage `models.usage` reads under `usage` percent, of one of `tickets`.
export function byRecommendation(host: Host, ask: Ask): Answer[] {
	const state = silentState(host.folder);
	const grant = typeof state === "object" && host.clock.now().getTime() < endOf(state) ? state.grant : undefined;
	const decided = typeof ask.recommend === "number" ? ask.options[ask.recommend - 1] : ask.recommend;
	if (grant === undefined || decided === undefined || [CLASS, "plan", "budget", "merge"].includes(ask.kind)) return [];
	if (grant.until !== undefined && !(host.clock.now().getTime() < Date.parse(grant.until))) return [];
	if (grant.tickets !== undefined && !(ask.ticket !== undefined && grant.tickets.includes(ask.ticket))) return [];
	const [used] = grant.usage === undefined ? [] : host.collect<unknown>("models.usage");
	if (grant.usage !== undefined && !(typeof used === "number" && used < grant.usage)) return [];
	return [{ record: "answer", id: ask.id, time: ask.time, decided, words: `by recommendation: ${grant.id}` }];
}

// The grant that answered, for an answer given by recommendation; never one decision-use.ts or a class takes as the owner's.
export const recommendedBy = (answer: Answer | undefined) => /^by recommendation: (.+)$/.exec(answer?.words ?? "")?.[1];

// `on`'s words: the work, `--until`, and with `--recommend` the grant's bounds by flag; undefined for a flag without its value
// or given twice, or a bound but `--until` without `--recommend`.
function onArgs(args: readonly string[]): { readonly work: string; readonly until?: string; readonly bounds?: Readonly<Record<string, string>> } | undefined {
	const [words, flags]: [string[], Record<string, string>] = [[], {}];
	for (let at = 0; at < args.length; at++) {
		const arg = args[at] ?? "";
		if (arg !== "--recommend" && !BOUNDS.includes(arg)) words.push(arg);
		else if (arg in flags || (arg !== "--recommend" && at + 1 >= args.length)) return undefined;
		else flags[arg] = arg === "--recommend" ? "" : (args[++at] ?? "");
	}
	const { "--recommend": recommend, ...bounds } = flags;
	if (recommend === undefined && Object.keys(bounds).some((flag) => flag !== "--until")) return undefined;
	return { work: words.join(" ").trim(), until: bounds["--until"], ...(recommend === undefined ? {} : { bounds }) };
}

// `--until`, a time of day, as its next instant, when that `on` ends on its own (AR0739); a text is why it is refused.
const untilOf = (host: Host, until: string): Date | string => (/^([01]\d|2[0-3]):[0-5]\d$/.test(until) ? host.clock.next(until) : `--until ${until}: a time of day, HH:MM`);

// The grant's bounds as kept, or why they are refused: at least one; `--until`, the mode's own `end`; `--usage` a whole percent
// from 1 to 100, with a plugin that reads the usage (`models.usage`); `--tickets` ticket ids.
function grantOf(host: Host, bounds: Readonly<Record<string, string>>, end: Date | undefined): Omit<Grant, "id"> | string {
	const { "--usage": usage, "--tickets": tickets } = bounds;
	const ids = tickets?.split(",").map((id) => id.trim().toUpperCase());
	if (Object.keys(bounds).length === 0) return "--recommend needs a bound: --until <HH:MM>, --usage <percent> or --tickets <id>,...";
	if (usage !== undefined && !(/^\d+$/.test(usage) && Number(usage) >= 1 && Number(usage) <= 100)) return `--usage ${usage}: a whole percent from 1 to 100`;
	if (usage !== undefined && host.collect("models.usage").length === 0) return "--usage needs the models plugin, which reads the usage (models.usage)";
	if (ids !== undefined && !ids.every((id) => /^[A-Z]+\d+$/.test(id))) return `--tickets ${tickets}: ticket ids, comma-separated`;
	return { ...(end === undefined ? {} : { until: end.toISOString() }), ...(usage === undefined ? {} : { usage: Number(usage) }), ...(ids === undefined ? {} : { tickets: ids }) };
}

// The grant in words, for `on`'s answer and the context.
function granted(host: Host, grant: Grant): string {
	const bounds = [...(grant.until === undefined ? [] : [`until ${when(host, grant.until)}`]), ...(grant.usage === undefined ? [] : [`while usage is under ${grant.usage}%`]), ...(grant.tickets === undefined ? [] : [`for ${grant.tickets.join(", ")}`])];
	return `the owner's grant ${grant.id}: an arthur decision ask with --recommend is answered by its recommendation ${bounds.join(", ")}; never a plan question, a merge question, a budget question or a class's proposal`;
}

// Whether the reply written to `<session>/outbox/<name>`, of a turn holding no owner message, is held: silent is on, and `arthur
// silent ask` did not run in that session before it was written (the name starts with that time in ms); one ask, one reply (AR0713).
export function held(folder: string, session: string, name: string): boolean {
	if (silentState(folder) === undefined) return false;
	const asked = existsSync(join(session, ASK)) ? Number(readFileSync(join(session, ASK), "utf8")) : Number.NaN;
	if (!(Number(name.split("-")[0]) >= asked)) return true;
	rmSync(join(session, ASK), { force: true });
	return false;
}

export function silentMode(host: Host, sessions: readonly Session[]): void {
	const { folder } = host;
	// `end` and `grant` are an `on`'s: when it ends on its own, 24 hours on without `--until`, and the grant it gives.
	const answer = (verb: string, work: string, end?: Date, grant?: Omit<Grant, "id">): string | undefined => {
		const state = silentState(folder);
		if (verb === "") return answer(state === undefined ? "on" : "off", "");
		if (verb === "ask") {
			if (state !== undefined) writeFileSync(join(sessionOf(sessions)?.folder ?? folder, ASK), String(Date.now()));
			return state === undefined ? "silent: off" : "silent: on; the reply of this turn goes to the owner";
		}
		if (verb === "on") {
			// From off, each session's ask left behind goes; while on, since when and the event number stay, and the end is this `on`'s.
			// A grant is the one given, its event in the log for good; without one, the grant before goes.
			if (typeof state !== "object") for (const each of sessions) rmSync(join(each.folder, ASK), { force: true });
			const kept = typeof state === "object" ? state : { since: host.clock.now().toISOString(), seq: host.events.read(1).at(-1)?.seq ?? 0 };
			const until = (end ?? new Date(host.clock.now().getTime() + DAY_MS)).toISOString();
			const given = grant === undefined ? undefined : { id: `G${host.events.emit("silent-grant", { work, ...grant }).seq}`, ...grant };
			writeFileSync(join(folder, `${FILE}.new`), `${JSON.stringify({ since: kept.since, seq: kept.seq, work, until, ...(given === undefined ? {} : { grant: given }) })}\n`);
			renameSync(join(folder, `${FILE}.new`), join(folder, FILE));
			return `silent: on until ${when(host, until)}${given === undefined ? "" : `; ${granted(host, given)}`}`;
		}
		if (verb !== "off") return undefined;
		const was = turnOff(folder, sessions);
		if (was === undefined) return "silent: off";
		return `silent: off, ${was === "broken" ? `${join(folder, FILE)} did not parse, so what happened meanwhile is unknown` : meanwhile(host, was.seq)}`;
	};
	host.commands.register({
		name: "silent",
		doc: new URL("../docs/commands/silent.md", import.meta.url),
		run({ args }) {
			const [verb = "", ...rest] = args;
			const on = verb === "on" ? onArgs(rest) : undefined;
			// The coordinator's shell could give itself the grant; only the owner's own `/silent` gives it.
			if (on?.bounds !== undefined) {
				console.error("arthur silent: refused: --recommend is the owner's grant: he gives it on his phone, /silent on <the work> --until <HH:MM> --recommend");
				return 1;
			}
			const end = on?.until === undefined ? undefined : untilOf(host, on.until);
			if (typeof end === "string") {
				console.error(`arthur silent: refused: ${end}`);
				return 1;
			}
			const said = on !== undefined ? answer(verb, on.work, end) : verb !== "on" && rest.length === 0 ? answer(verb, "") : undefined;
			console[said === undefined ? "error" : "log"](said ?? `${USAGE}\n${GRANT}`);
			return said === undefined ? 2 : 0;
		},
		phone: {
			about: "Silent mode on or off: while on, only the end of delegated work, a decision and your answers reach you",
			reply: (text) => {
				const [, verb = "", work = ""] = /^(\S*)\s*([\s\S]*)$/.exec(text.trim()) ?? [];
				const on = verb === "on" ? onArgs(work.split(/\s+/).filter(Boolean)) : undefined;
				const end = on?.until === undefined ? undefined : untilOf(host, on.until);
				if (typeof end === "string") return `silent: refused: ${end}`;
				const grant = on?.bounds === undefined ? undefined : grantOf(host, on.bounds, end);
				if (typeof grant === "string") return `silent: refused: ${grant}`;
				// Without a flag the work is his text as he wrote it.
				const said = on !== undefined ? answer(verb, on.until === undefined && on.bounds === undefined ? work.trim() : on.work, end, grant) : work === "" ? answer(verb, "") : undefined;
				return said ?? `${USAGE}\n${GRANT}`.replace("arthur silent", "/silent");
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
	const grant = state.grant === undefined ? "" : `\nWhile it holds, ${granted(host, state.grant)}.`;
	return `On since ${when(host, state.since)}, for: ${state.work || "nothing named; the owner turned it on"}. It ends on its own at ${when(host, endOf(state))}, and Arthur tells the owner.${grant}`;
}
