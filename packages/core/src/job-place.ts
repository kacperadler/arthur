import { existsSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

// Where a job may not write, as the worktree guard (worktree-guard.ts) sees it: from the job's record, and the other
// projects from the list the projects plugin keeps in the home folder.

// Absolute paths with their symlinks resolved; `branch` is empty for a read-only kind's detached checkout; `others` are the
// other projects, each with its main checkout and the folder of its jobs' worktrees; `guarded` the places outside every
// checkout, each with the name a refusal gives it.
export type Place = { readonly worktree: string; readonly branch: string; readonly home: string; readonly root: string; readonly worktrees: string; readonly others: readonly { readonly name: string; readonly root: string; readonly worktrees: string }[]; readonly guarded: readonly { readonly name: string; readonly path: string }[] };

// The keys of the record's `guarded` file, and the name each place has in a refusal.
const GUARDED: Readonly<Record<string, string>> = { config: "Arthur's config folder", env: "Arthur's env file", install: "Arthur's install", ssh: "the user's SSH folder", systemd: "the user's systemd folder", gitconfig: "the user's Git config", gitxdg: "the user's Git config" };

// The record's `guarded` file, a line `<key> <absolute path>` each: Arthur's install, the folder that holds the core's
// package (the clone of docs/setup.md, so every plugin's package too; `node_modules` of an install from npm), the user's
// `~/.ssh`, `~/.config/systemd`, and Git's user config, `~/.gitconfig` and `~/.config/git/` (with `$XDG_CONFIG_HOME/git/`
// too when that is set elsewhere, as Git reads it then), and with `config` (none on another machine) the config's folder and
// the env file, which may lie outside it. A file the user's Git config includes from elsewhere is not followed.
export function guardedPlaces(config?: { readonly folder: string; readonly envFile: string }): string {
	const user = homedir();
	const xdg = process.env.XDG_CONFIG_HOME ? join(process.env.XDG_CONFIG_HOME, "git") : join(user, ".config", "git");
	const places = [...(config ? [["config", config.folder], ["env", config.envFile]] : []), ["install", resolve(import.meta.dirname, "..", "..", "..")], ["ssh", join(user, ".ssh")], ["systemd", join(user, ".config", "systemd")], ["gitconfig", join(user, ".gitconfig")], ["gitxdg", join(user, ".config", "git")]];
	if (xdg !== join(user, ".config", "git")) places.push(["gitxdg", xdg]);
	return places.map(([key, path]) => `${key} ${path}`).join("\n");
}

// The places `text` names as `guardedPlaces` writes them; a line with another key or a relative path is none.
function guarded(text: string): Place["guarded"] {
	return text.split("\n").flatMap((line) => {
		const [key, path] = [line.slice(0, line.indexOf(" ")), line.slice(line.indexOf(" ") + 1)];
		return Object.hasOwn(GUARDED, key) && isAbsolute(path) ? [{ name: GUARDED[key]!, path: real(path) }] : [];
	});
}

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
// `projects` or `guarded` was written names no other project or no guarded place.
export function jobPlace(record: string): Place {
	const field = (name: string) => readFileSync(join(record, name), "utf8").trim();
	const optional = (name: string) => (existsSync(join(record, name)) ? field(name) : "");
	const [worktree, root] = [real(field("worktree")), real(field("root"))];
	return { worktree, branch: field("branch"), home: real(dirname(dirname(record))), root, worktrees: dirname(worktree), others: others(optional("projects"), root), guarded: guarded(optional("guarded")) };
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
