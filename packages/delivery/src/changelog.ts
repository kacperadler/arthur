import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { checkConfig } from "@arthur/core/git-config";
import type { Command, Host } from "@arthur/core/plugin";

// `arthur changelog` (spec/roadmap.md, entries 56 and 105), and the rebuild after each merge that went in: a project's CHANGELOG.md
// from its merged tickets, a `## <day>` per merge day, newest first, and under it a heading per kind; once there is a release (the
// root package.json's version changed, or a `v<x.y.z>` tag), the days go under `## Unreleased` and a `## <version> (<date>)` per release.
// docs/commands/changelog.md.

const FILE = "CHANGELOG.md";
const FETCH_MS = 60_000;
// The heading of each ticket kind (`- Kind:` under the ticket's `## Goal`), in Keep a Changelog's words; any other of the
// board's kinds goes under Changed, a kind the board does not know, or none, under Other. ORDER is the order they print.
const HEADING: Readonly<Record<string, string>> = { feat: "Added", fix: "Fixed", security: "Fixed" };
const ORDER = ["Added", "Fixed", "Changed", "Other"];
const MERGED = /^- Merged: (\d{4}-\d{2}-\d{2}), `([0-9a-f]+)`/m;

type Line = { readonly day: string; readonly heading: string | undefined; readonly line: string; readonly hash: string };
type Release = { readonly version: string; readonly date: string; readonly at: number };

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
		const heading = Object.hasOwn(HEADING, kind) ? HEADING[kind] : host.board.kinds.includes(kind) ? "Changed" : "Other";
		return { day, heading, line: `- ${ticket.id} ${ticket.title}${outcome ? ` (${outcome[2]})` : ""}`, hash: outcome?.[2] ?? "" };
	});
	const { line, releases } = releasesOf(root, host.clock);
	// A ticket belongs to the first release at or after its merge commit on main's first-parent line; one whose hash is not on it
	// (none, or a history rewritten) to the first release made on its day or later.
	const releaseOf = (each: Line) => {
		const at = each.hash === "" ? -1 : line.findIndex((sha) => sha.startsWith(each.hash));
		return at === -1 ? releases.find((release) => release.date >= each.day) : releases.find((release) => release.at >= at);
	};
	const head = "# Changelog\n\nGenerated from the merged tickets of `spec/build.json` by `arthur changelog`; a hand edit is overwritten at the next merge.\n";
	const unreleased = lines.filter((each) => releaseOf(each) === undefined);
	const sections =
		releases.length === 0
			? days(lines, "##")
			: [
					...(unreleased.length === 0 ? [] : [`## Unreleased\n\n${days(unreleased, "###").join("\n")}`]),
					...releases.toReversed().map((release) => {
						const own = days(lines.filter((each) => releaseOf(each) === release), "###");
						return `## ${release.version} (${release.date})\n\n${own.length === 0 ? "No merged ticket in this release.\n" : own.join("\n")}`;
					}),
				];
	const text = [head, ...(sections.length === 0 ? ["No merged ticket yet.\n"] : sections)].join("\n");
	const draft = join(root, `.${FILE}.${process.pid}`);
	writeFileSync(draft, text);
	renameSync(draft, join(root, FILE));
	return `wrote ${FILE}: ${merged.length} merged ticket${merged.length === 1 ? "" : "s"}`;
}

// One `<level> <day>` section per day, newest first, and under it a heading one level deeper per kind, in ORDER.
function days(lines: readonly Line[], level: string): string[] {
	return [...new Set(lines.map((each) => each.day))]
		.sort()
		.reverse()
		.map((day) => {
			const groups = ORDER.flatMap((heading) => {
				const group = lines.filter((each) => each.day === day && each.heading === heading);
				return group.length === 0 ? [] : [`${level}# ${heading}\n\n${group.map((each) => each.line).join("\n")}\n`];
			});
			return `${level} ${day}\n\n${groups.join("\n")}`;
		});
}

// HEAD's first-parent line, oldest first, and on it each release: a commit whose root package.json `version` differs from its
// first parent's, both having one (a version that appears, a project's first package.json, is none), and a `v<x.y.z>` tag of a
// version no such commit made, at the commit it names (AR0699: v0.1.0 was tagged where the version appeared). Outside Git, none.
function releasesOf(root: string, clock: Host["clock"]): { readonly line: readonly string[]; readonly releases: readonly Release[] } {
	const git = (...words: string[]) => spawnSync("git", ["--no-replace-objects", "-C", root, ...words], { encoding: "utf8" }).stdout.trim();
	const version = (commit: string) => {
		try {
			const value: unknown = JSON.parse(git("cat-file", "blob", `${commit}:package.json`)).version;
			return typeof value === "string" ? value : undefined;
		} catch {
			return undefined; // No package.json there, no parent, or one broken by hand.
		}
	};
	const log = git("log", "--first-parent", "--reverse", "--format=%H %cI", "HEAD").split("\n").filter(Boolean).map((entry) => entry.split(" "));
	const line = log.map(([commit = ""]) => commit);
	const changed = git("log", "--first-parent", "--reverse", "--format=%H %cI", "HEAD", "--", "package.json")
		.split("\n")
		.flatMap((entry): Release[] => {
			const [commit = "", time = ""] = entry.split(" ");
			const [now, before] = [version(commit), version(`${commit}^`)];
			return now === undefined || before === undefined || now === before ? [] : [{ version: now, date: clock.local(new Date(time)).date, at: line.indexOf(commit) }];
		});
	// `<object> <commit an annotated tag names, else nothing> <name>` per tag.
	const tagged = git("for-each-ref", "--format=%(objectname) %(*objectname) %(refname:strip=2)", "refs/tags/v*")
		.split("\n")
		.flatMap((entry): Release[] => {
			const [own = "", peeled = "", name = ""] = entry.split(" ");
			const [tag, at] = [/^v(\d+\.\d+\.\d+)$/.exec(name)?.[1], line.indexOf(peeled || own)];
			if (tag === undefined || at === -1 || changed.some((each) => each.version === tag)) return [];
			return [{ version: tag, date: clock.local(new Date(log[at]?.[1] ?? "")).date, at }];
		});
	return { line, releases: [...changed, ...tagged].sort((a, b) => a.at - b.at) };
}

// Origin's `v*` tags fetched into `root` before a merge rebuilds the changelog, so a release tagged there counts (AR0699); a line
// when they could not be, the merge going on with the tags `root` has. No prompt, program or hook (as github's calls to origin);
// only the refspec given, so no `remote.origin.fetch` a job wrote, and no prune; a tag `root` holds elsewhere is not moved.
export function fetchTags(root: string): string {
	if (spawnSync("git", ["-C", root, "remote", "get-url", "origin"], { stdio: "ignore" }).status !== 0) return "";
	const { refusal, pins } = checkConfig(root);
	if (refusal !== "") return `tags not fetched from origin: ${refusal}`;
	const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "", GCM_INTERACTIVE: "never", SSH_ASKPASS_REQUIRE: "never", GIT_PROTOCOL_FROM_USER: "0" };
	const words = ["fetch", "--quiet", "--no-tags", "--no-prune", "--refmap=", "origin", "refs/tags/v*:refs/tags/v*"];
	const ran = spawnSync("git", ["--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", ...pins, "-C", root, ...words], { env, stdio: "ignore", timeout: FETCH_MS });
	if (ran.status === 0) return "";
	return `tags not fetched from origin: git fetch ${ran.error === undefined ? `exited ${ran.status}` : `timed out after ${FETCH_MS / 1000} s`}; CHANGELOG.md counts the tags of ${root}`;
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
