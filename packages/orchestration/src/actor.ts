import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// What orchestration answers as `actor` (the core's stamp, docs/plugin-api.md): `coordinator` in a process of the coordinator's
// session, which alone has `ARTHUR_ORCHESTRATION_FOLDER` set to this folder (coordinator.ts), `on` the messages of its turn in
// progress, the event numbers in the names of `inbox/turn/` (`<seq>-<ms>`); nothing in any other process.
export function actor(folder: string): () => { readonly actor: string; readonly on: readonly number[] } | undefined {
	return () => {
		if (process.env.ARTHUR_ORCHESTRATION_FOLDER !== folder) return undefined;
		const turn = join(folder, "inbox", "turn");
		const names = existsSync(turn) ? readdirSync(turn) : [];
		return { actor: "coordinator", on: names.flatMap((name) => (/^\d+-\d+$/.test(name) ? [Number(name.split("-")[0])] : [])).sort((a, b) => a - b) };
	};
}
