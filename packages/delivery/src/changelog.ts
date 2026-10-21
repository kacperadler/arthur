import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command, Host } from "@arthur/core/plugin";

// `arthur changelog` (spec/roadmap.md, entry 56), and the rebuild after each merge that went in: a project's CHANGELOG.md from
// its merged tickets, a `## <day>` per merge day, newest first, and under it a heading per kind. docs/commands/changelog.md.

const FILE = "CHANGELOG.md";
// The heading of each ticket kind (`- Kind:` under the ticket's `## Goal`), in Keep a Changelog's words; any other kind, or
// none, goes under Other. ORDER is the order they print.
const HEADING: Readonly<Record<string, string>> = { feature: "Added", improvement: "Added", bug: "Fixed", risk: "Fixed", cleanup: "Changed" };
const ORDER = ["Added", "Fixed", "Changed", "Other"];
const MERGED = /^- Merged: (\d{4}-\d{2}-\d{2}), `([0-9a-f]+)`/m;

// Writes `project`'s CHANGELOG.md, the main one when undefined, whole or not at all; returns the line that says so. A ticket's
// day and hash come from its outcome.md's `- Merged:` line; without one (merged before `arthur merge` wrote outcomes) the day
// of its last move on the board, no hash. Ids of one project share a prefix, so they sort by number: AR9999 before AR10000.
export function writeChangelog(host: Pick<Host, "board" | "clock">, project: string | undefined): string {
	const merged = host.board
		.list(project)
		.filter((ticket) => ticket.status === "merged")
		.sort((a, b) => a.id.length - b.id.length || (a.id < b.id ? -1 : 1));
	const projects = host.board.projects();
	// `host.board.list` refuses an unknown project, so `root` is found.
	const root = (project === undefined ? projects[0] : projects.find((each) => each.name === project))?.path ?? "";
	const lines = merged.map((ticket) => {
		const [outcomePath, ticketPath] = [join(root, dirname(ticket.path), "outcome.md"), join(root, ticket.path)];
		const outcome = MERGED.exec(existsSync(outcomePath) ? readFileSync(outcomePath, "utf8") : "");
		const goal = (existsSync(ticketPath) ? readFileSync(ticketPath, "utf8") : "").split(/^## Goal$/m)[1]?.split(/^## /m)[0] ?? "";
		const kind = /^- Kind: *(\S+) *$/m.exec(goal)?.[1] ?? "";
		const day = outcome?.[1] ?? host.clock.local(new Date(ticket.updated)).date;
		return { day, heading: Object.hasOwn(HEADING, kind) ? HEADING[kind] : "Other", line: `- ${ticket.id} ${ticket.title}${outcome ? ` (${outcome[2]})` : ""}` };
	});
	const sections = [...new Set(lines.map((each) => each.day))]
		.sort()
		.reverse()
		.map((day) => {
			const groups = ORDER.flatMap((heading) => {
				const group = lines.filter((each) => each.day === day && each.heading === heading);
				return group.length === 0 ? [] : [`### ${heading}\n\n${group.map((each) => each.line).join("\n")}\n`];
			});
			return `## ${day}\n\n${groups.join("\n")}`;
		});
	const head = "# Changelog\n\nGenerated from the merged tickets of `spec/build.json` by `arthur changelog`; a hand edit is overwritten at the next merge.\n";
	const text = [head, ...(sections.length === 0 ? ["No merged ticket yet.\n"] : sections)].join("\n");
	const draft = join(root, `.${FILE}.${process.pid}`);
	writeFileSync(draft, text);
	renameSync(draft, join(root, FILE));
	return `wrote ${FILE}: ${merged.length} merged ticket${merged.length === 1 ? "" : "s"}`;
}

export function changelogCommand(host: Host): Command {
	return {
		name: "changelog",
		doc: new URL("../docs/commands/changelog.md", import.meta.url),
		run({ args, project }) {
			if (args.length > 0) {
				console.error("usage: arthur changelog [--project <name>]");
				return 2;
			}
			console.log(writeChangelog(host, project));
		},
	};
}
