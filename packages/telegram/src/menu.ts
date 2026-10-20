import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { type Bot, call } from "./bot-api.ts";

// The bot's command menu (spec/roadmap.md, entry 50): the phone commands the plugins registered, each with its `about`, set
// at the start with `setMyCommands` (`deleteMyCommands` for none) only when they differ from what `<folder>/menu.json` records
// as set for that bot, keyed by its id (the token's part before the colon). A failure is one line on stderr and the record
// stays, so the next start tries again: packages/telegram/docs/telegram.md, "Phone commands".
export async function menu(host: Host, bots: readonly Bot[], signal: AbortSignal): Promise<void> {
	const file = join(host.folder, "menu.json");
	const commands = host.commands.phone().map(({ name, about }) => ({ command: name, description: about }));
	const want = JSON.stringify(commands);
	for (const bot of bots) {
		const id = bot.token.split(":")[0] ?? "";
		if (recorded(file)[id] === want) continue;
		try {
			await call(bot, commands.length > 0 ? "setMyCommands" : "deleteMyCommands", commands.length > 0 ? { commands } : {}, signal);
			writeFileSync(`${file}.tmp`, JSON.stringify({ ...recorded(file), [id]: want }));
			renameSync(`${file}.tmp`, file);
		} catch (error) {
			if (signal.aborted) return;
			console.error(`${(error as Error).message}; the command menu is set again at the next start`);
		}
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
