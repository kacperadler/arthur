// GitHub's REST API (spec/roadmap.md, entries 57 and 58), with the token as a `Bearer`: one request, `ask`, a list page after
// page, `pages`, and a workflow's newest runs. A refusal is one line naming the instance or the repository and the variable,
// never the token; a rate limit answers when the next request may go, as GitHub's "Rate limits for the REST API" says.

export type Instance = {
	readonly name: string | undefined;
	// The name, or `(unnamed)`, as errors say it.
	readonly label: string;
	readonly tokenEnv: string;
	// Without a trailing slash: `https://api.github.com`.
	readonly apiUrl: string;
	readonly token: string;
};
// A project's checkout, its repository (`owner/name`) and the instance that reads it; `Watched`, one with a `github.project({ workflow })`.
export type Repository = { readonly project: string; readonly path: string; readonly repo: string; readonly instance: Instance };
export type Watched = Repository & { readonly workflow: string };

// `attempt` is GitHub's `run_attempt`: a rerun keeps the run's `id` and raises it. `startedAt` is the attempt's start,
// `run_started_at` (else `created_at`), as GitHub writes it.
export type Run = { readonly id: number; readonly attempt: number; readonly sha: string; readonly branch: string | null; readonly status: string; readonly conclusion: string | null; readonly url: string; readonly startedAt: string | null };
// `loud` when the owner must act (a token refused, a workflow not found): a notice, else a line on stderr; `until` the time in
// ms before which the instance asks nothing more.
export type Failure = { readonly text: string; readonly loud: boolean; readonly until?: number };
export type Runs = { readonly runs: readonly Run[]; readonly until?: number };
// A 2xx answer: its text, its JSON when it is some, and GitHub's `date` header (its clock, whole seconds) when it sent one.
export type Answer = { readonly body: unknown; readonly text: string; readonly until?: number; readonly date?: string };

// GitHub's largest page: the runs asked per poll, so a branch whose nearest run is older than these has none, and a list's page.
export const PER_PAGE = 100;
// The pages `pages` asks at most, and what a list cut there says after its name.
const PAGES = 10;
export const CUT = `stop at ${PAGES} pages of ${PER_PAGE}: GitHub may hold more`;
const TIMEOUT_MS = 30_000;
// A secondary rate limit that says no time: "wait for at least one minute before retrying".
const MINUTE_MS = 60_000;

// A key of an answer's object, undefined when it is no object or lacks it.
export const field = (item: unknown, key: string): unknown => (typeof item === "object" && item !== null && key in item ? (item as Readonly<Record<string, unknown>>)[key] : undefined);

// One request of `path`, from the API's root; `what` is the thing asked and `needs` the token's permission on it, as a
// refusal names them. A redirect is followed (a job's log).
export async function ask(instance: Instance, path: string, what: string, needs: string, signal: AbortSignal, method = "GET"): Promise<Answer | Failure> {
	const { label, tokenEnv, apiUrl, token } = instance;
	let response: Response;
	let text: string;
	let body: unknown;
	try {
		const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "arthur" };
		response = await fetch(`${apiUrl}${path}`, { method, headers, signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) });
		text = await response.text();
		try {
			body = JSON.parse(text);
		} catch {}
	} catch (error) {
		const cause = error instanceof Error && typeof error.cause === "object" && error.cause !== null && "code" in error.cause ? error.cause.code : undefined;
		const why = error instanceof DOMException && error.name === "TimeoutError" ? `no answer in ${TIMEOUT_MS / 1000} s` : `cannot reach it${typeof cause === "string" ? ` (${cause})` : ""}`;
		return { text: `instance ${label}: ${apiUrl}: ${why}`, loud: false };
	}
	const message = field(body, "message");
	const said = (typeof message === "string" ? message : response.statusText || "no reason given").replaceAll(token, "[token]").replace(/\s+/g, " ").slice(0, 300);
	const until = waitUntil(response, said);
	const date = response.headers.get("date");
	if (response.ok) return { body, text, ...(until === undefined ? {} : { until }), ...(date === null ? {} : { date }) };
	if (until !== undefined) return { text: `instance ${label}: ${response.status}, rate limited: ${said}; no request until ${new Date(until).toISOString()}`, loud: false, until };
	if (response.status === 401) return { text: `instance ${label}: 401: the token in ${tokenEnv} was refused: ${said}`, loud: true };
	if (response.status === 403) return { text: `instance ${label}: 403 for ${what}: ${said}; the token in ${tokenEnv} needs ${needs} on it`, loud: true };
	if (response.status === 404) return { text: `instance ${label}: 404: ${what} not found, or the token in ${tokenEnv} cannot see it`, loud: true };
	return { text: `instance ${label}: ${response.status} for ${what}: ${said}`, loud: false };
}

// The newest runs of `workflow` (its file name or id) in `repo` (`owner/name`), newest first.
export async function workflowRuns(instance: Instance, repo: string, workflow: string, signal: AbortSignal): Promise<Runs | Failure> {
	const what = `workflow ${workflow} of ${repo}`;
	const answer = await ask(instance, `/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=${PER_PAGE}&exclude_pull_requests=true`, what, "Actions: read", signal);
	if (!("body" in answer)) return answer;
	const list = field(answer.body, "workflow_runs");
	if (!Array.isArray(list)) return { text: `instance ${instance.label}: the answer for ${what} holds no workflow_runs`, loud: false };
	return { runs: list.flatMap((each) => run(each) ?? []), ...(answer.until === undefined ? {} : { until: answer.until }) };
}

// Every item of the list at `path`, in GitHub's order, page after page of `PER_PAGE`, at most `PAGES` pages: `cut` when the
// last one asked was full, so GitHub may hold more.
export async function pages(instance: Instance, path: string, what: string, needs: string, signal: AbortSignal): Promise<{ readonly items: readonly unknown[]; readonly cut: boolean } | Failure> {
	const items: unknown[] = [];
	for (let page = 1; page <= PAGES; page++) {
		const answer = await ask(instance, `${path}${path.includes("?") ? "&" : "?"}per_page=${PER_PAGE}&page=${page}`, what, needs, signal);
		if (!("body" in answer)) return answer;
		if (!Array.isArray(answer.body)) return { text: `instance ${instance.label}: the answer for ${what} is no list`, loud: false };
		items.push(...answer.body);
		if (answer.body.length < PER_PAGE) return { items, cut: false };
	}
	return { items, cut: true };
}

// When the next request may go, in ms, when the answer says to wait: `retry-after` seconds; else, the requests left at 0,
// `x-ratelimit-reset` (epoch seconds); else a 429, or a 403 that names a rate limit, one minute. Undefined: no wait.
function waitUntil(response: Response, said: string): number | undefined {
	const header = (name: string) => response.headers.get(name);
	const after = Number(header("retry-after") ?? Number.NaN);
	if (!response.ok && Number.isFinite(after)) return Date.now() + Math.max(0, after) * 1000;
	const reset = Number(header("x-ratelimit-reset") ?? Number.NaN);
	if (header("x-ratelimit-remaining") === "0" && Number.isFinite(reset)) return reset * 1000;
	if (response.status === 429 || (response.status === 403 && /rate limit/i.test(said))) return Date.now() + MINUTE_MS;
	return undefined;
}

// One run of the answer's `workflow_runs`, undefined when it lacks a field the plugin reads; a server without `run_attempt`
// (an older GitHub Enterprise Server) has first attempts only.
function run(item: unknown): Run | undefined {
	const [id, attempt, sha, branch, status, conclusion, url, started, created] = ["id", "run_attempt", "head_sha", "head_branch", "status", "conclusion", "html_url", "run_started_at", "created_at"].map((key) => field(item, key));
	if (typeof id !== "number" || typeof sha !== "string" || typeof status !== "string" || typeof url !== "string") return undefined;
	const startedAt = typeof started === "string" ? started : typeof created === "string" ? created : null;
	return { id, attempt: typeof attempt === "number" ? attempt : 1, sha, branch: typeof branch === "string" ? branch : null, status, conclusion: typeof conclusion === "string" ? conclusion : null, url, startedAt };
}
