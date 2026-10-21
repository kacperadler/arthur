import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { TestContext } from "node:test";

// A fake GitHub REST API on a loopback port the OS picks, answering in the shape of GitHub's documentation, every field of it:
// "List workflow runs for a workflow", "List jobs for a workflow run attempt", "Download job logs for a workflow run" (a 302
// to the log's text), "Re-run a workflow" (201, the run's next attempt queued), "List pull requests", "List reviews for a
// pull request", and the headers of "Rate limits for the REST API".

export type FakeRun = { readonly id: number; attempt?: number; readonly sha: string; readonly branch: string; status: "queued" | "in_progress" | "completed"; conclusion: "success" | "failure" | "cancelled" | null };
export type FakeStep = { readonly name: string; readonly conclusion: "success" | "failure" | "skipped" };
export type FakeJob = { readonly id: number; readonly name: string; readonly conclusion: "success" | "failure"; readonly steps: readonly FakeStep[]; readonly log: string };
// `submitted`, GitHub's `submitted_at` of a review not pending: 2026-01-01 when left out.
export type FakeReview = { readonly id: number; readonly user: string; readonly state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "PENDING"; readonly body: string; readonly submitted?: string };
export type FakePull = { readonly number: number; readonly title: string; readonly branch: string; updated: string; readonly reviews: FakeReview[] };
export type Reply = { readonly status: number; readonly headers?: Readonly<Record<string, string>>; readonly body: unknown };

export const DOCS = "https://docs.github.com/rest";
const RATE = { "x-ratelimit-limit": "5000", "x-ratelimit-used": "1", "x-ratelimit-resource": "core" };
const API = "https://api.github.com";
const T = "2026-01-01T00:00:00Z";

const user = (login: string, id: number) => ({
	...{ login, id, node_id: "MDQ6VXNlcjE=", avatar_url: `https://github.com/images/${login}.gif`, gravatar_id: "", url: `${API}/users/${login}`, html_url: `https://github.com/${login}` },
	...Object.fromEntries(["followers", "following{/other_user}", "gists{/gist_id}", "starred{/owner}{/repo}", "subscriptions", "organizations", "repos", "events{/privacy}", "received_events"].map((each) => [`${each.split("{")[0]}_url`, `${API}/users/${login}/${each}`])),
	...{ type: "User", site_admin: false },
});
const repo = (full: string) => ({
	...{ id: 1296269, node_id: "MDEwOlJlcG9zaXRvcnkxMjk2MjY5", name: full.split("/")[1], full_name: full, owner: user(full.split("/")[0] ?? "", 1), private: false },
	...{ html_url: `https://github.com/${full}`, description: "This your first repo!", fork: false, url: `${API}/repos/${full}` },
	...Object.fromEntries(
		["archive", "assignees", "blobs", "branches", "collaborators", "comments", "commits", "compare", "contents", "contributors", "deployments", "downloads", "events", "forks", "git_commits", "git_refs", "git_tags", "issue_comment", "issue_events", "issues", "keys", "labels", "languages", "merges", "milestones", "notifications", "pulls", "releases", "stargazers", "statuses", "subscribers", "subscription", "tags", "teams", "trees", "hooks"].map((each) => [`${each}_url`, `${API}/repos/${full}/${each}`]),
	),
});
const shapedRun = (full: string, workflow: string, { id, attempt = 1, sha, branch, status, conclusion }: FakeRun) => ({
	...{ id, name: "CI", node_id: "MDEyOldvcmtmbG93IFJ1bjI2OTI4OQ==", check_suite_id: 42, check_suite_node_id: "MDEwOkNoZWNrU3VpdGU0Mg==", head_branch: branch, head_sha: sha, path: `.github/workflows/${workflow}@${branch}` },
	...{ run_number: id % 1000, event: "push", display_title: `on ${branch}`, status, conclusion, workflow_id: 159038, url: `${API}/repos/${full}/actions/runs/${id}`, html_url: `https://github.com/${full}/actions/runs/${id}` },
	...{ pull_requests: [], created_at: T, updated_at: "2026-01-01T00:01:00Z", actor: user("octocat", 1), run_attempt: attempt, referenced_workflows: [], run_started_at: T, triggering_actor: user("octocat", 1) },
	...Object.fromEntries(["jobs", "logs", "artifacts", "cancel", "rerun"].map((each) => [`${each}_url`, `${API}/repos/${full}/actions/runs/${id}/${each}`])),
	...{ check_suite_url: `${API}/repos/${full}/check-suites/414944374`, previous_attempt_url: attempt > 1 ? `${API}/repos/${full}/actions/runs/${id}/attempts/${attempt - 1}` : null, workflow_url: `${API}/repos/${full}/actions/workflows/159038` },
	head_commit: { id: sha, tree_id: "d23f6eedb1e1b9610bbc754ddb5197bfe7271223", message: `on ${branch}`, timestamp: T, author: { name: "test", email: "test@example.com" }, committer: { name: "test", email: "test@example.com" } },
	...{ repository: repo(full), head_repository: repo(full) },
});
const shapedJob = (full: string, run: FakeRun, { id, name, conclusion, steps }: FakeJob) => ({
	...{ id, run_id: run.id, run_url: `${API}/repos/${full}/actions/runs/${run.id}`, run_attempt: run.attempt ?? 1, node_id: "MDg6Q2hlY2tSdW40", head_sha: run.sha, url: `${API}/repos/${full}/actions/jobs/${id}` },
	...{ html_url: `https://github.com/${full}/runs/${id}`, status: "completed", conclusion, created_at: T, started_at: T, completed_at: T, name, check_run_url: `${API}/repos/${full}/check-runs/${id}` },
	steps: steps.map((step, index) => ({ status: "completed", conclusion: step.conclusion, name: step.name, number: index + 1, started_at: T, completed_at: T })),
	...{ labels: ["ubuntu-latest"], runner_id: 1, runner_name: "GitHub Actions 1", runner_group_id: 2, runner_group_name: "GitHub Actions", workflow_name: "CI", head_branch: run.branch },
});
const branchOf = (full: string, ref: string, sha: string) => ({ label: `${full.split("/")[0]}:${ref}`, ref, sha, user: user(full.split("/")[0] ?? "", 1), repo: repo(full) });
const shapedPull = (full: string, { number, title, branch, updated }: FakePull) => {
	const url = `${API}/repos/${full}/pulls/${number}`;
	const links = { self: url, html: `https://github.com/${full}/pull/${number}`, issue: `${API}/repos/${full}/issues/${number}`, comments: `${API}/repos/${full}/issues/${number}/comments` };
	return {
		...{ url, id: 1000 + number, node_id: "MDExOlB1bGxSZXF1ZXN0MQ==", html_url: links.html, diff_url: `${links.html}.diff`, patch_url: `${links.html}.patch`, issue_url: links.issue, commits_url: `${url}/commits` },
		...{ review_comments_url: `${url}/comments`, review_comment_url: `${API}/repos/${full}/pulls/comments{/number}`, comments_url: links.comments, statuses_url: `${API}/repos/${full}/statuses/abc`, number, state: "open", locked: false, title },
		...{ user: user("octocat", 1), body: "Please pull these awesome changes", labels: [], milestone: null, active_lock_reason: null, created_at: T, updated_at: updated, closed_at: null, merged_at: null, merge_commit_sha: null },
		...{ assignee: null, assignees: [], requested_reviewers: [], requested_teams: [], head: branchOf(full, branch, "6dcb09b5b57875f334f61aebed695e2e4193db5e"), base: branchOf(full, "main", "6dcb09b5b57875f334f61aebed695e2e4193db5e") },
		_links: Object.fromEntries(
			Object.entries({ ...links, review_comments: `${url}/comments`, review_comment: `${API}/repos/${full}/pulls/comments{/number}`, commits: `${url}/commits`, statuses: `${API}/repos/${full}/statuses/abc` }).map(([key, href]) => [key, { href }]),
		),
		...{ author_association: "OWNER", auto_merge: null, draft: false },
	};
};
const shapedReview = (full: string, number: number, { id, user: login, state, body, submitted = T }: FakeReview) => ({
	...{ id, node_id: "MDE3OlB1bGxSZXF1ZXN0UmV2aWV3ODA=", user: user(login, 2), body, state, html_url: `https://github.com/${full}/pull/${number}#pullrequestreview-${id}`, pull_request_url: `${API}/repos/${full}/pulls/${number}` },
	_links: { html: { href: `https://github.com/${full}/pull/${number}#pullrequestreview-${id}` }, pull_request: { href: `${API}/repos/${full}/pulls/${number}` } },
	...(state === "PENDING" ? {} : { submitted_at: submitted }),
	...{ commit_id: "ecdd80bb57125d7ba9641ffaa4d7d2c19d3f3091", author_association: "COLLABORATOR" },
});

// `runs[<owner>/<repo>/<workflow>]` newest first; `jobs[<run id>]` the jobs of its attempt, each with its log; `pulls[<owner>/<repo>]`
// the open pull requests; `next` replies once each, before anything else; `always` replies to every request while set, `post`
// to every POST. `seen` holds each request: its method, path, time and Authorization.
export async function fakeGithub(t: TestContext) {
	const runs: Record<string, FakeRun[]> = {};
	const jobs: Record<number, FakeJob[]> = {};
	const pulls: Record<string, FakePull[]> = {};
	const next: Reply[] = [];
	const state: { always?: Reply; post?: Reply } = {};
	const seen: { readonly method: string; readonly path: string; readonly at: number; readonly auth: string }[] = [];
	const http = createServer((request, response) => {
		const path = request.url ?? "";
		seen.push({ method: request.method ?? "", path, at: Date.now(), auth: request.headers.authorization ?? "" });
		const found = ((): Reply | undefined => {
			if (request.method === "POST" && state.post !== undefined) return state.post;
			const match = (pattern: RegExp) => pattern.exec(path)?.slice(1).map(decodeURIComponent);
			const [full = "", workflow = ""] = match(/^\/repos\/([^/]+\/[^/]+)\/actions\/workflows\/([^/]+)\/runs\?per_page=100&exclude_pull_requests=true$/) ?? [];
			const list = runs[`${full}/${workflow}`];
			if (list !== undefined) return { status: 200, body: { total_count: list.length, workflow_runs: list.map((run) => shapedRun(full, workflow, run)) } };
			const everyRun = Object.entries(runs).flatMap(([key, each]) => each.map((run) => ({ full: key.split("/").slice(0, 2).join("/"), run })));
			const [, id = "", attempt = ""] = match(/^\/repos\/([^/]+\/[^/]+)\/actions\/runs\/(\d+)\/attempts\/(\d+)\/jobs\?per_page=100$/) ?? [];
			const ran = everyRun.find((each) => String(each.run.id) === id && String(each.run.attempt ?? 1) === attempt);
			if (ran !== undefined) return { status: 200, body: { total_count: jobs[ran.run.id]?.length ?? 0, jobs: (jobs[ran.run.id] ?? []).map((job) => shapedJob(ran.full, ran.run, job)) } };
			const [, job = ""] = match(/^\/repos\/([^/]+\/[^/]+)\/actions\/jobs\/(\d+)\/logs$/) ?? [];
			if (Object.values(jobs).flat().some((each) => String(each.id) === job)) return { status: 302, headers: { location: `/blob/logs/${job}` }, body: "" };
			const [rerun = ""] = match(/^\/repos\/[^/]+\/[^/]+\/actions\/runs\/(\d+)\/rerun$/) ?? [];
			const again = everyRun.find((each) => String(each.run.id) === rerun && request.method === "POST")?.run;
			if (again !== undefined) {
				[again.attempt, again.status, again.conclusion] = [(again.attempt ?? 1) + 1, "queued", null];
				return { status: 201, body: {} };
			}
			const [pullsOf = ""] = match(/^\/repos\/([^/]+\/[^/]+)\/pulls\?state=open&sort=updated&direction=desc&per_page=100$/) ?? [];
			if (pulls[pullsOf] !== undefined) return { status: 200, body: pulls[pullsOf].map((pull) => shapedPull(pullsOf, pull)) };
			const [reviewsOf = "", number = ""] = match(/^\/repos\/([^/]+\/[^/]+)\/pulls\/(\d+)\/reviews\?per_page=100$/) ?? [];
			const pull = pulls[reviewsOf]?.find((each) => String(each.number) === number);
			if (pull !== undefined) return { status: 200, body: pull.reviews.map((review) => shapedReview(reviewsOf, pull.number, review)) };
			return undefined;
		})();
		const log = /^\/blob\/logs\/(\d+)$/.exec(path)?.[1];
		if (log !== undefined) return void response.writeHead(200, { "content-type": "text/plain" }).end(Object.values(jobs).flat().find((each) => String(each.id) === log)?.log ?? "");
		const reply = next.shift() ?? state.always ?? found ?? { status: 404, body: { message: "Not Found", documentation_url: DOCS, status: "404" } };
		response.writeHead(reply.status, { "content-type": "application/json; charset=utf-8", ...RATE, "x-ratelimit-remaining": "4999", "x-ratelimit-reset": "1767225600", ...reply.headers }).end(JSON.stringify(reply.body));
	});
	await once(http.listen(0, "127.0.0.1"), "listening");
	t.after(() => {
		http.closeAllConnections();
		http.close();
	});
	const apiUrl = `http://127.0.0.1:${(http.address() as AddressInfo).port}/`;
	return { runs, jobs, pulls, next, state, seen, apiUrl, count: (path: string) => seen.filter((each) => each.path.startsWith(path)).length };
}
