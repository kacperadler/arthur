import type { Host } from "@arthur/core/plugin";
import type { Send } from "./receive.ts";
import { type Bot, rest } from "./rest.ts";
import { slices } from "./slices.ts";

// A command the owner picked from Discord's `/` menu (spec/roadmap.md, entry 90), an INTERACTION_CREATE of type 2
// (APPLICATION_COMMAND) over the gateway; any other type is left alone. One of another server, another user (a DM brings `user`
// and no `member`) or outside the server's known text channels gets an ephemeral refusal and runs nothing. Any other is
// answered at once with a deferred answer, then runs through the host's registry as `/name text` typed in that channel does,
// and its reply goes in slices of 2000 as follow-ups, the first of which fills the deferred answer. A deferred answer Discord
// refused (late, or replayed after a resume) runs nothing, so a command never runs twice; what a failed follow-up did not
// send goes through the outbox to that channel. Every call is answered whatever a stop says: packages/discord/docs/discord.md.

export const REFUSED = "only the owner's commands in the server's text channels run";
const LIMIT = 2000;

const record = (value: unknown) => (typeof value === "object" && value !== null ? value : {}) as Readonly<Record<string, unknown>>;

export async function interaction(host: Host, bot: Bot, data: Readonly<Record<string, unknown>>, channels: ReadonlySet<string> | undefined, send: Send): Promise<void> {
	if (data.type !== 2) return;
	const [channel, token, command] = [String(data.channel_id), String(data.token), record(data.data)];
	const always = new AbortController().signal;
	const owner = data.guild_id === bot.guild && record(record(data.member).user).id === bot.user && channels?.has(channel) === true;
	try {
		const answer = owner ? { type: 5 } : { type: 4, data: { content: REFUSED, flags: 64, allowed_mentions: { parse: [] } } };
		await rest(bot, "POST", `/interactions/${String(data.id)}/${token}/callback`, answer, always);
	} catch (error) {
		return console.error(`${(error as Error).message}; the command picked from the / menu did not run`);
	}
	if (!owner) return;
	const place = channel === bot.channel ? undefined : channel;
	const from = { channel: "discord", ...(place === undefined ? {} : { place }), ...(bot.name === undefined ? {} : { instance: bot.name }) };
	const option = (Array.isArray(command.options) ? command.options : []).map(record).find((each) => each.name === "text");
	const name = String(command.name);
	const parts = slices(await host.commands.route(typeof option?.value === "string" ? `/${name} ${option.value}` : `/${name}`, from), LIMIT);
	if (parts.length === 0) parts.push(`/${name} gave no reply`);
	for (const [at, part] of parts.entries()) {
		try {
			await rest(bot, "POST", `/webhooks/${String(data.application_id)}/${token}`, { content: part, allowed_mentions: { parse: [] } }, always);
		} catch (error) {
			console.error(`${(error as Error).message}; the rest of /${name}'s reply goes to the channel instead`);
			return send(bot, parts.slice(at).join("\n"), place);
		}
	}
}
