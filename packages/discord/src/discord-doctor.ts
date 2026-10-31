import type { Requirement } from "@arthur/core/plugin";
import { type ApiError, type Bot, rest } from "./rest.ts";

// One bot's requirements for `arthur doctor` (spec/roadmap.md, entries 80 and 89): the token works and the MESSAGE_CONTENT
// intent is on (`GET /applications/@me`), the server requires 2FA for moderation and has no member but the owner and the bot
// (`GET /guilds/{id}?with_counts=true`). None is critical (AR0592): a Discord that refused the token must not keep the
// coordinator down, and a Discord that does not answer is `ok (Discord not reached: ...)`, never a miss. Each call is asked once
// per doctor run: packages/discord/docs/discord.md, "Setting it up".

// GATEWAY_MESSAGE_CONTENT (1 << 18), for a bot in 100 servers or more; GATEWAY_MESSAGE_CONTENT_LIMITED (1 << 19), under 100.
const CONTENT = (1 << 18) | (1 << 19);
const PORTAL = "the Bot page of the application at discord.com/developers/applications";
// Under the 10 s the doctor gives a check, so a Discord that hangs is not reached, not a check that timed out.
const CALL_MS = 5000;

type Answer = Readonly<Record<string, unknown>> | ApiError;

export function requirements(bot: Bot): Requirement[] {
	const ask = (path: string) => {
		let asked: Promise<Answer> | undefined;
		return () => (asked ??= rest(bot, "GET", path, undefined, new AbortController().signal, CALL_MS).then((found): Answer => (typeof found === "object" && found !== null ? (found as Answer) : {}), (error: ApiError) => error));
	};
	const [application, guild] = [ask("/applications/@me"), ask(`/guilds/${bot.guild}?with_counts=true`)];
	// The check's line from an answer: `holds` a miss's reason or undefined; a 401 or 403 a definite miss, any other failure not reached.
	const line = async (answer: () => Promise<Answer>, holds: (found: Readonly<Record<string, unknown>>) => string | undefined, refused: string) => {
		const found = await answer();
		if (!(found instanceof Error)) return holds(found) ?? "ok";
		return found.code === 401 || found.code === 403 || found.code === 404 ? `missing: ${refused} (${found.message})` : `ok (Discord not reached: ${found.message})`;
	};
	// The doctor puts the plugin's name before it: `discord bot <name>: <what>`.
	const name = (what: string) => `bot ${bot.label}: ${what}`;
	const token = "Discord refused the token";
	const server = `the bot cannot see the server in ${bot.guild}`;
	return [
		{ name: name("token"), check: () => line(application, () => undefined, token), costs: "nothing reaches Discord or comes from it", fix: `reset the token on ${PORTAL} and put it in ${bot.tokenEnv}` },
		{
			name: name("Message Content Intent"),
			check: () => line(application, (found) => ((Number(found.flags) & CONTENT) === 0 ? "missing: the intent is off, so Discord refuses the connection (4014)" : undefined), token),
			costs: "the gateway closes with 4014 and no message reaches the coordinator",
			fix: `switch on Message Content Intent on ${PORTAL}`,
		},
		{
			name: name("server 2FA"),
			check: () => line(guild, (found) => (found.mfa_level === 1 ? undefined : "missing: the server does not require 2FA for moderation"), server),
			costs: "a stolen password alone is enough to moderate the server",
			fix: "turn on 2FA on your Discord account, then Require 2FA for moderator actions in the server's Safety Setup",
		},
		{
			name: name("server members"),
			check: () => line(guild, (found) => (found.approximate_member_count === 2 ? undefined : `missing: ${String(found.approximate_member_count)} members, not 2 (you and the bot)`), server),
			costs: "someone else in the server reads what the coordinator writes there",
			fix: "remove every member but you and the bot in the server's Members settings",
		},
	];
}
