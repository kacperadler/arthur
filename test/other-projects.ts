import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

// Arthur's repository is public and about Arthur alone (AR0627): no tracked file and no commit message names another project
// of the owner. Their names are the folders of the main checkout's git-ignored `projects/`, read at each run, so none is
// written here. `npm test` runs it on the checkout (other-projects.test.ts), so `arthur merge` does on main; `.githooks/commit-msg` at each commit.

// `own`: the commit's author's and committer's addresses, lowercased.
type Message = { readonly where: string; readonly text: string; readonly own: readonly string[] };

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
	const entries = git(root, ["log", "-z", "--format=%h%n%ae%n%ce%n%B", ...(merge ? ["HEAD^1..HEAD"] : ["-1", "HEAD"])]).split("\0").filter(Boolean);
	return entries.map((entry) => {
		const [hash = "", author = "", committer = ""] = entry.split("\n", 3);
		return { where: `commit ${hash}`, text: entry.split("\n").slice(3).join("\n"), own: [author.toLowerCase(), committer.toLowerCase()] };
	});
}

// The text of `message` but the address of a `Signed-off-by:` line that is the commit's own author's or committer's (AR-D501):
// the owner signs off with his address, whatever it names; the rest of that line, and that address anywhere else, still count.
function unsigned(message: Message): string {
	return message.text.replace(/^(signed-off-by:.*)<([^>]*)>[ \t]*$/gim, (line: string, head: string, address: string) => (message.own.includes(address.toLowerCase()) ? head : line));
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
		return [...files, ...messages.filter((message) => named(unsigned(message))).map((message) => message.where)].map((where) => `${where}: names the project ${name}`);
	});
}

// The `commit-msg` hook: the message in the file Git passes, and the files the commit holds, in the checkout Git runs it in.
if (import.meta.main) {
	const root = process.cwd();
	const own = ["GIT_AUTHOR_IDENT", "GIT_COMMITTER_IDENT"].map((ident) => (/<([^>]*)>/.exec(git(root, ["var", ident]))?.[1] ?? "").toLowerCase());
	const found = namings(root, otherProjects(root), [{ where: "the commit message", text: readFileSync(process.argv[2] ?? "", "utf8"), own }]);
	for (const line of found) console.error(`commit refused: ${line}; Arthur's repository names no other project (AR0627)`);
	if (found.length > 0) process.exitCode = 1;
}
