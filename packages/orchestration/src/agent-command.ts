import type { Command, Host } from "@arthur/core/plugin";
import { type Session, sessionOf } from "./sessions.ts";

// `arthur agent tell <project|coordinator> '<text>'` (spec/roadmap.md, entry 86): one message from this session to another,
// emitted as `agent-told`, which every process that gets it queues in that session's inbox (inbox.ts), marked `[from <this
// session>]`, never the owner's word: docs/commands/agent.md.

const USAGE = "usage: arthur agent tell <project|coordinator> '<text>'";

export function agentCommand(host: Host, sessions: readonly Session[]): Command {
	return {
		name: "agent",
		doc: new URL("../docs/commands/agent.md", import.meta.url),
		run({ args }) {
			const [verb, name = "", ...words] = args;
			const said = words.join(" ").trim();
			if (verb !== "tell" || said === "") {
				console.error(USAGE);
				return 2;
			}
			const [from, to] = [sessionOf(sessions), sessions.find((each) => (each.project ?? "coordinator") === name)];
			if (from === undefined || to === undefined || to === from) {
				const agents = sessions.map((each) => each.project ?? "coordinator").join(", ");
				const alone = "only a session of Arthur's tells another: the coordinator or a project agent, in its own omp";
				const why = from === undefined ? alone : to === undefined ? `no agent ${name}; agents: ${agents}` : `${name} is this session; tell another: ${agents}`;
				console.error(`arthur agent tell: refused: ${why}`);
				return 1;
			}
			host.events.emit("agent-told", { to: to.name, from: from.name, text: said });
			console.log(`arthur agent tell: queued for ${to.name}, marked [from ${from.name}]`);
		},
	};
}
