// Telegram's Bot API (spec/roadmap.md, entry 47): one POST of JSON to `<apiUrl>/bot<token>/<method>`, answered
// `{ ok, result }` or `{ ok: false, error_code, description }`. A failure is one line naming the bot and the method, never the
// token, which is part of the URL.

export type Bot = {
	// The name, absent for the unnamed bot; `label` is how errors say it: the name, or `(unnamed)`.
	readonly name?: string;
	readonly label: string;
	readonly token: string;
	readonly chat: number;
	readonly apiUrl: string;
};

// A refusal or no answer; `code` is Telegram's `error_code`, 0 when none came; `retryAfter` its `parameters.retry_after`, the
// seconds a 429 says to wait, 0 when it says none.
export type ApiError = Error & { readonly code: number; readonly retryAfter: number };

export async function call(bot: Bot, method: string, params: Readonly<Record<string, unknown>>, signal: AbortSignal): Promise<unknown> {
	const fail = (code: number, text: string, retryAfter = 0): ApiError =>
		Object.assign(new Error(`telegram bot ${bot.label}: ${method}: ${text.replaceAll(bot.token, "[token]").replace(/\s+/g, " ").slice(0, 300)}`), { code, retryAfter });
	let text: string;
	let status: number;
	try {
		const response = await fetch(`${bot.apiUrl}/bot${bot.token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params), signal });
		[status, text] = [response.status, await response.text()];
	} catch (error) {
		if (signal.aborted && signal.reason instanceof DOMException && signal.reason.name === "TimeoutError") throw fail(0, "no answer in time");
		if (signal.aborted) throw error;
		const cause = error instanceof Error && typeof error.cause === "object" && error.cause !== null && "code" in error.cause ? error.cause.code : undefined;
		throw fail(0, `cannot reach the Bot API${typeof cause === "string" ? ` (${cause})` : ""}`);
	}
	let answer: { readonly ok?: unknown; readonly result?: unknown; readonly error_code?: unknown; readonly description?: unknown; readonly parameters?: { readonly retry_after?: unknown } } = {};
	try {
		answer = JSON.parse(text) ?? {};
	} catch {}
	if (answer.ok === true) return answer.result;
	const code = typeof answer.error_code === "number" ? answer.error_code : status;
	const wait = answer.parameters?.retry_after;
	throw fail(code, `${code}: ${typeof answer.description === "string" && answer.description.trim() !== "" ? answer.description : "no description"}`, typeof wait === "number" && wait > 0 ? wait : 0);
}
