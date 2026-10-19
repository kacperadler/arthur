import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { clock as wallClock } from "@arthur/core/clock";
import type { Host } from "@arthur/core/plugin";
import { agentUp, alive, put, REQUEST, type Request, readRequest } from "./request.ts";
import type { SessionOptions } from "./session.ts";

// The fresh start and `/restart` (spec/roadmap.md, entry 36): a restart only once no job runs, after the handoff the
// coordinator writes (handoff-extension.ts), through orchestration's `coordinator.restart`; at `freshAt` a fresh conversation,
// tried every `freshRetryMinutes` until `freshUntil`; after the restart one `Restarted.` notice: docs/session.md and
// docs/commands/restart.md.

// How long `/restart` waits for the handoff before it restarts without one.
const RESTART_WAIT_SECONDS = 120;
// Left by a restart until the next coordinator is up: `before` is the agent it ended, `written` whether the handoff was.
const RESTARTED = "restarted.json";
const AFTER = "after-restart.md";

// `<n> job(s) running`, with their short ids unless `named` is false (the fresh start's line).
const running = (ids: readonly string[], named = true) => `${ids.length} job${ids.length === 1 ? "" : "s"} running${named ? `: ${ids.map((id) => id.split("-").at(-1)).join(", ")}` : ""}`;

function restart(host: Host, fresh: boolean, written: boolean): void {
	put(join(host.folder, RESTARTED), JSON.stringify({ fresh, written, before: agentUp(host.folder) ?? 0 }));
	host.call("coordinator.restart", { fresh });
}

// `arthur restart [fresh]` and the phone command `/restart [fresh]`, answered without the model.
export function registerRestart(host: Host): void {
	const answer = (text: string): { readonly code: number; readonly line: string } => {
		const word = text.trim();
		if (word !== "" && word !== "fresh") return { code: 2, line: "usage: /restart [fresh]" };
		const fresh = word === "fresh";
		const ids = host.jobs.running();
		if (ids.length > 0) return { code: 1, line: `error: ${running(ids)}; run /stopall first` };
		const pending = readRequest(host.folder);
		if (pending !== undefined && pending.then !== "compact") return { code: 1, line: `error: a restart is already on its way, asked by ${pending.slot === "/restart" ? "/restart" : `freshAt ${pending.slot}`}` };
		// A compaction still asked for gives way: the extension drops it once the file holds another request.
		if (agentUp(host.folder) === undefined) {
			rmSync(join(host.folder, REQUEST), { force: true });
			restart(host, fresh, false);
			return { code: 0, line: `no coordinator is running, so no handoff is asked; its next start ${fresh ? "is a fresh conversation" : "goes on with --continue"}` };
		}
		const asked: Request = { then: fresh ? "fresh" : "restart", slot: "/restart", asked: Date.now(), waitSeconds: RESTART_WAIT_SECONDS };
		put(join(host.folder, REQUEST), JSON.stringify(asked));
		return { code: 0, line: `restarting${fresh ? " in a fresh conversation" : ""}: the coordinator writes its handoff first, for at most ${RESTART_WAIT_SECONDS} s; Restarted. follows` };
	};
	host.commands.register({
		name: "restart",
		doc: new URL("../docs/commands/restart.md", import.meta.url),
		run({ args }) {
			const { code, line } = args.length > 1 || (args.length === 1 && args[0] !== "fresh") ? { code: 2, line: "usage: arthur restart [fresh]" } : answer(args[0] ?? "");
			(code === 0 ? console.log : console.error)(line);
			return code;
		},
		phone: { about: "Restart the coordinator after its handoff; /restart fresh starts a new conversation; refused while a job runs", reply: (text) => answer(text).line },
	});
}

// Every 500 ms in `arthur run`: the outcome of a restart asked for, acted on; the `Restarted.` notice once the next coordinator
// is up; and tonight's tries of the fresh start.
export function restarts(host: Host): () => void {
	const { freshAt = "23:00", freshRetryMinutes = 15, freshUntil = "03:00" } = host.options as SessionOptions;
	const [file, step, clock] = [join(host.folder, REQUEST), freshRetryMinutes * 60_000, host.clock];
	const say = (text: string) => console.log(`session: fresh: ${text}`);
	// The next night's window: tries from `start`, every `step`, the last at `end`, the first `freshUntil` after `start`; `at` the
	// next try, `tried` the one whose request is out. Counted from now, so a night missed while Arthur was down is skipped.
	const plan = () => {
		const start = clock.next(freshAt).getTime();
		return { start, end: freshUntil === freshAt ? start : wallClock(clock.timeZone, undefined, () => new Date(start)).next(freshUntil).getTime(), at: start };
	};
	let night = plan();
	let tried: number | undefined;
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
		const request = readRequest(host.folder);
		if (request === undefined || request.then === "compact") return;
		const none = request.pid === undefined && agentUp(host.folder) === undefined;
		const gone = request.pid !== undefined && !alive(request.pid);
		if (request.line === undefined && !none && !gone && Date.now() - request.asked < request.waitSeconds * 1000) return;
		rmSync(file, { force: true });
		const [byNight, fresh, written] = [request.slot !== "/restart", request.then === "fresh", request.line === "handoff written"];
		const why = request.line ?? (gone ? "handoff not written: the coordinator ended" : `handoff not written within ${request.waitSeconds} s`);
		// No coordinator: nothing to ask, the restart goes on; a night's handoff that failed withdraws its try.
		if (byNight && !written && !none) return again(why, true);
		const ids = host.jobs.running();
		if (ids.length > 0) {
			if (byNight) return again(running(ids, false), false);
			host.events.emit("notice", { text: `restart: not done, ${running(ids)}; run /stopall first` });
			return;
		}
		// The night is over before the restart is asked, so one that throws never holds the next night's tries.
		if (byNight) [night, tried] = [plan(), undefined];
		restart(host, fresh, written);
		const how = written ? "which starts by reading the handoff" : none ? "with no handoff: no coordinator was running" : `with no handoff (${why})`;
		console.log(`session: ${byNight ? "fresh: done" : "restart: done"}; the coordinator restarts${fresh ? " in a fresh conversation" : ""}, ${how}`);
	};

	const notice = () => {
		const marked = join(host.folder, RESTARTED);
		if (!existsSync(marked)) return;
		const text = readFileSync(marked, "utf8");
		let left: { readonly fresh?: unknown; readonly written?: unknown; readonly before?: unknown } = {};
		try {
			left = JSON.parse(text);
		} catch {}
		const { fresh, written, before } = left;
		if (typeof fresh !== "boolean" || typeof written !== "boolean" || typeof before !== "number") {
			rmSync(marked, { force: true });
			console.error(`session: ${marked} is not a restart's mark, so it is dropped: ${text.slice(0, 200)}`);
			return;
		}
		const pid = agentUp(host.folder);
		if (pid === undefined || pid === before) return;
		rmSync(marked, { force: true });
		const notes = [fresh ? "fresh session" : "", written ? "" : "handoff not written"].filter(Boolean).join("; ");
		const after = join(host.folder, AFTER);
		const steps = existsSync(after) ? readFileSync(after, "utf8").trim() : "";
		const health = host.collectEach<unknown>("health").flatMap((answer) => ("error" in answer ? [`${answer.plugin}: health failed: ${answer.error.message.split("\n")[0]}`] : [answer.value].flat().filter((line): line is string => typeof line === "string" && line.trim() !== "")));
		const parts = [`Restarted.${notes === "" ? "" : ` (${notes})`}`, steps === "" ? "" : `After the restart:\n${steps}`, health.length === 0 ? "" : `Health:\n${health.map((line) => `- ${line.trim()}`).join("\n")}`];
		host.events.emit("notice", { text: parts.filter(Boolean).join("\n\n") });
		// The steps go once.
		if (steps !== "") rmSync(after, { force: true });
	};

	return () => {
		settle();
		notice();
		const now = clock.now().getTime();
		if (tried !== undefined || now < night.at) return;
		// A window passed unseen (a clock that jumped, a machine that slept) is skipped, never tried late.
		if (now >= night.end + 60_000) {
			night = plan();
			return;
		}
		const ids = host.jobs.running();
		if (ids.length > 0) return again(running(ids, false), false);
		const pending = readRequest(host.folder);
		if (pending !== undefined && pending.then !== "compact") return again("a restart already asked", false);
		const asked: Request = { then: "fresh", slot: freshAt, asked: Date.now(), waitSeconds: freshRetryMinutes * 60 };
		put(file, JSON.stringify(asked));
		// Noted once the request is out: one whose write threw is tried again at the next tick.
		tried = night.at;
	};
}
