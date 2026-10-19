import { existsSync, linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Project, ProjectEntry } from "./projects.ts";

// `arthur init <project>` (spec/roadmap.md, entry 42): what Arthur reads, given to a repository without a board, each file only
// where it is missing; it commits nothing: docs/commands/init.md.

export const BOARD = "spec/build.json";
const SKELETON = new URL("../skeleton/", import.meta.url);

// The skeleton of criteria file `name`: the one shipped here, else its title alone (`code-review` is `# Code review`).
function criterion(name: string): string {
	const shipped = new URL(`criteria/${name}.md`, SKELETON);
	return existsSync(shipped) ? readFileSync(shipped, "utf8") : `# ${name[0]?.toUpperCase()}${name.slice(1).replaceAll("-", " ")}\n`;
}

// Where the project's `prompts` keeps its vision and criteria, the files an onboarding drafts; `criteriaDir` without a final `/`.
export function drafted(project: ProjectEntry): { readonly vision: string; readonly criteriaDir: string } {
	return { vision: join(project.prompts?.vision ?? "spec/vision.md"), criteriaDir: join(project.prompts?.criteriaDir ?? ".agents/arthur/criteria", ".") };
}

// `criteria`: the names of the criteria files the registered roles read (`host.jobs.criteria()`), one skeleton each.
export function init(all: readonly Project[], args: readonly string[], flag: string | undefined, criteria: readonly string[]): number | void {
	if (args.length !== 1 || flag !== undefined) {
		console.error("usage: arthur init <project>");
		return 2;
	}
	const project = all.find((each) => each.name === args[0]);
	if (project === undefined) {
		console.error(`arthur init: unknown project ${args[0]}; projects: ${all.map((each) => each.name).join(", ")}`);
		return 1;
	}
	const refused = () => {
		console.error(`arthur init: ${project.name} has a board already, ${join(project.path, BOARD)}; arthur init is for a repository without one`);
		return 1;
	};
	if (existsSync(join(project.path, BOARD))) return refused();
	const { vision, criteriaDir } = drafted(project);
	// The board last: once it is there the repository counts as given, so an init cut short can run again.
	const files: [string, string][] = [
		[vision, readFileSync(new URL("vision.md", SKELETON), "utf8")],
		...criteria.map((name): [string, string] => [join(criteriaDir, `${name}.md`), criterion(name)]),
		[".nvmrc", `${process.versions.node.split(".")[0]}\n`],
		[BOARD, "[]\n"],
	];
	const [created, left]: [string[], string[]] = [[], []];
	for (const [path, text] of files) (writeOnce(join(project.path, path), text) ? created : left).push(path);
	// Another init wrote it meanwhile.
	if (left.includes(BOARD)) return refused();
	console.log(`created: ${created.join(", ")}\nleft as it was: ${left.join(", ") || "nothing"}`);
	console.log(`nothing committed: commit these files, then start the onboarding: arthur spawn --kind onboarding --project ${project.name} 'Onboard ${project.name}.'`);
}

// Writes `text` to `file` unless something is there, a symlink included, and never half of it: a link to a whole temporary file.
export function writeOnce(file: string, text: string): boolean {
	mkdirSync(dirname(file), { recursive: true });
	const draft = `${file}.${process.pid}.draft`;
	writeFileSync(draft, text);
	try {
		linkSync(draft, file);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
		throw error;
	} finally {
		rmSync(draft, { force: true });
	}
}
