import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Command, Host } from "@arthur/core/plugin";
import { branchOf, worker } from "./review-command.ts";

// `arthur review-needed <worker job>` (spec/roadmap.md, entry 53): whether an ended worker's branch needs a review, by the
// first rule that holds, its answer kept in `<folder>/<job>/review-needed`; on `no review` its ticket moved to done and its
// branch pushed (`github.push`, entry 58, when a plugin provides it), as after a PASS. docs/commands/review-needed.md.

const USAGE = "usage: arthur review-needed <worker job>";
// At most this many lines added and removed, a branch with passing checks needs no review.
const SMALL = 30;
// `.env` as text, a file's name: not `process.env`, a regex's `process\.env` (core's env-refusal.ts), `.envrc` or `.environment`.
const DOT_ENV = /(?<![\w.]\\*)\.env\b/;

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
			// The merge's own checks first (AR0570): no review is paid for a branch the merge would refuse.
			const refusals = host.collect("merge.check", job).filter((answer) => typeof answer === "string" && answer !== "");
			if (refusals.length > 0) throw new Error(`refused by merge.check: ${refusals.join("; ")}; no review until the branch passes it`);
			const ticket = basename(feature).split("-")[0] ?? "";
			// No hook or fsmonitor the main checkout's config names runs, nor a replacement (refs/replace): a program a job runs may have set them (AR0330, AR0384).
			const git = (...words: string[]) => {
				const ran = spawnSync("git", ["--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "-C", root, ...words], { encoding: "utf8" });
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
			if (answer.startsWith("no review")) for (const line of [`${ticket} moves to done.`, ...(await Promise.all(host.collect<Promise<string>>("github.push", { project: job.project, branch: job.branch })))]) console.log(line);
		},
	};
}

// The answer for `base..tip`, `review: <why>` or `no review: <why>`, by the first rule that holds: a file on the always-review
// list (both names of a renamed one), a deleted file, a `.env` file, `.env` in a changed line outside docs and tests, a binary
// file (numstat's `-` for its counts, a `*.md` too); then only docs (`*.md`); over SMALL lines; then the job's `checks`, for each
// script the tip's package.json declares its latest line (`<script> <result> <commit> clean|dirty`) on the tip's clean tree passing.
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
	for (const [added, , path] of numstat) if (added === "-") return `review: changes a binary file ${path}`;
	if (files.length > 0 && files.every((path) => path.endsWith(".md"))) return `no review: ${files.length} file${files.length === 1 ? "" : "s"}, all docs (*.md)`;
	const size = numstat.reduce((sum, [added, removed]) => sum + Number(added) + Number(removed), 0);
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
	const recorded = checks.split("\n").map((line) => line.split(" ")).filter((words) => words.length >= 4);
	if (recorded.length === 0) return `review: ${lines}; the job recorded no checks`;
	const latest = scripts.map((script) => recorded.findLast((words) => words[0] === script && words.at(-2) === tip && words.at(-1) === "clean") ?? recorded.findLast(([name]) => name === script));
	const off = latest.find((words) => words !== undefined && `${words.at(-2)} ${words.at(-1)}` !== `${tip} clean`);
	if (off !== undefined) return `review: ${lines}; the job's checks ran on ${off.at(-2) === tip ? "a dirty tree" : `${off.at(-2)}, not the tip`}`;
	const results = latest.map((words, at) => words?.slice(0, -2).join(" ") ?? `no ${scripts[at]}`);
	return `${latest.every((words) => words?.[1] === "pass") ? "no review" : "review"}: ${lines}; the job's checks: ${results.join(", ")}`;
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
