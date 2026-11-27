import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// Arthur's repository is public and about Arthur alone (AR0627): no tracked file and no commit message names another project
// of the owner, by its name or by its ticket or decision ids (AR0744). Their names are the folders of the main checkout's git-ignored
// `projects/`, and their prefixes each folder's `project.config.ts`, or in a job, whose sandbox hides those files, the line for it in
// `<home>/projects/prefixes` (AR0749); all read at each run, so none is written here, and a prefix learned from neither refuses the commit.
// `npm test` runs it on the checkout (other-projects.test.ts), so `arthur merge` does on main; `.githooks/commit-msg` at each commit,
// and `npm run commit-msg` at the merge's own `spec:` commit, which it makes with hooks off (AR0635).

// `own`: the commit's author's and committer's addresses, lowercased.
type Message = { readonly where: string; readonly text: string; readonly own: readonly string[] };

function git(root: string, args: readonly string[]): string {
	// No cap: the list of tracked files grows with every ticket.
	const run = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: Infinity });
	// `git grep` exits 1 when nothing matches.
	if (run.status !== 0 && !(args[0] === "grep" && run.status === 1)) throw new Error(`git ${args.join(" ")}: ${run.error?.message ?? run.stderr.trim()}`);
	return run.stdout;
}

// A project's prefix, as packages/projects/src/project-options.ts checks it; a hand-edited file may hold any other.
const PREFIX = /^[A-Z]+$/;

// `unlearned`: why its prefix is not known, so its ids cannot be checked.
export type Project = { readonly name: string; readonly prefix: string } | { readonly name: string; readonly unlearned: string };

// The folders of `projects/` in the main checkout of the repository `root` is in, from a worktree too, but `arthur`'s; none
// without that folder (a clone, CI). Each with its prefix: its config's, else, in a job (`ARTHUR_JOB` is `<home>/jobs/<id>`),
// its line `<name> <prefix>` in `<home>/projects/prefixes`.
export async function otherProjects(root: string, env: Readonly<Record<string, string | undefined>> = process.env): Promise<Project[]> {
	const folder = join(dirname(git(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim()), "projects");
	if (!existsSync(folder)) return [];
	const names = readdirSync(folder).filter((name) => name !== "arthur" && statSync(join(folder, name)).isDirectory());
	const file = env.ARTHUR_JOB ? join(dirname(dirname(env.ARTHUR_JOB)), "projects", "prefixes") : undefined;
	const lines = file !== undefined && existsSync(file) ? readFileSync(file, "utf8").split("\n") : undefined;
	return Promise.all(
		names.map(async (name): Promise<Project> => {
			// Each config is a git-ignored file named at run time, so it is imported here, as packages/projects/src/project-file.ts does.
			const loaded: unknown = await import(pathToFileURL(join(folder, name, "project.config.ts")).href).then(
				(module: { readonly default?: unknown }) => module.default,
				(error: Error) => new Error(error.message.split("\n")[0]),
			);
			const piece = Array.isArray(loaded) ? (loaded.find((each) => typeof each === "object" && each !== null && "projects" in each)?.projects as unknown) : undefined;
			const prefix = typeof piece === "object" && piece !== null && "prefix" in piece ? piece.prefix : undefined;
			if (typeof prefix === "string" && PREFIX.test(prefix)) return { name, prefix };
			const listed = lines?.map((line) => /^(\S+) ([A-Z]+)$/.exec(line)).find((match) => match?.[1] === name)?.[2];
			if (listed !== undefined) return { name, prefix: listed };
			const config = loaded instanceof Error ? loaded.message : "no projects.project({ prefix }) of capital letters A-Z";
			const job = file === undefined ? "no ARTHUR_JOB, so no prefixes file" : `${file}: ${lines === undefined ? "missing" : "no line for it"}`;
			return { name, unlearned: `${config}; ${job}` };
		}),
	);
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
// that names a project of `projects`, in any case, as written or as a ticket folder's slug spells it, or by one of its ids:
// `<where>: names the project <name>`, `<path>:<line>` for an id in a file; and each project whose prefix was not learned.
export function namings(root: string, projects: readonly Project[], messages: readonly Message[]): string[] {
	const paths = git(root, ["ls-files", "-z"]).split("\0").filter(Boolean);
	return projects.flatMap((project) => {
		const { name } = project;
		const forms = [...new Set([name, name.replace(/[^a-z0-9]+/gi, "-")].map((form) => form.toLowerCase()))];
		const named = (text: string) => forms.some((form) => text.toLowerCase().includes(form));
		const contents = git(root, ["grep", "--cached", "-l", "-z", "-i", "-F", ...forms.flatMap((form) => ["-e", form])]).split("\0").filter(Boolean);
		const files = [...new Set([...paths.filter(named), ...contents])].toSorted();
		const found = [...files, ...messages.filter((message) => named(unsigned(message))).map((message) => message.where)].map((where) => `${where}: names the project ${name}`);
		if ("unlearned" in project) return [...found, `projects/${name}/project.config.ts: its prefix was not learned (${project.unlearned}), so its ids cannot be checked`];
		// Its ids: a ticket's, `<prefix>` and 4 or more digits, and a decision's, `<prefix>-D<n>`; `\b` and `-w` pass them inside a longer word.
		const id = new RegExp(`\\b${project.prefix}(-D\\d+|\\d{4,})\\b`);
		// `-o -n -z`: a record `<path>\0<line>\0<id>\n` per id.
		const grep = git(root, ["grep", "--cached", "-a", "-z", "-n", "-o", "-w", "-E", "-e", `${project.prefix}(-D[0-9]+|[0-9]{4,})`]);
		const lines = [...new Set(grep.split("\n").filter(Boolean).map((record) => record.split("\0").slice(0, 2).join(":")))];
		const where = [...paths.filter((path) => id.test(path)), ...lines, ...messages.filter((message) => id.test(unsigned(message))).map((message) => message.where)];
		return [...found, ...where.map((each) => `${each}: names the project ${name}`)];
	});
}

// The `commit-msg` hook: the message in the file Git passes, and the files the commit holds, in the checkout Git runs it in.
if (import.meta.main) {
	const root = process.cwd();
	const own = ["GIT_AUTHOR_IDENT", "GIT_COMMITTER_IDENT"].map((ident) => (/<([^>]*)>/.exec(git(root, ["var", ident]))?.[1] ?? "").toLowerCase());
	const found = namings(root, await otherProjects(root), [{ where: "the commit message", text: readFileSync(process.argv[2] ?? "", "utf8"), own }]);
	for (const line of found) console.error(`commit refused: ${line}; Arthur's repository names no other project (AR0627)`);
	if (found.length > 0) process.exitCode = 1;
}
