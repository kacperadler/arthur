// GitHub's REST API (spec/roadmap.md, entry 57): a workflow's newest runs, `GET /repos/{owner}/{repo}/actions/workflows/
// {workflow}/runs`, with the token as a `Bearer`. A refusal is one line naming the instance or the repository and the
// variable, never the token; a rate limit answers when the next request may go, as GitHub's "Rate limits for the REST API" says.

export type Instance = {
	readonly name: string | undefined;
	// The name, or `(unnamed)`, as errors say it.
	readonly label: string;
	readonly tokenEnv: string;
	// Without a trailing slash: `https://api.github.com`.
	readonly apiUrl: string;
	readonly token: string;
};

export type Run = { readonly id: number; readonly sha: string; readonly branch: string | null; readonly status: string; readonly conclusion: string | null; readonly url: string };
// `loud` when the owner must act (a token refused, a workflow not found): a notice, else a line on stderr; `until` the time in
// ms before which the instance asks nothing more.
export type Failure = { readonly text: string; readonly loud: boolean; readonly until?: number };
export type Runs = { readonly runs: readonly Run[]; readonly until?: number };

// Runs asked per poll: GitHub's largest page. A branch whose nearest run is older than these has none.
export const PER_PAGE = 100;
const TIMEOUT_MS = 30_000;
// A secondary rate limit that says no time: "wait for at least one minute before retrying".
const MINUTE_MS = 60_000;

// The newest runs of `workflow` (its file name or id) in `repo` (`owner/name`), newest first.
export async function workflowRuns(instance: Instance, repo: string, workflow: string, signal: AbortSignal): Promise<Runs | Failure> {
	const { label, tokenEnv, apiUrl, token } = instance;
	const what = `workflow ${workflow} of ${repo}`;
	const url = `${apiUrl}/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=${PER_PAGE}&exclude_pull_requests=true`;
	let response: Response;
	let body: unknown;
	try {
		const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "arthur" };
		response = await fetch(url, { headers, signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) });
		const text = await response.text();
		try {
			body = JSON.parse(text);
		} catch {}
	} catch (error) {
		const cause = error instanceof Error && typeof error.cause === "object" && error.cause !== null && "code" in error.cause ? error.cause.code : undefined;
		const why = error instanceof DOMException && error.name === "TimeoutError" ? `no answer in ${TIMEOUT_MS / 1000} s` : `cannot reach it${typeof cause === "string" ? ` (${cause})` : ""}`;
		return { text: `instance ${label}: ${apiUrl}: ${why}`, loud: false };
	}
	const message = typeof body === "object" && body !== null && "message" in body && typeof body.message === "string" ? body.message : response.statusText || "no reason given";
	const said = message.replaceAll(token, "[token]").replace(/\s+/g, " ").slice(0, 300);
	const until = waitUntil(response, said);
	if (response.ok) {
		const list = typeof body === "object" && body !== null && "workflow_runs" in body && Array.isArray(body.workflow_runs) ? (body.workflow_runs as unknown[]) : undefined;
		if (list === undefined) return { text: `instance ${label}: the answer for ${what} holds no workflow_runs`, loud: false };
		return { runs: list.flatMap((each) => run(each) ?? []), ...(until === undefined ? {} : { until }) };
	}
	if (until !== undefined) return { text: `instance ${label}: ${response.status}, rate limited: ${said}; no request until ${new Date(until).toISOString()}`, loud: false, until };
	if (response.status === 401) return { text: `instance ${label}: 401: the token in ${tokenEnv} was refused: ${said}`, loud: true };
	if (response.status === 403) return { text: `instance ${label}: 403 for ${what}: ${said}; the token in ${tokenEnv} needs Actions: read on it`, loud: true };
	if (response.status === 404) return { text: `instance ${label}: 404: ${what} not found, or the token in ${tokenEnv} cannot see it`, loud: true };
	return { text: `instance ${label}: ${response.status} for ${what}: ${said}`, loud: false };
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

// One run of the answer's `workflow_runs`, undefined when it lacks a field the plugin reads.
function run(item: unknown): Run | undefined {
	const field = (key: string) => (typeof item === "object" && item !== null && key in item ? (item as Readonly<Record<string, unknown>>)[key] : undefined);
	const [id, sha, branch, status, conclusion, url] = ["id", "head_sha", "head_branch", "status", "conclusion", "html_url"].map(field);
	if (typeof id !== "number" || typeof sha !== "string" || typeof status !== "string" || typeof url !== "string") return undefined;
	return { id, sha, branch: typeof branch === "string" ? branch : null, status, conclusion: typeof conclusion === "string" ? conclusion : null, url };
}
