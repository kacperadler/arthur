import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { TestContext } from "node:test";

// A fake GitHub REST API on a loopback port the OS picks, answering in the shape of GitHub's documentation, every field of it:
// "List workflow runs for a workflow", "List jobs for a workflow run attempt", "Download job logs for a workflow run" (a 302
// to the log's text), "Re-run a workflow" (201, the run's next attempt queued), "Cancel a workflow run" (202, the run
// cancelled; 409 for one completed), "List pull requests", "Get a pull request", "List reviews for a pull request", "List
// issue comments", with the `link` header of "Using pagination in the REST API" on each page that has a next one, and the
// headers of "Rate limits for the REST API".

export type FakeRun = { readonly id: number; attempt?: number; readonly sha: string; readonly branch: string; status: "queued" | "in_progress" | "completed"; conclusion: "success" | "failure" | "cancelled" | null; readonly started?: string };
export type FakeStep = { readonly name: string; readonly conclusion: "success" | "failure" | "skipped" };
export type FakeJob = { readonly id: number; readonly name: string; readonly conclusion: "success" | "failure"; readonly steps: readonly FakeStep[]; readonly log: string };
// `submitted`, GitHub's `submitted_at` of a review not pending: 2026-01-01 when left out, none when null.
export type FakeReview = { readonly id: number; readonly user: string; readonly state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "PENDING"; readonly body: string; readonly submitted?: string | null };
// A pull request: `state` open when left out, `merged` its `merged_at` (closed then), `user` octocat, `body` the docs' own.
export type FakePull = {
	readonly number: number;
	readonly title: string;
	readonly branch: string;
	updated: string;
	readonly reviews: FakeReview[];
	readonly state?: "open" | "closed";
	readonly merged?: string;
	readonly draft?: boolean;
	readonly user?: string;
	readonly body?: string | null;
	readonly comments?: readonly FakeComment[];
};
export type FakeComment = { readonly id: number; readonly user: string; readonly body: string; readonly created?: string };
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
const shapedRun = (full: string, workflow: string, { id, attempt = 1, sha, branch, status, conclusion, started = T }: FakeRun) => ({
	...{ id, name: "CI", node_id: "MDEyOldvcmtmbG93IFJ1bjI2OTI4OQ==", check_suite_id: 42, check_suite_node_id: "MDEwOkNoZWNrU3VpdGU0Mg==", head_branch: branch, head_sha: sha, path: `.github/workflows/${workflow}@${branch}` },
	...{ run_number: id % 1000, event: "push", display_title: `on ${branch}`, status, conclusion, workflow_id: 159038, url: `${API}/repos/${full}/actions/runs/${id}`, html_url: `https://github.com/${full}/actions/runs/${id}` },
	...{ pull_requests: [], created_at: T, updated_at: "2026-01-01T00:01:00Z", actor: user("octocat", 1), run_attempt: attempt, run_started_at: started, triggering_actor: user("octocat", 1) },
	...Object.fromEntries(["jobs", "logs", "artifacts", "cancel", "rerun"].map((each) => [`${each}_url`, `${API}/repos/${full}/actions/runs/${id}/${each}`])),
	...{ check_suite_url: `${API}/repos/${full}/check-suites/414944374`, workflow_url: `${API}/repos/${full}/actions/workflows/159038` },
	head_commit: { id: sha, tree_id: "d23f6eedb1e1b9610bbc754ddb5197bfe7271223", message: `on ${branch}`, timestamp: T, author: { name: "test", email: "test@example.com" }, committer: { name: "test", email: "test@example.com" } },
	...{ repository: { ...repo(full), git_url: `git:github.com/${full}.git`, ssh_url: `git@github.com:${full}.git` }, head_repository: repo(full) },
});
const shapedJob = (full: string, run: FakeRun, { id, name, conclusion, steps }: FakeJob) => ({
	...{ id, run_id: run.id, run_url: `${API}/repos/${full}/actions/runs/${run.id}`, node_id: "MDg6Q2hlY2tSdW40", head_sha: run.sha, url: `${API}/repos/${full}/actions/jobs/${id}` },
	...{ html_url: `https://github.com/${full}/runs/${id}`, status: "completed", conclusion, started_at: T, completed_at: T, name, check_run_url: `${API}/repos/${full}/check-runs/${id}` },
	steps: steps.map((step, index) => ({ status: "completed", conclusion: step.conclusion, name: step.name, number: index + 1, started_at: T, completed_at: T })),
	...{ labels: ["ubuntu-latest"], runner_id: 1, runner_name: "GitHub Actions 1", runner_group_id: 2, runner_group_name: "GitHub Actions", workflow_name: "CI", head_branch: run.branch },
});
// A pull request's head or base repository, as "List pull requests" shows it; "Get a pull request" shows `has_discussions`
// instead of the last seven keys of a listed one's, and its head `allow_forking` too.
const pullRepo = (full: string, shown: "listed" | "head" | "base") => ({
	...repo(full),
	...{ git_url: `git:github.com/${full}.git`, ssh_url: `git@github.com:${full}.git`, clone_url: `https://github.com/${full}.git`, mirror_url: null, svn_url: `https://svn.github.com/${full}`, homepage: null, language: null },
	...{ forks_count: 0, stargazers_count: 0, watchers_count: 0, size: 108, default_branch: "main", open_issues_count: 0, topics: [], has_issues: true, has_projects: true, has_wiki: true, has_pages: false },
	...{ has_downloads: true, archived: false, disabled: false, pushed_at: T, created_at: T, updated_at: T, permissions: { admin: false, push: false, pull: true }, allow_rebase_merge: true, temp_clone_token: null },
	...{ allow_squash_merge: true, allow_merge_commit: true, forks: 0, open_issues: 0, license: null, watchers: 0 },
	...(shown === "listed" ? { is_template: false, visibility: "public", template_repository: null, allow_auto_merge: false, delete_branch_on_merge: false, subscribers_count: 0, network_count: 0 } : { has_discussions: false }),
	...(shown === "head" ? { allow_forking: true } : {}),
});
const branchOf = (full: string, ref: string, sha: string, shown: "listed" | "head" | "base") => ({ label: `${full.split("/")[0]}:${ref}`, ref, sha, user: user(full.split("/")[0] ?? "", 1), repo: pullRepo(full, shown) });
const shapedPull = (full: string, { number, title, branch, updated, state = "open", merged, draft = false, user: login = "octocat", body = "Please pull these awesome changes" }: FakePull, listed = true) => {
	const url = `${API}/repos/${full}/pulls/${number}`;
	const links = { self: url, html: `https://github.com/${full}/pull/${number}`, issue: `${API}/repos/${full}/issues/${number}`, comments: `${API}/repos/${full}/issues/${number}/comments` };
	const closed = merged ?? (state === "closed" ? updated : null);
	return {
		...{ url, id: 1000 + number, node_id: "MDExOlB1bGxSZXF1ZXN0MQ==", html_url: links.html, diff_url: `${links.html}.diff`, patch_url: `${links.html}.patch`, issue_url: links.issue, commits_url: `${url}/commits` },
		...{ review_comments_url: `${url}/comments`, review_comment_url: `${API}/repos/${full}/pulls/comments{/number}`, comments_url: links.comments, statuses_url: `${API}/repos/${full}/statuses/abc`, number, state: merged === undefined ? state : "closed", locked: false, title },
		...{ user: user(login, 1), body, labels: [], milestone: null, active_lock_reason: null, created_at: T, updated_at: updated, closed_at: closed, merged_at: merged ?? null, merge_commit_sha: merged === undefined ? null : "e5bd3914e2e596debea16f433f57875b5b90bcd6" },
		...{ assignee: null, assignees: [], requested_reviewers: [], requested_teams: [] },
		...{ head: branchOf(full, branch, "6dcb09b5b57875f334f61aebed695e2e4193db5e", listed ? "listed" : "head"), base: branchOf(full, "main", "6dcb09b5b57875f334f61aebed695e2e4193db5e", listed ? "listed" : "base") },
		_links: Object.fromEntries(
			Object.entries({ ...links, review_comments: `${url}/comments`, review_comment: `${API}/repos/${full}/pulls/comments{/number}`, commits: `${url}/commits`, statuses: `${API}/repos/${full}/statuses/abc` }).map(([key, href]) => [key, { href }]),
		),
		...{ author_association: "OWNER", auto_merge: null, draft },
	};
};
// "Get a pull request" adds these to a listed one.
const fullPull = (full: string, pull: FakePull) => ({
	...shapedPull(full, pull, false),
	...{ merged: pull.merged !== undefined, mergeable: true, rebaseable: true, mergeable_state: "clean", merged_by: pull.merged === undefined ? null : user("octocat", 1), comments: pull.comments?.length ?? 0 },
	...{ review_comments: 0, maintainer_can_modify: true, commits: 3, additions: 100, deletions: 3, changed_files: 5 },
});
const shapedComment = (full: string, number: number, { id, user: login, body, created = T }: FakeComment) => ({
	...{ id, node_id: "MDEyOklzc3VlQ29tbWVudDE=", url: `${API}/repos/${full}/issues/comments/${id}`, html_url: `https://github.com/${full}/issues/${number}#issuecomment-${id}`, body, user: user(login, 3) },
	...{ created_at: created, updated_at: created, issue_url: `${API}/repos/${full}/issues/${number}`, author_association: "COLLABORATOR", minimized: null },
});
const shapedReview = (full: string, number: number, { id, user: login, state, body, submitted = T }: FakeReview) => ({
	...{ id, node_id: "MDE3OlB1bGxSZXF1ZXN0UmV2aWV3ODA=", user: user(login, 2), body, state, html_url: `https://github.com/${full}/pull/${number}#pullrequestreview-${id}`, pull_request_url: `${API}/repos/${full}/pulls/${number}` },
	_links: { html: { href: `https://github.com/${full}/pull/${number}#pullrequestreview-${id}` }, pull_request: { href: `${API}/repos/${full}/pulls/${number}` } },
	...(state === "PENDING" || submitted === null ? {} : { submitted_at: submitted }),
	...{ commit_id: "ecdd80bb57125d7ba9641ffaa4d7d2c19d3f3091", author_association: "COLLABORATOR" },
});

// `runs[<owner>/<repo>/<workflow>]` newest first; `jobs[<run id>]` the jobs of its attempt, each with its log; `pulls[<owner>/<repo>]`
// its pull requests, listed in that order by `state` (`open`, GitHub's default, `closed` or `all`), each with its reviews and
// comments, every list paged by `per_page` (GitHub's default 30) and `page`; `next` replies once each, before anything else;
// `always` replies to every request while set, `post` to every POST; `clock` is GitHub's clock less this machine's, in ms, as
// its `date` header says it (null: no `date`); `slow` the ms an answer waits after its request, its body taken at the request.
// `seen` holds each request: its method, path, time and Authorization.
export async function fakeGithub(t: TestContext) {
	const runs: Record<string, FakeRun[]> = {};
	const jobs: Record<number, FakeJob[]> = {};
	const pulls: Record<string, FakePull[]> = {};
	const next: Reply[] = [];
	const state: { always?: Reply; post?: Reply; clock?: number | null; slow?: number } = {};
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
			const [stop = ""] = match(/^\/repos\/[^/]+\/[^/]+\/actions\/runs\/(\d+)\/cancel$/) ?? [];
			const cancelled = everyRun.find((each) => String(each.run.id) === stop && request.method === "POST")?.run;
			if (cancelled?.status === "completed") return { status: 409, body: { message: "Cannot cancel a workflow run that is completed.", documentation_url: DOCS, status: "409" } };
			if (cancelled !== undefined) {
				[cancelled.status, cancelled.conclusion] = ["completed", "cancelled"];
				return { status: 202, body: {} };
			}
			const url = new URL(path, "http://fake");
			const paged = (items: readonly unknown[]): Reply => {
				const [per, page] = [Number(url.searchParams.get("per_page") ?? 30), Number(url.searchParams.get("page") ?? 1)];
				const after = new URLSearchParams({ ...Object.fromEntries(url.searchParams), page: String(page + 1) });
				return { status: 200, body: items.slice((page - 1) * per, page * per), ...(items.length > page * per ? { headers: { link: `<${API}${url.pathname}?${after}>; rel="next"` } } : {}) };
			};
			const [listOf = ""] = match(/^\/repos\/([^/]+\/[^/]+)\/pulls(?:\?|$)/) ?? [];
			const wanted = url.searchParams.get("state") ?? "open";
			const stateOf = (pull: FakePull) => pull.state ?? (pull.merged === undefined ? "open" : "closed");
			if (pulls[listOf] !== undefined) return paged(pulls[listOf].filter((pull) => wanted === "all" || stateOf(pull) === wanted).map((pull) => shapedPull(listOf, pull)));
			const find = (pattern: RegExp) => {
				const [of = "", number = ""] = match(pattern) ?? [];
				return { of, pull: pulls[of]?.find((each) => String(each.number) === number) };
			};
			const got = find(/^\/repos\/([^/]+\/[^/]+)\/pulls\/(\d+)$/);
			if (got.pull !== undefined) return { status: 200, body: fullPull(got.of, got.pull) };
			const reviewed = find(/^\/repos\/([^/]+\/[^/]+)\/pulls\/(\d+)\/reviews\?/);
			if (reviewed.pull !== undefined) return paged(reviewed.pull.reviews.map((review) => shapedReview(reviewed.of, reviewed.pull!.number, review)));
			const said = find(/^\/repos\/([^/]+\/[^/]+)\/issues\/(\d+)\/comments\?/);
			if (said.pull !== undefined) return paged((said.pull.comments ?? []).map((comment) => shapedComment(said.of, said.pull!.number, comment)));
			return undefined;
		})();
		const log = /^\/blob\/logs\/(\d+)$/.exec(path)?.[1];
		if (log !== undefined) return void response.writeHead(200, { "content-type": "text/plain" }).end(Object.values(jobs).flat().find((each) => String(each.id) === log)?.log ?? "");
		const reply = next.shift() ?? state.always ?? found ?? { status: 404, body: { message: "Not Found", documentation_url: DOCS, status: "404" } };
		const answer = () => {
			response.sendDate = false;
			const date = state.clock === null ? {} : { date: new Date(Date.now() + (state.clock ?? 0)).toUTCString() };
			response.writeHead(reply.status, { "content-type": "application/json; charset=utf-8", ...date, ...RATE, "x-ratelimit-remaining": "4999", "x-ratelimit-reset": "1767225600", ...reply.headers }).end(JSON.stringify(reply.body));
		};
		if (state.slow === undefined) answer();
		else setTimeout(answer, state.slow);
	});
	await once(http.listen(0, "127.0.0.1"), "listening");
	t.after(() => {
		http.closeAllConnections();
		http.close();
	});
	const apiUrl = `http://127.0.0.1:${(http.address() as AddressInfo).port}/`;
	return { runs, jobs, pulls, next, state, seen, apiUrl, count: (path: string) => seen.filter((each) => each.path.startsWith(path)).length };
}
