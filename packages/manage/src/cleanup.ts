import { lstatSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";

// The daily cleanup of `prune.keepJobsDays` (spec/roadmap.md, entry 64), which the schedule plugin runs as manage's entry
// `manage.prune`: old ended jobs freed by the core's prune, and Arthur's temporary folders older than a day removed.
// docs/manage.md, "The daily prune".

const DAY_MS = 86_400_000;
// What Arthur's temporary folders are named: `arthur-test-*` of the test kit, and every other one Arthur's code makes.
const OURS = /^arthur-/;

// Each folder right in `temp` named `arthur-*`, changed last before `before`, removed with what is inside; a link is never
// followed. One that user `uid` does not own is skipped, and one that cannot be removed whole is named with the reason.
function removeTemporary(temp: string, before: number, uid: number): string[] {
	const lines: string[] = [];
	let removed = 0;
	for (const name of readdirSync(temp).filter((each) => OURS.test(each))) {
		const path = join(temp, name);
		const stat = lstatSync(path, { throwIfNoEntry: false });
		if (stat === undefined || !stat.isDirectory() || stat.mtimeMs >= before) continue;
		if (stat.uid !== uid) {
			lines.push(`kept ${path}: user ${stat.uid} owns it, not Arthur's user ${uid}`);
			continue;
		}
		try {
			rmSync(path, { recursive: true, force: true });
			removed++;
		} catch (error) {
			lines.push(`kept ${path}: ${(error as Error).message}`);
		}
	}
	return removed === 0 ? lines : [`removed ${removed} temporary folder${removed === 1 ? "" : "s"} of Arthur's from ${temp}`, ...lines];
}

// The whole cleanup, each line printed as `manage: <line>`; `temp` is the system's temporary folder, `uid` Arthur's user. Each
// part runs even when the other fails; a failure is thrown after both, so the schedule says it.
export async function cleanup(host: Pick<Host, "jobs" | "clock">, keepDays: number, temp: string, uid: number): Promise<void> {
	const now = host.clock.now().getTime();
	const failed: string[] = [];
	const part = (what: string, run: () => readonly string[]) => {
		try {
			for (const line of run()) console.log(`manage: ${line}`);
		} catch (error) {
			failed.push(`${what}: ${(error as Error).message}`);
		}
	};
	part("the prune of old jobs", () => {
		// Ended `keepDays` days ago or longer, by when they took their state; a time that does not parse keeps the job.
		const ids = host.jobs.list().flatMap((job) => (job.state === "ended" && Date.parse(job.since) <= now - keepDays * DAY_MS ? [job.id] : []));
		return ids.length === 0 ? [] : host.jobs.prune(ids).map((line) => `prune: ${line}`);
	});
	part("the temporary folders", () => {
		// A day ago, or earlier when a job in a run began its current run before that, so nothing a running job made is touched:
		// `seconds` holds its runs so far, the current one up to now, so `now - seconds` is never after the current run began.
		const running = new Set(host.jobs.running());
		const runs = host.jobs.list().flatMap((job) => (running.has(job.id) ? [now - job.seconds * 1000] : []));
		return removeTemporary(temp, Math.min(now - DAY_MS, ...runs), uid);
	});
	if (failed.length > 0) throw new Error(failed.join("; "));
}
