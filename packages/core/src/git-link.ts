import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { real } from "./job-place.ts";

// Git's links to a repository, for the worktree guard (spec/roadmap.md, entry 20). A `.git` file (`gitdir: <folder>`)
// makes the folder that holds it a checkout of the repository folder it names, and a `commondir` makes a repository folder
// share another's refs and objects: either, naming the main checkout's repository, makes any folder a checkout of main.

// Whether Git reads a file at `path` as a link by its name, `.git` or `commondir` (a `.git` file given by `--git-dir` may
// have any name).
export const linkName = (path: string): boolean => [".git", "commondir"].includes(basename(path));

// The text of `path` when it is a regular file, its end trimmed as Git trims it; undefined when it is none.
function fileText(path: string): string | undefined {
	try {
		return statSync(path).isFile() ? readFileSync(path, "utf8").trimEnd() : undefined;
	} catch {
		return undefined;
	}
}

// The folder a `commondir` in `repository` names, if any.
const common = (repository: string): string[] => [fileText(join(repository, "commondir"))].flatMap((text) => (text === undefined ? [] : [resolve(repository, text)]));

// The repository folders a git call given `start` (its folder, `-C`, `--git-dir` or `--work-tree`) reaches through a link,
// as Git looks for its repository: `start` as a `.git` file, else the first `.git` from `start` up, and each `commondir`
// on the way. A `.git` file links to the folder it names and that folder's `commondir`, but not when that folder names
// the file back, as the pair `git worktree add` makes for a worktree; a `.git` folder links only by its `commondir`.
export function linkedFolders(start: string): string[] {
	const found: string[] = [];
	for (let at = start; ; at = dirname(at)) {
		for (const link of [at, join(at, ".git")]) {
			const text = fileText(link);
			if (text === undefined) continue;
			if (!text.startsWith("gitdir: ")) return found;
			const repository = resolve(dirname(link), text.slice("gitdir: ".length));
			const back = fileText(join(repository, "gitdir"));
			return back !== undefined && real(resolve(repository, back)) === real(link) ? found : [...found, repository, ...common(repository)];
		}
		found.push(...common(at));
		if (existsSync(join(at, ".git"))) return [...found, ...common(join(at, ".git"))];
		if (at === dirname(at)) return found;
	}
}
