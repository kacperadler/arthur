import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The steps `arthur merge` runs on main once the branch is in (spec/roadmap.md, entry 54): the project's install, as the
// projects plugin answers `projects.install` for the merge commit, the one a new worktree gets, then the `check` and `test`
// scripts main's package.json declares, as `npm run check` and `npm test`. docs/commands/merge.md, "Checks on main".

// A step's `install` marks an install that ran; `Install` is `projects.install` for the project: its install at a commit, "" none.
export type Step = { readonly command: string; readonly result: string; readonly install?: true };
type Install = (commit: string) => string;
// Up to 64 MiB of a step's output is read, a whole test run's.
const MAX_BUFFER = 64 * 2 ** 20;

// Each step in order, its output's last 20 lines printed when it fails; a failed install or a broken package.json ends them.
export function mainChecks(root: string, install: Install, log: (line: string) => void): Step[] {
	const steps = installed(root, install, log);
	if (steps.some(failed)) return steps;
	const path = join(root, "package.json");
	let parsed: unknown = {};
	try {
		if (existsSync(path)) parsed = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		const result = `failed, not JSON (${error instanceof Error ? error.message : String(error)}).`;
		log(`package.json: ${result}`);
		return [...steps, { command: "package.json", result }];
	}
	const scripts: Readonly<Record<string, unknown>> = typeof parsed === "object" && parsed !== null && "scripts" in parsed && typeof parsed.scripts === "object" && parsed.scripts !== null ? Object.fromEntries(Object.entries(parsed.scripts)) : {};
	const checks = [typeof scripts.check === "string" ? "npm run check" : "", typeof scripts.test === "string" ? "npm test" : ""].filter(Boolean);
	return [...steps, ...checks.map((command) => step(root, command, log))];
}

export const failed = (each: Step): boolean => each.result.startsWith("failed");

// After main was reset: main's own install run again, when the failed run had run the merge commit's.
export function reinstall(root: string, install: Install, steps: readonly Step[], log: (line: string) => void): string {
	if (!steps.some((each) => each.install)) return "";
	const again = installed(root, install, log, "reinstall of main's dependencies, ");
	return again.some(failed) ? `, but reinstalling main's dependencies failed (${again.filter(failed).map((each) => each.command).join(", ")}): they still hold the branch's install` : "";
}

// The install of main's HEAD as a step, none for ""; an answer that throws (two lockfiles, no provider) fails without running.
function installed(root: string, install: Install, log: (line: string) => void, prefix = ""): Step[] {
	try {
		const command = install("HEAD");
		return command === "" ? [] : [{ ...step(root, command, log, prefix), install: true }];
	} catch (error) {
		const result = `failed, ${error instanceof Error ? error.message : String(error)}.`;
		log(`${prefix}install: ${result}`);
		return [{ command: "install", result }];
	}
}

// `passed.`, `12/12 passed.` or `failed, 11/12 passed.`: the counts from node --test's last summary, when it printed one.
function step(root: string, command: string, log: (line: string) => void, prefix = ""): Step {
	const ran = spawnSync("sh", ["-c", command], { cwd: root, encoding: "utf8", maxBuffer: MAX_BUFFER });
	const out = [ran.stdout, ran.stderr, ran.error?.message].filter(Boolean).join("\n");
	const [total, pass] = [/^\S+ tests (\d+)$/gm, /^\S+ pass (\d+)$/gm].map((pattern) => [...out.matchAll(pattern)].at(-1)?.[1]);
	const count = total !== undefined && pass !== undefined ? `${pass}/${total} passed` : "";
	const result = ran.status === 0 ? `${count || "passed"}.` : `failed${count ? `, ${count}` : ""}.`;
	log(`${prefix}${command}: ${result}`);
	if (ran.status !== 0) log(out.trimEnd().split("\n").slice(-20).join("\n"));
	return { command, result };
}
