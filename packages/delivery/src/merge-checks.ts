import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The steps `arthur merge` runs on main once the branch is in (spec/roadmap.md, entry 54): the project's install, as the
// projects plugin answers `projects.install` for the merge commit, the one a new worktree gets, then the `check` and `test`
// scripts main's package.json declares, as `npm run check` and `npm test`, each on the PATH the nvm plugin answers
// `nvm.path` for main's checkout, the one a worktree there gets. docs/commands/merge.md, "Checks on main".

// A step's `install` marks an install that ran. `Ask` is what other plugins answer for the project: `install`, its install at a
// commit (`projects.install`), "" none; `path`, the PATH of its checkout (`nvm.path`), "" the PATH as it is.
export type Step = { readonly command: string; readonly result: string; readonly install?: true };
type Ask = { readonly install: (commit: string) => string; readonly path: () => string };
// Runs one step's command in main's checkout with `env`, as `stepRunner` makes it.
type Run = (command: string, env: NodeJS.ProcessEnv) => SpawnSyncReturns<string>;
// Up to 64 MiB of a step's output is read, a whole test run's.
const MAX_BUFFER = 64 * 2 ** 20;

// How the steps of one merge run in `root` (AR0373): each in a transient scope of its own under the jobs' slice `slice`, as a
// job runs, stopped once the step ended, so what its scripts leave behind is killed; with no user manager to make one (the
// probe's systemd-run fails), bare, which one `uncapped:` line says.
export function stepRunner(root: string, slice: string, log: (line: string) => void): Run {
	const scope = (unit: string) => ["--user", "--scope", "--quiet", "--collect", `--slice=${slice}.slice`, `--unit=${unit}`, "-p", "KillSignal=SIGKILL", "--"];
	const probe = spawnSync("systemd-run", [...scope(`arthur-merge-${process.pid}-0.scope`), "true"], { encoding: "utf8" });
	const bare = probe.error?.message ?? (probe.status === 0 ? undefined : probe.stderr.trim().split("\n")[0] || `systemd-run exited ${probe.status ?? probe.signal}`);
	if (bare !== undefined) log(`uncapped: no systemd scope (${bare}); the steps run bare, outside the jobs' slice, and what they leave behind is not killed`);
	let count = 0;
	return (command, env) => {
		const options = { cwd: root, env, encoding: "utf8", maxBuffer: MAX_BUFFER } as const;
		if (bare !== undefined) return spawnSync("sh", ["-c", command], options);
		const unit = `arthur-merge-${process.pid}-${++count}.scope`;
		try {
			return spawnSync("systemd-run", [...scope(unit), "sh", "-c", command], options);
		} finally {
			spawnSync("systemctl", ["--user", "stop", unit], { stdio: "ignore" });
		}
	};
}

// Each step in order, its output's last 20 lines printed when it fails; no PATH, a failed install or a broken package.json ends them.
export function mainChecks(root: string, ask: Ask, run: Run, log: (line: string) => void): Step[] {
	const { env, steps } = installed(ask, run, log);
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
	return [...steps, ...checks.map((command) => step(run, command, env, log))];
}

export const failed = (each: Step): boolean => each.result.startsWith("failed");

// After main was reset: main's own install run again, on main's own PATH, when the failed run had run the merge commit's.
export function reinstall(ask: Ask, run: Run, steps: readonly Step[], log: (line: string) => void): string {
	if (!steps.some((each) => each.install)) return "";
	const again = installed(ask, run, log, "reinstall of main's dependencies, ").steps;
	return again.some(failed) ? `, but reinstalling main's dependencies failed (${again.filter(failed).map((each) => each.command).join(", ")}): they still hold the branch's install` : "";
}

// Main's environment, its PATH `ask.path` when not "", and the install of its HEAD as a step, none for ""; an answer that throws
// (nvm's Node not installed, two lockfiles, no provider) is a failed step, `node` or `install`, that ran nothing.
function installed(ask: Ask, run: Run, log: (line: string) => void, prefix = ""): { readonly env: NodeJS.ProcessEnv; readonly steps: Step[] } {
	let [env, command] = [process.env, "node"];
	try {
		const PATH = ask.path();
		if (PATH !== "") env = { ...env, PATH };
		command = "install";
		const install = ask.install("HEAD");
		return { env, steps: install === "" ? [] : [{ ...step(run, install, env, log, prefix), install: true }] };
	} catch (error) {
		const result = `failed, ${error instanceof Error ? error.message : String(error)}.`;
		log(`${prefix}${command}: ${result}`);
		return { env, steps: [{ command, result }] };
	}
}

// `passed.`, `12/12 passed.` or `failed, 11/12 passed.`: the counts from node --test's last summary, when it printed one.
function step(run: Run, command: string, env: NodeJS.ProcessEnv, log: (line: string) => void, prefix = ""): Step {
	const ran = run(command, env);
	const out = [ran.stdout, ran.stderr, ran.error?.message].filter(Boolean).join("\n");
	const [total, pass] = [/^\S+ tests (\d+)$/gm, /^\S+ pass (\d+)$/gm].map((pattern) => [...out.matchAll(pattern)].at(-1)?.[1]);
	const count = total !== undefined && pass !== undefined ? `${pass}/${total} passed` : "";
	const result = ran.status === 0 ? `${count || "passed"}.` : `failed${count ? `, ${count}` : ""}.`;
	log(`${prefix}${command}: ${result}`);
	if (ran.status !== 0) log(out.trimEnd().split("\n").slice(-20).join("\n"));
	return { command, result };
}
