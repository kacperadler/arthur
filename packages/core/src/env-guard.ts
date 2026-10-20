import { envRefusal } from "./env-refusal.ts";

// The env guard (spec/roadmap.md, entry 19): an OMP extension, loaded into every job by the wrapper with `-e` and published
// as `@arthur/core/env-guard` for the coordinator, that refuses a tool call naming a secrets file before the tool runs
// (env-refusal.ts).

type Verdict = { block: true; reason: string } | undefined;
type ExtensionApi = { on(event: "tool_call", handler: (event: { readonly toolName: string; readonly input: Readonly<Record<string, unknown>> }) => Verdict): void };

// `tool_call` fires before the tool runs, and a handler that throws blocks the call too.
export default function envGuard(pi: ExtensionApi): void {
	pi.on("tool_call", (event) => {
		const reason = envRefusal(event.toolName, event.input);
		return reason === undefined ? undefined : { block: true, reason };
	});
}
