import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { JobRecord } from "@arthur/core/plugin";

// herdr 0.9.3's CLI as the herdr plugin calls it (AR0670): one `herdr <args>` at a time, its answer `{ id, result }` on stdout,
// a server's refusal on stderr with exit code 1; the `arthur` workspace, its `coordinator` tab and a tab per job. docs/herdr.md.

// The seconds a call may take before it is killed; the doctor's line names them.
export const LIMIT_SECONDS = 5;
export const WORKSPACE = "arthur";
export const ATTACH = "while :; do arthur attach; sleep 5; done";

type Tab = { readonly tab_id: string; readonly label: string };
type Pane = { readonly pane_id: string; readonly tab_id: string };
// The keys of herdr's results the plugin reads, from herdr's own output: one it lacks fails that call's task.
type Result = {
	readonly workspaces?: readonly { readonly workspace_id: string; readonly label: string }[];
	readonly workspace?: { readonly workspace_id: string };
	readonly tabs?: readonly Tab[];
	readonly tab?: Tab;
	readonly panes?: readonly Pane[];
	readonly root_pane?: Pane;
};
// The `arthur` workspace's id, and its tabs by the last word of their label, a job tab's short id, each with its first pane.
export type Space = { readonly id: string; readonly tabs: ReadonlyMap<string, { readonly tab: string; readonly pane: string }> };

const run = promisify(execFile);

// Rejects naming the call: herdr not on PATH, its stderr's first line, or no answer within LIMIT_SECONDS.
export async function call(args: readonly string[]): Promise<Result> {
	try {
		const { stdout } = await run("herdr", args, { timeout: LIMIT_SECONDS * 1000, killSignal: "SIGKILL" });
		const answer: { readonly result?: Result } = JSON.parse(stdout);
		return answer.result ?? {};
	} catch (error) {
		const failed = error as NodeJS.ErrnoException & { readonly killed?: boolean; readonly stderr?: string };
		if (failed.code === "ENOENT") throw new Error("herdr not found on PATH");
		const named = `herdr ${args.slice(0, 2).join(" ")}`;
		if (failed.killed === true) throw new Error(`${named} did not answer in ${LIMIT_SECONDS} s`);
		throw new Error(`${named}: ${failed.stderr?.split("\n").find((line) => line.trim() !== "") ?? failed.message}`);
	}
}

export const short = (id: string): string => id.slice(-8);

// `<ticket> <kind> <short id>`, the ticket the first one the task names in `spec/features/`, left out when none.
export function label(job: JobRecord): string {
	const ticket = job.tickets.map((path) => /(?:^|\/)([A-Z]+\d{4,})-[^/]*\/[^/]*$/.exec(path)?.[1]).find(Boolean);
	return [ticket, job.kind, short(job.id)].filter(Boolean).join(" ");
}

// The `arthur` workspace; with `create`, made when missing (a herdr started since) and given its `coordinator` tab running
// `arthur attach` again after each coordinator restart, a first tab renamed, else a new one.
export function space(create: true): Promise<Space>;
export function space(create: boolean): Promise<Space | undefined>;
export async function space(create: boolean): Promise<Space | undefined> {
	const found = (await call(["workspace", "list"])).workspaces?.find((each) => each.label === WORKSPACE);
	if (found === undefined && !create) return undefined;
	const made = found === undefined ? await call(["workspace", "create", "--label", WORKSPACE, "--cwd", process.cwd(), "--no-focus"]) : undefined;
	const id = found?.workspace_id ?? made?.workspace?.workspace_id ?? "";
	const tabs = (await call(["tab", "list", "--workspace", id])).tabs ?? [];
	const panes = (await call(["pane", "list", "--workspace", id])).panes ?? [];
	if (create && !tabs.some((tab) => tab.label === "coordinator")) {
		const at = made ?? (await call(["tab", "create", "--workspace", id, "--label", "coordinator", "--cwd", process.cwd(), "--no-focus"]));
		if (made !== undefined) await call(["tab", "rename", made.tab?.tab_id ?? "", "coordinator"]);
		await call(["pane", "run", at.root_pane?.pane_id ?? "", ATTACH]);
	}
	return { id, tabs: new Map(tabs.map((tab) => [tab.label.split(" ").at(-1) ?? "", { tab: tab.tab_id, pane: panes.find((each) => each.tab_id === tab.tab_id)?.pane_id ?? "" }])) };
}

// Each job state as herdr's sidebar shows it: herdr 0.9.3 takes idle, working, blocked or unknown; an ended job is `idle`.
const REPORTS: Readonly<Record<string, (reason: string) => readonly string[]>> = {
	working: () => ["working"],
	idle: () => ["working", "--message", "idle"],
	blocked: (reason) => ["blocked", "--message", reason],
	ended: (reason) => ["idle", "--message", `ended: ${reason}`],
};

export async function report(pane: string, state: string, reason: string): Promise<void> {
	const how = Object.hasOwn(REPORTS, state) ? REPORTS[state]?.(reason) : undefined;
	if (how !== undefined) await call(["pane", "report-agent", pane, "--source", "arthur", "--agent", "arthur", "--state", ...how]);
}
