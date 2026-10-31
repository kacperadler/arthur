import { join, relative, sep } from "node:path";
import { linkName } from "./git-link.ts";
import type { Place } from "./job-place.ts";

const TICKET = "arthur: refused: a ticket's ticket.md is the coordinator's, written on main, and the merge refuses a branch that changes one; write what you found in the ticket's findings.md, and what the ticket should say in your final message";

export const inside = (path: string, folder: string): boolean => path === folder || path.startsWith(folder.endsWith(sep) ? folder : folder + sep);

// The line that refuses writing `path` (absolute, resolved), or undefined when it is not a guarded place. Of nested places (a project's checkout inside
// another's, the job's own worktree, no place, in the jobs' folder) the innermost names it. The worktree's `.git` file is its link to the repository, as is any path `named` `.git` or `commondir` (git-link.ts). A ticket's `spec/features/*/ticket.md` in the worktree is the coordinator's (AR0570); its `findings.md` stays the job's.
export function refusal(place: Place, path: string, shown = path, named = true): string | undefined {
	if (/^spec\/features\/[^/]+\/ticket\.md$/.test(relative(place.worktree, path))) return TICKET;
	const link = join(place.worktree, ".git");
	const linking = named && (linkName(path) || linkName(shown)) ? `arthur: refused: this call writes ${shown}, which Git reads as a link to a repository (a .git or commondir) and so may make its folder a checkout of main; make or remove a repository's folder with git init, git clone or rm -r instead` : undefined;
	const places: (readonly [string, string])[] = [[place.worktree, ""], [place.home, "Arthur's home folder"], [place.worktrees, "another job's worktree"], [place.root, "the main checkout"], [link, "the main checkout"]];
	for (const other of place.others) places.push([other.worktrees, `a job worktree of project ${other.name}`], [other.root, `the main checkout of project ${other.name}`]);
	for (const each of place.guarded) places.push([each.path, each.name]);
	const name = places.filter(([folder]) => inside(path, folder)).sort(([a], [b]) => b.length - a.length)[0]?.[1];
	return name ? `arthur: refused: this call writes into ${name} (${shown}); a job writes only in its own worktree ${place.worktree}, outside Arthur's checkouts, home folder, install and config, and the user's own files` : linking;
}
