import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Command, Host } from "@arthur/core/plugin";
import { branchOf, worker } from "./review-command.ts";

// `arthur review-needed <worker job>` (spec/roadmap.md, entry 53): whether an ended worker's branch needs a review, by the
// first rule that holds, its answer kept in `<folder>/<job>/review-needed`, and on `no review` its ticket moved to done and
// its branch pushed, as after a PASS, by the plugin that provides `github.push` (entry 58), when one is loaded.
// docs/commands/review-needed.md.

const USAGE = "usage: arthur review-needed <worker job>";
// At most this many lines added and removed, a branch with passing checks needs no review.
const SMALL = 30;
// `.env` as text, a file's name: not `process.env`, `.envrc` or `.environment`.
const DOT_ENV = /(?<!\w)\.env\b/;

// `held`: whether a path is on the always-review list.
export function reviewNeededCommand(host: Host, held: (path: string) => boolean): Command {
	return {
		name: "review-needed",
		doc: new URL("../docs/commands/review-needed.md", import.meta.url),
		async run({ args }) {
			const [name, ...more] = args;
			if (name === undefined || more.length > 0 || name.startsWith("-")) {
				console.error(`arthur review-needed: ${name === undefined ? "no job" : name.startsWith("-") ? `unknown flag ${name}` : `one job; got ${args.length}`}\n${USAGE}`);
				return 2;
			}
			const job = worker(host, name);
			const { folder: feature, root, commit: tip, base } = branchOf(host, job);
			const ticket = basename(feature).split("-")[0] ?? "";
			const git = (...words: string[]) => {
				const ran = spawnSync("git", ["-C", root, ...words], { encoding: "utf8" });
				if (ran.status !== 0) throw new Error(`git ${words.join(" ")} in ${root}: ${ran.stderr.trim().split("\n").at(-1) ?? `exit ${ran.status}`}`);
				return ran.stdout.trim();
			};
			const folder = join(host.folder, job.id);
			const checks = existsSync(join(folder, "checks")) ? readFileSync(join(folder, "checks"), "utf8") : "";
			const answer = decide(git, base, tip, held, checks);
			if (answer.startsWith("no review")) host.board.move(ticket, "done");
			mkdirSync(folder, { recursive: true });
			writeFileSync(join(folder, ".review-needed"), `${JSON.stringify({ answer, ticket, branch: job.branch, commit: tip, at: Date.now() })}\n`);
			renameSync(join(folder, ".review-needed"), join(folder, "review-needed"));
			console.log(answer);
			if (!answer.startsWith("no review")) return;
			console.log(`${ticket} moves to done.`);
			for (const line of await Promise.all(host.collect<Promise<string>>("github.push", { project: job.project, branch: job.branch }))) console.log(line);
		},
	};
}

// The answer for `base..tip`, `review: <why>` or `no review: <why>`, by the first rule that holds: a file on the always-review
// list (both names of a renamed one), a deleted file, a `.env` file, `.env` in a changed line outside docs and tests; then only
// docs (`*.md`); over SMALL lines; then the job's `checks` after their last `stale`, each script the tip's package.json declares
// passing.
function decide(git: (...words: string[]) => string, base: string, tip: string, held: (path: string) => boolean, checks: string): string {
	const diff = (options: readonly string[], paths: readonly string[] = []) => git("diff", "--no-renames", ...options, base, tip, "--", ...paths);
	const numstat = diff(["--numstat"]).split("\n").filter(Boolean).map((line) => line.split("\t"));
	const files = numstat.map(([, , path = ""]) => path);
	const listed = files.find(held);
	if (listed !== undefined) return `review: ${listed} is on the always-review list`;
	const deleted = diff(["--diff-filter=D", "--name-only"]).split("\n").find(Boolean);
	if (deleted !== undefined) return `review: deletes ${deleted}`;
	const secrets = files.find((path) => basename(path).startsWith(".env"));
	if (secrets !== undefined) return `review: changes ${secrets}`;
	const mention = mentions(diff(["--unified=0"], [".", ":(exclude)*.md", ":(exclude,glob)**/test/**"]));
	if (mention !== undefined) return `review: the diff mentions .env in ${mention}`;
	if (files.length > 0 && files.every((path) => path.endsWith(".md"))) return `no review: ${files.length} file${files.length === 1 ? "" : "s"}, all docs (*.md)`;
	// A binary file counts no lines; numstat shows it as `-`.
	const size = numstat.reduce((sum, [added, removed]) => sum + (Number(added) || 0) + (Number(removed) || 0), 0);
	const lines = `${size} line${size === 1 ? "" : "s"} changed`;
	if (size > SMALL) return `review: ${lines}, over ${SMALL}`;
	let scripts: readonly string[] = [];
	try {
		const { scripts: declared } = JSON.parse(git("show", `${tip}:package.json`)) as { readonly scripts?: Readonly<Record<string, unknown>> };
		scripts = ["check", "test"].filter((name) => typeof declared?.[name] === "string");
	} catch {
		// No package.json at the tip, or a broken one: no checks.
	}
	if (scripts.length === 0) return `review: ${lines}; the project's package.json declares no check or test script`;
	const recorded = checks.split("\n").filter(Boolean);
	const fresh = recorded.slice(recorded.lastIndexOf("stale") + 1);
	if (fresh.length === 0) return `review: ${lines}; ${recorded.length === 0 ? "the job recorded no checks" : "a file changed after the job's checks (stale)"}`;
	const results = scripts.map((script) => fresh.findLast((line) => line.startsWith(`${script} `)) ?? `no ${script}`);
	const pass = results.every((line, at) => line.startsWith(`${scripts[at]} pass`));
	return `${pass ? "no review" : "review"}: ${lines}; the job's checks: ${results.join(", ")}`;
}

// The first file of a `git diff --unified=0` with `.env` in a changed line.
function mentions(diff: string): string | undefined {
	let [file, hunk] = ["", false];
	for (const line of diff.split("\n")) {
		if (line.startsWith("diff --git ")) hunk = false;
		else if (!hunk && line.startsWith("+++ b/")) file = line.slice("+++ b/".length);
		else if (line.startsWith("@@")) hunk = true;
		else if (hunk && /^[+-]/.test(line) && DOT_ENV.test(line.slice(1))) return file;
	}
	return undefined;
}
