import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The steps `arthur merge` runs on main once the branch is in (spec/roadmap.md, entry 54): the install, when the merge changed a
// known lockfile at the top of the repository, then the `check` and `test` scripts main's package.json declares, as
// `npm run check` and `npm test`. docs/commands/merge.md, "Checks on main".

export type Step = { readonly command: string; readonly result: string };

// The frozen install of each lockfile, as the projects plugin installs a new worktree.
const LOCKFILES: Readonly<Record<string, string>> = {
	"bun.lock": "bun install --frozen-lockfile",
	"package-lock.json": "npm ci",
	"pnpm-lock.yaml": "pnpm install --frozen-lockfile",
	"composer.lock": "composer install",
	"uv.lock": "uv sync --frozen",
};
// Up to 64 MiB of a step's output is read, a whole test run's.
const MAX_BUFFER = 64 * 2 ** 20;

// Each step in order, its output's last 20 lines printed when it fails; a failed install or a broken package.json ends them.
export function mainChecks(root: string, before: string, log: (line: string) => void): Step[] {
	const steps = installs(root, ["diff", "--name-only", before, "HEAD", "--", ...Object.keys(LOCKFILES)]).map((command) => step(root, command, log));
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

// After main was reset: main's own lockfile installed again, when the failed run had installed the branch's.
export function reinstall(root: string, steps: readonly Step[], log: (line: string) => void): string {
	if (!steps.some((each) => Object.values(LOCKFILES).includes(each.command))) return "";
	const again = installs(root, ["ls-files", "--", ...Object.keys(LOCKFILES)]).map((command) => step(root, command, log, "reinstall of main's dependencies, "));
	return again.some(failed) ? `, but reinstalling main's dependencies failed (${again.filter(failed).map((each) => each.command).join(", ")}): they still hold the branch's install` : "";
}

// The installs of the lockfiles `git <words>` names, in the table's order.
function installs(root: string, words: readonly string[]): string[] {
	const named = spawnSync("git", ["-C", root, ...words], { encoding: "utf8" }).stdout.split("\n");
	return Object.entries(LOCKFILES).flatMap(([lock, command]) => (named.includes(lock) ? [command] : []));
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
