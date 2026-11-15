import { join } from "node:path";
import { addUsage, appendLine, readLines, round, type Usage } from "./stats-lines.ts";

// The coordinator's spend (spec/roadmap.md, entry 109): an OMP extension that orchestration loads into the coordinator's agent
// for the stats plugin (`coordinator.extension`). At each real end of a turn it appends one line to `sessions/<session>.jsonl`
// of the folder `ARTHUR_STATS_FOLDER` names: the tokens and cost of the assistant messages after the last one counted (`until`,
// read at its start from the file's last line of the session's own agent, so a resumed turn or a `--continue` counts nothing
// twice), and the seconds since the turn's `agent_start`; a session without a UI (a `task` subagent) is marked `sub`: docs/stats.md.

type Said = { readonly role?: string; readonly provider?: string; readonly model?: string; readonly timestamp?: number; readonly usage?: Readonly<Record<string, unknown>> & { readonly cost?: { readonly total?: unknown } } };
type ExtensionApi = {
	on(event: "agent_start", handler: () => void): void;
	on(event: "agent_end", handler: (event: { readonly messages?: readonly Said[]; readonly willContinue?: boolean }, ctx: { readonly hasUI: boolean }) => void): void;
};

export default function sessionStats(pi: ExtensionApi): void {
	// The session's name orchestration sets for a project agent, `agent:<project>`; the coordinator's sets none.
	const SESSION = process.env.ARTHUR_ORCHESTRATION_SESSION || "coordinator";
	const folder = process.env.ARTHUR_STATS_FOLDER ?? "";
	if (folder === "") return;
	const file = join(folder, "sessions", `${SESSION}.jsonl`);
	let until = Number(readLines(file).findLast((line) => line.sub !== true)?.until) || 0;
	// The turn's first `agent_start`: one that goes on after an `agent_end` with `willContinue` is the same turn.
	let started: number | undefined;
	pi.on("agent_start", () => void (started ??= Date.now()));
	pi.on("agent_end", (event, ctx) => {
		if (event.willContinue === true) return;
		const fresh = (event.messages ?? []).filter((message) => message.role === "assistant" && (message.timestamp ?? 0) > until);
		let [cost, usage]: [number, Usage] = [0, {}];
		for (const { provider, model, usage: used = {} } of fresh) {
			cost += Number(used.cost?.total) || 0;
			usage = addUsage(usage, { [`${provider}/${model}`]: { ...used, messages: 1, cost: Number(used.cost?.total) || 0 } });
		}
		until = Math.max(until, ...fresh.map((message) => message.timestamp ?? 0));
		const now = Date.now();
		appendLine(file, { time: new Date(now).toISOString(), session: SESSION, seconds: round((now - (started ?? now)) / 1000), until, ...(ctx.hasUI ? {} : { sub: true }), cost: round(cost), usage });
		started = undefined;
	});
}
