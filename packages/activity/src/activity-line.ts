import type { Event } from "@arthur/core/plugin";

// One event as a line of the day file (spec/roadmap.md, entry 100): who acted, on whose message, what and its text, the
// text one line cut to `textChars` characters, `cut` its full length. docs/activity.md, "Lines".

export type Line = {
	readonly seq: number;
	readonly time: string;
	readonly actor: string;
	readonly on?: readonly number[];
	readonly plugin: string;
	readonly what: string;
	readonly project?: string;
	readonly ticket?: string;
	readonly job?: string;
	readonly kind?: string;
	readonly text: string;
	readonly cut?: number;
};
// What a job's own lines carry, from its `job-started`.
export type JobInfo = { readonly kind?: string; readonly ticket?: string };

type Data = Readonly<Record<string, unknown>>;
const list = (value: unknown, by = ", ") => (Array.isArray(value) ? value.join(by) : "");
const text = (data: Data) => (typeof data.text === "string" ? data.text : "");

// A part of an owner's message: a forward's words and every path left out.
function part(value: unknown): string {
	const { kind, text, seconds } = (typeof value === "object" && value !== null ? value : {}) as Data;
	const name = typeof kind === "string" ? kind : "part";
	if (kind !== "text") return typeof seconds === "number" ? `[${name} ${Math.round(seconds)} s]` : `[${name}]`;
	const said = typeof text === "string" ? text : "";
	const forward = /^\[forwarded from [^\]]*\] ?/.exec(said);
	return forward === null ? said : `[forwarded, ${[...said.slice(forward[0].length)].length} chars]`;
}

// The logged events, each with its text; any other event is not logged.
const TEXTS: Readonly<Record<string, (data: Data) => string>> = {
	"message-received": (data) => (Array.isArray(data.parts) ? data.parts.map(part).join(" ") : ""),
	"phone-command": text,
	"coordinator-replied": text,
	"coordinator-message": text,
	notice: text,
	"command-ran": (data) => `${list(data.args, " ")} (exit ${data.code})`,
	"job-started": (data) => `${data.kind} on ${list(data.tickets) || "no ticket"}, machine ${data.machine}`,
	"job-state": (data) => `${data.from} -> ${data.to}: ${data.reason}`,
	"job-ended": (data) => `${data.state}: ${data.reason}`,
	"stop-all": (data) => list(data.ids),
	"ticket-created": (data) => `${data.status}: ${data.title}`,
	"ticket-moved": (data) => `${data.from} -> ${data.to}`,
	"ticket-after": (data) => `after ${list(data.after) || "nothing"}`,
	"ci-finished": (data) => `${data.workflow} ${data.conclusion} on ${data.branch}: ${data.url}`,
	"pull-request-review": (data) => `${data.user} ${data.state} #${data.pull} of ${data.repo}: ${data.url}`,
	"cap-reached": (data) => `${data.cap}: ${data.spent} of ${data.limit}`,
	"machine-online": (data) => `${data.machine}: ${data.os} ${data.arch} ${data.version}`,
	"machine-offline": (data) => `${data.machine}: ${data.reason}`,
	"disk-low": (data) => `${data.machine} ${data.path}: ${data.free} free, floor ${data.floor}`,
	"uptime-down": (data) => `${data.url}: ${data.reason}`,
	"uptime-up": (data) => `${data.url}: up after ${data.downSeconds} s`,
	"schedule-fired": (data) => `${data.id}: ${data.does}${data.late === true ? ", late" : ""}`,
	"run-started": (data) => `pid ${data.pid}: ${list(data.plugins)}`,
};
export const LOGGED = Object.keys(TEXTS);

const named = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);

// The line of `event`, undefined for one not logged; `jobs` the jobs whose `job-started` was seen, by id.
export function line(event: Event, textChars: number, jobs: ReadonlyMap<string, JobInfo>): Line | undefined {
	const data = (typeof event.data === "object" && event.data !== null ? event.data : {}) as Data;
	const say = Object.hasOwn(TEXTS, event.name) ? TEXTS[event.name] : undefined;
	if (say === undefined || (event.name === "job-state" && data.to !== "blocked" && data.to !== "ended")) return undefined;
	const actor = event.by?.actor ?? `plugin:${event.plugin}`;
	const job = event.name.startsWith("job-") ? named(data.id) : actor.startsWith("job:") ? actor.slice(4) : undefined;
	const ticket = event.name.startsWith("ticket-") ? named(data.id) : (named(data.ticket) ?? (Array.isArray(data.tickets) ? named(data.tickets[0]) : undefined));
	const known = job === undefined ? undefined : jobs.get(job);
	const whole = [...say(data).replace(/\s+/g, " ").trim()];
	return {
		seq: event.seq,
		time: event.time,
		actor,
		...(event.by?.on === undefined ? {} : { on: event.by.on }),
		plugin: event.plugin,
		what: event.name === "command-ran" ? `command ${data.command}` : event.name,
		...(named(data.project) === undefined ? {} : { project: named(data.project) }),
		...((ticket ?? known?.ticket) === undefined ? {} : { ticket: ticket ?? known?.ticket }),
		...(job === undefined ? {} : { job }),
		...((named(data.kind) ?? known?.kind) === undefined ? {} : { kind: named(data.kind) ?? known?.kind }),
		text: whole.slice(0, textChars).join(""),
		...(whole.length > textChars ? { cut: whole.length } : {}),
	};
}
