import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, type StatsFs, statfsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize } from "node:path";
import { configRefusal } from "@arthur/core/git-config";
import type { Host, JobRecord, Project, Ticket } from "@arthur/core/plugin";
import { AUDITS } from "./audit.ts";
import { newest, type Reports } from "./report-file.ts";
import { RETROS } from "./retro-due.ts";

// Manage's own answer to `health` (spec/roadmap.md, entry 60): a line for each thing that should have happened by now and has
// not, read only, nothing fixed. Each check costs its own line when it throws. docs/manage.md, "The checks".

// How long a ticket may stand without a job, main hold commits not pushed, or the board hold changes not committed.
export const HOUR_MS = 3_600_000;
// The share of a filesystem's space or inodes left free under which it is full.
const LOW = 0.1;
// The statuses a job should be working on.
const OPEN = ["in-progress", "review"];
// What the board is in a project's checkout (the core's board.ts).
const BOARD = ["spec/build.json", "spec/features"];
// Where `arthur ticket file` files each kind's report (report-file.ts).
const FILED: Readonly<Record<string, Reports>> = { audit: AUDITS, retro: RETROS };

export type Space = Pick<StatsFs, "blocks" | "bavail" | "bsize" | "files" | "ffree">;

const hours = (ms: number) => `${Math.floor(ms / HOUR_MS)} h`;
const free = (share: number) => `${Math.floor(share * 100)}%`;

// Git's output, or undefined when it exits with an error; Git missing throws. No hook or fsmonitor the checkout's config names
// runs, nor a replacement (refs/replace), and nothing runs while that config may name another program (a clean filter for
// `git status`): a program a job runs may have written it (AR0488), and the refusal is the check's line.
function git(path: string, args: readonly string[]): string | undefined {
	const refusal = configRefusal(path);
	if (refusal !== "") throw new Error(refusal);
	const ran = spawnSync("git", ["--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "-C", path, ...args], { encoding: "utf8" });
	if (ran.error !== undefined) throw ran.error;
	return ran.status === 0 ? ran.stdout : undefined;
}

// An in-progress or review ticket that no job in a run names, for an hour since its last move and since its last job took its
// state.
export function stalledTickets(tickets: readonly Ticket[], jobs: readonly JobRecord[], running: readonly string[], now: number): string[] {
	return tickets.flatMap((ticket) => {
		if (!OPEN.includes(ticket.status)) return [];
		const folder = normalize(dirname(ticket.path));
		const own = jobs.filter((job) => job.project === ticket.project && job.tickets.some((path) => normalize(dirname(path)) === folder));
		if (own.some((job) => running.includes(job.id))) return [];
		const since = Math.max(Date.parse(ticket.updated), ...own.map((job) => Date.parse(job.since)).filter(Number.isFinite));
		return now - since < HOUR_MS ? [] : [`${ticket.id} is ${ticket.status} with no job in a run for ${hours(now - since)}: ${ticket.title}`];
	});
}

// The checkout's branch ahead of its upstream, its oldest commit of its own (first parent) an hour old. A detached HEAD or a
// branch with no upstream has nothing to push to; the upstream is the one Git last fetched, never asked of the remote.
export function unpushed(project: Project, now: number): string[] {
	const branch = git(project.path, ["symbolic-ref", "--quiet", "--short", "HEAD"])?.trim();
	const upstream = branch === undefined ? undefined : git(project.path, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"])?.trim();
	if (upstream === undefined) return [];
	const times = (git(project.path, ["log", "--first-parent", "--format=%ct", "@{upstream}..HEAD"]) ?? "").split("\n").filter(Boolean);
	const oldest = Math.min(...times.map((time) => Number(time) * 1000));
	if (times.length === 0 || now - oldest < HOUR_MS) return [];
	return [`${project.name}: ${branch} has ${times.length} commit${times.length === 1 ? "" : "s"} not pushed to ${upstream}, the oldest made ${hours(now - oldest)} ago`];
}

// The board's files changed and not committed, the oldest change an hour old by its file's time; a deletion has no time.
export function uncommittedBoard(project: Project, now: number): string[] {
	const status = git(project.path, ["status", "--porcelain", "-z", "--untracked-files=all", "--", ...BOARD]);
	if (status === undefined) throw new Error(`git status failed in ${project.path}`);
	const entries = status.split("\0");
	const changed: { readonly path: string; readonly at: number }[] = [];
	for (let at = 0; at < entries.length; at++) {
		const entry = entries[at] ?? "";
		if (entry === "") continue;
		// A rename or a copy holds its source in the next entry.
		if (entry[0] === "R" || entry[0] === "C") at++;
		const path = entry.slice(3);
		if (existsSync(join(project.path, path))) changed.push({ path, at: statSync(join(project.path, path)).mtimeMs });
	}
	const oldest = changed.toSorted((a, b) => a.at - b.at)[0];
	if (oldest === undefined || now - oldest.at < HOUR_MS) return [];
	const more = changed.length > 1 ? ` and ${changed.length - 1} more` : "";
	return [`${project.name}: the board has changes not committed for ${hours(now - oldest.at)}: ${oldest.path}${more}`];
}

// An audit or retro of the project that ended finished an hour ago, whose id no `- Job:` line of a report in its kind's folder
// names: the next one starts from the report before it, and a prune of the job loses its result. A broken time is no line.
export function unfiledReports(project: Project, jobs: readonly JobRecord[], now: number): string[] {
	return Object.entries(FILED).flatMap(([kind, reports]) => {
		const ended = jobs.filter((job) => job.project === project.name && job.kind === kind && job.state === "ended" && job.reason === "finished" && now - Date.parse(job.since) >= HOUR_MS);
		if (ended.length === 0) return [];
		const filed = new Set(newest(project.path, reports, "md").flatMap((path) => [...readFileSync(join(project.path, path), "utf8").matchAll(/^- Job: (\S+)$/gm)].map((match) => match[1])));
		return ended.filter((job) => !filed.has(job.id)).map((job) => `${project.name}: the ${kind} ${job.id} finished ${hours(now - Date.parse(job.since))} ago and is not filed in ${reports.folder}/: arthur ticket file ${job.id}`);
	});
}

// The temporary folder with under LOW of its space free, and each filesystem of `temp` and `folders`, once, with under LOW of
// its inodes free. A folder that does not exist is skipped; a filesystem that counts no inodes has none to run out of.
export function diskLines(temp: string, folders: readonly string[], statfs: (path: string) => Space = statfsSync): string[] {
	const space = statfs(temp);
	const lines = space.blocks > 0 && space.bavail / space.blocks < LOW ? [`the temporary folder ${temp} has ${free(space.bavail / space.blocks)} of its space free: ${((space.bavail * space.bsize) / 1e9).toFixed(1)} GB`] : [];
	const seen = new Set<number>();
	for (const folder of [temp, ...folders]) {
		const device = statSync(folder, { throwIfNoEntry: false })?.dev;
		if (device === undefined || seen.has(device)) continue;
		seen.add(device);
		const { files, ffree } = folder === temp ? space : statfs(folder);
		if (files > 0 && ffree / files < LOW) lines.push(`${folder}: ${free(ffree / files)} of its filesystem's inodes free, ${ffree} of ${files}`);
	}
	return lines;
}

// Every check above over every project, the jobs read once; a check that throws gives `manage: <what> could not be checked`.
export function ownHealth(host: Pick<Host, "board" | "jobs" | "clock" | "folder">): string[] {
	const now = host.clock.now().getTime();
	const lines: string[] = [];
	const each = (what: string, check: () => readonly string[]) => {
		try {
			lines.push(...check());
		} catch (error) {
			lines.push(`manage: ${what} could not be checked: ${(error instanceof Error ? error.message : String(error)).split("\n")[0]}`);
		}
	};
	let projects: readonly Project[] = [];
	each("the projects", () => ((projects = host.board.projects()), []));
	let jobs: { readonly list: readonly JobRecord[]; readonly running: readonly string[] } | undefined;
	const list = () => (jobs ??= { list: host.jobs.list(), running: host.jobs.running() });
	for (const project of projects) {
		each(`the tickets of ${project.name}`, () => stalledTickets(host.board.list(project.name), list().list, list().running, now));
		each(`the commits of ${project.name}`, () => unpushed(project, now));
		each(`the board of ${project.name}`, () => uncommittedBoard(project, now));
		each(`the reports of ${project.name}`, () => unfiledReports(project, list().list, now));
	}
	each("the disk", () => diskLines(tmpdir(), [dirname(host.folder), ...projects.map((project) => project.path)]));
	return lines;
}
