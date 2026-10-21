import { linkSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Filing } from "@arthur/core/plugin";

// How `arthur ticket file <id> <job>` files a plan and a plan review (spec/roadmap.md, entry 28): docs/commands/plan.md, "Filing".
// Each one's task names its one ticket (plans.ts), so the core files it only with that ticket named.

const REVIEW = /^plan-review-(\d+)\.md$/;

// A plan replaces the ticket's `plan.md`, whose earlier versions stay in Git history; written whole and renamed, so a reader
// never sees half of it.
export function filePlan({ root, ticket: named, job }: Filing): string {
	const ticket = named!;
	const path = join(dirname(ticket.path), "plan.md");
	const draft = join(root, dirname(ticket.path), `.plan.md.${process.pid}`);
	writeFileSync(draft, `# ${ticket.id} - Plan\n\n- Job: ${job.id}\n- Planned at: ${job.base}\n\n${job.result}`);
	renameSync(draft, join(root, path));
	return path;
}

// A plan review becomes the next `plan-review-N.md`, after the highest N there; never over a file, and never a job filed before.
export function filePlanReview({ root, ticket: named, job }: Filing): string {
	const ticket = named!;
	const folder = dirname(ticket.path);
	const reviews = readdirSync(join(root, folder)).filter((name) => REVIEW.test(name));
	const filed = reviews.find((name) => readFileSync(join(root, folder, name), "utf8").includes(`\n- Job: ${job.id}\n`));
	if (filed !== undefined) throw new Error(`${job.id} is already filed as ${folder}/${filed}`);
	const n = Math.max(0, ...reviews.map((name) => Number(REVIEW.exec(name)?.[1]))) + 1;
	const path = `${folder}/plan-review-${n}.md`;
	// The verdict is the last non-empty line, exactly PASS or FAIL.
	const last = job.result.trimEnd().split("\n").at(-1)?.trim();
	const verdict = last === "PASS" || last === "FAIL" ? last : "none";
	const draft = join(root, folder, `.plan-review.${process.pid}`);
	writeFileSync(draft, `# ${ticket.id} - Plan review ${n}\n\n- Job: ${job.id}\n- Plan reviewed: ${folder}/plan.md at ${job.base}\n- Verdict: ${verdict}\n\n${job.result}`);
	try {
		// A link, unlike a rename, never replaces a file a second filer wrote meanwhile.
		linkSync(draft, join(root, path));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`${path} was written meanwhile; file ${job.id} again`);
		throw error;
	} finally {
		rmSync(draft, { force: true });
	}
	return path;
}
