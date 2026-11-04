import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkConfig } from "@arthur/core/git-config";
import type { Host } from "@arthur/core/plugin";
import type { Entry } from "./github-command.ts";
import { deleteOnOrigin, git, originBranches } from "./github-git.ts";

// A job's branch on origin (AR0555): deleted once its job is pruned, and `arthur github branch sweep [--dry-run]`, origin's
// `arthur/*` branches whose job is gone and whose tip main holds. `<folder>/pushed/<job id>` holds the tip `github.push`
// last pushed of the job's branch, which the prune may delete although main does not hold it (a dropped ticket's). AR0619:
// a delete git failed is left in `<folder>/pending/<job id>` and tried again each poll for 24 hours.
// docs/github.md, "Branches on origin"; docs/commands/github-branch.md.

// `arthur/<job id>`, the one branch a job's spawn names, `<date>-<kind>-<8 hex digits>` as the core's job ids.
const JOB = /^arthur\/(\d{4}-\d\d-\d\d-[a-z][a-z0-9]*(?:-[a-z0-9]+)*-[0-9a-f]{8})$/;

// After a push of a job's branch: `tip`, what it pushed, written to a temporary name and renamed; any other branch, nothing.
export function recordPush(folder: string, branch: string, tip: string): void {
	const id = JOB.exec(branch)?.[1];
	if (id === undefined) return;
	const file = join(folder, "pushed", id);
	mkdirSync(join(folder, "pushed"), { recursive: true });
	writeFileSync(`${file}.${process.pid}.tmp`, `${tip}\n`);
	renameSync(`${file}.${process.pid}.tmp`, file);
}

// Whether the checkout at `path` has `tip` on its branch, main; a commit it lacks is not.
const inMain = (path: string, tip: string) => git(path, "merge-base", "--is-ancestor", tip, "HEAD") !== undefined;
const mainOf = (path: string) => git(path, "symbolic-ref", "--quiet", "--short", "HEAD") ?? "HEAD";

type Pruned = { readonly id: string; readonly project: string; readonly branch: string };
// A delete left for a failure of git's (`<folder>/pending/<job id>`): its job, the tip it would delete ("" unknown), since when.
type Pending = Pruned & { readonly tip: string; readonly since: string };
const DAY_MS = 24 * 60 * 60 * 1000;

// Whether a try later may delete what `why` kept: git's own failure (no connection, origin unreadable, a timeout), or a
// `[remote rejected]` for a server's error (GitHub's 5xx); never a refusal git's porcelain gave, as `[rejected] (stale info)`.
export const again = (why: string) => !why.startsWith("[") || /^\[remote rejected\] \(.*(?:\b5\d\d\b|server error|unavailable|bad gateway)/i.test(why);

// A record that is not what `settle` writes (broken, edited by hand) is none.
function readPending(folder: string, id: string): Pending | undefined {
	try {
		const { project, branch, tip, since } = JSON.parse(readFileSync(join(folder, "pending", id), "utf8")) as Partial<Pending>;
		if ([project, branch, tip, since].every((value) => typeof value === "string") && Number.isFinite(Date.parse(since ?? ""))) return { id, project, branch, tip, since } as Pending;
	} catch {}
	return undefined;
}

// `jobs.keep`, which the core asks once a prune freed the job's worktree and local branch: never a reason to keep, and the
// job's branch deleted on origin in the background, one prune after the other. And `retry`, which each poll calls first:
// every delete left, queued as a prune again, unless the ones the poll before queued are still on their way.
export function pruned(host: Host, list: readonly Entry[]) {
	let queue = Promise.resolve();
	let busy = false;
	// A throw (a record not written) is the branch's notice; the queue goes on.
	const attempt = (job: Pruned) =>
		void (queue = queue.then(() => settle(host, list, job)).catch((error: Error) => void host.events.emit("notice", { text: `github: ${job.branch} not deleted on origin: ${error.message}` })));
	const keep = (job: Pruned): undefined => {
		if (job.branch !== "") attempt(job);
	};
	const retry = () => {
		if (busy || !existsSync(join(host.folder, "pending"))) return;
		busy = true;
		for (const name of readdirSync(join(host.folder, "pending"))) {
			const job = name.endsWith(".tmp") ? undefined : readPending(host.folder, name);
			if (job !== undefined) attempt(job);
		}
		queue = queue.finally(() => void (busy = false));
	};
	return { keep, retry };
}

// One try at a job's branch: gone, or refused for good, takes its record with it; a refusal is one `notice`. A failure a try
// later may get past is recorded, and told, the first time only; after 24 hours of them, told once more and given up.
async function settle(host: Host, list: readonly Entry[], job: Pruned): Promise<void> {
	const [file, left] = [join(host.folder, "pending", job.id), readPending(host.folder, job.id)];
	const why = await originDelete(host, list, job).catch((error: Error) => error.message);
	const notice = (text: string) => void host.events.emit("notice", { text: `github: ${job.branch} ${text}` });
	if (typeof why === "object" && left === undefined) {
		mkdirSync(join(host.folder, "pending"), { recursive: true });
		const record = { project: job.project, branch: job.branch, tip: why.tip, since: new Date().toISOString() };
		writeFileSync(`${file}.${process.pid}.tmp`, `${JSON.stringify(record)}\n`);
		renameSync(`${file}.${process.pid}.tmp`, file);
		return notice(`not deleted on origin, retrying: ${why.retry}`);
	}
	if (typeof why === "object" && Date.now() - Date.parse(left?.since ?? "") < DAY_MS) return;
	rmSync(file, { force: true });
	if (typeof why === "object") notice(`still on origin after 24 h: ${why.retry}; arthur github branch sweep deletes it once origin answers`);
	else if (why !== undefined) notice(`not deleted on origin: ${why}`);
}

// Why the job's branch stays on origin, undefined once it is gone there: deleted now, or never there (nothing is said);
// `retry` when a try later may get past it, with origin's tip, else the one github pushed ("" for none).
async function originDelete(host: Host, list: readonly Entry[], { id, project, branch }: Pruned): Promise<string | { readonly retry: string; readonly tip: string } | undefined> {
	if (branch !== `arthur/${id}`) return `it is not arthur/${id}, the branch of job ${id}`;
	const path = list.find((each) => each.name === project)?.path;
	if (path === undefined) return `no project ${project}`;
	if (mainOf(path) === branch) return `${path} has it checked out`;
	// A project without origin has no branch there; a config refused is refused again on every try.
	if (git(path, "remote", "get-url", "origin") === undefined) return undefined;
	const { refusal } = checkConfig(path);
	if (refusal !== "") return refusal;
	const record = join(host.folder, "pushed", id);
	const pushed = existsSync(record) ? readFileSync(record, "utf8").trim() : "";
	const listed = await originBranches(path, branch);
	if (typeof listed === "string") return { retry: listed, tip: pushed };
	const tip = listed.get(branch);
	if (tip !== undefined && tip !== pushed && !inMain(path, tip))
		return `origin's tip ${tip.slice(0, 7)} is not the commit Arthur pushed (${pushed.slice(0, 7) || "none recorded"}), nor in ${mainOf(path)}`;
	const why = tip === undefined ? "" : ((await deleteOnOrigin(path, new Map([[branch, tip]]))).get(branch) ?? "");
	if (why !== "") return again(why) ? { retry: why, tip: tip ?? "" } : why;
	rmSync(record, { force: true });
	if (tip !== undefined) console.log(`github: deleted ${branch} on origin (${tip.slice(0, 7)})`);
	return undefined;
}

// `arthur github branch sweep [--dry-run]`: origin's `arthur/*` branches of the project, deleted in one push with a lease each
// when their job is gone and main holds their tip; every other one kept, with why. Writes its output; exit 1 when a delete
// failed, a refused origin throws.
export async function branch(host: Host, entry: Entry, dryRun: boolean): Promise<number> {
	const listed = await originBranches(entry.path, "arthur/");
	if (typeof listed === "string") throw new Error(`origin's branches of project ${entry.name} not listed: ${listed}`);
	if (listed.size === 0) return (console.log(`no arthur/* branches on origin of project ${entry.name}`), 0);
	const jobs = new Set(host.jobs.list().map((job) => job.id));
	const main = mainOf(entry.path);
	const kept = new Map<string, string>();
	const gone = new Map<string, string>();
	for (const [name, tip] of listed) {
		const id = JOB.exec(name)?.[1];
		const why = id === undefined ? "not arthur/<job id>" : jobs.has(id) ? `its job still exists; arthur prune ${id} frees it` : inMain(entry.path, tip) ? "" : `its tip ${tip.slice(0, 7)} is not in ${main}`;
		if (why === "") gone.set(name, tip);
		else kept.set(name, why);
	}
	const refused = dryRun || gone.size === 0 ? new Map<string, string>() : await deleteOnOrigin(entry.path, gone);
	const lines = [...listed.keys()].map((name) => {
		const [why, tip = ""] = [kept.get(name) ?? refused.get(name), gone.get(name)];
		if (why !== undefined && why !== "") return `kept ${name}: ${why}`;
		if (!dryRun) rmSync(join(host.folder, "pushed", name.slice("arthur/".length)), { force: true });
		return `${dryRun ? "would delete" : "deleted"} ${name} (${tip.slice(0, 7)})`;
	});
	const failed = [...refused.values()].filter((why) => why !== "").length;
	const deleted = gone.size - failed;
	console.log([...lines, dryRun ? `--dry-run: ${gone.size} would be deleted, ${kept.size} kept; nothing deleted` : `${deleted} deleted, ${kept.size + failed} kept`].join("\n"));
	return failed > 0 ? 1 : 0;
}
