import { withLock } from "@arthur/core/lock";
import type { Host, Project } from "@arthur/core/plugin";
import { redact } from "./credential.ts";
import { byPolicy, CLASS, described, ticketKind } from "./decision-classes.ts";
import { type Answer, type Ask, change, type Close, DECISION_ID, decisions, KINDS, oneLine, readLog, stamp } from "./decision-log.ts";
import { proof } from "./decision-proof.ts";
import { byRecommendation } from "./silent.ts";

// A question asked, answered or closed in the decision log (decision-log.ts): docs/commands/decision.md.

// Records a question; its id. One approved class matching it answers it by policy in the same write, else the owner's grant by
// its recommendation, that answer returned; two or more classes leave it to the owner, `classes` naming them.
export function ask(host: Host, project: Project, asked: Omit<Ask, "record" | "id" | "time" | "project">, lock = withLock): { readonly id: string; readonly unwritten?: string; readonly policy?: Answer; readonly classes: readonly string[] } {
	const question = asked.question.trim();
	if (question === "") throw new Error("an empty question: --question <what the owner decides>");
	if (!KINDS.includes(asked.kind) && !(asked.kind === CLASS && asked.class !== undefined)) throw new Error(`kind ${JSON.stringify(asked.kind)}: one of ${KINDS.join(", ")}`);
	const ticket = asked.ticket === undefined ? undefined : host.board.get(asked.ticket);
	if (asked.ticket !== undefined && ticket?.project !== project.name) throw new Error(`--ticket ${asked.ticket} is not on the board of project ${project.name}`);
	const { recommend, options } = asked;
	if (typeof recommend === "number" && !(recommend >= 1 && recommend <= options.length)) throw new Error(`--recommend ${recommend}: no such option; ${options.length} offered (--option)`);
	const kind = ticketKind(host, project, asked.ticket);
	let classes: readonly string[] = [];
	const { added, unwritten } = change(host, project, (entries, time) => {
		const next = Math.max(0, ...entries.flatMap((each) => (each.record === "ask" ? [Number(DECISION_ID.exec(each.id)?.[2])] : []))) + 1;
		const kept = { ...(asked.ticket === undefined ? {} : { ticket: asked.ticket }), ...(asked.job === undefined ? {} : { job: asked.job }), ...(asked.what === undefined ? {} : { what: asked.what }), ...(asked.class === undefined ? {} : { class: asked.class }) };
		const said = recommend === undefined ? {} : { recommend: typeof recommend === "number" ? recommend : redact(recommend, host.secrets) };
		const record = { record: "ask", id: `${project.prefix}-D${next}`, time, project: project.name, kind: asked.kind, question: redact(question, host.secrets), options: options.map((option) => redact(option, host.secrets)), ...said, ...kept } satisfies Ask;
		const policy = byPolicy(entries, record, kind);
		classes = policy.classes;
		return [record, ...policy.answers, ...(classes.length === 0 ? byRecommendation(host, record) : [])];
	}, lock);
	return { id: added[0]?.id ?? "", unwritten, ...(added[1]?.record === "answer" ? { policy: added[1] } : {}), classes };
}

// What an answer lets through that only the owner's message naming its id may record (AR0664), none for any other: a merge flag,
// `--budget 0` (any budget question), `arthur take-main` (a merge question of no ticket and no job), a class approved.
function impact(ask: Ask, picked: number | undefined): string | undefined {
	if (ask.class !== undefined) return picked === 1 ? `approves the class ${described(ask.class)}` : undefined;
	if (ask.kind === "budget") return "lets through --budget 0";
	if (ask.kind !== "merge") return undefined;
	if ((ask.what ?? []).length > 0) return `lets through ${ask.what?.join(" and ")}`;
	return ask.ticket === undefined && ask.job === undefined ? "lets through arthur take-main" : undefined;
}

// Records the owner's answer, with the number of his message that holds its words (decision-proof.ts); the record as written,
// with its question. A high-impact one sends him a notice, built without the model, of what was recorded.
export function answer(host: Host, project: Project, id: string, given: { readonly decided?: string; readonly picked?: string; readonly words: string }): { readonly answer: Answer; readonly ask: Ask; readonly unwritten?: string } {
	if (given.words.trim() === "") throw new Error(`an empty answer: the owner's words, as he wrote or said them, after the flags`);
	if (/^by policy\b/i.test(given.words.trim())) throw new Error("an answer given by policy: only arthur decision ask answers by policy, and only a class the owner approved in his own words");
	if (given.decided === undefined || given.decided.trim() === "") throw new Error("no --decided: the decision in one English line");
	// A question is never rewritten, so the one read here is the one under the lock.
	const found = decisions(readLog(project)).find((each) => each.ask.id === id)?.ask;
	if (found === undefined) throw new Error(`${id} is not in the decision log of project ${project.name}`);
	const picked = given.picked === undefined ? undefined : Number(given.picked);
	if (picked !== undefined && !(Number.isInteger(picked) && picked >= 1 && picked <= found.options.length)) throw new Error(`--picked ${given.picked}: no such option; ${id} offered ${found.options.length}`);
	if (found.class !== undefined && picked === undefined) throw new Error(`${id} proposes a class: --picked 1 approves it, --picked 2 refuses it`);
	const high = impact(found, picked);
	const message = proof(host.folder, given.words, Date.parse(found.time), high === undefined ? undefined : id);
	if (typeof message === "string") throw new Error(high === undefined ? message : `${id} ${high}: ${message}`);
	const record: Answer = { record: "answer", id, time: stamp(host), decided: redact(oneLine(given.decided), host.secrets), ...(picked === undefined ? {} : { picked }), words: redact(given.words.trim(), host.secrets), message };
	const { unwritten } = change(host, project, () => [record]);
	const where = found.ticket === undefined ? "" : ` of ${found.ticket}`;
	if (high !== undefined) host.events.emit("notice", { text: `Recorded as your decision ${id} (${found.kind}${where}, ${high}): ${record.decided}; your words: "${record.words}"`, decision: id });
	return { answer: record, ask: found, unwritten };
}

// Closes the open questions `match` picks, with `reason`; the ids closed. A question answered or closed already is left.
export function close(host: Host, project: Project, match: (ask: Ask) => boolean, reason: string, lock = withLock): { readonly ids: readonly string[]; readonly unwritten?: string } {
	const { added, unwritten } = change(host, project, (entries, time) =>
		decisions(entries).flatMap(({ ask, state }) => (state === "open" && match(ask) ? [{ record: "close", id: ask.id, time, reason: redact(reason, host.secrets) } satisfies Close] : [])),
	lock);
	return { ids: added.map((each) => each.id), unwritten };
}
