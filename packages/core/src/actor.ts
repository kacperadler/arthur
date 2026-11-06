import { userInfo } from "node:os";
import { join } from "node:path";
import { holds } from "./lock.ts";

// Who acted (spec/roadmap.md, entry 99): the stamp `by` on every event, `actor` and `on`, the numbers of the messages acted on.
export type By = { readonly actor: string; readonly on?: readonly number[] };
export type Stamp = (plugin: string, name: string, data: unknown) => By;

// In this order: inside job `job`, `job:<id>`; the owner's `message-received` or `phone-command`, `user:<channel>[/<instance>]`;
// the first answer of a plugin's `actor` (orchestration's `coordinator`); in the process holding `<home>/run.pid` (`arthur run`),
// `arthur` for the core and `plugin:<name>`; else `user:terminal:<OS user>`. Data that `answers` messages is `on` them.
export function stamper(home: string, job: string | undefined, provided: () => readonly unknown[], user = userInfo().username): Stamp {
	return (plugin, name, data) => {
		const fields = (typeof data === "object" && data !== null ? data : {}) as Readonly<Record<string, unknown>>;
		const on = numbers(fields.answers) === undefined ? {} : { on: fields.answers as number[] };
		if (job !== undefined) return { actor: `job:${job}`, ...on };
		if ((name === "message-received" || name === "phone-command") && typeof fields.channel === "string")
			return { actor: `user:${fields.channel}${typeof fields.instance === "string" ? `/${fields.instance}` : ""}` };
		const answer = provided().find((each) => typeof (each as By | undefined)?.actor === "string" && (each as By).actor !== "") as By | undefined;
		if (answer !== undefined) return { actor: answer.actor, ...(numbers(answer.on) === undefined ? on : { on: answer.on }) };
		if (holds(join(home, "run.pid"))) return { actor: plugin === "core" ? "arthur" : `plugin:${plugin}`, ...on };
		return { actor: `user:terminal:${user}`, ...on };
	};
}

function numbers(value: unknown): readonly number[] | undefined {
	return Array.isArray(value) && value.every((each) => Number.isSafeInteger(each)) ? value : undefined;
}
