// Telegram's Bot API (spec/roadmap.md, entries 47 and 49): one POST to `<apiUrl>/bot<token>/<method>`, JSON or a multipart
// form with files, answered `{ ok, result }` or `{ ok: false, error_code, description }`; a file the owner sent is a GET of
// `<apiUrl>/file/bot<token>/<file_path>`. A failure is one line naming the bot and the method, never the token, which is part
// of the URL.

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

// A place is a topic's `message_thread_id`; any other is not Telegram's, and the message goes to the chat itself.
export const topic = (place: unknown) => (typeof place === "string" && /^[1-9]\d{0,15}$/.test(place) ? place : undefined);

type Fail = (code: number, text: string, retryAfter?: number) => ApiError;

const failure = (bot: Bot, method: string): Fail => (code, text, retryAfter = 0) =>
	Object.assign(new Error(`telegram bot ${bot.label}: ${method}: ${text.replaceAll(bot.token, "[token]").replace(/\s+/g, " ").slice(0, 300)}`), { code, retryAfter });

// The status of the response to `url` and its body as `read` takes it, else the failure of no answer: in time, or at all.
async function fetched<T>(url: string, init: RequestInit, signal: AbortSignal, fail: Fail, read: (response: Response) => Promise<T>): Promise<[number, T]> {
	try {
		const response = await fetch(url, { ...init, signal });
		return [response.status, await read(response)];
	} catch (error) {
		if (signal.aborted && signal.reason instanceof DOMException && signal.reason.name === "TimeoutError") throw fail(0, "no answer in time");
		if (signal.aborted) throw error;
		const cause = error instanceof Error && typeof error.cause === "object" && error.cause !== null && "code" in error.cause ? error.cause.code : undefined;
		throw fail(0, `cannot reach the Bot API${typeof cause === "string" ? ` (${cause})` : ""}`);
	}
}

export async function call(bot: Bot, method: string, params: Readonly<Record<string, unknown>> | FormData, signal: AbortSignal): Promise<unknown> {
	const fail = failure(bot, method);
	const body = params instanceof FormData ? { body: params } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) };
	const [status, text] = await fetched(`${bot.apiUrl}/bot${bot.token}/${method}`, { method: "POST", ...body }, signal, fail, (response) => response.text());
	let answer: { readonly ok?: unknown; readonly result?: unknown; readonly error_code?: unknown; readonly description?: unknown; readonly parameters?: { readonly retry_after?: unknown } } = {};
	try {
		answer = JSON.parse(text) ?? {};
	} catch {}
	if (answer.ok === true) return answer.result;
	const code = typeof answer.error_code === "number" ? answer.error_code : status;
	const wait = answer.parameters?.retry_after;
	throw fail(code, `${code}: ${typeof answer.description === "string" && answer.description.trim() !== "" ? answer.description : "no description"}`, typeof wait === "number" && wait > 0 ? wait : 0);
}

// The bytes of a file `getFile` gave the path of.
export async function download(bot: Bot, path: string, signal: AbortSignal): Promise<Buffer> {
	const fail = failure(bot, "file download");
	const [status, bytes] = await fetched(`${bot.apiUrl}/file/bot${bot.token}/${path}`, {}, signal, fail, async (response) => Buffer.from(await response.arrayBuffer()));
	if (status !== 200) throw fail(status, `${status}: ${bytes.toString("utf8").trim() || "no description"}`);
	return bytes;
}
