// Dokploy's REST API (AR0588): a GET of `<url>/api/<procedure>` with the API key as `x-api-key`, never following a redirect,
// so the key goes only to the configured server. Every failure is one line naming the instance, the key never in it.

export type Instance = {
	readonly name: string | undefined;
	// The name, or `(unnamed)`, as errors and output say it.
	readonly label: string;
	readonly tokenEnv: string;
	// The configured url without a trailing slash: `https://dokploy.example.com`, or `https://host/dokploy` under a path.
	readonly base: string;
	readonly token: string;
	readonly timeoutSeconds: number;
};

// A Dokploy id (nanoid's alphabet), the only text a command puts into a query.
export const ID = /^[A-Za-z0-9_-]{1,64}$/;

// The JSON `procedure` (e.g. `application.one`) answers with `query`; `what` names what was asked, for a 404 and any other refusal.
export async function call(instance: Instance, procedure: string, query: Readonly<Record<string, string>>, what: string): Promise<unknown> {
	const { label, tokenEnv, token, base, timeoutSeconds } = instance;
	const url = new URL(`${base}/api/${procedure}`);
	for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
	const fail = (said: string) => new Error(`instance ${label}: ${text(said.replaceAll(token, "[token]").replace(/\s+/g, " ")).slice(0, 300)}`);
	let response: Response;
	let body: string;
	try {
		response = await fetch(url, { headers: { "x-api-key": token, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(timeoutSeconds * 1000) });
		body = await response.text();
	} catch (error) {
		if (error instanceof DOMException && error.name === "TimeoutError") throw fail(`no answer in ${timeoutSeconds} s from ${base} for ${what}`);
		const cause = error instanceof Error && error.cause instanceof Error ? error.cause : undefined;
		// fetch carries a custom header to wherever a redirect points, so none is followed.
		if (cause?.message === "unexpected redirect") throw fail(`${base} answered ${what} with a redirect, which is not followed: the token goes only to the configured url`);
		const code = cause !== undefined && "code" in cause && typeof cause.code === "string" ? ` (${cause.code})` : "";
		throw fail(`cannot reach ${base} for ${what}${code}`);
	}
	let answer: unknown;
	try {
		answer = JSON.parse(body);
	} catch {
		if (response.ok) throw fail(`the answer for ${what} is not JSON`);
	}
	if (response.ok) return answer;
	// Dokploy's error body: `{ message, code, issues }`, or `{ message }` alone for a key it does not know.
	const said = [field(answer, "message"), response.statusText].find((each) => typeof each === "string" && each.trim() !== "") ?? "no reason given";
	if (response.status === 401) throw fail(`401: the token in ${tokenEnv} was refused: ${said}`);
	if (response.status === 403) throw fail(`403: the token's user may not read ${what}: ${said}`);
	if (response.status === 404) throw fail(`404: ${what} not found`);
	throw fail(`${response.status} for ${what}: ${said}`);
}

// A key of an item of Dokploy's JSON, undefined when the item is not an object or lacks it.
export function field(item: unknown, key: string): unknown {
	return typeof item === "object" && item !== null && key in item ? (item as Readonly<Record<string, unknown>>)[key] : undefined;
}

// Dokploy's text as one line that may be printed: control characters, which could drive the terminal, dropped; `unknown`
// for a value that is no text or number, so a key a later Dokploy drops prints, not crashes.
export function text(value: unknown): string {
	return typeof value === "string" || typeof value === "number" ? String(value).replace(/[\u0000-\u001f\u007f-\u009f]/g, "") : "unknown";
}
