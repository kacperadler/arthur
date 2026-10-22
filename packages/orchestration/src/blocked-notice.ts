import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { MESSAGE } from "./board-commands.ts";
import { policyOf } from "./decision-classes.ts";
import { askOfJob, type JobQuestion } from "./decision-hooks.ts";

// A job blocked on the owner (spec/roadmap.md, entry 27): its `job-state` to `blocked` on `user: <question>` emits one `notice`
// `{ text: "<id> asks [<decision id>]: <question>", blocked: "<id>" }`, which every channel sends (without a notification in
// quiet hours) and silent mode lets through; a question an approved class answered by policy (entry 97) ends it with
// ` — answered by policy (<class id>): <decided>`. A text longer than one message is cut, saying where the whole question is. The
// question is asked in the decision log first (entry 96, decision-hooks.ts); without a log for its project the notice names no
// decision, and a log broken by hand fails the event after the notice went. Every process that loads the plugin gets the
// event, and `arthur run` gets it again after a crash, so `<folder>/asked/<event number>-<its time in ms>`, created by the
// first one only, makes it one notice per block; the time keeps a log cut by hand, whose numbers start
// again, from matching an old mark. Files there older than 7 days go at the next block: docs/commands/coordinator.md.

const KEEP_MS = 7 * 24 * 3_600_000;

export function blockedNotice(host: Host): void {
	host.events.on("job-state", (event) => {
		const { id, to, reason } = (event.data ?? {}) as Readonly<Record<string, unknown>>;
		if (to !== "blocked" || typeof reason !== "string" || !reason.startsWith("user: ")) return;
		const asked = join(host.folder, "asked");
		mkdirSync(asked, { recursive: true });
		try {
			writeFileSync(join(asked, `${event.seq}-${Date.parse(event.time)}`), "", { flag: "wx" });
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "EEXIST") return;
			throw error;
		}
		// Another process may remove one meanwhile.
		for (const name of readdirSync(asked)) if (Date.now() - (statSync(join(asked, name), { throwIfNoEntry: false })?.mtimeMs ?? Date.now()) > KEEP_MS) rmSync(join(asked, name), { force: true });
		const question = reason.slice("user: ".length);
		const notify = (decision?: JobQuestion) => {
			const ending = decision?.policy === undefined ? "" : ` — answered by policy (${policyOf(decision.policy)}): ${decision.policy.decided}`;
			const head = `${String(id)} asks${decision === undefined ? "" : ` [${decision.id}]`}: `;
			const text = `${head}${question}${ending}`;
			const tail = ` … (cut; /jobs shows the whole question of job ${String(id).split("-").at(-1)})`;
			// The question is cut, never the ending, unless the ending leaves no room for the head.
			const kept = MESSAGE - tail.length - ending.length >= head.length ? ending : "";
			// Never half of a character that takes two UTF-16 units.
			let end = MESSAGE - tail.length - kept.length;
			if (/[\uD800-\uDBFF]/.test(text[end - 1] ?? "")) end--;
			host.events.emit("notice", { text: text.length > MESSAGE ? `${text.slice(0, end)}${tail}${kept}` : text, blocked: String(id) });
		};
		const failed = (error: unknown) => {
			notify();
			throw error;
		};
		let decision: JobQuestion | undefined | Promise<JobQuestion>;
		try {
			decision = askOfJob(host, event.data as Readonly<Record<string, unknown>>, question);
		} catch (error) {
			return failed(error);
		}
		// While another process holds the log's lock, the notice waits for its id; `arthur run` goes on.
		if (decision instanceof Promise) return decision.then(notify, failed);
		notify(decision);
	});
}
