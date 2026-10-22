import type { Host } from "@arthur/core/plugin";
import { type Decision, decisions, oneLine, readLog } from "./decision-log.ts";

// The decision log in the coordinator's context (spec/roadmap.md, entry 96): every open question of every project, its id,
// how long it has been open and the question, and under it up to 5 answered decisions like it: the same kind first, then the
// most words shared with the question, the newest on a tie. No open question, no section; a log broken by hand is one line.

const LIKE = 5;
const words = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);

export function decisionContext(host: Host): string {
	if (host.collect("projects").length === 0) return "";
	const now = host.clock.now().getTime();
	const lines: string[] = [];
	for (const project of host.board.projects()) {
		let all: Decision[];
		try {
			all = decisions(readLog(project));
		} catch (error) {
			lines.push(`- project ${project.name}: its decision log was not read: ${(error instanceof Error ? error.message : String(error)).split("\n")[0]}`);
			continue;
		}
		const answered = all.filter((each) => each.state === "answered");
		for (const { ask } of all.filter((each) => each.state === "open")) {
			const minutes = Math.max(0, Math.floor((now - Date.parse(ask.time)) / 60_000));
			const on = [ask.ticket === undefined ? "" : `, ticket ${ask.ticket}`, ask.job === undefined ? "" : `, job ${ask.job}`].join("");
			lines.push(`- ${ask.id}, ${ask.kind}${on}, open for ${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m: ${oneLine(ask.question)}`);
			const mine = words(ask.question);
			const like = answered
				.map((each) => ({ each, kind: each.ask.kind === ask.kind ? 1 : 0, shared: [...words(each.ask.question)].filter((word) => mine.has(word)).length, at: Date.parse(each.answers.at(-1)?.time ?? "") }))
				.filter(({ kind, shared }) => kind + shared > 0)
				.sort((a, b) => b.kind - a.kind || b.shared - a.shared || b.at - a.at)
				.slice(0, LIKE);
			for (const { each } of like) lines.push(`  - like it, ${each.ask.id} of ${each.answers.at(-1)?.time.slice(0, 10)}: ${oneLine(each.ask.question)} → ${each.answers.at(-1)?.decided}`);
		}
	}
	return lines.join("\n");
}
