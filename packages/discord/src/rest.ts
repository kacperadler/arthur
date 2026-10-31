// Discord's REST API (spec/roadmap.md, entry 89): one call to `<apiUrl><path>` with the bot's token in the Authorization header,
// never in the URL, and the User-Agent Discord asks of a bot, answered JSON or a refusal `{ code, message }` (a 429: `{ message,
// retry_after, global }`). A failure is one line naming the bot and the call, the token replaced wherever it shows.

export type Bot = {
	// The name, absent for the unnamed bot; `label` is how errors say it: the name, or `(unnamed)`.
	readonly name?: string;
	readonly label: string;
	readonly token: string;
	readonly tokenEnv: string;
	readonly guild: string;
	readonly user: string;
	readonly channel: string;
	readonly apiUrl: string;
};

// A refusal or no answer; `code` is the HTTP status, 0 when none came; `retryAfter` the seconds a 429 says to wait, else 0.
export type ApiError = Error & { readonly code: number; readonly retryAfter: number };

const AGENT = "DiscordBot (https://github.com/kacperadler/arthur, 1)";
const CALL_MS = 30_000;

export const failure = (bot: Bot, call: string, code: number, text: string, retryAfter = 0): ApiError =>
	Object.assign(new Error(`discord bot ${bot.label}: ${call}: ${text.replaceAll(bot.token, "[token]").replace(/\s+/g, " ").slice(0, 300)}`), { code, retryAfter });

// `ms` bounds the call, 30 s unless the caller needs an answer sooner.
export async function rest(bot: Bot, method: "GET" | "POST", path: string, body: unknown, signal: AbortSignal, ms = CALL_MS): Promise<unknown> {
	const call = `${method} ${path.replace(/\?.*$/, "")}`;
	const within = AbortSignal.any([signal, AbortSignal.timeout(ms)]);
	const headers = { Authorization: `Bot ${bot.token}`, "User-Agent": AGENT, ...(body === undefined ? {} : { "Content-Type": "application/json" }) };
	let response: Response;
	let text: string;
	try {
		response = await fetch(`${bot.apiUrl}${path}`, { method, headers, signal: within, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
		text = await response.text();
	} catch (error) {
		if (signal.aborted) throw error;
		if (within.aborted) throw failure(bot, call, 0, "no answer in time");
		const cause = error instanceof Error && typeof error.cause === "object" && error.cause !== null && "code" in error.cause ? error.cause.code : undefined;
		throw failure(bot, call, 0, `cannot reach Discord's API${typeof cause === "string" ? ` (${cause})` : ""}`);
	}
	let answer: unknown;
	try {
		answer = text === "" ? null : JSON.parse(text);
	} catch {}
	if (response.ok) return answer;
	const { message, retry_after: wait } = (typeof answer === "object" && answer !== null ? answer : {}) as { readonly message?: unknown; readonly retry_after?: unknown };
	const said = typeof message === "string" && message.trim() !== "" ? message : "no message";
	throw failure(bot, call, response.status, `${response.status}: ${said}`, typeof wait === "number" && wait > 0 ? wait : 0);
}
