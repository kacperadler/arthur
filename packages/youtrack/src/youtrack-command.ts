import { call, field, getAll, type Instance } from "./youtrack-api.ts";
import { saveAttachments } from "./youtrack-attachments.ts";
import { comments } from "./youtrack-comments.ts";
import { addWork, create, setField, update } from "./youtrack-write.ts";

// `arthur youtrack issue|article|comment ...` (spec/roadmap.md, entries 44 to 46): a project's issues, articles and comments,
// read from and written to the instance its `tracker` picks, an issue's attachments saved: docs/commands/youtrack.md. An id
// outside the project's YouTrack project is refused before any call. No verb deletes an issue or an article.

// A project of the list, and what its `tracker` names when that is youtrack: the instance and the YouTrack project's id.
export type Tracked = { readonly name: string; readonly tracker: { readonly instance: Instance; readonly project: string } | undefined };

const USAGE =
	"usage: arthur youtrack issue list [--all]|get <id>|create <file>|update <id> <file> <version>|set <id> <field> <value>|work <id> <minutes> [<text>]|attachments <id>; arthur youtrack article list|get <id>|create <file>|update <id> <file> <version>; arthur youtrack comment list <id>|add <id> <file>|edit <id> <comment> <file>|delete <id> <comment>; --project <name> for another project than the main one";

// The words each verb takes after it; a `?` marks an optional last one.
const VERBS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
	issue: { list: [], get: ["id"], create: ["file"], update: ["id", "file", "version"], set: ["id", "field", "value"], work: ["id", "minutes", "text?"], attachments: ["id"] },
	article: { list: [], get: ["id"], create: ["file"], update: ["id", "file", "version"] },
	comment: { list: ["id"], add: ["id", "file"], edit: ["id", "comment", "file"], delete: ["id", "comment"] },
};

const FIELDS = {
	issues: "idReadable,summary,resolved",
	issue: "idReadable,summary,description,created,updated,resolved,reporter(login,name),customFields(name,value(name,presentation,text))",
	articles: "idReadable,summary,updated",
	article: "idReadable,summary,content,created,updated,reporter(login,name),parentArticle(idReadable)",
};

// Writes its output; a refusal throws, wrong usage is exit code 2. `folder` is the plugin's own, where attachments go.
export async function youtrackCommand(projects: readonly Tracked[], args: readonly string[], name: string | undefined, folder: string): Promise<number> {
	// `--all`: `issue list` with the resolved issues too (AR0195); by default only the unresolved ones.
	const all = args.includes("--all");
	const [kind = "", verb = "", ...words] = args.filter((each) => each !== "--all");
	const shape = Object.hasOwn(VERBS, kind) && Object.hasOwn(VERBS[kind]!, verb) ? VERBS[kind]![verb]! : undefined;
	if (shape === undefined || words.length < shape.filter((each) => !each.endsWith("?")).length || words.length > shape.length || (all && `${kind} ${verb}` !== "issue list")) {
		console.error(USAGE);
		return 2;
	}
	const project = name === undefined ? projects[0] : projects.find((each) => each.name === name);
	if (project === undefined) throw new Error(`unknown project ${name ?? ""}; projects: ${projects.map((each) => each.name).join(", ") || "none"}`);
	if (project.tracker === undefined) {
		const others = projects.filter((each) => each.tracker !== undefined).map((each) => each.name);
		throw new Error(`project ${project.name} has no youtrack tracker; ${others.length > 0 ? `projects with one: ${others.join(", ")}` : "no project has one"}`);
	}
	const { instance, project: short } = project.tracker;
	if (verb === "list" && kind !== "comment") {
		const path = kind === "issue" ? "issues" : `admin/projects/${short}/articles`;
		const items = await getAll(instance, path, { fields: kind === "issue" ? FIELDS.issues : FIELDS.articles, ...(kind === "issue" ? { query: `project: ${short}${all ? "" : " #Unresolved"}` } : {}) }, `project ${short}`);
		// `SHOP-12 Summary`, ` (resolved)` after a resolved issue.
		const lines = items.map((item) => `${text(field(item, "idReadable"))} ${text(field(item, "summary"))}${typeof field(item, "resolved") === "number" ? " (resolved)" : ""}`);
		console.log(lines.length === 0 ? `no ${kind === "issue" && !all ? "unresolved " : ""}${kind}s in YouTrack project ${short}` : lines.join("\n"));
		return 0;
	}
	if (verb === "create") {
		console.log(text(await create(instance, short, kind as "issue" | "article", words[0] ?? "")));
		return 0;
	}
	const [id = "", first = "", second] = words;
	const form = kind === "article" ? /^([A-Za-z][A-Za-z0-9_]*)-A-\d+$/i : /^([A-Za-z][A-Za-z0-9_]*)-\d+$/;
	const prefix = form.exec(id)?.[1];
	if (prefix === undefined) throw new Error(`${id} is not ${kind === "article" ? `an article id such as ${short}-A-3` : `an issue id such as ${short}-12`}`);
	if (prefix.toUpperCase() !== short.toUpperCase()) throw new Error(`${id} is outside YouTrack project ${short}, the tracker of project ${project.name}; nothing was asked of YouTrack`);
	const asked = `${short}${id.slice(prefix.length).toUpperCase()}`;
	if (kind === "comment") console.log(text(await comments(instance, verb, asked, words.slice(1))));
	else if (verb === "attachments") console.log(text(await saveAttachments(instance, folder, asked)));
	else if (verb === "update") console.log(text(await update(instance, kind as "issue" | "article", asked, first, second ?? "")));
	else if (verb === "set") console.log(text(await setField(instance, asked, first, second ?? "")));
	else if (verb === "work") console.log(text(await addWork(instance, asked, first, second)));
	else console.log(kind === "issue" ? issueText(await call(instance, `issues/${asked}`, { fields: FIELDS.issue }, `issue ${asked}`)) : articleText(await call(instance, `articles/${asked}`, { fields: FIELDS.article }, `article ${asked}`)));
	return 0;
}

// `version:` is the `updated` that `issue update` and `article update` are given, so a change made since is not overwritten.
function issueText(item: unknown): string {
	const fields = field(item, "customFields");
	const values = (Array.isArray(fields) ? fields : []).map((each) => `${text(field(each, "name"))}: ${value(field(each, "value"))}`);
	const resolved = field(item, "resolved");
	return [heading(item), `version: ${text(field(item, "updated"))}`, `resolved: ${typeof resolved === "number" ? day(resolved) : "no"}`, ...values, "", text(field(item, "description"))].join("\n");
}

function articleText(item: unknown): string {
	const parent = field(field(item, "parentArticle"), "idReadable");
	return [heading(item), `version: ${text(field(item, "updated"))}`, ...(typeof parent === "string" ? [`parent: ${text(parent)}`] : []), "", text(field(item, "content"))].join("\n");
}

// `SHOP-12: Summary`, then who wrote it and when.
function heading(item: unknown): string {
	const reporter = field(item, "reporter");
	const who = reporter === null || reporter === undefined ? "nobody" : `${text(field(reporter, "name"))} (${text(field(reporter, "login"))})`;
	return `${text(field(item, "idReadable"))}: ${text(field(item, "summary"))}\nreporter: ${who}; created ${day(field(item, "created"))}; updated ${day(field(item, "updated"))}`;
}

// A custom field's value: none, a number or text, an object (an enum or user's `name`, a period's `presentation`, a text
// field's `text`), or a list of them.
function value(item: unknown): string {
	if (item === null || item === undefined) return "none";
	if (Array.isArray(item)) return item.length === 0 ? "none" : item.map(value).join(", ");
	if (typeof item !== "object") return text(item);
	return text(["name", "presentation", "text"].map((key) => field(item, key)).find((each) => each !== undefined && each !== null));
}

function day(time: unknown): string {
	return typeof time === "number" && Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : "unknown";
}

// The tracker's text as it may be printed: control characters, which could drive the terminal, dropped; a missing one empty.
function text(item: unknown): string {
	return typeof item === "string" || typeof item === "number" ? String(item).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "") : "";
}
