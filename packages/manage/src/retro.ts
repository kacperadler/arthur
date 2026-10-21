import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Host, Job, PhoneFrom } from "@arthur/core/plugin";
import type { RetroOptions } from "./manage-options.ts";
import { fileReport, newest } from "./report-file.ts";
import { period, RETROS, retroDue } from "./retro-due.ts";
import { scheduleKind } from "./scheduled-kind.ts";
import { stats } from "./stats.ts";

// The retro (spec/roadmap.md, entry 63): the kind `retro`, read-only, with the retro role and the retro criteria; every retro's
// prompt gets the FAIL reviews, findings and outcomes of the merges since the last retro (retro-due.ts), the stats, the board,
// and the roles and criteria; `arthur retro-due`, also the coordinator's context line; the schedule entry of `retro.day` and
// `retro.at`, which starts none while no retro is due; the filing with its phone page (report-file.ts), `/retro` sending the
// newest page, and the procedure its end brings. docs/manage.md, "The retro".

const KIND = "retro";
export const RETRO_TASK = "Look back on the merges since the last retro, as your role and the retro criteria say.";

export function retro(host: Host, options: RetroOptions | undefined): void {
	host.jobs.registerRole({ name: KIND, file: new URL("../roles/retro.md", import.meta.url), criteria: ["retro"] });
	host.jobs.registerKind({ name: KIND, readOnly: true, role: KIND, file: (filing) => fileReport(RETROS, filing) });
	host.provide("prompt", (role: string, job: Job) => (role === KIND ? context(host, job) : undefined));
	const procedure = new URL("../roles/coordinator/retro-ended.md", import.meta.url);
	host.provide("coordinator.wake", (job: { readonly kind?: unknown }) => (job.kind === KIND ? readFileSync(procedure, "utf8").trim() : undefined));
	host.provide("coordinator.context", () => retroDue(period(host, undefined, "HEAD")).line);
	host.commands.register({
		name: "retro-due",
		doc: new URL("../docs/commands/retro-due.md", import.meta.url),
		run({ args, project }) {
			if (args.length > 0) {
				console.error("usage: arthur retro-due [--project <name>]");
				return 2;
			}
			console.log(retroDue(period(host, project, "HEAD")).line);
		},
	});
	host.commands.register({
		name: "retro",
		doc: new URL("../docs/commands/retro.md", import.meta.url),
		phone: { about: "the newest retro's page, as a file", reply: (text, from) => (text.trim() === "" ? sendPage(host, from) : "usage: /retro") },
		run({ args, project }) {
			if (args.length > 0) {
				console.error("usage: arthur retro [--project <name>]");
				return 2;
			}
			const root = projectRoot(host, project);
			console.log(newest(root, RETROS, "html")[0] ?? noPage(root));
		},
	});
	if (options === undefined) return;
	const skip = () => {
		const due = retroDue(period(host, undefined, "HEAD"));
		return due.due ? undefined : due.line;
	};
	scheduleKind(host, { kind: KIND, option: "retro", daysOption: "retro.day", at: options.at, days: [options.day], task: RETRO_TASK, skip });
}

// The folder of `project`, the main one when undefined; `host.board.list` refuses an unknown project.
function projectRoot(host: Host, project: string | undefined): string {
	host.board.list(project);
	return (project === undefined ? host.board.projects()[0] : host.board.projects().find((each) => each.name === project))!.path;
}

const noPage = (root: string) => `no retro page yet: ${RETROS.folder}/ in ${root} holds none; a retro's filing writes one beside its report`;

// `/retro`: the main project's newest page, sent as a file by the channel the command came from, to its place.
async function sendPage(host: Host, from: PhoneFrom): Promise<string> {
	const root = projectRoot(host, undefined);
	const [page] = newest(root, RETROS, "html");
	if (page === undefined) return noPage(root);
	const message = { files: [join(root, page)], ...(from.place === undefined ? {} : { place: from.place }) };
	const answers = host.collectEach("channel.send", message).filter((answer) => from.channel === undefined || answer.plugin === from.channel);
	if (answers.length === 0) return `${page} not sent: ${from.channel ?? "no channel"} provides no channel.send`;
	const lines = await Promise.all(
		answers.map(async (answer) => {
			if ("error" in answer) return `${page} not sent by ${answer.plugin}: ${answer.error.message.split("\n").join("; ")}`;
			if (typeof answer.value !== "function") return `${page} not sent by ${answer.plugin}: channel.send answered no send`;
			return `${page}: ${answer.plugin}: ${await answer.value()}`;
		}),
	);
	return lines.join("\n");
}

// The role files, procedures and criteria the plugins of this load ship (a role file's own folder, `roles/coordinator/`,
// `criteria/`), from the project's root when inside it.
function shipped(host: Host, root: string): string[] {
	return host.code.flatMap((folder) =>
		["roles", "roles/coordinator", "criteria"].flatMap((sub) => {
			const path = join(folder, sub);
			if (!existsSync(path)) return [];
			return readdirSync(path)
				.filter((name) => name.endsWith(".md"))
				.sort()
				.map((name) => {
					const file = relative(root, join(path, name));
					return file.startsWith("..") ? join(path, name) : file;
				});
		}),
	);
}

// The section every retro's prompt gets, from the project's checkout: the period, each merged ticket's files to read, the stats
// since the last retro's commit, the board, and the roles and criteria.
function context(host: Host, job: Job): string {
	const look = period(host, job.project, job.base);
	const merged = look.merged.map((each) => {
		if (each.folder === undefined) return `- ${each.id}: not on the board, nothing to read`;
		const files = [...(each.outcome ? ["outcome.md"] : []), ...each.fails.map((name) => `${name} (FAIL)`), ...(each.findings > 0 ? [`findings.md (${each.findings})`] : [])];
		return `- ${each.id} ${each.ticket?.title} (${each.folder}/): ${files.join(", ") || "nothing to read"}`;
	});
	return [
		`## This retro\n\nYou look back on project ${job.project} at ${job.base}; your worktree is a detached checkout of that commit.`,
		`### Merges since ${look.since}\n\n${retroDue(look).line}\n\n${merged.join("\n") || "none"}`,
		`### Stats\n\n${stats(host, job.project, look.made)}`,
		`### Board\n\n${host.board.digest(job.project)}`,
		`### Roles and criteria\n\nThe files the plugins ship:\n${shipped(host, look.project.path).map((file) => `- ${file}`).join("\n") || "none"}\n\nThe project's own criteria files, beside the retro criteria above: ${host.jobs.criteria().join(", ")}.`,
	].join("\n\n");
}
