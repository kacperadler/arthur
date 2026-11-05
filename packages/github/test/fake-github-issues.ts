import { API, type FakeComment, type FakePull, type Reply, shapedComment, T, user } from "./fake-github.ts";

// The issues of the fake GitHub (fake-github.ts), in the shape of GitHub's documentation, every field of it: "List repository
// issues" (a pull request among them as an issue, with `pull_request`), "Get an issue", "Create an issue" (201), "Update an
// issue", "List issue comments" and "Create an issue comment" (201) of an issue, "List labels for a repository", "Add labels
// to an issue" (each name asked added, as GitHub adds a label the repository lacks).

// An issue: `state` open when left out, `reason` its `state_reason`, `user` octocat, `body` the docs' own, `labels` their names.
export type FakeIssue = {
	readonly number: number;
	readonly title: string;
	readonly updated: string;
	state?: "open" | "closed";
	reason?: "completed" | "not_planned" | "reopened" | null;
	readonly user?: string;
	readonly body?: string | null;
	labels?: string[];
	comments?: FakeComment[];
};

// A label as an issue shows it; "List labels for a repository" and "Add labels to an issue" add `archived_at` and `archived_by`.
const shapedLabel = (full: string, name: string, listed = false) => ({
	...{ id: 208045946, node_id: "MDU6TGFiZWwyMDgwNDU5NDY=", url: `${API}/repos/${full}/labels/${encodeURIComponent(name)}`, name, description: null, color: "f29513", default: false },
	...(listed ? { archived_at: null, archived_by: null } : {}),
});
// A pull request, `pull` set, shows `pull_request`, as GitHub's own example issue does.
const shapedIssue = (full: string, { number, title, updated, state = "open", reason = null, user: login = "octocat", body = "I'm having a problem with this.", labels = [], comments = [] }: FakeIssue, pull = false) => {
	const url = `${API}/repos/${full}/issues/${number}`;
	const html = `https://github.com/${full}/${pull ? "pull" : "issues"}/${number}`;
	return {
		...{ id: 2000 + number, node_id: "MDU6SXNzdWUx", url, repository_url: `${API}/repos/${full}`, labels_url: `${url}/labels{/name}`, comments_url: `${url}/comments`, events_url: `${url}/events`, html_url: html },
		...{ number, state, title, body, user: user(login, 1), pinned_comment: null, labels: labels.map((name) => shapedLabel(full, name)), assignee: null, assignees: [], milestone: null, locked: false },
		...{ active_lock_reason: null, comments: comments.length, closed_at: state === "closed" ? updated : null, created_at: T, updated_at: updated, closed_by: state === "closed" ? user("octocat", 1) : null },
		...(pull ? { pull_request: { url: `${API}/repos/${full}/pulls/${number}`, html_url: html, diff_url: `${html}.diff`, patch_url: `${html}.patch` } } : {}),
		...{ author_association: "COLLABORATOR", state_reason: reason },
	};
};
const asIssue = (pull: FakePull): FakeIssue => ({ ...pull, state: pull.merged === undefined ? (pull.state ?? "open") : "closed", body: pull.body ?? null });

// The answer of `issues[<owner>/<repo>]`'s routes, its pull requests `pulls[<owner>/<repo>]` after its issues, undefined for a
// path none answers. `paged` pages a list as fake-github.ts does; an issue created takes the next number, a comment the next id.
export function issueRoute(method: string, url: URL, asked: Readonly<Record<string, unknown>>, issues: Record<string, FakeIssue[]>, labels: Record<string, string[]>, pulls: Record<string, FakePull[]>, paged: (items: readonly unknown[]) => Reply): Reply | undefined {
	const [, owner = ""] = /^\/repos\/([^/]+\/[^/]+)\/labels$/.exec(url.pathname) ?? [];
	if (owner !== "") return paged((labels[owner] ?? []).map((name) => shapedLabel(owner, name, true)));
	const [, full = "", number = "", rest = ""] = /^\/repos\/([^/]+\/[^/]+)\/issues(?:\/(\d+)(\/labels|\/comments)?)?$/.exec(url.pathname) ?? [];
	const listed = issues[full];
	if (listed === undefined) return undefined;
	const all = [...listed.map((issue) => ({ issue, pull: false })), ...(pulls[full] ?? []).map((pull) => ({ issue: asIssue(pull), pull: true }))];
	if (number === "" && method === "POST") {
		const made: FakeIssue = { number: Math.max(0, ...all.map((each) => each.issue.number)) + 1, title: String(asked.title ?? ""), updated: T, body: typeof asked.body === "string" ? asked.body : null };
		listed.push(made);
		return { status: 201, body: shapedIssue(full, made) };
	}
	const wanted = url.searchParams.get("state") ?? "open";
	if (number === "") return paged(all.filter((each) => wanted === "all" || (each.issue.state ?? "open") === wanted).map((each) => shapedIssue(full, each.issue, each.pull)));
	const found = all.find((each) => String(each.issue.number) === number);
	const issue = listed.find((each) => String(each.number) === number);
	if (found === undefined) return undefined;
	if (rest === "/labels" && method === "POST" && issue !== undefined) {
		issue.labels = [...new Set([...(issue.labels ?? []), ...(asked.labels as string[])])];
		return { status: 200, body: issue.labels.map((name) => shapedLabel(full, name, true)) };
	}
	if (rest === "/comments" && issue !== undefined) {
		if (method !== "POST") return paged((issue.comments ?? []).map((comment) => shapedComment(full, issue.number, comment)));
		const ids = [...Object.values(issues), ...Object.values(pulls)].flat().flatMap((each) => (each.comments ?? []).map((one) => one.id));
		const added = { id: Math.max(0, ...ids) + 1, user: "octocat", body: String(asked.body ?? "") };
		issue.comments = [...(issue.comments ?? []), added];
		return { status: 201, body: shapedComment(full, issue.number, added, true) };
	}
	if (rest !== "") return undefined;
	if (method === "PATCH" && issue !== undefined) [issue.state, issue.reason] = [asked.state as "open" | "closed", asked.state_reason as "completed"];
	return { status: 200, body: shapedIssue(full, issue ?? found.issue, issue === undefined) };
}
