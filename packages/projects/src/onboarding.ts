import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { drafted, writeOnce } from "./init.ts";
import type { Project } from "./projects.ts";

// The kind `onboarding` (spec/roadmap.md, entry 42): its role, the files it drafts named in its prompt, the procedure its end
// brings with its questions cut at 10, and the merge's check of its branch: docs/commands/init.md, "Onboarding".

const KIND = "onboarding";
const MAX_QUESTIONS = 10;
const ITEM = /^\s*\d+[.)]\s/;
const RUN = /^[0-9a-f]{16}$/;

type Ended = { readonly id?: unknown; readonly kind?: unknown; readonly project?: unknown; readonly state?: unknown; readonly reason?: unknown };

export function onboarding(host: Host, all: readonly Project[]): void {
	host.jobs.registerRole({ name: KIND, file: new URL("../roles/onboarding.md", import.meta.url), criteria: ["styleguide"] });
	host.jobs.registerKind({ name: KIND, readOnly: false, role: KIND });
	host.provide("prompt", (role: string, job: { readonly project: string }) => {
		const project = all.find((each) => each.name === job.project);
		if (role !== KIND || project === undefined) return undefined;
		const { vision, criteriaDir } = drafted(project);
		const criteria = host.jobs.criteria().map((name) => `\`${criteriaDir}/${name}.md\``).join(", ");
		return `## The files this onboarding drafts\n\n- The vision: \`${vision}\`\n- The criteria: ${criteria}\n\nIts merge accepts only \`${vision}\` and \`${criteriaDir}/*.md\`.`;
	});
	const procedure = new URL("../roles/coordinator/onboarding-ended.md", import.meta.url);
	// Asked with the job-ended data and the job's final message, which an eval gives for a job in no home.
	host.provide("coordinator.wake", (job: Ended, result?: unknown) => (job.kind === KIND ? [readFileSync(procedure, "utf8").trim(), ...questions(host, job, typeof result === "string" ? result : "")].join("\n\n") : undefined));
	// Asked by the merge with the job as `host.jobs.list()` has it: a reason to refuse its branch, undefined to let it in.
	host.provide("merge.check", (job: Ended & { readonly branch?: unknown }) => {
		if (job.kind !== KIND) return undefined;
		const project = all.find((each) => each.name === job.project);
		return project === undefined ? `project ${String(job.project)} is not in the list` : outside(project, String(job.branch));
	});
}

// The numbered items under `## Questions` of a finished run's final message, cut so that one onboarding sends the owner at most
// 10 in all. `<folder>/onboarding/<id>/<run>` keeps how many each run sent, `<run>` a hash of its message, written once however
// often its wake is built, and only for a job of this home: an eval's wake writes nothing.
function questions(host: Host, job: Ended, result: string): string[] {
	if (job.state !== "ended" || job.reason !== "finished") return [];
	const lines = result.split("\n");
	const items: string[] = [];
	for (const line of lines.slice(lines.findIndex((each) => each.trim() === "## Questions") + 1 || lines.length)) {
		if (line.startsWith("## ")) break;
		if (ITEM.test(line)) items.push(line.trimEnd());
		else if (items.length > 0 && line.trim() !== "") items.push(`${items.pop()}\n${line.trimEnd()}`);
	}
	if (items.length === 0) return [];
	const folder = join(host.folder, "onboarding", String(job.id));
	const run = createHash("sha256").update(result).digest("hex").slice(0, 16);
	const runs = existsSync(folder) ? readdirSync(folder).filter((name) => RUN.test(name) && name !== run) : [];
	const earlier = runs.reduce((sum, name) => sum + Number(readFileSync(join(folder, name), "utf8")), 0);
	const sent = items.slice(0, Math.max(0, MAX_QUESTIONS - earlier));
	if (host.jobs.list().some((each) => each.id === job.id)) writeOnce(join(folder, run), String(sent.length));
	if (sent.length === 0) return [`Its ${items.length} new questions are cut: it asked ${earlier} already, and an onboarding asks at most ${MAX_QUESTIONS}. Send none.`];
	const cut = sent.length < items.length ? `, the first ${sent.length} of its ${items.length}: an onboarding asks at most ${MAX_QUESTIONS} in all, the rest are cut` : "";
	return [`Its questions to send the owner${cut}:\n${sent.join("\n")}`];
}

// What an onboarding's branch changes against the project's checkout (its HEAD, which the merge goes into): only the vision and
// the criteria files, and no symlink, which could bring a file from outside the repository into a prompt.
function outside(project: Project, branch: string): string | undefined {
	const diff = spawnSync("git", ["-C", project.path, "diff", "--raw", "-z", "--no-renames", `HEAD...${branch}`, "--"], { encoding: "utf8" });
	if (diff.status !== 0) return `git diff HEAD...${branch}: ${diff.stderr.trim().split("\n").at(-1)}`;
	const { vision, criteriaDir } = drafted(project);
	const [links, others]: [string[], string[]] = [[], []];
	const fields = diff.stdout.split("\0");
	for (let at = 0; at + 1 < fields.length; at += 2) {
		const path = fields[at + 1] ?? "";
		if (fields[at]?.split(" ")[1] === "120000") links.push(path);
		else if (path !== vision && !(dirname(path) === criteriaDir && path.endsWith(".md"))) others.push(path);
	}
	const reasons = [
		others.length > 0 && `${branch} changes ${others.join(", ")}; an onboarding's merge accepts only ${vision} and ${criteriaDir}/*.md`,
		links.length > 0 && `${branch} adds or changes the symlink ${links.join(", ")}; an onboarding's merge accepts no symlink`,
	];
	return reasons.filter((reason) => reason !== false).join("; ") || undefined;
}
