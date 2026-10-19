import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import type { Answer, Requirement } from "./plugin.ts";

// `arthur doctor` (spec/roadmap.md, entry 80): the core's own requirements (requirements.ts), then each enabled plugin's
// through `collect("doctor")`, all checked at once, each cut after 10 s, one line each; at `arthur run`'s start, before any
// plugin's `start`, the missing lines are printed, and sent at most once a day: docs/commands/doctor.md.

// One line as printed; `missing` and `critical` decide the exit code and the start.
export type DoctorLine = { readonly plugin: string; readonly name: string; readonly text: string; readonly missing: boolean; readonly critical: boolean };

const LIMIT_SECONDS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
// In the home folder: each missing line last sent, with when.
const SENT = "doctor.json";

const firstLine = (error: unknown) => (error instanceof Error ? error.message : String(error)).trim().split("\n")[0] ?? "";

// `work`'s answer, or `late` once LIMIT_SECONDS passed.
function within<T>(work: Promise<T>, late: T): Promise<T> {
	const { promise: cut, resolve } = Promise.withResolvers<T>();
	const timer = setTimeout(resolve, LIMIT_SECONDS * 1000, late);
	return Promise.race([work, cut]).finally(() => clearTimeout(timer));
}

// `own`: the core's requirements; `answers`: what `collectEach("doctor")` gave, each plugin's list, or its promise, in setup order.
export async function doctor(own: readonly Requirement[], answers: readonly Answer<unknown>[]): Promise<DoctorLine[]> {
	const lists = [{ plugin: "core", value: own }, ...answers].map(async (answer): Promise<DoctorLine[]> => {
		const { plugin } = answer;
		const listed =
			"error" in answer
				? firstLine(answer.error)
				: await within(
						Promise.resolve(answer.value).then((list) => (Array.isArray(list) ? (list as Requirement[]) : "it answered no list of requirements"), firstLine),
						`check timed out after ${LIMIT_SECONDS} s`,
					);
		if (typeof listed !== "string") return Promise.all(listed.map((requirement) => line(plugin, requirement)));
		const text = `${plugin} requirements: missing: check failed: ${listed}; without it: what ${plugin} needs is not checked; fix: plugin ${plugin}'s doctor answer`;
		return [{ plugin, name: "requirements", text, missing: true, critical: false }];
	});
	return (await Promise.all(lists)).flat();
}

// A check that throws or hangs costs its own line only.
async function line(plugin: string, requirement: Requirement): Promise<DoctorLine> {
	const answer = await within(
		Promise.try(() => requirement.check()).then(String, (error) => `missing: check failed: ${firstLine(error)}`),
		`missing: check timed out after ${LIMIT_SECONDS} s`,
	);
	const { name } = requirement;
	if (answer === "ok" || answer.startsWith("ok (")) return { plugin, name, text: `${plugin} ${name}: ${answer}`, missing: false, critical: false };
	const reason = answer.startsWith("missing: ") ? answer.slice("missing: ".length) : `check failed: it answered ${JSON.stringify(answer)}, neither ok nor missing`;
	const text = `${plugin} ${name}: missing: ${reason}; without it: ${requirement.costs}; fix: ${requirement.fix}`;
	return { plugin, name, text, missing: true, critical: requirement.critical === true };
}

// At `arthur run`'s start: each missing line printed, the journal's record of them; with a critical one, the refusal. Returns
// whether the start is refused.
export function printAtStart(lines: readonly DoctorLine[]): boolean {
	const missing = lines.filter((line) => line.missing);
	const refused = missing.some((line) => line.critical);
	for (const line of missing) (refused ? console.error : console.log)(`arthur run: ${line.text}`);
	if (refused) console.error("arthur run: refused: a critical requirement is missing; fix each line above, then run arthur doctor");
	return refused;
}

// Then the missing lines not sent within a day are sent: a refusal's as one notice, else as the `doctor` event, whose lines the
// session plugin's start notice opens with. Without a writable home nothing can record what was sent, so nothing is.
export function sendAtStart(home: string, lines: readonly DoctorLine[], emit: (name: string, data: unknown) => void): void {
	const missing = lines.filter((line) => line.missing);
	if (missing.some((line) => line.plugin === "core" && line.name === "home")) return;
	const sent = toSend(home, missing.map((line) => line.text));
	if (sent.length === 0) return;
	if (missing.some((line) => line.critical)) emit("notice", { text: [`arthur run refused on ${hostname()}: a critical requirement is missing`, ...sent].join("\n") });
	else emit("doctor", { lines: sent });
}

// The lines of `missing` not sent within a day. `<home>/doctor.json` then holds the lines missing now, each with when it was
// sent: a line fixed is dropped from it, so missing again it is sent again; a line that changed is another line.
function toSend(home: string, missing: readonly string[]): string[] {
	const file = join(home, SENT);
	let record: unknown;
	try {
		record = JSON.parse(readFileSync(file, "utf8"));
	} catch {
		// None yet, or not JSON (edited by hand): every line is sent.
	}
	const before = typeof record === "object" && record !== null ? (record as Readonly<Record<string, unknown>>) : {};
	const now = Date.now();
	const kept: Record<string, number> = {};
	const sent: string[] = [];
	for (const text of missing) {
		const at = Object.hasOwn(before, text) ? before[text] : undefined;
		const recent = typeof at === "number" && at <= now && now - at < DAY_MS;
		kept[text] = recent ? at : now;
		if (!recent) sent.push(text);
	}
	writeFileSync(`${file}.tmp`, `${JSON.stringify(kept, null, "\t")}\n`);
	renameSync(`${file}.tmp`, file);
	return sent;
}
