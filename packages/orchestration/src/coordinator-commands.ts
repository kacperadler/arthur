import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Command, Host } from "@arthur/core/plugin";
import { coordinatorContext, projectContext } from "./context.ts";
import { pane, STOPPED, tmux } from "./coordinator.ts";
import type { Session } from "./sessions.ts";

// `arthur attach [<project>]` and `arthur coordinator stop|context [<project>]` (spec/roadmap.md, entries 23, 25 and 85): the
// coordinator's session without a project, else that project's agent's: docs/commands/attach.md and coordinator.md.

export function coordinatorCommands(host: Host, list: readonly Session[]): Command[] {
	// The session `project` names, else the refusal, naming the projects with an agent.
	const named = (command: string, project: string | undefined): Session | string => {
		const found = list.find((each) => each.project === project);
		const agents = list.flatMap((each) => each.project ?? []).join(", ") || "none";
		return found ?? `arthur ${command}: project ${project} has no agent (no orchestration.project({ chat }) in its project file); projects with one: ${agents}`;
	};
	const where = ({ coordinator }: Session) => `tmux session ${coordinator.session} (socket ${coordinator.socket})`;
	return [
		{
			name: "attach",
			doc: new URL("../docs/commands/attach.md", import.meta.url),
			run({ args }) {
				const session = args.length > 1 ? undefined : named("attach", args[0]);
				if (typeof session !== "object") {
					console.error(session ?? "usage: arthur attach [<project>]");
					return session === undefined ? 2 : 1;
				}
				if (pane(session.coordinator) === "none") {
					const asked = `arthur coordinator stop${session.project === undefined ? "" : ` ${session.project}`}`;
					const why = existsSync(join(session.folder, STOPPED)) ? `${asked} stopped it until arthur run starts again` : "arthur run starts it";
					console.error(`arthur attach: no ${session.project === undefined ? "coordinator" : `agent of project ${session.project}`}: ${where(session)} is not running; ${why}`);
					return 1;
				}
				return tmux(session.coordinator, ["attach-session", "-t", `=${session.coordinator.session}`], true).status ?? 1;
			},
		},
		{
			name: "coordinator",
			doc: new URL("../docs/commands/coordinator.md", import.meta.url),
			run({ args }) {
				const [verb, project, ...more] = args;
				const session = (verb !== "stop" && verb !== "context") || more.length > 0 ? undefined : named(`coordinator ${verb}`, project);
				if (typeof session !== "object") {
					console.error(session ?? "usage: arthur coordinator stop|context [<project>]");
					return session === undefined ? 2 : 1;
				}
				if (verb === "context") {
					console.log(session.project === undefined ? coordinatorContext(host) : projectContext(host, session.project));
					return 0;
				}
				const records = session.project === undefined ? [] : host.jobs.list();
				const running = host.jobs.running().filter((id) => session.project === undefined || records.some((job) => job.id === id && job.project === session.project));
				if (running.length > 0) {
					const jobs = `${running.length} job${running.length === 1 ? "" : "s"}${session.project === undefined ? "" : ` of ${session.project}`} running: ${running.join(", ")}`;
					const hears = session.project === undefined ? "the coordinator is who hears their end" : `the agent of project ${session.project} directs them`;
					console.error(`arthur coordinator stop: refused: ${jobs}; ${hears}; stop them first (arthur stop <id>, or arthur stopall)`);
					return 1;
				}
				// The mark first, so `arthur run` does not start it again once its session is gone.
				mkdirSync(session.folder, { recursive: true });
				writeFileSync(join(session.folder, STOPPED), "");
				const ended = tmux(session.coordinator, ["kill-session", "-t", `=${session.coordinator.session}`]).status === 0;
				console.log(`arthur coordinator stop: ${where(session)} ${ended ? "ended" : "was not running"}; it stays stopped until arthur run starts again`);
			},
		},
	];
}
