import { existsSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

// Where a job may not write, as the worktree guard (worktree-guard.ts) sees it: from the job's record, and the other
// projects from the list the projects plugin keeps in the home folder.

// Absolute paths with their symlinks resolved; `branch` is empty for a read-only kind's detached checkout; `others` are the
// other projects, each with its main checkout and the folder of its jobs' worktrees.
export type Place = { readonly worktree: string; readonly branch: string; readonly home: string; readonly root: string; readonly worktrees: string; readonly others: readonly { readonly name: string; readonly root: string; readonly worktrees: string }[] };

// `path` with its nearest existing ancestor resolved through symlinks, and a link whose target does not exist yet followed,
// so a link cannot name a place its target is not.
export function real(path: string, depth = 0): string {
	for (let rest = "", at = path; ; at = dirname(at)) {
		try {
			return join(realpathSync(at), rest);
		} catch {
			try {
				if (depth < 40) return real(join(resolve(dirname(at), readlinkSync(at)), rest), depth + 1);
			} catch {}
			if (dirname(at) === at) return path;
			rest = join(basename(at), rest);
		}
	}
}

// The projects `text` lists, a line `<name> <absolute root>` each, but the job's own `root`; a line that is not one is none.
function others(text: string, root: string): Place["others"] {
	return text.split("\n").flatMap((line) => {
		const at = /^\S+ \//.test(line) ? real(line.slice(line.indexOf(" ") + 1)) : root;
		return at === root ? [] : [{ name: line.slice(0, line.indexOf(" ")), root: at, worktrees: real(join(dirname(at), ".arthur-worktrees")) }];
	});
}

// The places of the job whose record is `record` (`<home>/jobs/<id>`), as the runner wrote them. A record from before
// `projects` was written names no other project.
export function jobPlace(record: string): Place {
	const field = (name: string) => readFileSync(join(record, name), "utf8").trim();
	const [worktree, root] = [real(field("worktree")), real(field("root"))];
	return { worktree, branch: field("branch"), home: real(dirname(dirname(record))), root, worktrees: dirname(worktree), others: others(existsSync(join(record, "projects")) ? field("projects") : "", root) };
}

// `place` with the other projects as declared now: the list the projects plugin rewrites in its folder whenever the config
// loads with a changed one (packages/projects/src/projects.ts), read anew so a project declared while the job runs is guarded
// at once. When that file cannot be read (missing, as without the plugin or on another machine), `place` as the record has
// it, and `fallback` gets the reason.
export function declaredPlace(place: Place, fallback: (reason: string) => void): Place {
	try {
		return { ...place, others: others(readFileSync(join(place.home, "projects", "checkouts"), "utf8").trim(), place.root) };
	} catch (error) {
		fallback(error instanceof Error ? error.message : String(error));
		return place;
	}
}
