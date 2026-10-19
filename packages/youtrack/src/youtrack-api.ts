// Reading YouTrack's REST API (spec/roadmap.md, entry 44): one GET under `<url>/api/`, with the permanent token as a `Bearer`, and
// a list read page by page with `$top` and `$skip`. Every failure is one line naming the instance and the variable, never
// the token or the URL a variable holds.

export type Instance = {
	readonly name: string | undefined;
	// The name, or `(unnamed)`, as errors and refusals say it.
	readonly label: string;
	readonly urlEnv: string;
	readonly tokenEnv: string;
	// The server's URL without a trailing slash: `https://example.youtrack.cloud`, or `https://host/youtrack` for a server under a path.
	readonly base: string;
	readonly token: string;
	readonly timeoutSeconds: number;
};

// Items asked per page; a page with fewer is the last.
export const PAGE = 100;

// The JSON of `path` (e.g. `issues/SHOP-1`) with `params`; `what` names what was asked, for a 404.
export async function get(instance: Instance, path: string, params: Readonly<Record<string, string>>, what: string): Promise<unknown> {
	const { label, urlEnv, tokenEnv, token, timeoutSeconds } = instance;
	const url = new URL(`${instance.base}/api/${path}`);
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	const fail = (text: string) => new Error(`instance ${label}: ${text.replaceAll(token, "[token]").replaceAll(url.host, "[url]").replace(/\s+/g, " ").slice(0, 300)}`);
	let response: Response;
	let text: string;
	try {
		response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutSeconds * 1000) });
		text = await response.text();
	} catch (error) {
		if (error instanceof DOMException && error.name === "TimeoutError") throw fail(`no answer in ${timeoutSeconds} s from the server in ${urlEnv}`);
		const cause = error instanceof Error && typeof error.cause === "object" && error.cause !== null && "code" in error.cause ? error.cause.code : undefined;
		throw fail(`cannot reach the server in ${urlEnv}${typeof cause === "string" ? ` (${cause})` : ""}`);
	}
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {}
	const answer = (typeof body === "object" && body !== null ? body : {}) as { readonly error?: unknown; readonly error_description?: unknown };
	const said = [answer.error_description, answer.error, response.statusText].find((each) => typeof each === "string" && each.trim() !== "") ?? "no reason given";
	if (response.status === 401) throw fail(`401: the token in ${tokenEnv} was refused: ${said}`);
	if (response.status === 404) throw fail(`404: ${what} not found`);
	if (!response.ok) throw fail(`${response.status} for ${what}: ${said}`);
	if (body === undefined) throw fail(`the answer for ${what} is not JSON`);
	return body;
}

// Every item of a list, page after page, in the server's order.
export async function getAll(instance: Instance, path: string, params: Readonly<Record<string, string>>, what: string): Promise<unknown[]> {
	const items: unknown[] = [];
	for (let skip = 0; ; skip += PAGE) {
		const page = await get(instance, path, { ...params, $top: String(PAGE), $skip: String(skip) }, what);
		if (!Array.isArray(page)) throw new Error(`instance ${instance.label}: the answer for ${what} is not a list`);
		items.push(...page);
		if (page.length < PAGE) return items;
	}
}
