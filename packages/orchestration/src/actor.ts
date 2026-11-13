import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { type Session, sessionOf } from "./sessions.ts";

// What orchestration answers as `actor` (the core's stamp, docs/plugin-api.md): the session's name, `coordinator` or
// `agent:<project>`, in a process of that session, which alone has `ARTHUR_ORCHESTRATION_FOLDER` set to its folder
// (coordinator.ts), `on` the messages of its turn in progress, the event numbers in the names of `inbox/turn/` (`<seq>-<ms>`);
// nothing in any other process.
export function actor(sessions: readonly Session[]): () => { readonly actor: string; readonly on: readonly number[] } | undefined {
	return () => {
		const session = sessionOf(sessions);
		if (session === undefined) return undefined;
		const turn = join(session.folder, "inbox", "turn");
		const names = existsSync(turn) ? readdirSync(turn) : [];
		return { actor: session.name, on: names.flatMap((name) => (/^\d+-\d+$/.test(name) ? [Number(name.split("-")[0])] : [])).sort((a, b) => a - b) };
	};
}
