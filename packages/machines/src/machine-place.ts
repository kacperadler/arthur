import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe } from "@arthur/core";
import type { Host } from "@arthur/core/plugin";
import type { Report } from "./machine-check.ts";
import type { Labels } from "./machine-options.ts";

// Placing a job by labels (spec/roadmap.md, entry 31): the machines plugin's answer to the core's `jobs.place`, for a spawn
// that names no machine and for one that does. docs/commands/machines.md, "Placing a job".

// A machine as placement sees it: `local` first, then the list in config order.
export type Seat = { readonly name: string; readonly labels: Labels; readonly maxJobs?: number };
// What the core asks with (packages/core/src/jobs.ts): the spawn, the machine it names, and the labels of `--requires`.
type Asked = { readonly project: string; readonly tickets: readonly string[]; readonly machine?: string; readonly requires?: unknown };
// The labels a job needs, and where they come from.
type Need = { readonly labels: Labels; readonly from: string };

const NONE: Need = { labels: {}, from: "" };
// A ticket's folder in a `Ticket:` path, and its id.
const FEATURE = /^(.*?spec\/features\/([A-Z]+\d{4,})-[^/]*\/)/;

// `os macos, arch arm64, tools xcodebuild docker`, as `arthur machines` shows labels.
export function labelsText(labels: Labels): string {
	return Object.entries(labels).map(([key, value]) => `${key} ${Array.isArray(value) ? value.join(" ") : value}`).join(", ") || "none";
}

// `value` as labels, refused naming `where` when it is not `{ os?, arch?, tools? }`; `{}` needs none.
function labelsOf(value: unknown, where: string): Labels {
	const record = (value ?? {}) as Readonly<Record<string, unknown>>;
	const text = (item: unknown) => typeof item === "string" && item.trim() !== "";
	const keys = Object.keys(record).every((key) => key === "os" || key === "arch" || key === "tools");
	const values = [record.os, record.arch].every((item) => item === undefined || text(item)) && (record.tools === undefined || (Array.isArray(record.tools) && record.tools.every(text)));
	if (typeof value !== "object" || value === null || Array.isArray(value) || !keys || !values)
		throw new Error(`${where}: requires must be { os?, arch?, tools? }, os and arch non-empty strings, tools a list of them; got ${describe(value)}`);
	return record as Labels;
}

// `--requires`, else the `requires` of the JSON block of the first ticket the task names, else its project's, else none. A
// ticket and a project are read from the list the projects plugin provides; without it, neither requires anything.
function need(host: Host, asked: Asked): Need {
	if (asked.requires !== undefined) return { labels: labelsOf(asked.requires, "--requires"), from: "--requires" };
	const [list] = host.collect<readonly { readonly name?: unknown; readonly path?: unknown; readonly requires?: unknown }[]>("projects");
	const project = Array.isArray(list) ? list.find((each) => each?.name === asked.project) : undefined;
	if (project === undefined || typeof project.path !== "string") return NONE;
	const [, folder, id] = asked.tickets.map((path) => FEATURE.exec(path)).find((match) => match !== null) ?? [];
	const file = folder === undefined ? "" : join(project.path, folder, "ticket.md");
	const block = file !== "" && existsSync(file) ? /^```json\n([\s\S]*?)^```$/m.exec(readFileSync(file, "utf8"))?.[1] : undefined;
	if (block !== undefined) {
		let json: unknown;
		try {
			json = JSON.parse(block);
		} catch (error) {
			throw new Error(`${file}: its JSON block is not JSON (${(error as Error).message}); fix it by hand`);
		}
		if (typeof json === "object" && json !== null && "requires" in json) return { labels: labelsOf(json.requires, `ticket ${id} (${file})`), from: `ticket ${id}` };
	}
	return project.requires === undefined ? NONE : { labels: labelsOf(project.requires, `project ${asked.project}`), from: `project ${asked.project}` };
}

// The labels `seat` lacks of `labels`, as text; empty when it has each: the same os and arch, every tool listed.
function lacks(seat: Seat, labels: Labels): string {
	const tools = (labels.tools ?? []).filter((tool) => !(seat.labels.tools ?? []).includes(tool));
	const os = labels.os !== undefined && labels.os !== seat.labels.os ? labels.os : undefined;
	const arch = labels.arch !== undefined && labels.arch !== seat.labels.arch ? labels.arch : undefined;
	const missing = { ...(os === undefined ? {} : { os }), ...(arch === undefined ? {} : { arch }), ...(tools.length === 0 ? {} : { tools }) };
	return Object.keys(missing).length === 0 ? "" : labelsText(missing);
}

// `jobs.place`: the named machine once it has the labels (an unknown one is the core's to refuse); else, among the online
// machines with the labels and under their `maxJobs`, the one with the most room, `local` and then the list's order on a tie.
// `check` answers each listed machine's state; `local` is always online. A refusal names the labels and every machine.
export function placement(host: Host, seats: readonly Seat[], check: () => Promise<ReadonlyMap<string, Report>>) {
	return async (asked: Asked): Promise<string> => {
		const { labels, from } = need(host, asked);
		const running = new Set(host.jobs.running());
		const counts = new Map<string, number>();
		for (const job of host.jobs.list()) if (running.has(job.id)) counts.set(job.machine, (counts.get(job.machine) ?? 0) + 1);
		const jobs = (seat: Seat) => counts.get(seat.name) ?? 0;
		const full = (seat: Seat) => seat.maxJobs !== undefined && jobs(seat) >= seat.maxJobs;
		const refuse = (why: string, reports: ReadonlyMap<string, Report>) => {
			const state = (seat: Seat, report = reports.get(seat.name)) =>
				report?.online === false ? `offline: ${report.reason}` : `online, ${full(seat) ? "full: " : ""}${jobs(seat)}${seat.maxJobs === undefined ? "" : ` of ${seat.maxJobs}`} jobs`;
			const needs = Object.keys(labels).length === 0 ? "the job needs no label" : `the job needs ${labelsText(labels)} (${from})`;
			return new Error(`${why}; ${needs}; machines: ${seats.map((seat) => `${seat.name} (${labelsText(seat.labels)}): ${state(seat)}`).join("; ")}`);
		};
		if (asked.machine !== undefined) {
			const seat = seats.find((each) => each.name === asked.machine);
			if (seat === undefined || lacks(seat, labels) === "") return asked.machine;
			throw refuse(`machine ${seat.name} lacks ${lacks(seat, labels)}`, await check());
		}
		const fitting = seats.filter((seat) => lacks(seat, labels) === "");
		if (fitting.length === 0) throw refuse("no machine has the labels", await check());
		const reports = fitting.some((seat) => seat.name !== "local") ? await check() : undefined;
		const open = fitting.filter((seat) => (seat.name === "local" || reports?.get(seat.name)?.online === true) && !full(seat));
		if (open.length === 0) throw refuse("every machine with the labels is offline or full", reports ?? (await check()));
		// The room of each, from the resources plugin when it provides `resources.free` (the jobs a machine has room for), else
		// its jobs, fewer being more room.
		const room = await Promise.all(open.map(async (seat) => {
			const free = host.collect<number | Promise<number>>("resources.free", seat.name);
			if (free.length > 1) throw new Error(`call("resources.free"): provided by ${free.length} plugins; call needs exactly one`);
			return free.length === 0 ? -jobs(seat) : Number(await free[0]);
		}));
		const best = room.reduce<number>((at, value, index) => (value > (room[at] ?? 0) ? index : at), 0);
		return open[best]?.name ?? "local";
	};
}
