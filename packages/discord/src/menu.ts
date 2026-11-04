import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { type Bot, rest } from "./rest.ts";
import { cut } from "./slices.ts";

// Discord's `/` menu of one bot (spec/roadmap.md, entry 90): the phone commands the plugins registered, set as the bot's guild
// commands at each READY, each with its `about` cut to Discord's 100 characters and one optional string option, `text`, for what
// follows the name. Set only when they differ from what `<folder>/commands.json` records for `<application id>/<server>`; a
// refusal is one line on stderr and the record stays, so the next start tries again: packages/discord/docs/discord.md.

export type MenuCommand = { readonly type: 1; readonly name: string; readonly description: string; readonly options: readonly object[] };

// Discord's limit on a command's description.
const DESCRIBED = 100;
const TEXT = { type: 3, name: "text", description: "the text after the command", required: false };

export const menuCommands = (host: Host): MenuCommand[] => host.commands.phone().map(({ name, about }) => ({ type: 1, name, description: cut(about, DESCRIBED, "…"), options: [TEXT] }));

export async function setMenu(host: Host, bot: Bot, application: string, signal: AbortSignal): Promise<void> {
	const file = join(host.folder, "commands.json");
	const commands = menuCommands(host);
	const [want, key] = [JSON.stringify(commands), `${application}/${bot.guild}`];
	if (recorded(file)[key] === want) return;
	try {
		await rest(bot, "PUT", `/applications/${application}/guilds/${bot.guild}/commands`, commands, signal);
		writeFileSync(`${file}.tmp`, JSON.stringify({ ...recorded(file), [key]: want }));
		renameSync(`${file}.tmp`, file);
	} catch (error) {
		if (signal.aborted) return;
		console.error(`${(error as Error).message}; the / commands are set again at the next start`);
	}
}

// What the record holds; a missing file, or one that does not parse or was edited into another shape, records nothing.
function recorded(file: string): Readonly<Record<string, unknown>> {
	try {
		const found: unknown = JSON.parse(readFileSync(file, "utf8"));
		return typeof found === "object" && found !== null && !Array.isArray(found) ? (found as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}
