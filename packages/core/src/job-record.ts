import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { taskTickets } from "./board-jobs.ts";
import { branchExists } from "./git.ts";
import { guardedPlaces } from "./job-place.ts";
import type { Caps } from "./job-scope.ts";
import type { Job, Spawn } from "./jobs.ts";
import type { McpServers } from "./roles.ts";

// The job record `<home>/jobs/<id>/` (spec/roadmap.md, entries 9 and 10) as the spawn writes it, one file per key; the
// wrapper (entry 11) adds the files of the run.

// What the record keeps of the job's kind (job-kinds.ts) and of the extensions the plugins registered, which the wrapper reads.
export type Own = { readonly resumeOnBudget: boolean; readonly verdicts: readonly string[]; readonly extensions: readonly string[] };

// Written into `.<id>` and renamed, so a reader sees all of it or nothing. An empty `branch`, `model`, `model-why`, `thinking`,
// `quick`, `cpu`, `memory`, `feature`, `feature-cpu` or `feature-memory` is none; `model-why` says why the model was picked from
// its list (job-model.ts); `prompt` is the role's; `resume-on-budget` is `true` when the kind asks for one resume at its budget,
// `verdicts` the lines its final message may end on, empty for any; `extensions` one `extensionPath` per line, empty for none; the caps are the job's own and its ticket's slice's (job-scope.ts);
// `cost` starts at 0, so a missing one is a broken record; `free` is `true` for a model that costs nothing (job-model.ts).
// A job starts `working` (job-state.ts) at `since`; `idle-minutes` is the core's `jobs.idleMinutes`; `projects` is every
// project's main checkout, `checkouts` (job-checkout.ts), and `guarded` the places outside them (job-place.ts): Arthur's
// install, the user's own files and, with `config`, the config's folder and env file; the worktree guard refuses them too.
// With `mcp`, the role's MCP servers (`writeMcp`). `task`, what omp gets, has a word joiner before each `@` omp 18.3.0 reads a file for with no option to stop it (`@<path>` at the start or after whitespace or ( [ { < " ' `: its utils/file-mentions.ts), as orchestration's hand-over.ts does, so a final message the task quotes makes the job's session read no file (AR0537).
export function writeRecord(home: string, job: Job, prompt: string, kind: Own, idleMinutes: number, since: Date, projects: string, config: Parameters<typeof guardedPlaces>[0], mcp?: McpServers): void {
	const folder = join(home, "jobs");
	const temporary = join(folder, `.${job.id}`);
	mkdirSync(temporary, { recursive: true });
	writeMcp(temporary, mcp);
	const record = {
		task: job.task.replace(/(?<=^|[\s([{<"'`])@/g, "\u2060@"), kind: job.kind, project: job.project, model: job.model ?? "", "model-why": job.modelWhy ?? "", thinking: job.thinking ?? "", quick: job.quick ?? "", prompt,
		timeout: String(job.timeoutMinutes), budget: String(job.budgetUsd), free: String(job.free), "resume-on-budget": String(kind.resumeOnBudget), verdicts: kind.verdicts.join("\n"), ...capFields(job), cost: "0.0000",
		"idle-minutes": String(idleMinutes), branch: job.branch ?? "", root: job.root, base: job.base, worktree: job.worktree, machine: job.machine, projects, guarded: guardedPlaces(config), extensions: kind.extensions.join("\n"),
		reason: "", since: since.toISOString(), state: "working",
	};
	for (const [name, value] of Object.entries(record)) writeFileSync(join(temporary, name), value);
	renameSync(temporary, join(folder, job.id));
}

// The role's MCP servers (AR0234), if any, in the record `folder` at the spawn and each `arthur continue`: `mcp/` for omp's
// `--plugin-dir`, its `.mcp.json` readable by its owner only, and `mcp.yml`, the overlay that keeps a read-only role's `--tools`
// without `write`. Any job of the user can read `mcp/`, so each end of a run removes it before `state` (AR0337).
export function writeMcp(folder: string, mcp: McpServers | undefined): void {
	if (!mcp) return;
	mkdirSync(join(folder, "mcp", ".claude-plugin"), { recursive: true });
	writeFileSync(join(folder, "mcp", ".claude-plugin", "plugin.json"), '{ "name": "arthur" }\n');
	writeFileSync(join(folder, "mcp", ".mcp.json"), `${JSON.stringify({ mcpServers: mcp }, null, "\t")}\n`, { mode: 0o600 });
	writeFileSync(join(folder, "mcp.yml"), "tools:\n  xdev: false\n");
}

// The record's files of a job's caps, `arthur continue` writing them anew from what `jobs.limits` answers then.
export function capFields(caps: Caps): Readonly<Record<string, string>> {
	return { cpu: String(caps.cpu ?? ""), memory: caps.memory ?? "", feature: caps.feature?.name ?? "", "feature-cpu": String(caps.feature?.cpu ?? ""), "feature-memory": caps.feature?.memory ?? "" };
}

// A registered extension's module as the record keeps it, its path from the core's `src/`, where the wrapper resolves it: so it
// holds on another machine, whose Arthur is a checkout of the same commit (docs/deploy.md). Refused unless a file exists there.
export function extensionPath(url: URL): string {
	if (!(url instanceof URL) || url.protocol !== "file:" || !existsSync(url)) throw new Error(`extension ${String(url)}: expected the file: URL of a module that exists, as new URL("./<file>.ts", import.meta.url) gives`);
	return relative(import.meta.dirname, fileURLToPath(url));
}

// The job as its record `field` reads it, for `arthur continue` (job-control.ts): the `beforeSpawn` checks and the prepares.
export function recordedJob(id: string, field: (name: string) => string): Job {
	const or = (name: string) => field(name) || undefined;
	const [cpu, featureCpu] = [field("cpu"), field("feature-cpu")];
	const [task, feature] = [field("task"), or("feature")];
	return {
		id, task, kind: field("kind"), project: field("project"), model: or("model"), modelWhy: or("model-why"), thinking: or("thinking"), quick: or("quick"),
		timeoutMinutes: Number(field("timeout")), budgetUsd: Number(field("budget")), free: field("free") === "true", tickets: taskTickets(task), machine: field("machine") || "local", ignoreRestart: false,
		cpu: cpu === "" ? undefined : Number(cpu), memory: or("memory"), feature: feature === undefined ? undefined : { name: feature, cpu: featureCpu === "" ? undefined : Number(featureCpu), memory: or("feature-memory") },
		root: field("root"), base: field("base"), branch: or("branch"), worktree: field("worktree"),
	};
}

// A free id, `<date>-<kind>-<8 hex digits>`: no record, worktree or branch of that name exists yet. The worktree goes beside
// `place`, the repository it is added to: `root`, or the project's repository on another machine.
export function newJob(home: string, date: string, spawn: Spawn & Caps, root: string, base: string, readOnly: boolean, place: string): Job {
	for (;;) {
		const random = Buffer.from(crypto.getRandomValues(new Uint8Array(4))).toString("hex");
		const id = `${date}-${spawn.kind}-${random}`;
		const branch = readOnly ? undefined : `arthur/${id}`;
		const worktree = join(dirname(place), ".arthur-worktrees", id);
		if (existsSync(join(home, "jobs", id)) || existsSync(worktree) || (branch !== undefined && branchExists(root, branch))) continue;
		return { ...spawn, id, root, base, branch, worktree };
	}
}
