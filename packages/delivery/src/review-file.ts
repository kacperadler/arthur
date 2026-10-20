import { linkSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Filing, Host } from "@arthur/core/plugin";
import { readReview, verdictOf } from "./review-records.ts";

// How `arthur ticket file <id> <review job>` files a review (spec/roadmap.md, entry 52): the next `review-N.md` in the ticket's
// folder, in the core's template's shape, never over a file and never a job filed before. docs/commands/review.md, "Filing".

const NAME = /^review-(\d+)\.md$/;

export function reviewFiler(host: Host): (filing: Filing) => string {
	return ({ ticket, job }) => {
		const review = readReview(host, job.id);
		if (review === undefined) throw new Error(`${job.id} has no record of delivery's, so it reviewed no branch; review one with arthur review <worker job>`);
		const verdict = verdictOf(job.result);
		if (verdict === "none")
			throw new Error(`${job.id} has no verdict: the last line of its final message is not PASS or FAIL alone; the review failed and is never filed; review again with arthur review ${review.branch.slice("arthur/".length)}, and prune it`);
		const folder = dirname(ticket.path);
		const reviews = readdirSync(join(ticket.root, folder)).filter((name) => NAME.test(name));
		const filed = reviews.find((name) => readFileSync(join(ticket.root, folder, name), "utf8").includes(`\n- Job: ${job.id}\n`));
		if (filed !== undefined) throw new Error(`${job.id} is already filed as ${folder}/${filed}`);
		const n = Math.max(0, ...reviews.map((name) => Number(NAME.exec(name)?.[1]))) + 1;
		const path = `${folder}/review-${n}.md`;
		const draft = join(ticket.root, folder, `.review.${process.pid}`);
		writeFileSync(draft, `# ${ticket.id} - Review ${n}\n\n- Job: ${job.id}\n- Branch: ${review.branch}\n- Commit reviewed: ${review.commit}\n- Verdict: ${verdict}\n\n## Final message\n\n${job.result}`);
		try {
			// A link, unlike a rename, never replaces a file a second filer wrote meanwhile.
			linkSync(draft, join(ticket.root, path));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`${path} was written meanwhile; file ${job.id} again`);
			throw error;
		} finally {
			rmSync(draft, { force: true });
		}
		return path;
	};
}
