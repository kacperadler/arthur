import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Host, PhoneFrom } from "@arthur/core/plugin";

// The sessions this plugin keeps (spec/roadmap.md, entry 88): the coordinator's in the plugin's folder, and each project
// agent orchestration runs (`orchestration.sessions`) in `agents/<project>/`, each with its own handoff, request, `agent` pid,
// `context-use`, `turn-failed/` and `restarted.json`. Without orchestration's answer, the coordinator's alone (entries 35 to 38).

type Chat = { readonly plugin: string; readonly instance?: string; readonly place: string };
export type Session = { readonly name: string; readonly project?: string; readonly chat?: Chat; readonly folder: string };

// Read once at setup, after orchestration's: the list does not change while `arthur run` runs. Each folder is made here, since
// orchestration starts the agents, whose extensions write in it, before this plugin's start.
export function sessionList(host: Host): Session[] {
	const listed = host.collect<readonly { readonly name: string; readonly project?: string; readonly chat?: Chat }[]>("orchestration.sessions").flat();
	const agents = listed.flatMap(({ name, project, chat }) => (project === undefined || chat === undefined ? [] : [{ name, project, chat, folder: join(host.folder, "agents", project) }]));
	for (const { folder } of agents) mkdirSync(folder, { recursive: true });
	return [{ name: "coordinator", folder: host.folder }, ...agents];
}

// The session whose chat a phone command came from: its channel, bot and place, a chat naming no bot being its channel's main
// one (`channel.main`); else the coordinator's, as orchestration routes that chat's messages.
export function sessionFrom(host: Host, list: readonly Session[], from: PhoneFrom): Session {
	const main = Object.fromEntries(host.collectEach("channel.main").flatMap((each) => ("error" in each ? [] : [[each.plugin, each.value]])));
	const found = list.find(({ chat }) => chat !== undefined && chat.plugin === from.channel && (chat.instance ?? main[chat.plugin]) === from.instance && chat.place === from.place);
	return found ?? (list[0] as Session);
}

// Where a session's notice goes: an agent's chat, by its bot, to its place; the coordinator's to every channel.
export const noticeAt = ({ chat }: Session) => (chat === undefined ? {} : { channel: chat.plugin, ...(chat.instance === undefined ? {} : { instance: chat.instance }), place: chat.place });

// How a session is named in the lines and replies about it.
export const who = ({ project }: Session) => (project === undefined ? "coordinator" : `project agent of ${project}`);
