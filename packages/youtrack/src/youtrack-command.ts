import { get, getAll, type Instance } from "./youtrack-api.ts";

// `arthur youtrack issue|article list|get` (spec/roadmap.md, entry 44): a project's issues and articles, read from the instance
// its `tracker` picks: docs/commands/youtrack.md. An id outside the project's YouTrack project is refused before any call.

// A project of the list, and what its `tracker` names when that is youtrack: the instance and the YouTrack project's id.
export type Tracked = { readonly name: string; readonly tracker: { readonly instance: Instance; readonly project: string } | undefined };

const USAGE = "usage: arthur youtrack issue list|get <id>; arthur youtrack article list|get <id>; --project <name> for another project than the main one";

const FIELDS = {
	issues: "idReadable,summary,resolved",
	issue: "idReadable,summary,description,created,updated,resolved,reporter(login,name),customFields(name,value(name,presentation,text))",
	articles: "idReadable,summary,updated",
	article: "idReadable,summary,content,created,updated,reporter(login,name),parentArticle(idReadable)",
};

// Writes its output; a refusal throws, wrong usage is exit code 2.
export async function youtrackCommand(projects: readonly Tracked[], args: readonly string[], name: string | undefined): Promise<number> {
	const [kind = "", verb = "", id, ...extra] = args;
	if (!["issue", "article"].includes(kind) || !["list", "get"].includes(verb) || (verb === "get") !== (id !== undefined) || extra.length > 0) {
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
	if (id === undefined) {
		const path = kind === "issue" ? "issues" : `admin/projects/${short}/articles`;
		const items = await getAll(instance, path, { fields: kind === "issue" ? FIELDS.issues : FIELDS.articles, ...(kind === "issue" ? { query: `project: ${short}` } : {}) }, `project ${short}`);
		// `SHOP-12 Summary`, ` (resolved)` after a resolved issue.
		const lines = items.map((item) => `${text(field(item, "idReadable"))} ${text(field(item, "summary"))}${typeof field(item, "resolved") === "number" ? " (resolved)" : ""}`);
		console.log(lines.length === 0 ? `no ${kind}s in YouTrack project ${short}` : lines.join("\n"));
		return 0;
	}
	const form = kind === "issue" ? /^([A-Za-z][A-Za-z0-9_]*)-\d+$/ : /^([A-Za-z][A-Za-z0-9_]*)-A-\d+$/i;
	const prefix = form.exec(id)?.[1];
	if (prefix === undefined) throw new Error(`${id} is not ${kind === "issue" ? `an issue id such as ${short}-12` : `an article id such as ${short}-A-3`}`);
	if (prefix.toUpperCase() !== short.toUpperCase()) throw new Error(`${id} is outside YouTrack project ${short}, the tracker of project ${project.name}; nothing was asked of YouTrack`);
	const asked = `${short}${id.slice(prefix.length).toUpperCase()}`;
	const item = await get(instance, `${kind === "issue" ? "issues" : "articles"}/${asked}`, { fields: kind === "issue" ? FIELDS.issue : FIELDS.article }, `${kind} ${asked}`);
	console.log(kind === "issue" ? issueText(item) : articleText(item));
	return 0;
}

function issueText(item: unknown): string {
	const fields = field(item, "customFields");
	const values = (Array.isArray(fields) ? fields : []).map((each) => `${text(field(each, "name"))}: ${value(field(each, "value"))}`);
	const resolved = field(item, "resolved");
	return [heading(item), `resolved: ${typeof resolved === "number" ? day(resolved) : "no"}`, ...values, "", text(field(item, "description"))].join("\n");
}

function articleText(item: unknown): string {
	const parent = field(field(item, "parentArticle"), "idReadable");
	return [heading(item), ...(typeof parent === "string" ? [`parent: ${text(parent)}`] : []), "", text(field(item, "content"))].join("\n");
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

function field(item: unknown, key: string): unknown {
	return typeof item === "object" && item !== null && key in item ? (item as Readonly<Record<string, unknown>>)[key] : undefined;
}

function day(time: unknown): string {
	return typeof time === "number" && Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : "unknown";
}

// The tracker's text as it may be printed: control characters, which could drive the terminal, dropped; a missing one empty.
function text(item: unknown): string {
	return typeof item === "string" || typeof item === "number" ? String(item).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "") : "";
}
