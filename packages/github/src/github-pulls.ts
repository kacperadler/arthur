import { ask, type Failure, field, type Watched } from "./github-api.ts";
import type { Pull, Pulls } from "./github-state.ts";

// Pull request reviews (spec/roadmap.md, entry 58), polled only when `wakeOn` names `pull-request-review`: a repository's open
// pull requests, newest update first, and the reviews of each one that is new or was updated since the last poll. Submitting
// a review updates its pull request's `updated_at` [INFERENCE: GitHub's lists sort a pull request reviewed a moment ago first].

export type Review = {
	readonly project: string;
	readonly repo: string;
	readonly pull: number;
	readonly title: string;
	readonly branch: string;
	readonly review: number;
	readonly user: string;
	readonly state: string;
	readonly body: string;
	readonly url: string;
};
export type Reviews = { readonly reviews: readonly Review[]; readonly pulls: Pulls; readonly until?: number };

// Pull requests and reviews asked per request: GitHub's largest page.
const PER_PAGE = 100;

// The reviews submitted since `known` (the project's pull requests at its last poll), and the pull requests now. Without
// `known`, the project's first poll, every review is taken as told. A pull request `known` lacks (new, reopened, or back
// among the 100 listed) has told only its reviews submitted since `known.polled`, as the ones before were told already
// (AR0250). A failed request fails the round, so nothing is lost.
export async function newReviews(each: Watched, known: Pulls | undefined, signal: AbortSignal): Promise<Reviews | Failure> {
	const { instance, repo, project } = each;
	// GitHub's `submitted_at` has whole seconds: one at the second this poll began is taken as after it.
	const polled = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
	const listed = await ask(instance, `/repos/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=${PER_PAGE}`, `the pull requests of ${repo}`, "Pull requests: read", signal);
	if (!("body" in listed)) return listed;
	if (!Array.isArray(listed.body)) return { text: `instance ${instance.label}: the answer for the pull requests of ${repo} is no list`, loud: false };
	let until = listed.until;
	const open: Record<string, Pull> = {};
	const text = (value: unknown) => (typeof value === "string" ? value : "");
	const reviews: Review[] = [];
	for (const item of listed.body) {
		const [number, updated, title] = ["number", "updated_at", "title"].map((key) => field(item, key));
		const branch = field(field(item, "head"), "ref");
		if (typeof number !== "number" || typeof updated !== "string") continue;
		const before = known?.open[number];
		if (before?.updated === updated) {
			open[number] = before;
			continue;
		}
		const answer = await ask(instance, `/repos/${repo}/pulls/${number}/reviews?per_page=${PER_PAGE}`, `the reviews of pull request #${number} of ${repo}`, "Pull requests: read", signal);
		if (!("body" in answer)) return answer;
		until = answer.until ?? until;
		const told: number[] = [];
		for (const one of Array.isArray(answer.body) ? answer.body : []) {
			const [review, state, body, url, submitted] = ["id", "state", "body", "html_url", "submitted_at"].map((key) => field(one, key));
			const user = field(field(one, "user"), "login");
			// A pending review is a draft its author has not submitted.
			if (typeof review !== "number" || typeof state !== "string" || state === "PENDING") continue;
			told.push(review);
			if (known === undefined || before?.told.includes(review)) continue;
			// A review without a time it was submitted is told rather than lost.
			if (before === undefined && Date.parse(text(submitted)) < Date.parse(known.polled)) continue;
			reviews.push({ project, repo, pull: number, title: text(title), branch: text(branch), review, user: text(user), state, body: text(body), url: text(url) });
		}
		open[number] = { updated, told };
	}
	return { reviews, pulls: { polled, open }, ...(until === undefined ? {} : { until }) };
}
