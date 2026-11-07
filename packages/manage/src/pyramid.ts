import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import type { Host, Job } from "@arthur/core/plugin";
import { findings } from "./audit.ts";
import type { PyramidOptions } from "./manage-options.ts";
import { fileReport, type Reports, reportPage } from "./report-file.ts";
import { corrections, repeatsOf, shipped } from "./retro.ts";

// The pyramid audit (AR0563): the kind `pyramid`, read-only, with the pyramid role and criteria; `arthur pyramid` and
// `/pyramid` start it on one project, refused for a project without a board or while one runs for it; every pyramid's prompt
// gets the project's corrections, its prose and its checks, read without a model, and the board; the filing writes a before
// and after page beside the report (report-file.ts), and the procedure its end brings. docs/manage.md, "The pyramid audit".

const KIND = "pyramid";
export const PYRAMID_TASK = "Audit the project by the pyramid: move each correction as high up as it goes, as your role and the pyramid criteria say.";
// Its own folder: a pyramid report never moves the range of the next audit (spec/quality/) or retro (spec/retro/).
export const PYRAMIDS: Reports = { folder: "spec/pyramid", title: "Pyramid", commit: "Commit audited", page: reportPage };
const USAGE = "usage: arthur pyramid [--project <name>] ['<focus>']";
// The files of the project's own prose, its checks, and its tests, by their path in the repository.
const PROSE = /(^|\/)(AGENTS|CLAUDE|CONTRIBUTING)\.md$|(^|\/)\.(agents|claude|cursor)\/|(^|\/)\.cursorrules$|^\.github\/copilot-instructions\.md$|style-?guide/i;
const CHECKS = /^\.github\/workflows\/|^\.gitlab-ci\.yml$|^\.circleci\/|(^|\/)(tsconfig[^/]*\.json|\.?eslint[^/]*|biome\.jsonc?|\.prettierrc[^/]*|ruff\.toml|pyproject\.toml|mypy\.ini|setup\.cfg|\.golangci\.ya?ml|Makefile|Cargo\.toml|go\.mod|\.pre-commit-config\.yaml|lefthook\.ya?ml)$/;
const TEST = /\.(test|spec)\.[cm]?[jt]sx?$|_test\.(go|py|rb)$|(^|\/)test_[^/]*\.py$|_spec\.rb$/;
// A line that opens one test, in the test files' languages.
const CASE = /^\s*(?:(?:test|it)(?:\.\w+)?\(|def test_|func Test)/gm;

export function pyramid(host: Host, options: PyramidOptions | undefined): void {
	host.jobs.registerRole({ name: KIND, file: new URL("../roles/pyramid.md", import.meta.url), criteria: ["pyramid", "styleguide"] });
	host.jobs.registerKind({ name: KIND, readOnly: true, role: KIND, ...(options?.budgetUsd === undefined ? {} : { budgetUsd: options.budgetUsd }), file: (filing) => fileReport(PYRAMIDS, filing) });
	host.provide("prompt", (role: string, job: Job) => (role === KIND ? context(host, job) : undefined));
	const procedure = new URL("../roles/coordinator/pyramid-ended.md", import.meta.url);
	host.provide("coordinator.wake", (job: { readonly kind?: unknown }) => (job.kind === KIND ? readFileSync(procedure, "utf8").trim() : undefined));
	// Under the spawn lock, so two starts at once find each other, `arthur spawn --kind pyramid` among them.
	host.jobs.beforeSpawn(({ kind, project }) => {
		if (kind !== KIND) return undefined;
		const path = host.board.projects().find((each) => each.name === project)?.path ?? "";
		if (!existsSync(join(path, "spec/build.json"))) return `project ${project} has no board, ${join(path, "spec/build.json")}: arthur init ${project} first`;
		const running = new Set(host.jobs.running());
		const busy = host.jobs.list().find((job) => job.kind === KIND && job.project === project && running.has(job.id));
		return busy === undefined ? undefined : `a pyramid audit of ${project} runs already: job ${busy.id}; wait for its end, or arthur stop ${busy.id}`;
	});
	host.commands.register({
		name: KIND,
		doc: new URL("../docs/commands/pyramid.md", import.meta.url),
		phone: {
			about: "a pyramid audit of a project: one planning ticket and a before and after page; /pyramid [<project>] [<focus>]",
			reply: (text) => {
				const [first = "", ...rest] = text.trim().split(/\s+/);
				const named = host.board.projects().some((each) => each.name === first);
				return start(host, named ? first : undefined, (named ? rest.join(" ") : text).trim());
			},
		},
		async run({ args, project }) {
			if (args.length > 1 || args[0]?.startsWith("-")) return (console.error(USAGE), 2);
			console.log(await start(host, project, args[0]?.trim() ?? ""));
		},
	});
}

// The pyramid kind on `project`, the main one when undefined, the focus under its task; refused, it throws.
async function start(host: Host, project: string | undefined, focus: string): Promise<string> {
	const job = await host.jobs.spawn({ task: focus === "" ? PYRAMID_TASK : `${PYRAMID_TASK}\n\nFocus: ${focus}`, kind: KIND, ...(project === undefined ? {} : { project }) });
	if (job.failed !== undefined) throw new Error(`job ${job.id} did not start: ${job.failed}`);
	return `pyramid: started job ${job.id}`;
}

// Git's output in `root`, empty when it exits with an error; Git missing throws.
function git(root: string, args: readonly string[]): string {
	const ran = spawnSync("git", ["--no-replace-objects", "-C", root, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	if (ran.error !== undefined) throw ran.error;
	return ran.status === 0 ? ran.stdout : "";
}

// The section every pyramid's prompt gets, from the job's checkout (the project's on another machine): the corrections
// ledger, the prose and checks inventories, and the board.
function context(host: Host, job: Job): string {
	const root = host.board.projects().find((each) => each.name === job.project)?.path ?? job.root;
	const dir = existsSync(job.worktree) ? job.worktree : root;
	const files = git(dir, ["ls-files"]).split("\n").filter(Boolean);
	// A file's text, undefined when it cannot be read (a submodule, a link to nowhere); its lines, or why not.
	const read = (file: string) => {
		try {
			return readFileSync(isAbsolute(file) ? file : join(dir, file), "utf8");
		} catch {
			return undefined;
		}
	};
	const lines = (file: string) => {
		const text = read(file);
		return text === undefined ? "not read" : `${text.split("\n").length - (text.endsWith("\n") ? 1 : 0)} lines`;
	};
	const tickets = host.board.list(job.project);
	const fails = new Map<string, string[]>();
	for (const path of git(dir, ["grep", "-l", "-E", "^- Verdict: FAIL$", "--", "*review-*.md"]).split("\n").filter(Boolean)) {
		const ticket = tickets.find((each) => dirname(each.path) === dirname(path));
		if (ticket !== undefined) fails.set(ticket.id, [...(fails.get(ticket.id) ?? []), path.slice(dirname(path).length + 1)]);
	}
	const blocked = host.jobs.list().filter((each) => each.project === job.project && each.state === "blocked" && each.reason.startsWith("user: "));
	const ledger = [
		`### FAIL reviews\n\n${[...fails].map(([id, names]) => `- ${id} (${dirname(tickets.find((each) => each.id === id)?.path ?? "")}/): ${names.join(", ")}`).join("\n") || "none"}`,
		`### Open and deferred findings\n\n${findings(dir, tickets, /^- Status: (open|deferred \(client summary\))\s*$/m, true).join("\n") || "none"}`,
		repeatsOf(host, job.project, undefined),
		`### Blocked on the owner\n\n${blocked.map((each) => `- ${each.id} (${each.kind}): ${each.reason.slice("user: ".length)}`).join("\n") || "none"}`,
		corrections(host, job.project, undefined),
	];
	// No FAIL, finding, question or steer: a project with no Arthur history, whose corrections are in its git log.
	const none = [ledger[0], ledger[1], ledger[3]].every((section) => section?.endsWith("\n\nnone")) && ledger[4]?.endsWith("\n\nnone");
	const history = none ? "\n\nNo Arthur history: no correction is recorded. Read the repository and its git log instead: its fix-up, revert and review commits are its corrections." : "";
	const prose = [...shipped(host, root), ...files.filter((file) => PROSE.test(file))].map((file) => `- ${file} (${lines(file)})`);
	const scripts = files.filter((file) => /(^|\/)package\.json$/.test(file)).flatMap((file) => {
		try {
			const { scripts: all = {} } = JSON.parse(read(file) ?? "") as { scripts?: Record<string, string> };
			return Object.entries(all).map(([name, command]) => `- ${file} ${name}: ${command}`);
		} catch (error) {
			return [`- ${file}: not read: ${(error as Error).message.split("\n")[0]}`];
		}
	});
	const tests = files.filter((file) => TEST.test(file));
	const cases = tests.reduce((total, file) => total + (read(file)?.match(CASE)?.length ?? 0), 0);
	return [
		`## This pyramid audit\n\nYou audit project ${job.project} at ${job.base}; your worktree is a detached checkout of that commit.${history}`,
		...ledger,
		`### Prose\n\nThe files agents read, the plugins' roles, procedures and criteria first:\n${prose.join("\n") || "none"}`,
		`### Checks\n\nScripts:\n${scripts.join("\n") || "none"}\n\nCI, type and lint configs:\n${files.filter((file) => CHECKS.test(file)).map((file) => `- ${file} (${lines(file)})`).join("\n") || "none"}\n\nTests: ${tests.length} test files, ${cases} tests`,
		`### Board\n\n${host.board.digest(job.project)}`,
	].join("\n\n");
}
