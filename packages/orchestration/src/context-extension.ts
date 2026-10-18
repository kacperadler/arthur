import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";

// The coordinator's context on every turn (spec/roadmap.md, entry 25), the agent's side: an OMP extension the coordinator's
// `omp` loads with `-e`. Before each turn it runs the command `ARTHUR_ORCHESTRATION_CONTEXT` holds (a JSON list: node, the
// CLI, `coordinator`, `context`) and adds what it prints to the system prompt; when that fails, the shipped role and why:
// docs/commands/coordinator.md, "The coordinator's context".

type Prompt = { readonly systemPrompt: readonly string[] };
type ExtensionApi = { on(event: "before_agent_start", handler: (event: Prompt, ctx: { readonly hasUI: boolean }) => Promise<Prompt | undefined>): void };

const ROLE = new URL("../roles/coordinator.md", import.meta.url);
const TIMEOUT_MS = 60_000;

export default function context(pi: ExtensionApi): void {
	const command = process.env.ARTHUR_ORCHESTRATION_CONTEXT ?? "";
	if (command === "") return;
	const [file = "", ...args] = JSON.parse(command) as string[];
	pi.on("before_agent_start", async (event, ctx) => {
		// Not in a session without a UI: a `task` subagent is not the coordinator.
		if (!ctx.hasUI) return undefined;
		try {
			const { stdout } = await promisify(execFile)(file, args, { encoding: "utf8", timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
			return { systemPrompt: [...event.systemPrompt, stdout.trim()] };
		} catch (error) {
			const { stderr = "", message } = error as { stderr?: string; message: string };
			const failed = `## Context\n\nArthur could not build your context this turn (the board, the visions, the time): ${stderr.trim() || message}\n\nSay so in your reply.`;
			return { systemPrompt: [...event.systemPrompt, readFileSync(ROLE, "utf8").trim(), failed] };
		}
	});
}
