import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";

// A branch waiting for its CI (spec/roadmap.md, entry 59): `arthur merge --auto` refused it only for CI not yet passed, and
// left `<folder>/<job>/ci-wait`. A run's end is told by github's poll, which asks `delivery.ciEnded` (AR0257, one wake per run
// end): a wait that counts the run wakes the coordinator with its verdict, once per run attempt, `<folder>/<job>/ci-told`
// keeping each one told across a restart, and github leaves the branch out of its own wake. While `arthur run` runs, every
// POLL_MS each wait asks `github.ci` for the run that built its branch: one going HANG_MINUTES after its start is cancelled
// through `github.cancel`, once. A wait ends with its branch's merge, its job pruned, or a commit on its branch past the tip
// that had the PASS. docs/commands/merge.md, "--auto".

// What `github.ci` answers: the run that built a branch, `below` the commits from the tip to the one it ran on.
export type CiRun = { readonly id: number; readonly attempt: number; readonly sha: string; readonly below: number; readonly status: string; readonly conclusion: string | null; readonly url: string; readonly startedAt: string | null };
// `own`: the commits of the branch main lacks; a run further below the tip than that ran on main, not on the branch.
export type Wait = { readonly job: string; readonly project: string; readonly branch: string; readonly tip: string; readonly own: number };
// `round` checks every wait once; `start` polls them every POLL_MS until `stop`.
export type CiWaits = { round(): Promise<void>; start(): void; stop(): void };
// A run's end on a branch as github's poll tells it, `below` the commits from the branch's tip to the run's.
export type CiEnd = { readonly project: string; readonly branch: string; readonly below: number; readonly run: Pick<CiRun, "id" | "attempt" | "sha" | "conclusion" | "url"> };

const HANG_MINUTES = 30;
const POLL_MS = 60_000;
// A job id, the only folder name a wait takes.
const ID = /^[\w-]+$/;

const paths = (host: Host, id: string) => ({ wait: join(host.folder, id, "ci-wait"), told: join(host.folder, id, "ci-told") });

// The job ids with a wait.
const waiting = (host: Host) => (existsSync(host.folder) ? readdirSync(host.folder) : []).filter((id) => ID.test(id) && existsSync(paths(host, id).wait));

function read(host: Host, id: string): Wait | Error {
	try {
		return JSON.parse(readFileSync(paths(host, id).wait, "utf8")) as Wait;
	} catch (error) {
		return error as Error;
	}
}

// Why the wait of job `id` holds no more: its job pruned, or its branch's tip moved; undefined while it holds.
function gone(host: Host, id: string, wait: Wait): string | undefined {
	if (!host.jobs.list().some((job) => job.id === id)) return "its job was pruned";
	const root = host.board.projects().find((project) => project.name === wait.project)?.path;
	const tip = root && spawnSync("git", ["-C", root, "rev-parse", "--verify", "--quiet", `${wait.branch}^{commit}`], { encoding: "utf8" }).stdout.trim();
	return tip === wait.tip ? undefined : `its tip is no longer ${wait.tip.slice(0, 7)}`;
}

// Written whole under a temporary name, then renamed; a second `--auto` refused the same way keeps what was told.
export function startWait(host: Host, wait: Wait): void {
	const { wait: file } = paths(host, wait.job);
	mkdirSync(join(host.folder, wait.job), { recursive: true });
	writeFileSync(`${file}.${process.pid}`, `${JSON.stringify(wait)}\n`);
	renameSync(`${file}.${process.pid}`, file);
}

export function endWait(host: Host, id: string): void {
	for (const file of Object.values(paths(host, id))) rmSync(file, { force: true });
}

// The verdict a run that built a waiting branch ended on, as the coordinator's wake says it.
function ended(wait: Wait, run: CiEnd["run"], cancelled: boolean): string {
	const where = `${wait.branch} (run ${run.id}, attempt ${run.attempt}, on ${run.sha.slice(0, 7)}): ${run.url}`;
	if (run.conclusion === "success") return `CI passed on ${where}. It waited for that: arthur merge --auto ${wait.job}`;
	const ci = `arthur ci ${wait.branch} --project ${wait.project}`;
	const hung = cancelled ? `, cancelled by delivery after it ran ${HANG_MINUTES} minutes` : "";
	return `CI ended ${run.conclusion}${hung} on ${where}. Not merged; it waits on: the next end of a run on it wakes you again. Why: ${ci}; then a failure in the branch's own code goes back to its worker: arthur continue ${wait.job} '<the failed step and its lines>'; one that looks transient (a network error, a runner lost, a timeout in a step that passed before) is rerun once: ${ci} --rerun`;
}

// `delivery.ciEnded`: the end of a run on a waiting branch's tip wakes the coordinator, once per run attempt, and answers true;
// any other end, one below the tip included (AR0359), answers false, and github's wake tells it. The wait ends only in a round.
export function ciEnded(host: Host, { project, branch, below, run }: CiEnd): boolean {
	for (const id of waiting(host)) {
		const wait = read(host, id);
		if (wait instanceof Error || wait.project !== project || wait.branch !== branch || below !== 0 || gone(host, id, wait) !== undefined) continue;
		const { told: file } = paths(host, id);
		const key = `${run.id}/${run.attempt}`;
		const told = existsSync(file) ? readFileSync(file, "utf8").split("\n") : [];
		if (told.includes(`${key} ended`)) return true;
		appendFileSync(file, `${key} ended\n`);
		host.events.emit("coordinator-message", { text: ended(wait, run, told.includes(`${key} cancel`)) });
		return true;
	}
	return false;
}

export function ciWaits(host: Host): CiWaits {
	let timer: NodeJS.Timeout | undefined;
	let stopped = true;
	// The last refusal said for each wait, so a refusal that stands is said once.
	const said = new Map<string, string>();
	const say = (id: string, text: string) => {
		if (said.get(id) !== text) console.error(`delivery: ${text}`);
		said.set(id, text);
	};
	const one = async (id: string) => {
		const { wait: file, told: toldFile } = paths(host, id);
		const wait = read(host, id);
		if (wait instanceof Error) return say(id, `${file} is no CI wait (${wait.message}); remove it, and arthur merge --auto ${id} again`);
		const why = gone(host, id, wait);
		if (why !== undefined) {
			endWait(host, id);
			return console.log(`delivery: ${wait.branch} waits for CI no more: ${why}`);
		}
		let run: CiRun | undefined;
		try {
			run = await host.call<Promise<CiRun | undefined>>("github.ci", { project: wait.project, branch: wait.branch });
		} catch (error) {
			return say(id, `the CI of ${wait.branch} was not asked: ${(error as Error).message}`);
		}
		said.delete(id);
		// No run on the branch's own commits yet (the one below them ran on main), or one that ended, which `ciEnded` tells.
		if (run === undefined || run.below >= wait.own || run.status === "completed") return;
		const key = `${run.id}/${run.attempt}`;
		const told = existsSync(toldFile) ? readFileSync(toldFile, "utf8").split("\n") : [];
		const started = Date.parse(run.startedAt ?? "");
		if (!(host.clock.now().getTime() - started >= HANG_MINUTES * 60_000) || told.includes(`${key} cancel`)) return;
		appendFileSync(toldFile, `${key} cancel\n`);
		try {
			console.log(await host.call<Promise<string>>("github.cancel", { project: wait.project, run: run.id }));
		} catch (error) {
			const text = `CI run ${run.id}, attempt ${run.attempt}, on ${wait.branch} has run ${HANG_MINUTES} minutes and was not cancelled: ${(error as Error).message}. Cancel it on GitHub: ${run.url}`;
			host.events.emit("coordinator-message", { text });
		}
	};
	const round = async () => {
		for (const id of waiting(host)) await one(id);
	};
	return {
		round,
		start() {
			stopped = false;
			const loop = () =>
				void round()
					.catch((error: unknown) => console.error(`delivery: a round of the CI waits failed: ${(error as Error).message}`))
					.finally(() => {
						// The poll never holds a process alive on its own: a command that ran `start` without `stop` still ends.
						if (!stopped) timer = setTimeout(loop, POLL_MS).unref();
					});
			loop();
		},
		stop() {
			stopped = true;
			clearTimeout(timer);
		},
	};
}
