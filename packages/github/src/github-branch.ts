import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import type { Entry } from "./github-command.ts";
import { deleteOnOrigin, git, originBranches } from "./github-git.ts";

// A job's branch on origin (AR0555): deleted once its job is pruned, and `arthur github branch sweep [--dry-run]`, origin's
// `arthur/*` branches whose job is gone and whose tip main holds. `<folder>/pushed/<job id>` holds the tip `github.push`
// last pushed of the job's branch, which the prune may delete although main does not hold it (a dropped ticket's).
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

// `jobs.keep`, which the core asks once a prune freed the job's worktree and local branch: never a reason to keep, and the
// job's branch deleted on origin in the background, one prune after the other. A refusal or a failure is a `notice`.
export function pruned(host: Host, list: readonly Entry[]) {
	let queue = Promise.resolve();
	return ({ id, project, branch }: { readonly id: string; readonly project: string; readonly branch: string }): undefined => {
		if (branch === "") return;
		queue = queue
			.then(() => originDelete(host, list, { id, project, branch }))
			.catch((error: Error) => error.message)
			.then((why) => {
				if (why !== undefined) host.events.emit("notice", { text: `github: ${branch} not deleted on origin: ${why}` });
			});
	};
}

// Why the job's branch stays on origin, undefined once it is gone there: deleted now, or never there (nothing is said).
async function originDelete(host: Host, list: readonly Entry[], { id, project, branch }: { readonly id: string; readonly project: string; readonly branch: string }): Promise<string | undefined> {
	if (branch !== `arthur/${id}`) return `it is not arthur/${id}, the branch of job ${id}`;
	const path = list.find((each) => each.name === project)?.path;
	if (path === undefined) return `no project ${project}`;
	if (mainOf(path) === branch) return `${path} has it checked out`;
	// A project without origin has no branch there.
	if (git(path, "remote", "get-url", "origin") === undefined) return undefined;
	const listed = await originBranches(path, branch);
	if (typeof listed === "string") return listed;
	const [tip, record] = [listed.get(branch), join(host.folder, "pushed", id)];
	const pushed = existsSync(record) ? readFileSync(record, "utf8").trim() : "";
	if (tip !== undefined && tip !== pushed && !inMain(path, tip))
		return `origin's tip ${tip.slice(0, 7)} is not the commit Arthur pushed (${pushed.slice(0, 7) || "none recorded"}), nor in ${mainOf(path)}`;
	const why = tip === undefined ? "" : (await deleteOnOrigin(path, new Map([[branch, tip]]))).get(branch);
	if (why !== "") return why;
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
