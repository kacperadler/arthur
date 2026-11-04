import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { Host, Job } from "@arthur/core/plugin";

// The project's review criteria in a worker's prompt, so the worker knows what fails its branch (AR0584): `<criteriaDir>/review.md`
// read as the core reads a criteria file (docs/commands/roles.md), in the worktree here, in the main checkout for a job on
// another machine, or in the project's folder its `prompts` names; never through a symlink. Missing or empty, nothing.
export function workerCriteria(host: Pick<Host, "collect">, job: Job): string | { readonly warnings: string[] } | undefined {
	const listed = host.collect<readonly { readonly name: string; readonly prompts?: { readonly criteriaDir?: string } }[]>("projects").flat();
	const path = join(listed.find((each) => each.name === job.project)?.prompts?.criteriaDir ?? ".agents/arthur/criteria", "review.md");
	const checkout = job.machine === "local" ? job.worktree : job.root;
	const file = isAbsolute(path) ? path : join(checkout, path);
	const stat = lstatSync(file, { throwIfNoEntry: false });
	if (stat === undefined) return undefined;
	if (!stat.isFile() || realpathSync(file) !== (isAbsolute(path) ? path : join(realpathSync(checkout), path)))
		return { warnings: [`${path} is a symlink or not a file; the worker goes without the review criteria`] };
	const body = readFileSync(file, "utf8").trim();
	return body === "" ? undefined : `## The review criteria your branch is judged by (${path})\n\n${body}`;
}
