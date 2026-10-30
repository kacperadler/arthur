// Why a job's run ended, the `reason` its state says (docs/commands/spawn.md), and the one resume a second try may mend.

export type Why = "time" | "budget" | "memory" | "stop";
// What stopped the job first (wrapper.ts `halt`), how its agent ended, and its run record's `stopped` and `result` (run-record.ts).
export type Ending = Readonly<{ why: Why | undefined; playing: boolean; timeout: string; cost: number; budgetUsd: number; overCap: string; failure: Error | undefined; killed: NodeJS.Signals | null; code: number | null; stopped: string; result: string; verdicts: string }>;

export function reason({ why, playing, timeout, cost, budgetUsd, overCap, failure, killed, code, stopped, result, verdicts }: Ending): string {
	return why === "stop" ? "stopped"
		: why === "time" ? `limit: time: the job ran past its timeout of ${timeout} minutes${playing ? "" : ", during its install"}`
		: why === "budget" ? `limit: budget: its cost $${cost.toFixed(4)} reached its budget of $${budgetUsd}`
		: why === "memory" ? `limit: memory: ${overCap}`
		: failure !== undefined ? `failed: the agent did not start: ${failure.message}`
		: killed !== null ? `failed: the agent was killed by ${killed}`
		: stopped !== "" ? `failed: the agent stopped on ${stopped}`
		: code !== 0 ? `failed: the agent exited ${code}`
		: result === "" ? "failed: the agent ended without a final message"
		: verdicts !== "" && !verdicts.split("\n").includes(result.trimEnd().split("\n").at(-1)?.trim() ?? "") ? `failed: no verdict: the last line of its final message is not ${verdicts.split("\n").join(" or ")} alone`
		: "finished";
}

// The message of the one resume (`--continue`) after a provider error omp gave up on (job-omp.yml), a connection error, an overload
// or a 5xx, but no cyber refusal, or a final message without the kind's verdict; none after any other ending, an abort included.
export function resumeFor(ending: string, verdicts: string): string | undefined {
	const error = /^failed: the agent stopped on error: (.*)$/s.exec(ending)?.[1] ?? "";
	if (/connection.?error|overloaded|\b5\d\d\b/i.test(error) && !/cyber/i.test(error)) return "Your run stopped on a provider error; Arthur resumes it once. Go on with the task where you stopped.";
	if (ending.startsWith("failed: no verdict: "))
		return `Your final message did not end on a verdict; Arthur resumes the run once. Write your final message again, its last line exactly ${verdicts.split("\n").join(" or ")}, alone.`;
	return undefined;
}
