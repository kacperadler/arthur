// YouTrack's REST API (spec/roadmap.md, entries 44 to 46): one GET, or a POST of JSON, under `<url>/api/`, with the permanent
// token as a `Bearer`, a list read page by page with `$top` and `$skip`, and a file's bytes. Every failure is one line naming
// the instance and the variable, never the token or the URL a variable holds.

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

// The JSON of `path` (e.g. `issues/SHOP-1`) with `params`, sent `body` as JSON in a POST when given; `what` names what was
// asked, for a 404 and any other refusal.
export async function call(instance: Instance, path: string, params: Readonly<Record<string, string>>, what: string, body?: unknown): Promise<unknown> {
	const url = new URL(`${instance.base}/api/${path}`);
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	const bytes = await request(instance, url, what, body === undefined ? undefined : JSON.stringify(body));
	try {
		return JSON.parse(bytes.toString("utf8"));
	} catch {
		throw new Error(`instance ${instance.label}: the answer for ${what} is not JSON`);
	}
}

// The bytes `url` answers, a file's too, after a POST of the JSON `body` when given; the token goes along, so `url` is on the
// instance's own server.
export async function request(instance: Instance, url: URL, what: string, body?: string): Promise<Buffer> {
	const { label, urlEnv, tokenEnv, token, timeoutSeconds } = instance;
	const fail = (text: string) => new Error(`instance ${label}: ${text.replaceAll(token, "[token]").replaceAll(url.host, "[url]").replace(/\s+/g, " ").slice(0, 300)}`);
	let response: Response;
	let bytes: Buffer;
	try {
		// JSON first; a file answers in its own type.
		const headers = { Authorization: `Bearer ${token}`, Accept: "application/json, */*;q=0.1", ...(body === undefined ? {} : { "Content-Type": "application/json" }) };
		response = await fetch(url, { headers, ...(body === undefined ? {} : { method: "POST", body }), signal: AbortSignal.timeout(timeoutSeconds * 1000) });
		bytes = Buffer.from(await response.arrayBuffer());
	} catch (error) {
		if (error instanceof DOMException && error.name === "TimeoutError") throw fail(`no answer in ${timeoutSeconds} s from the server in ${urlEnv}`);
		const cause = error instanceof Error && typeof error.cause === "object" && error.cause !== null && "code" in error.cause ? error.cause.code : undefined;
		throw fail(`cannot reach the server in ${urlEnv}${typeof cause === "string" ? ` (${cause})` : ""}`);
	}
	if (response.ok) return bytes;
	let answer: unknown;
	try {
		answer = JSON.parse(bytes.toString("utf8"));
	} catch {}
	const error = (typeof answer === "object" && answer !== null ? answer : {}) as { readonly error?: unknown; readonly error_description?: unknown };
	const said = [error.error_description, error.error, response.statusText].find((each) => typeof each === "string" && each.trim() !== "") ?? "no reason given";
	if (response.status === 401) throw fail(`401: the token in ${tokenEnv} was refused: ${said}`);
	if (response.status === 404) throw fail(`404: ${what} not found`);
	throw fail(`${response.status} for ${what}: ${said}`);
}

// Every item of a list, page after page, in the server's order.
export async function getAll(instance: Instance, path: string, params: Readonly<Record<string, string>>, what: string): Promise<unknown[]> {
	const items: unknown[] = [];
	for (let skip = 0; ; skip += PAGE) {
		const page = await call(instance, path, { ...params, $top: String(PAGE), $skip: String(skip) }, what);
		if (!Array.isArray(page)) throw new Error(`instance ${instance.label}: the answer for ${what} is not a list`);
		items.push(...page);
		if (page.length < PAGE) return items;
	}
}

// A key of an item of YouTrack's JSON, undefined when the item is not an object or lacks it.
export function field(item: unknown, key: string): unknown {
	return typeof item === "object" && item !== null && key in item ? (item as Readonly<Record<string, unknown>>)[key] : undefined;
}
