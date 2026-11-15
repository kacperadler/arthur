import { rmSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { agentUp, put, REQUEST, type Request, readRequest } from "./request.ts";
import { busy, due, RESTART_WAIT_SECONDS, restart } from "./restart.ts";
import { servicePid } from "./service.ts";
import { type Session, sessionFrom, who } from "./sessions.ts";

// `arthur restart [fresh]` and the phone command `/restart [fresh]`, answered without the model (spec/roadmap.md, entries 36 and
// 88): `/restart` restarts the session of the chat it came from, the coordinator's for any other chat; `arthur restart` the
// session of the project it names (`--project`, a project agent's own by default), else the coordinator's:
// docs/commands/restart.md.
export function registerRestart(host: Host, sessions: readonly Session[]): void {
	const answer = (text: string, session: Session): { readonly code: number; readonly line: string } => {
		const word = text.trim();
		if (word !== "" && word !== "fresh") return { code: 2, line: "usage: /restart [fresh]" };
		const fresh = word === "fresh";
		const held = busy(host, true, session.project);
		if (held !== "") return { code: 1, line: `error: ${held}` };
		const pending = readRequest(session.folder);
		if (pending !== undefined && pending.then !== "compact") return { code: 1, line: `error: a restart is already on its way, asked by ${{ "/restart": "/restart", due: "the restart guard" }[pending.slot] ?? `freshAt ${pending.slot}`}` };
		// Only the coordinator's restart ends `arthur run` while a restart is due; a project agent's restarts that agent alone.
		const why = session.project === undefined ? due(host) : undefined;
		const run = why !== undefined && servicePid(host.folder) !== undefined;
		const also =
			why === undefined ? "" : run ? `; then arthur run ends, a restart being due (${why}), and its service starts it again on the new code` : `; a restart is due (${why}), but arthur run runs without its service, so only the coordinator restarts and the restart stays due`;
		const none = agentUp(session.folder) === undefined;
		const line = none
			? `no ${who(session)} is running, so no handoff is asked; its next start ${fresh ? "is a fresh conversation" : "goes on with --continue"}${also}`
			: `restarting${fresh ? " in a fresh conversation" : ""}: the ${who(session)} writes its handoff first, for at most ${RESTART_WAIT_SECONDS} s${also}; Restarted. follows`;
		// With no agent the restart is made at once, unless `arthur run` ends too: that is its own tick's, in its process.
		if (none && !run) {
			rmSync(join(session.folder, REQUEST), { force: true });
			restart(host, session, fresh, false);
			return { code: 0, line };
		}
		// A compaction still asked for gives way: the extension drops it once the file holds another request.
		const asked: Request = { then: fresh ? "fresh" : "restart", slot: "/restart", asked: Date.now(), waitSeconds: RESTART_WAIT_SECONDS, run };
		put(join(session.folder, REQUEST), JSON.stringify(asked));
		return { code: 0, line };
	};
	host.commands.register({
		name: "restart",
		doc: new URL("../docs/commands/restart.md", import.meta.url),
		run({ args, project }) {
			const session = sessions.find((each) => each.project !== undefined && each.project === project) ?? (sessions[0] as Session);
			const { code, line } = args.length > 1 || (args.length === 1 && args[0] !== "fresh") ? { code: 2, line: "usage: arthur restart [fresh]" } : answer(args[0] ?? "", session);
			(code === 0 ? console.log : console.error)(line);
			return code;
		},
		phone: {
			about: "Restart this chat's agent (the coordinator, or a project agent in its chat) after its handoff, and arthur run too while a restart is due; /restart fresh starts a new conversation; refused while a job or a merge runs",
			reply: (text, from) => answer(text, sessionFrom(host, sessions, from)).line,
		},
	});
}
