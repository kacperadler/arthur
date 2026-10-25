import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

// Delivery's OMP extension (spec/roadmap.md, entry 53), which each job's agent loads with `-e` after the core's own
// (`host.jobs.registerExtension`): after each bash call it adds to the job's `checks`, `<home>/delivery/<job>/checks`, what a run
// of the project's own checks said, each line ending with the commit and the tree (`clean`, `dirty`) the call ended on.
// `arthur review-needed` reads it: docs/commands/review-needed.md, "The job's checks".

type Script = "check" | "test";
type ToolResult = { readonly toolName?: unknown; readonly input?: { readonly command?: unknown }; readonly content?: unknown; readonly details?: { readonly async?: unknown }; readonly isError?: unknown };
type ExtensionApi = { on(event: "tool_result", handler: (event: ToolResult, ctx: { readonly cwd: string }) => void): void };

export default function checks(pi: ExtensionApi): void {
	const record = process.env.ARTHUR_JOB;
	if (record === undefined || record === "") return;
	// The job's record is `<home>/jobs/<id>`, and delivery's folder `<home>/delivery`.
	const file = join(dirname(dirname(record)), "delivery", basename(record), "checks");
	pi.on("tool_result", (event, ctx) => {
		const lines = event.toolName === "bash" ? ran(event, ctx.cwd) : [];
		if (lines.length === 0) return;
		// The worktree's HEAD and whether a tracked file differs from it (an untracked one is on no branch); outside Git, no line.
		const git = (...words: string[]) => spawnSync("git", ["--no-optional-locks", "-C", ctx.cwd, ...words], { encoding: "utf8" });
		const [head, status] = [git("rev-parse", "HEAD"), git("status", "--porcelain", "--untracked-files=no")];
		if (head.status !== 0 || status.status !== 0) return;
		mkdirSync(dirname(file), { recursive: true });
		appendFileSync(file, lines.map((line) => `${line} ${head.stdout.trim()} ${status.stdout === "" ? "clean" : "dirty"}\n`).join(""));
	});
}

// The lines of one bash call: `check pass|fail` per `npm run check`, `test pass|fail <passed>/<total>` per `npm test` (`npm t`,
// `npm run test`), in the command's order, for the scripts the worktree's package.json declares; any other command, or a call
// the bash tool moved to the background (it returned before the checks did), none. Commands joined by `;`, `&&` or `|` give one
// exit status, so the output decides too: a check fails on a TypeScript error; a test takes pass or fail from node --test's
// last summary (`fail 0` passes), and from the exit status without one.
function ran(event: ToolResult, cwd: string): string[] {
	const command = event.input?.command;
	if (typeof command !== "string" || event.details?.async !== undefined) return [];
	const scripts = declared(cwd);
	const runs = Array.from(command.matchAll(/(?:^|[;&|(\n])\s*npm\s+(test|t|run\s+test|run\s+check)(?=$|[\s;&|)])/g), (match): Script => ((match[1] ?? "").endsWith("check") ? "check" : "test")).filter((name) => scripts.includes(name));
	const output = Array.isArray(event.content) ? event.content.map((part: { readonly text?: unknown }) => (typeof part?.text === "string" ? part.text : "")).join("\n") : "";
	const failed = event.isError === true;
	const count = (word: string) => Array.from(output.matchAll(new RegExp(`^\\S+ ${word} (\\d+)\\s*$`, "gm"))).at(-1)?.[1];
	const [tests, passed, failures] = [count("tests"), count("pass"), count("fail")];
	return runs.map((name) => {
		if (name === "check") return `check ${failed || /\berror TS\d+|^error:/m.test(output) ? "fail" : "pass"}`;
		if (tests === undefined || passed === undefined || failures === undefined) return `test ${failed ? "fail" : "pass"}`;
		return `test ${failures === "0" ? "pass" : "fail"} ${passed}/${tests}`;
	});
}

// The `check` and `test` scripts the package.json in `worktree` declares; a missing or broken one declares none.
function declared(worktree: string): Script[] {
	try {
		const { scripts } = JSON.parse(readFileSync(join(worktree, "package.json"), "utf8")) as { readonly scripts?: Readonly<Record<string, unknown>> };
		return (["check", "test"] as const).filter((name) => typeof scripts?.[name] === "string");
	} catch {
		return [];
	}
}
