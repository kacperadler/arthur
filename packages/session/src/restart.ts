import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { clock as wallClock } from "@arthur/core/clock";
import type { Host } from "@arthur/core/plugin";
import { agentUp, alive, put, REQUEST, type Request, readRequest } from "./request.ts";
import { restartDue } from "./restart-guard.ts";
import { servicePid } from "./service.ts";
import { DEFAULTS } from "./session-options.ts";
import type { SessionOptions } from "./session.ts";
import { noticeAt, type Session, who } from "./sessions.ts";

// The fresh start and the restart (spec/roadmap.md, entries 36 and 88), of each session on its own (sessions.ts): a restart only
// once no job and no merge runs, of its project for a project agent, after the handoff its agent writes (handoff-extension.ts),
// through orchestration's `coordinator.restart`; at `freshAt` a fresh conversation, tried every `freshRetryMinutes` until
// `freshUntil`; after the restart one `Restarted.` notice to its chat: docs/session.md and docs/commands/restart.md. While a
// restart is due (restart-guard.ts), the coordinator's `/restart` under the service ends `arthur run` too, and once no job and
// no merge runs `arthur run` asks that restart itself.

// How long `/restart` waits for the handoff before it restarts without one.
export const RESTART_WAIT_SECONDS = 120;
// Left by a restart until the session's next agent is up: `before` is the agent it ended, `written` whether the handoff was,
// `run` whether `arthur run` ended too.
const RESTARTED = "restarted.json";
const AFTER = "after-restart.md";

// What holds a restart, "" when nothing: `<n> job(s) running` and `<n> merge(s) running`, those delivery names (`delivery.merging`,
// AR0691: a restart would kill a merge on Arthur's main), of `project` only when given; `named` adds their short ids and what
// to do, the fresh start's line has neither.
export function busy(host: Host, named = true, project?: string): string {
	const short = (id: string) => id.split("-").at(-1) ?? id;
	const running = host.jobs.running();
	const ids = project === undefined ? running : host.jobs.list().flatMap((job) => (job.project === project && running.includes(job.id) ? [job.id] : []));
	const merging = host.collect<readonly { readonly project: string; readonly job: string }[]>("delivery.merging").flat().filter((merge) => project === undefined || merge.project === project);
	const [jobs, merges] = [ids.map(short), merging.map(({ project, job }) => (job === "" ? project : `${project} (${short(job)})`))];
	const count = (noun: string, ids: readonly string[]) => (ids.length === 0 ? [] : [`${ids.length} ${noun}${ids.length === 1 ? "" : "s"} running${named ? `: ${ids.join(", ")}` : ""}`]);
	const why = [...count("job", jobs), ...count("merge", merges)].join(", ");
	return named && why !== "" ? `${why}; ${jobs.length > 0 ? "run /stopall first" : "run /restart again once no merge runs"}` : why;
}

export function restart(host: Host, session: Session, fresh: boolean, written: boolean, run = false): void {
	put(join(session.folder, RESTARTED), JSON.stringify({ fresh, written, before: agentUp(session.folder) ?? 0, run }));
	host.call("coordinator.restart", { fresh, ...(session.project === undefined ? {} : { project: session.project }) });
}

// While the guard is on, why a restart of `arthur run` is due: the commits that changed its code, or why its note is broken.
export function due(host: Host): string | undefined {
	if (!((host.options as SessionOptions).restartGuard ?? DEFAULTS.restartGuard)) return undefined;
	try {
		const state = restartDue(host.folder);
		return state === undefined || state.due.length === 0 ? undefined : `${state.due.join(", ")} changed Arthur's code`;
	} catch (error) {
		return (error as Error).message.split("\n")[0];
	}
}

// Every 500 ms in `arthur run`, for one session: the outcome of a restart asked for, acted on; the `Restarted.` notice once its
// next agent is up; for the coordinator's, a restart due under the service, asked once no job and no merge runs; and tonight's
// tries of the fresh start.
export function restarts(host: Host, session: Session): () => void {
	const { freshAt = DEFAULTS.freshAt, freshRetryMinutes = DEFAULTS.freshRetryMinutes, freshUntil = DEFAULTS.freshUntil } = host.options as SessionOptions;
	const { folder, project } = session;
	const [file, step, clock, tag] = [join(folder, REQUEST), freshRetryMinutes * 60_000, host.clock, project === undefined ? "session" : `session: ${session.name}`];
	const say = (text: string) => console.log(`${tag}: fresh: ${text}`);
	// The next night's window: tries from `start`, every `step`, the last at `end`, the first `freshUntil` after `start`; `at` the
	// next try, `tried` the one whose request is out. Counted from now, so a night missed while Arthur was down is skipped.
	const plan = () => {
		const start = clock.next(freshAt).getTime();
		return { start, end: freshUntil === freshAt ? start : wallClock(clock.timeZone, undefined, () => new Date(start)).next(freshUntil).getTime(), at: start };
	};
	let night = plan();
	let tried: number | undefined;
	// Set once a restart ended `arthur run`: no restart due is asked again while it stops.
	let leaving = false;
	// A try that did not restart: the next one, or after the last the night skipped with one line.
	const again = (why: string, told: boolean) => {
		const last = (tried ?? night.at) >= night.end;
		tried = undefined;
		if (last) {
			say(`skipped, ${why} at ${freshUntil}`);
			night = plan();
			return;
		}
		const now = clock.now().getTime();
		night.at = Math.min(night.start + (Math.floor((now - night.start) / step) + 1) * step, night.end);
		if (told) say(`try withdrawn, ${why}; next try at ${clock.local(new Date(night.at)).time}`);
	};

	const settle = () => {
		const request = readRequest(folder);
		if (request === undefined || request.then === "compact") return;
		const none = request.pid === undefined && agentUp(folder) === undefined;
		const gone = request.pid !== undefined && !alive(request.pid);
		if (request.line === undefined && !none && !gone && Date.now() - request.asked < request.waitSeconds * 1000) return;
		rmSync(file, { force: true });
		// A notice only for the `/restart` the owner asked; the restart due (slot `due`) goes on as his does, not as a night's try.
		const [owner, fresh, written] = [request.slot === "/restart", request.then === "fresh", request.line === "handoff written"];
		const byNight = !owner && request.slot !== "due";
		const why = request.line ?? (gone ? `handoff not written: the ${who(session)} ended` : `handoff not written within ${request.waitSeconds} s`);
		// No coordinator: nothing to ask, the restart goes on; a night's handoff that failed withdraws its try.
		if (byNight && !written && !none) return again(why, true);
		const held = busy(host, !byNight, project);
		if (held !== "") {
			if (byNight) return again(held, false);
			if (owner) host.events.emit("notice", { text: `restart: not done, ${held}`, ...noticeAt(session) });
			return;
		}
		// The night is over before the restart is asked, so one that throws never holds the next night's tries.
		if (byNight) [night, tried] = [plan(), undefined];
		// `arthur run` ends only when it is the service's, as it noted at its start; SIGTERM, as the service's own stop, stops every
		// plugin, the coordinator included, and the service starts it again.
		const run = request.run === true && servicePid(host.folder) === process.pid;
		try {
			restart(host, session, fresh, written, run);
		} catch (error) {
			// The owner who asked hears it; the night's and the restart due's are only logged, and tried again.
			if (owner) host.events.emit("notice", { text: `restart: not done: ${String((error as Error).message).split("\n")[0]}`, ...noticeAt(session) });
			throw error;
		}
		const how = written ? "which starts by reading the handoff" : none ? `with no handoff: no ${who(session)} was running` : `with no handoff (${why})`;
		console.log(`${tag}: ${byNight ? "fresh: done" : "restart: done"}; the ${who(session)} restarts${fresh ? " in a fresh conversation" : ""}, ${how}${run ? "; arthur run ends, and its service starts it again on the new code" : ""}`);
		leaving ||= run;
		if (run) process.kill(process.pid, "SIGTERM");
	};

	const notice = () => {
		const marked = join(folder, RESTARTED);
		if (!existsSync(marked)) return;
		const text = readFileSync(marked, "utf8");
		let left: { readonly fresh?: unknown; readonly written?: unknown; readonly before?: unknown; readonly run?: unknown } = {};
		try {
			left = JSON.parse(text);
		} catch {}
		const { fresh, written, before, run } = left;
		if (typeof fresh !== "boolean" || typeof written !== "boolean" || typeof before !== "number") {
			rmSync(marked, { force: true });
			console.error(`session: ${marked} is not a restart's mark, so it is dropped: ${text.slice(0, 200)}`);
			return;
		}
		const pid = agentUp(folder);
		if (pid === undefined || pid === before) return;
		rmSync(marked, { force: true });
		const notes = [run === true ? "arthur run restarted" : "", fresh ? "fresh session" : "", written ? "" : "handoff not written"].filter(Boolean).join("; ");
		const after = join(folder, AFTER);
		const steps = existsSync(after) ? readFileSync(after, "utf8").trim() : "";
		const health = host.collectEach<unknown>("health").flatMap((answer) => ("error" in answer ? [`${answer.plugin}: health failed: ${answer.error.message.split("\n")[0]}`] : [answer.value].flat().filter((line): line is string => typeof line === "string" && line.trim() !== "")));
		const parts = [`Restarted.${notes === "" ? "" : ` (${notes})`}`, steps === "" ? "" : `After the restart:\n${steps}`, health.length === 0 ? "" : `Health:\n${health.map((line) => `- ${line.trim()}`).join("\n")}`];
		host.events.emit("notice", { text: parts.filter(Boolean).join("\n\n"), ...noticeAt(session) });
		// The steps go once.
		if (steps !== "") rmSync(after, { force: true });
	};

	return () => {
		settle();
		notice();
		if (project === undefined && !leaving && servicePid(host.folder) === process.pid && readRequest(folder) === undefined && due(host) !== undefined && busy(host, false) === "")
			put(file, JSON.stringify({ then: "restart", slot: "due", asked: Date.now(), waitSeconds: RESTART_WAIT_SECONDS, run: true } satisfies Request));
		const now = clock.now().getTime();
		if (tried !== undefined || now < night.at) return;
		// A window passed unseen (a clock that jumped, a machine that slept) is skipped, never tried late.
		if (now >= night.end + 60_000) {
			night = plan();
			return;
		}
		const held = busy(host, false, project);
		if (held !== "") return again(held, false);
		const pending = readRequest(folder);
		if (pending !== undefined && pending.then !== "compact") return again("a restart already asked", false);
		const asked: Request = { then: "fresh", slot: freshAt, asked: Date.now(), waitSeconds: freshRetryMinutes * 60 };
		put(file, JSON.stringify(asked));
		// Noted once the request is out: one whose write threw is tried again at the next tick.
		tried = night.at;
	};
}
