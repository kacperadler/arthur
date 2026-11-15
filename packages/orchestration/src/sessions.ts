import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { type Coordinator, roleOptions } from "./orchestration-options.ts";

// The sessions `arthur run` keeps running (spec/roadmap.md, entries 23 and 85): the coordinator's, then one per project whose
// project file holds `orchestration.project({ chat })`, its project agent, in the list's order. An agent lives in
// `<home>/orchestration/agents/<project>/`, in the tmux session `<coordinator's session>-<project>` on the coordinator's socket,
// `.` written `_` since tmux reads it in a target (a project's name holds no `_`), on `roles.project`'s model and thinking.

// Where a project agent talks: a channel plugin's place, through the bot `instance` names, else that plugin's main one.
export type Chat = { readonly plugin: string; readonly instance?: string; readonly place: string };
export type Session = { readonly name: string; readonly project?: string; readonly chat?: Chat; readonly folder: string; readonly coordinator: Coordinator };
// What the inbox and the notices read of a session; the coordinator's first in a list.
export type Box = Pick<Session, "name" | "project" | "chat" | "folder">;
type Listed = { readonly name: string; readonly pieces?: { readonly orchestration?: { readonly chat: Chat } } };

// An array is an object here too: its keys are indices, which no piece and no chat takes.
const fields = (value: unknown) => (typeof value === "object" && value !== null ? (value as Readonly<Record<string, unknown>>) : {});
const text = (value: unknown) => typeof value === "string" && value !== "";

// A project's piece, `orchestration.project({ chat: { plugin, instance?, place } })`, checked before the plugin's setup.
export function chatProblem(value: unknown): string | undefined {
	const { chat, ...rest } = fields(value);
	const { plugin, instance, place, ...more } = fields(chat);
	const fine = Object.keys(rest).length === 0 && Object.keys(more).length === 0 && text(plugin) && text(place) && (instance === undefined || text(instance));
	return fine ? undefined : `expected { chat: { plugin, instance?, place } }, each a non-empty string, got ${JSON.stringify(value)}`;
}

// Two projects in one place of one channel would each hear the other's messages, so the second is refused, naming both.
export function sessionList(host: Host, coordinator: Coordinator): Session[] {
	const { model, thinking } = roleOptions(host.options, "project");
	const list: Session[] = [{ name: "coordinator", folder: host.folder, coordinator }];
	for (const { name, pieces } of host.collect<readonly Listed[]>("projects").flat()) {
		const chat = pieces?.orchestration?.chat;
		if (chat === undefined) continue;
		const same = list.find((each) => each.chat?.plugin === chat.plugin && each.chat.instance === chat.instance && each.chat.place === chat.place);
		if (same !== undefined) throw new Error(`project ${name}: orchestration.project(...): its chat ${JSON.stringify(chat)} is project ${same.project}'s too; each project agent needs a place of its own`);
		const session = `${coordinator.session}-${name.replaceAll(".", "_")}`;
		list.push({ name: `agent:${name}`, project: name, chat, folder: join(host.folder, "agents", name), coordinator: { ...coordinator, model: model as string | undefined, thinking, session } });
	}
	return list;
}

// The session this process runs in, by the folder its supervisor set; undefined outside every session (a terminal, a job).
export const sessionOf = (list: readonly Session[], env: NodeJS.ProcessEnv = process.env): Session | undefined => list.find((each) => each.folder === env.ARTHUR_ORCHESTRATION_FOLDER);

// The session a message goes to: the agent whose chat is the channel, bot and place it came from, or, for Arthur's own (no
// channel), the agent of the project it names; else the coordinator, first in the list (spec/roadmap.md, entry 86). A chat
// that names no bot is its channel's main one, whose name `main` holds by channel (`channel.main`), none for an unnamed one.
export function sessionFor<T extends Pick<Session, "project" | "chat">>(list: readonly T[], to: Readonly<Record<string, unknown>>, main: Readonly<Record<string, unknown>> = {}): T {
	const found = list.find(({ project, chat }) => chat !== undefined && (to.channel === undefined ? project === to.project : chat.plugin === to.channel && (chat.instance ?? main[chat.plugin]) === to.instance && chat.place === to.place));
	return found ?? (list[0] as T);
}

// Where a notice of an agent's goes: its chat's channel, bot and place; nothing for the coordinator's, which every channel sends.
export const noticeAt = (chat: Chat | undefined): { readonly channel?: string; readonly instance?: string; readonly place?: string } =>
	chat === undefined ? {} : { channel: chat.plugin, ...(chat.instance === undefined ? {} : { instance: chat.instance }), place: chat.place };

// How the starts of every session `arthur run` supervises go: one at a time, each after the one before it ended, so two agents
// never refresh the shared login at once.
export type Turns = <T>(start: () => Promise<T>) => Promise<T>;
export function oneAtATime(): Turns {
	let last: Promise<unknown> = Promise.resolve();
	return (start) => {
		const next = last.then(start);
		last = next.catch(() => {});
		return next;
	};
}