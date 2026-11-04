import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

// Arthur's repository is public and about Arthur alone (AR0627): no tracked file and no commit message names another project
// of the owner. Their names are the folders of the main checkout's git-ignored `projects/`, read at each run, so none is
// written here. `npm test` runs it on the checkout (other-projects.test.ts), so `arthur merge` does on main; `.githooks/commit-msg` at each commit.

type Message = { readonly where: string; readonly text: string };

function git(root: string, args: readonly string[]): string {
	// No cap: the list of tracked files grows with every ticket.
	const run = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: Infinity });
	// `git grep` exits 1 when nothing matches.
	if (run.status !== 0 && !(args[0] === "grep" && run.status === 1)) throw new Error(`git ${args.join(" ")}: ${run.error?.message ?? run.stderr.trim()}`);
	return run.stdout;
}

// The folders of `projects/` in the main checkout of the repository `root` is in, from a worktree too, but `arthur`'s; none
// without that folder (a clone, CI).
export function otherProjects(root: string): string[] {
	const folder = join(dirname(git(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim()), "projects");
	if (!existsSync(folder)) return [];
	return readdirSync(folder).filter((name) => name !== "arthur" && statSync(join(folder, name)).isDirectory());
}

// The commits HEAD brings: HEAD alone, or for a merge every commit of its branch with it, as `arthur merge` checks main.
export function headMessages(root: string): Message[] {
	const merge = spawnSync("git", ["-C", root, "rev-parse", "--quiet", "--verify", "HEAD^2"]).status === 0;
	const entries = git(root, ["log", "-z", "--format=%h%n%B", ...(merge ? ["HEAD^1..HEAD"] : ["-1", "HEAD"])]).split("\0").filter(Boolean);
	return entries.map((entry) => ({ where: `commit ${entry.slice(0, entry.indexOf("\n"))}`, text: entry.slice(entry.indexOf("\n") + 1) }));
}

// Each tracked file (as the index holds it: the commit's own in a hook), by its path or its content, and each of `messages`
// that names a project of `names`, in any case, as written or as a ticket folder's slug spells it: `<where>: names the project <name>`.
export function namings(root: string, names: readonly string[], messages: readonly Message[]): string[] {
	const paths = git(root, ["ls-files", "-z"]).split("\0").filter(Boolean);
	return names.flatMap((name) => {
		const forms = [...new Set([name, name.replace(/[^a-z0-9]+/gi, "-")].map((form) => form.toLowerCase()))];
		const named = (text: string) => forms.some((form) => text.toLowerCase().includes(form));
		const contents = git(root, ["grep", "--cached", "-l", "-z", "-i", "-F", ...forms.flatMap((form) => ["-e", form])]).split("\0").filter(Boolean);
		const files = [...new Set([...paths.filter(named), ...contents])].toSorted();
		return [...files, ...messages.filter((message) => named(message.text)).map((message) => message.where)].map((where) => `${where}: names the project ${name}`);
	});
}

// The `commit-msg` hook: the message in the file Git passes, and the files the commit holds, in the checkout Git runs it in.
if (import.meta.main) {
	const root = process.cwd();
	const found = namings(root, otherProjects(root), [{ where: "the commit message", text: readFileSync(process.argv[2] ?? "", "utf8") }]);
	for (const line of found) console.error(`commit refused: ${line}; Arthur's repository names no other project (AR0627)`);
	if (found.length > 0) process.exitCode = 1;
}
