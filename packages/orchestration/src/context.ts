import type { Host } from "@arthur/core/plugin";
import { decisionContext } from "./decision-context.ts";
import { silentContext } from "./silent.ts";

// The coordinator's context (spec/roadmap.md, entry 25): what `arthur coordinator context` prints, which the context extension
// (context-extension.ts) adds to the coordinator's system prompt before every turn. Its role, read as every role is; each
// project's vision; a warning per file missing; each project's board digest; the jobs that have not ended, by state (entry 27);
// the open questions of the decision log (entry 96); the local time and whether it is night; the silent mode while it is on
// (entry 47); and each plugin's answer to `collect("coordinator.context")`. A vision, a board or a plugin that fails costs its
// own lines: docs/commands/coordinator.md.

const firstLine = (error: unknown) => (error instanceof Error ? error.message : String(error)).split("\n")[0];
const ORDER = ["blocked", "working", "idle"];

// Jobs grouped by state, `blocked` first, then working and idle, then a state written by hand; each group in the list's order.
export function byState<T extends { readonly state: string }>(jobs: readonly T[]): Map<string, T[]> {
	const rank = (state: string) => (ORDER.includes(state) ? ORDER.indexOf(state) : ORDER.length);
	const groups = new Map<string, T[]>();
	for (const job of jobs.toSorted((a, b) => rank(a.state) - rank(b.state))) groups.set(job.state, [...(groups.get(job.state) ?? []), job]);
	return groups;
}

// `checkout`: the context in a copy of the main project's repository at `root` (an eval's fixture), at the instant `at`: its
// vision and board read there, its lines naming no project; no jobs, open decisions or silent mode, which are the live Arthur's.
export function coordinatorContext(host: Host, checkout?: { readonly root: string; readonly at: Date }): string {
	const { prompt, warnings } = host.jobs.prompt("coordinator");
	const parts = [prompt.trim()];
	// Without a project list the only project is the repository Arthur runs in, which has no board.
	const projects = checkout === undefined && host.collect("projects").length > 0 ? host.board.projects().map((project) => project.name) : [undefined];
	for (const name of projects) {
		try {
			const { project, path, text = "", problem } = host.jobs.vision(name, checkout?.root);
			if (problem !== undefined || text.trim() === "") warnings.push(`${checkout === undefined ? `project ${project}` : "the copy"} has no vision: ${path} is ${problem ?? "empty"}; the coordinator goes without it`);
			else parts.push(`## Vision${checkout === undefined ? ` of ${project}` : ""} (${path})\n\n${text.trim()}`);
		} catch (error) {
			warnings.push(`${checkout === undefined ? `project ${name}` : "the copy"}: its vision was not read: ${firstLine(error)}`);
		}
	}
	if (warnings.length > 0) parts.push(`## Warnings\n\n${warnings.map((warning) => `- ${warning}`).join("\n")}`);
	for (const name of projects) {
		let digest: string;
		try {
			digest = host.board.digest(name, checkout?.root);
		} catch (error) {
			digest = `the board was not read: ${firstLine(error)}`;
		}
		parts.push(`## Board${name === undefined ? "" : ` of ${name}`}\n\n${digest}`);
	}
	const jobs = byState(checkout === undefined ? host.jobs.list().filter((job) => job.state !== "ended") : []);
	if (jobs.size > 0) {
		const now = host.clock.now().getTime();
		const lines = [...jobs].flatMap(([state, each]) => [
			`${state || "no state"}:`,
			...each.map((job) => {
				const minutes = Math.max(0, Math.floor((now - Date.parse(job.since)) / 60_000));
				const since = Number.isNaN(minutes) ? "since an unknown time" : `for ${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
				const project = projects.length > 1 && job.project !== projects[0] ? `, project ${job.project}` : "";
				return `- ${job.id}${project}, ${since}${job.reason === "" ? "" : `: ${job.reason}`}`;
			}),
		]);
		parts.push(`## Jobs not ended\n\n${lines.join("\n")}`);
	}
	const open = checkout === undefined ? decisionContext(host) : "";
	if (open !== "") parts.push(`## Open decisions\n\n${open}`);
	const at = checkout?.at ?? host.clock.now();
	const { date, time, day } = host.clock.local(at);
	const night = host.clock.isQuiet(at) ? "night: within the owner's quiet hours" : "day: outside the owner's quiet hours";
	parts.push(`## Time\n\n${time} on ${day} ${date} (${host.clock.timeZone}), ${night}.`);
	const silent = checkout === undefined ? silentContext(host) : "";
	if (silent !== "") parts.push(`## Silent\n\n${silent}`);
	for (const answer of host.collectEach("coordinator.context")) {
		const said = "error" in answer ? `coordinator.context failed: ${firstLine(answer.error)}` : answer.value;
		if (said !== undefined && typeof said !== "string") parts.push(`## ${answer.plugin}\n\ncoordinator.context answered ${typeof said}, not text`);
		else if (said !== undefined && said.trim() !== "") parts.push(`## ${answer.plugin}\n\n${said.trim()}`);
	}
	return parts.join("\n\n");
}
