import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Host, Project, Ticket } from "@arthur/core/plugin";
import { lastReport, type Reports } from "./report-file.ts";

// What a retro looks back on (spec/roadmap.md, entry 63): the merges into the project's main line since the last retro's commit,
// each merged ticket's FAIL reviews, findings and outcome; and `arthur retro-due`, whether there is enough of it for a retro:
// 10 merges, and in them 2 FAIL reviews or 5 findings. docs/commands/retro-due.md.

export const RETROS: Reports = { folder: "spec/retro", title: "Retro", commit: "Merges up to", page: true };
const MERGES = 10;
const FAILS = 2;
const FINDINGS = 5;
// The subject of a ticket's merge, as `arthur merge` writes it.
const MERGE = /^Merge ([A-Z]+\d+): /;
const REVIEW = /^review-(\d+)\.md$/;

// One merged ticket's folder from the project's root, the files a retro reads in it, and its findings counted.
export type Merged = { readonly id: string; readonly ticket?: Ticket; readonly folder?: string; readonly fails: readonly string[]; readonly findings: number; readonly outcome: boolean };
// `made`: when the last retro's commit was made, for the stats since then.
export type Period = { readonly project: Project; readonly made?: Date; readonly since: string; readonly merged: readonly Merged[]; readonly fails: number; readonly findings: number };

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");

// Git's output, or undefined when it exits with an error; Git missing throws.
function git(root: string, args: readonly string[]): string | undefined {
	const ran = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
	if (ran.error !== undefined) throw ran.error;
	return ran.status === 0 ? ran.stdout : undefined;
}

// The period of `project` (the main one when undefined) up to `head`: since the last retro's commit, or since the start when no
// report names one, or it is no commit of the repository. A merge whose ticket is not on the board still counts, with nothing
// to read; `host.board.list` refuses an unknown project.
export function period(host: Pick<Host, "board">, project: string | undefined, head: string): Period {
	const tickets = host.board.list(project);
	const projects = host.board.projects();
	const where = (project === undefined ? projects[0] : projects.find((each) => each.name === project))!;
	const last = lastReport(where.path, RETROS);
	// When the last retro's commit was made; undefined when there is none, or Git lacks it.
	const made = last === undefined ? undefined : git(where.path, ["show", "-s", "--format=%cI", `${last.commit}^{commit}`])?.trim();
	const why = last === undefined ? "no retro yet" : `${last.commit.slice(0, 12)} of ${last.path} is no commit of this repository`;
	const since = made !== undefined ? `the last retro, ${last?.commit.slice(0, 12)} (${last?.path})` : `the start (${why})`;
	const subjects = git(where.path, ["log", "--first-parent", "--merges", "--format=%s", made === undefined ? head : `${last?.commit}..${head}`]) ?? "";
	const merged = subjects.split("\n").filter(Boolean).reverse().flatMap((subject): Merged[] => {
		const id = MERGE.exec(subject)?.[1];
		if (id === undefined) return [];
		const ticket = tickets.find((each) => each.id === id);
		if (ticket === undefined) return [{ id, fails: [], findings: 0, outcome: false }];
		const folder = dirname(ticket.path);
		const names = existsSync(join(where.path, folder)) ? readdirSync(join(where.path, folder)) : [];
		const fails = names
			.filter((name) => REVIEW.test(name) && /^- Verdict: FAIL$/m.test(read(join(where.path, folder, name))))
			.sort((a, b) => Number(REVIEW.exec(a)?.[1]) - Number(REVIEW.exec(b)?.[1]));
		// Every `## F<n>.` entry, whatever its status.
		const findings = read(join(where.path, folder, "findings.md")).match(/^## F\d+\./gm)?.length ?? 0;
		return [{ id, ticket, folder, fails, findings, outcome: names.includes("outcome.md") }];
	});
	const sum = (count: (each: Merged) => number) => merged.reduce((total, each) => total + count(each), 0);
	return { project: where, ...(made === undefined ? {} : { made: new Date(made) }), since, merged, fails: sum((each) => each.fails.length), findings: sum((each) => each.findings) };
}

// `retro due: ...` or `no retro due: ...`, with the first rule that is not met.
export function retroDue({ merged, fails, findings, since }: Period): { readonly due: boolean; readonly line: string } {
	const counts = `${plural(merged.length, "merge")}, ${plural(fails, "FAIL review")} and ${plural(findings, "finding")} since ${since}`;
	if (merged.length < MERGES) return { due: false, line: `no retro due: ${counts}; ${MERGES} merges needed` };
	if (fails < FAILS && findings < FINDINGS) return { due: false, line: `no retro due: ${counts}; ${FAILS} FAIL reviews or ${FINDINGS} findings needed` };
	return { due: true, line: `retro due: ${counts}` };
}
