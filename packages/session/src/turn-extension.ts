import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { redact } from "./credential.ts";

// A coordinator turn that failed before any text (spec/roadmap.md, entry 38): an OMP extension that orchestration loads into
// the coordinator's agent for the session plugin (`coordinator.extension`). At the end of a turn whose last message is an
// error and none of whose replies held text, it leaves omp's error, its credentials redacted, in `turn-failed/` of the folder
// `ARTHUR_SESSION_FOLDER` names, one file per turn, which `arthur run` sends as a notice (start-notice.ts): docs/session.md.

type Said = { readonly role?: string; readonly stopReason?: string; readonly errorMessage?: string; readonly content?: readonly { readonly type?: string; readonly text?: string }[] };
type ExtensionApi = {
	on(event: "agent_end", handler: (event: { readonly messages?: readonly Said[]; readonly willContinue?: boolean }, ctx: { readonly hasUI: boolean }) => void): void;
};

export default function turnFailures(pi: ExtensionApi): void {
	const folder = process.env.ARTHUR_SESSION_FOLDER ?? "";
	if (folder === "") return;
	let written = 0;
	pi.on("agent_end", (event, ctx) => {
		// Only in the coordinator's own session, one with a UI, and at the turn's real end.
		if (!ctx.hasUI || event.willContinue === true) return;
		const messages = event.messages ?? [];
		const turn = messages.slice(messages.findLastIndex((message) => message.role === "user") + 1);
		const last = turn.at(-1);
		if (last?.role !== "assistant" || last.stopReason !== "error") return;
		if (turn.some((message) => message.role === "assistant" && (message.content ?? []).some((block) => block.type === "text" && (block.text ?? "").trim() !== ""))) return;
		const failed = join(folder, "turn-failed");
		const name = `${Date.now()}-${process.pid}-${++written}.txt`;
		mkdirSync(failed, { recursive: true });
		writeFileSync(join(failed, `.${name}`), redact(last.errorMessage ?? ""));
		renameSync(join(failed, `.${name}`), join(failed, name));
	});
}
