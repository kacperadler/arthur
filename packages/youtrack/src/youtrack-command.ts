import { call, field, getAll, type Instance, remove } from "./youtrack-api.ts";
import { changeAttachment, saveAttachments } from "./youtrack-attachments.ts";
import { comments } from "./youtrack-comments.ts";
import { addWork, create, setField, update } from "./youtrack-write.ts";

// `arthur youtrack issue|article|comment|attachment ...` (spec/roadmap.md, entries 44 to 46): a project's issues, articles,
// comments and attachments, read from and written to the instance its `tracker` picks: docs/commands/youtrack.md. An id
// outside the project's YouTrack project is refused before any call. The coordinator may delete an issue, an article or an
// attachment (AR0220); a job never writes, so never deletes.

// A project of the list, and what its `tracker` names when that is youtrack: the instance and the YouTrack project's id.
export type Tracked = { readonly name: string; readonly tracker: { readonly instance: Instance; readonly project: string } | undefined };

const USAGE =
	"usage: arthur youtrack issue list [--all]|get <id>|create <file>|update <id> <file> <version>|set <id> <field> <value>|work <id> <minutes> [<text>]|attachments <id>|delete <id>; arthur youtrack article list|get <id>|create <file>|update <id> <file> <version>|delete <id>; arthur youtrack comment list <id>|add <id> <file>|edit <id> <comment> <file>|delete <id> <comment>; arthur youtrack attachment add <id> <file>|delete <id> <attachment>; --project <name> for another project than the main one";

// The words each verb takes after it; a `?` marks an optional last one.
const VERBS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
	issue: { list: [], get: ["id"], create: ["file"], update: ["id", "file", "version"], set: ["id", "field", "value"], work: ["id", "minutes", "text?"], attachments: ["id"], delete: ["id"] },
	article: { list: [], get: ["id"], create: ["file"], update: ["id", "file", "version"], delete: ["id"] },
	comment: { list: ["id"], add: ["id", "file"], edit: ["id", "comment", "file"], delete: ["id", "comment"] },
	attachment: { add: ["id", "file"], delete: ["id", "attachment"] },
};

const FIELDS = {
	issues: "idReadable,summary,resolved,customFields(name,value(name))",
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
	// A job never writes to YouTrack (entry 46): the wrapper starts its agent with `ARTHUR_JOB` set, which its commands inherit.
	if (process.env.ARTHUR_JOB && ["create", "update", "set", "work", "add", "edit", "delete"].includes(verb))
		throw new Error("a job never writes to YouTrack; put what should go there in your final message; nothing was asked of YouTrack");
	const project = name === undefined ? projects[0] : projects.find((each) => each.name === name);
	if (project === undefined) throw new Error(`unknown project ${name ?? ""}; projects: ${projects.map((each) => each.name).join(", ") || "none"}`);
	if (project.tracker === undefined) {
		const others = projects.filter((each) => each.tracker !== undefined).map((each) => each.name);
		throw new Error(`project ${project.name} has no youtrack tracker; ${others.length > 0 ? `projects with one: ${others.join(", ")}` : "no project has one"}`);
	}
	const { instance, project: short } = project.tracker;
	if (verb === "list" && kind === "article") {
		const items = await getAll(instance, `admin/projects/${short}/articles`, { fields: FIELDS.articles }, `project ${short}`);
		console.log(items.length === 0 ? `no articles in YouTrack project ${short}` : items.map((item) => `${text(field(item, "idReadable"))} ${text(field(item, "summary"))}`).join("\n"));
		return 0;
	}
	if (verb === "list" && kind === "issue") {
		// Only the State field comes with each issue (`customFields=State`).
		const items = await getAll(instance, "issues", { fields: FIELDS.issues, customFields: "State", query: `project: ${short}${all ? "" : " #Unresolved"}` }, `project ${short}`);
		console.log(items.length === 0 ? `no ${all ? "" : "unresolved "}issues in YouTrack project ${short}` : await byState(instance, short, items));
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
	else if (kind === "attachment") console.log(text(await changeAttachment(instance, verb, asked, words.slice(1))));
	else if (verb === "attachments") console.log(text(await saveAttachments(instance, folder, asked)));
	else if (verb === "delete") console.log(await remove(instance, `${kind}s/${asked}`, `${kind} ${asked}`).then(() => `deleted ${asked}`));
	else if (verb === "update") console.log(text(await update(instance, kind as "issue" | "article", asked, first, second ?? "")));
	else if (verb === "set") console.log(text(await setField(instance, asked, first, second ?? "")));
	else if (verb === "work") console.log(text(await addWork(instance, asked, first, second)));
	else console.log(kind === "issue" ? issueText(await call(instance, `issues/${asked}`, { fields: FIELDS.issue }, `issue ${asked}`)) : articleText(await call(instance, `articles/${asked}`, { fields: FIELDS.article }, `article ${asked}`)));
	return 0;
}

// The issues under a heading per state, `Open (2)`, in the order of the project's State bundle (AR0220); a state the bundle
// does not hold after those, in the order met, and the issues without one under `(no state)`, last. A line is
// `  SHOP-12 Summary`, ` (resolved)` after a resolved issue.
async function byState(instance: Instance, short: string, items: readonly unknown[]): Promise<string> {
	const fields = await getAll(instance, `admin/projects/${short}/customFields`, { fields: "field(name),bundle(values(name,ordinal))" }, `the fields of project ${short}`);
	const values = field(field(fields.find((each) => field(field(each, "field"), "name") === "State"), "bundle"), "values");
	const order = (Array.isArray(values) ? values : []).toSorted((a, b) => Number(field(a, "ordinal")) - Number(field(b, "ordinal")));
	const groups = new Map<string, string[]>(order.map((each) => [text(field(each, "name")), []]));
	for (const item of items) {
		const custom = field(item, "customFields");
		const state = text(field(field((Array.isArray(custom) ? custom : []).find((each) => field(each, "name") === "State"), "value"), "name")) || "(no state)";
		const line = `  ${text(field(item, "idReadable"))} ${text(field(item, "summary"))}${typeof field(item, "resolved") === "number" ? " (resolved)" : ""}`;
		groups.set(state, [...(groups.get(state) ?? []), line]);
	}
	return [...groups]
		.filter(([, lines]) => lines.length > 0)
		.sort(([a], [b]) => Number(a === "(no state)") - Number(b === "(no state)"))
		.map(([state, lines]) => `${state} (${lines.length})\n${lines.join("\n")}`)
		.join("\n\n");
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
