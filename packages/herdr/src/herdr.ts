import type { OptionTable, Tool } from "@arthur/core/option-table";
import type { Host, JobRecord, OptionProblem, Options, Plugin, Requirement } from "@arthur/core/plugin";
import { call, label, LIMIT_SECONDS, report, short, type Space, space } from "./herdr-cli.ts";

// The herdr plugin (spec/roadmap.md, entry 115): each job in a run a tab of the `arthur` workspace in herdr on this server,
// running `arthur jobs --follow <id>`, its state in herdr's sidebar, the tab closed by its prune; a `coordinator` tab running
// `arthur attach`. Only `arthur run` acts, once started; herdr missing or down costs nothing but its doctor line. docs/herdr.md.

// Its options file too (`./options`), which `arthur setup` reads: what it is in one line, the tools it runs, its options.
export const summary = "herdr: each job a tab in herdr on this server, its live log and its state in herdr's sidebar";

export const tools: readonly Tool[] = [{ name: "herdr", version: ["herdr", "--version"] }];

export const table: OptionTable = {};

export function checkOptions(options: Options): OptionProblem[] {
	return Object.keys(options).map((key) => ({ path: key, problem: "unknown option; herdr has no options but enabled" }));
}

const requirements = (): Requirement[] => [
	{
		name: "herdr",
		async check() {
			try {
				await call(["workspace", "list"]);
				return "ok";
			} catch (error) {
				return `missing: ${(error as Error).message}`;
			}
		},
		costs: `no herdr tab per job: the jobs run as always, each herdr call giving up within ${LIMIT_SECONDS} s`,
		fix: "install herdr 0.9.3 into ~/.local/bin and keep its server running (packages/herdr/docs/herdr.md)",
		critical: false,
	},
];

// In a run: its wrapper runs, or a plugin holds it.
const inRun = (job: JobRecord): boolean => job.state === "working" || job.state === "idle" || job.hold !== "";
// A text field of an event's data, "" when it has none.
const text = (data: unknown, key: string): string => {
	const value: unknown = typeof data === "object" && data !== null ? Reflect.get(data, key) : undefined;
	return typeof value === "string" ? value : "";
};

// A job's tab, a new one, the one it had closed first, running its follow view, then its state reported.
async function open(at: Space, job: JobRecord): Promise<void> {
	const before = at.tabs.get(short(job.id));
	if (before !== undefined) await call(["tab", "close", before.tab]);
	const made = await call(["tab", "create", "--workspace", at.id, "--label", label(job), "--cwd", process.cwd(), "--no-focus"]);
	const pane = made.root_pane?.pane_id ?? "";
	await call(["pane", "run", pane, `arthur jobs --follow ${job.id}`]);
	await report(pane, job.state, job.reason);
}

export function herdr(options: { readonly enabled?: boolean } = {}): Plugin {
	let host: Host | undefined;
	let started = false;
	// Every herdr call in one chain, in the order asked, so a state never reaches herdr before its tab; a failure ends that task alone.
	let chain = Promise.resolve();
	const queue = (task: () => Promise<void>): Promise<void> => (chain = chain.then(task).catch(() => {}));
	const record = (data: unknown) => host?.jobs.list().find((job) => job.id === text(data, "id"));
	return {
		name: "herdr",
		module: import.meta.url,
		options,
		check: checkOptions,
		doctor: requirements,
		setup(given) {
			host = given;
			// Before `start`, an event is a replay at `arthur run`'s start or one in another `arthur` process: the start-up pass covers it.
			given.events.on("job-started", ({ data }) => {
				const job = started ? record(data) : undefined;
				if (job !== undefined && inRun(job)) void queue(async () => open(await space(true), job));
			});
			given.events.on("job-state", ({ data }) => {
				if (started) void queue(async () => {
					const pane = (await space(true)).tabs.get(short(text(data, "id")))?.pane;
					if (pane !== undefined) await report(pane, text(data, "to"), text(data, "reason"));
				});
			});
			// In whichever process prunes, started or not; it never makes the workspace.
			given.jobs.cleanup((job) => queue(async () => {
				const tab = (await space(false))?.tabs.get(short(job.id))?.tab;
				if (tab !== undefined) await call(["tab", "close", tab]);
			}));
		},
		start() {
			started = true;
			const jobs = host?.jobs.list() ?? [];
			void queue(async () => {
				const at = await space(true);
				for (const job of jobs) {
					const pane = at.tabs.get(short(job.id))?.pane;
					if (inRun(job)) await open(at, job);
					else if (pane !== undefined) await report(pane, job.state, job.reason);
				}
			});
		},
	};
}
