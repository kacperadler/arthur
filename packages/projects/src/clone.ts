import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { installCommand } from "./install.ts";

// Each project's folder at setup (spec/roadmap.md, entry 41): a `path` must be a Git repository already; a `repo` is cloned
// into `reposDir/<name>` when it is missing. Relative paths count from the current folder. Each refusal names the project.

type Located = { readonly name: string; readonly path?: string; readonly repo?: string; readonly install?: string };

// `home` is Arthur's home folder, which `reposDir` must be outside of.
export function projectFolder(project: Located, reposDir: string | undefined, home: string): string {
	const path = project.path !== undefined ? repository(project, resolve(project.path)) : cloned(project, project.repo ?? "", resolve(reposDir ?? "", project.name), home);
	installCommand(project, path, "HEAD");
	return path;
}

function repository(project: Located, path: string): string {
	if (statSync(path, { throwIfNoEntry: false })?.isDirectory() !== true) throw new Error(`project ${project.name}: path ${path} is not a folder`);
	if (!existsSync(join(path, ".git"))) throw new Error(`project ${project.name}: path ${path} is not a Git repository (no .git in it)`);
	return path;
}

// A clone into a temporary name, renamed when whole, so a failed clone leaves no folder; an existing one with another origin
// is refused and left as it is. A URL is printed without its userinfo; in one new URL cannot parse, each word with an `@` is masked.
function cloned(project: Located, repo: string, folder: string, home: string): string {
	const shown = (url: string) => (URL.canParse(url) ? Object.assign(new URL(url), { username: "", password: "" }).href : url.replace(/\S*@\S+/g, "the repo"));
	const fromHome = relative(home, dirname(folder));
	if (fromHome === "" || (fromHome.split(sep)[0] !== ".." && !isAbsolute(fromHome)))
		throw new Error(`project ${project.name}: reposDir ${dirname(folder)} is inside Arthur's home folder ${home}; put it outside`);
	if (existsSync(folder)) {
		const origin = spawnSync("git", ["-C", folder, "remote", "get-url", "origin"], { encoding: "utf8" });
		const url = origin.status === 0 ? origin.stdout.trim() : "no origin";
		if (url !== repo) throw new Error(`project ${project.name}: ${folder} holds ${shown(url)}, not ${shown(repo)}; it is left as it is`);
		return folder;
	}
	mkdirSync(dirname(folder), { recursive: true });
	const temporary = join(dirname(folder), `.${project.name}.cloning-${process.pid}`);
	rmSync(temporary, { recursive: true, force: true });
	const run = spawnSync("git", ["clone", "--quiet", "--", repo, temporary], { encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
	if (run.status !== 0) {
		rmSync(temporary, { recursive: true, force: true });
		throw new Error(`project ${project.name}: git clone ${shown(repo)} failed: ${(run.stderr.trim().split("\n").at(-1) ?? `exit code ${run.status}`).replace(/\S*@\S+/g, "the repo")}`);
	}
	try {
		renameSync(temporary, folder);
	} catch (error) {
		// Another process cloned it first: theirs stays, checked as any existing clone.
		rmSync(temporary, { recursive: true, force: true });
		if (!existsSync(folder)) throw error;
		return cloned(project, repo, folder, home);
	}
	return folder;
}
