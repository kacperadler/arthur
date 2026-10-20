import { readFileSync } from "node:fs";
import { call, field, getAll, type Instance, remove } from "./youtrack-api.ts";

// Writing to YouTrack (spec/roadmap.md, entry 45): an issue or an article created or updated from a file, an issue's custom
// field set, its tags changed, an issue moved to another project, an article under another (AR0222);
// docs/commands/youtrack.md. Each returns the line to print; a refusal of what was given (an empty file) throws before any
// call, and an update is made only from the version read.

type Kind = "issue" | "article";

// The key of the text under the summary: an issue's description, an article's content.
const TEXT = { issue: "description", article: "content" } as const;

// `parent`: the article a new article goes under, a sub-article.
export async function create(instance: Instance, project: string, kind: Kind, file: string, parent?: string): Promise<string> {
	const item = fromFile(kind, file);
	const under = parent === undefined ? {} : { parentArticle: { id: await databaseId(instance, `articles/${parent}`, `article ${parent}`) } };
	const made = await call(instance, `${kind}s`, { fields: "idReadable" }, `a new ${kind} in project ${project}`, { project: { id: await databaseId(instance, `admin/projects/${project}`, `YouTrack project ${project}`) }, ...item, ...under });
	return `created ${String(field(made, "idReadable"))}: ${item.summary}`;
}

// `issue move`: the issue into another YouTrack project of the instance, where it gets a new id; `article move`: the article
// under another.
export async function move(instance: Instance, kind: Kind, id: string, to: string): Promise<string> {
	if (kind === "article") {
		await call(instance, `articles/${id}`, { fields: "idReadable" }, `article ${id}`, { parentArticle: { id: await databaseId(instance, `articles/${to}`, `article ${to}`) } });
		return `${id}: moved under ${to}`;
	}
	if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(to)) throw new Error(`${to} is not a YouTrack project id such as SHOP; nothing was asked of YouTrack`);
	const moved = await call(instance, `issues/${id}`, { fields: "idReadable" }, `issue ${id}`, { project: { id: await databaseId(instance, `admin/projects/${to}`, `YouTrack project ${to}`) } });
	return `moved ${id} to ${String(field(moved, "idReadable"))}`;
}

// `tag`: the tag of that name, any case, created first when the token's user sees none, as YouTrack's own tag box does;
// `untag`: the issue's tag of that name.
export async function tag(instance: Instance, verb: string, id: string, given: string): Promise<string> {
	const name = given.trim();
	if (name === "") throw new Error("a tag needs a name; nothing was asked of YouTrack");
	const same = (each: unknown) => String(field(each, "name")).toLowerCase() === name.toLowerCase();
	if (verb === "untag") {
		const tags = await getAll(instance, `issues/${id}/tags`, { fields: "id,name" }, `the tags of issue ${id}`);
		const found = tags.find(same);
		if (found === undefined) throw new Error(`${id} has no tag ${name}; its tags: ${tags.map((each) => String(field(each, "name"))).join(", ") || "none"}; nothing was written`);
		await remove(instance, `issues/${id}/tags/${String(field(found, "id"))}`, `tag ${name} of issue ${id}`);
		return `${id}: untagged ${String(field(found, "name"))}`;
	}
	const found = (await getAll(instance, "tags", { fields: "id,name", query: name }, `tag ${name}`)).find(same);
	const chosen = found ?? (await call(instance, "tags", { fields: "id,name" }, `a new tag ${name}`, { name }));
	await call(instance, `issues/${id}/tags`, { fields: "id,name" }, `the tags of issue ${id}`, { id: field(chosen, "id") });
	return `${id}: tagged ${String(field(chosen, "name"))}${found === undefined ? " (a new tag)" : ""}`;
}

// The database id YouTrack's JSON names an entity by in a body, read from `path`.
async function databaseId(instance: Instance, path: string, what: string): Promise<string> {
	const id = field(await call(instance, path, { fields: "id" }, what), "id");
	if (typeof id !== "string") throw new Error(`instance ${instance.label}: the answer for ${what} has no id`);
	return id;
}

// `version` is the `updated` the issue or article had when it was read (`get` prints it): one changed since is not
// overwritten (AR0204). An issue says who changed it in `updater`, an article in `updatedBy`.
export async function update(instance: Instance, kind: Kind, id: string, file: string, version: string): Promise<string> {
	const item = fromFile(kind, file);
	if (!/^\d+$/.test(version)) throw new Error(`${version} is not a version: the number after version: in what arthur youtrack ${kind} get ${id} printed`);
	const by = kind === "issue" ? "updater" : "updatedBy";
	const now = await call(instance, `${kind}s/${id}`, { fields: `updated,${by}(login,name)` }, `${kind} ${id}`);
	const updated = field(now, "updated");
	if (updated !== Number(version)) {
		const who = field(field(now, by), "login");
		const when = typeof updated === "number" ? ` at ${new Date(updated).toISOString()}` : "";
		throw new Error(`${id} changed since version ${version}: ${typeof who === "string" ? who : "someone"} updated it${when}; read it again with arthur youtrack ${kind} get ${id} and make the change on what it holds now; nothing was written`);
	}
	const done = await call(instance, `${kind}s/${id}`, { fields: "idReadable,updated" }, `${kind} ${id}`, item);
	return `updated ${id}; version: ${String(field(done, "updated"))}`;
}

// The value in the shape the field's type takes (YouTrack's "Custom Fields in REST API"); a value the project does not allow
// is YouTrack's to refuse.
export async function setField(instance: Instance, id: string, name: string, value: string): Promise<string> {
	const issue = await call(instance, `issues/${id}`, { fields: "customFields(name,projectCustomField(field(fieldType(id))))" }, `issue ${id}`);
	const fields = field(issue, "customFields");
	const all = Array.isArray(fields) ? fields : [];
	const found = all.find((each) => String(field(each, "name")).toLowerCase() === name.toLowerCase());
	if (found === undefined) throw new Error(`issue ${id} has no field ${name}; its fields: ${all.map((each) => String(field(each, "name"))).join(", ") || "none"}; nothing was written`);
	const [real, type] = [String(field(found, "name")), field(field(field(field(found, "projectCustomField"), "field"), "fieldType"), "id")];
	const custom = { name: real, $type: field(found, "$type"), value: shaped(typeof type === "string" ? type : "string", value) };
	await call(instance, `issues/${id}`, { fields: "idReadable" }, `field ${real} of issue ${id}`, { customFields: [custom] });
	return `${id}: ${real} set to ${value}`;
}

// The file's first line, a Markdown heading's `#` dropped, is the summary; the rest the description or content.
function fromFile(kind: Kind, file: string): { readonly summary: string } & Partial<Record<(typeof TEXT)[Kind], string>> {
	const [first = "", ...rest] = readBytes(file).toString("utf8").trim().split("\n");
	const summary = first.replace(/^#+(\s+|$)/, "").trim();
	if (summary === "") throw new Error(`${file} is empty or starts with an empty heading; its first line is the ${kind}'s summary, the rest its ${TEXT[kind]}; nothing was asked of YouTrack`);
	return { summary, [TEXT[kind]]: rest.join("\n").trim() };
}

// A file a write sends, a comment's and an attachment's too; one that cannot be read is refused before any call.
export function readBytes(file: string): Buffer<ArrayBuffer> {
	try {
		return readFileSync(file);
	} catch (error) {
		throw new Error(`cannot read ${file}: ${error instanceof Error && "code" in error ? String(error.code) : String(error)}; nothing was asked of YouTrack`);
	}
}

// A custom field's type (`enum[1]`, `user[*]`, `integer`, `date`, ...) and the value given in its JSON shape: a list for
// `[*]`, its items split at commas.
function shaped(type: string, value: string): unknown {
	if (type.endsWith("[*]")) return value.split(",").map((each) => each.trim()).filter((each) => each !== "").map((each) => shaped(type.replace("[*]", "[1]"), each));
	if (type === "user[1]") return { login: value };
	if (type.endsWith("[1]")) return { name: value };
	if (type === "period") return { presentation: value };
	if (type === "text") return { text: value };
	if (type === "integer" || type === "float") return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
	if (type === "date" || type === "date and time") return /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value)) ? Date.parse(value) : value;
	return value;
}
