import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import type { StubAnswer } from "./eval-stub.ts";

// A scenario of `arthur eval` (spec/roadmap.md, entry 67): `<package>/evals/<name>/scenario.json` beside its `fixture/`, in
// each package the load runs, named `<package folder>/<name>`. Its turn is the text orchestration's inbox hands the coordinator
// for its event (`coordinator.turn`): a message of the owner's, a schedule entry due, a plugin's message, or a job's end. Docs:
// docs/commands/eval.md.

export type Expect = {
	readonly files: Readonly<Record<string, readonly string[]>>;
	readonly missing: readonly string[];
	readonly refs: Readonly<Record<string, "kept" | "moved">>;
	readonly calls: readonly string[];
	readonly never: readonly string[];
	readonly reply: { readonly lines?: number; readonly match: readonly string[]; readonly never: readonly string[] };
	readonly tools: readonly string[];
};
// `hour`: the hour of the owner's day the turn is played at, 0 to 23; noon when left out, so no scenario hangs on when it runs.
// `context`: each plugin's lines of the coordinator's context by its name, none for a plugin left out.
export type Scenario = { readonly name: string; readonly folder: string; readonly turn: string; readonly hour: number; readonly context: Readonly<Record<string, string>>; readonly timeoutSeconds: number; readonly stub: readonly StubAnswer[]; readonly expect: Expect };

export const TIMEOUT_SECONDS = 900;
const HOUR = 12;

// Every scenario folder of the packages `code` names, by name.
export function scenarios(code: readonly string[]): ReadonlyMap<string, string> {
	const found = code.flatMap((pkg) => {
		const evals = join(pkg, "evals");
		if (!existsSync(evals)) return [];
		return readdirSync(evals, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => [`${basename(pkg)}/${entry.name}`, join(evals, entry.name)] as const);
	});
	return new Map(found.sort(([a], [b]) => (a < b ? -1 : 1)));
}

type Json = Readonly<Record<string, unknown>>;
const object = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const words = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

// Throws what is wrong with `value` at `path`: a list of regexes, or a record of lists of them.
function patterns(value: unknown, path: string): readonly string[] {
	if (value === undefined) return [];
	if (!Array.isArray(value) || !value.every((each) => typeof each === "string")) throw new Error(`${path}: expected a list of regexes`);
	for (const each of value) new RegExp(each);
	return value;
}

// The scenario in `folder`, checked, its turn built; or why it cannot run, which fails it alone.
export async function readScenario(host: Host, name: string, folder: string): Promise<Scenario | string> {
	const file = join(folder, "scenario.json");
	try {
		if (!existsSync(join(folder, "fixture")) || !statSync(join(folder, "fixture")).isDirectory()) return `no fixture: ${join(folder, "fixture")} is not a folder`;
		const json: unknown = JSON.parse(readFileSync(file, "utf8"));
		if (!object(json)) throw new Error("expected an object");
		const { turn, hour = HOUR, context = {}, timeoutSeconds = TIMEOUT_SECONDS, stub = [], expect = {} } = json;
		if (!Number.isInteger(hour) || (hour as number) < 0 || (hour as number) > 23) throw new Error("hour: expected a whole hour, 0 to 23");
		if (!object(context) || !Object.values(context).every((text) => typeof text === "string")) throw new Error("context: expected { <plugin>: <text> }");
		if (!Number.isInteger(timeoutSeconds) || (timeoutSeconds as number) < 1) throw new Error("timeoutSeconds: expected a whole number of seconds, 1 or more");
		if (!Array.isArray(stub) || !stub.every((answer) => object(answer) && typeof answer.match === "string")) throw new Error("stub: expected a list of { match, output?, exit?, files? }");
		for (const [index, answer] of (stub as Json[]).entries()) {
			new RegExp(answer.match as string);
			if (answer.output !== undefined && typeof answer.output !== "string") throw new Error(`stub[${index}].output: expected text`);
			if (answer.exit !== undefined && !(Number.isInteger(answer.exit) && (answer.exit as number) >= 0 && (answer.exit as number) <= 255)) throw new Error(`stub[${index}].exit: expected 0 to 255`);
			if (answer.files !== undefined && !(object(answer.files) && Object.values(answer.files).every((text) => typeof text === "string"))) throw new Error(`stub[${index}].files: expected { <path>: <text> }`);
		}
		if (!object(expect)) throw new Error("expect: expected { files?, missing?, refs?, calls?, never?, reply?, tools? }");
		const files = expect.files ?? {};
		if (!object(files)) throw new Error("expect.files: expected { <path>: [<regex>...] }");
		const refs = expect.refs ?? {};
		if (!object(refs) || !Object.values(refs).every((value) => value === "kept" || value === "moved")) throw new Error('expect.refs: expected { <ref>: "kept" | "moved" }');
		const missing = expect.missing ?? [];
		if (!Array.isArray(missing) || !missing.every(words)) throw new Error("expect.missing: expected a list of paths");
		const reply = expect.reply ?? {};
		if (!object(reply) || (reply.lines !== undefined && !(Number.isInteger(reply.lines) && (reply.lines as number) >= 1))) throw new Error("expect.reply: expected { lines?: 1 or more, match?, never? }");
		return {
			...{ name, folder, turn: await turnText(host, folder, turn), hour: hour as number, context: context as Record<string, string>, timeoutSeconds: timeoutSeconds as number, stub: stub as StubAnswer[] },
			expect: {
				...{ files: Object.fromEntries(Object.entries(files).map(([path, list]) => [path, patterns(list, `expect.files.${path}`)])), missing },
				...{ refs: refs as Expect["refs"], calls: patterns(expect.calls, "expect.calls"), never: patterns(expect.never, "expect.never"), tools: patterns(expect.tools, "expect.tools") },
				reply: { ...(reply.lines === undefined ? {} : { lines: reply.lines as number }), match: patterns(reply.match, "expect.reply.match"), never: patterns(reply.never, "expect.reply.never") },
			},
		};
	} catch (error) {
		return `${file}: ${(error as Error).message}`;
	}
}

// The turn as the inbox hands it over, asked of orchestration (`coordinator.turn`): `{ message, channel? }` the owner's, a
// `message-received`; `{ scheduled, message, procedure? }` a schedule entry due, a `coordinator-message` as the schedule plugin
// words it (`schedule.message`), `procedure` a file beside the scenario; `{ arthur }` a plugin's `coordinator-message`, as it
// words it; `{ ended, result? }` a job's end, a `job-ended` with its final message, of the main project unless it names one,
// and with the `records` it names for the plugins, which have none of a job in no home.
async function turnText(host: Host, folder: string, turn: unknown): Promise<string> {
	if (!object(turn)) throw new Error("turn: expected { message, channel? }, { scheduled, message, procedure? }, { arthur } or { ended, result? }");
	if (turn.ended !== undefined) {
		const job = turn.ended;
		if (!object(job) || !words(job.id) || !words(job.kind) || (job.state !== "ended" && job.state !== "blocked") || (job.records !== undefined && !object(job.records)))
			throw new Error('turn.ended: expected { id, kind, state: "ended" | "blocked", reason?, project?, records?: { <plugin>: <its record> } }');
		return host.call<Promise<string>>("coordinator.turn", "job-ended", { project: host.board.projects()[0]?.name, ...job }, turn.result);
	}
	if (turn.arthur !== undefined) {
		if (!words(turn.arthur)) throw new Error("turn.arthur: expected a plugin's message, as text");
		return host.call<Promise<string>>("coordinator.turn", "coordinator-message", { text: turn.arthur });
	}
	if (!words(turn.message)) throw new Error("turn.message: expected text");
	if (turn.scheduled === undefined) {
		const parts = [{ kind: "text", text: turn.message, mime: "text/plain" }];
		return host.call<Promise<string>>("coordinator.turn", "message-received", { channel: words(turn.channel) ? turn.channel : "telegram", parts });
	}
	if (turn.procedure !== undefined && !words(turn.procedure)) throw new Error("turn.procedure: expected a file's path beside the scenario");
	const procedure = turn.procedure === undefined ? undefined : readFileSync(join(folder, turn.procedure as string), "utf8");
	return host.call<Promise<string>>("coordinator.turn", "coordinator-message", { text: host.call<string>("schedule.message", turn.scheduled, turn.message, procedure) });
}
