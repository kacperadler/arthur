import { readFileSync } from "node:fs";
import { call, field, type Instance } from "./youtrack-api.ts";

// Writing to YouTrack (spec/roadmap.md, entry 45): an issue or an article created or updated from a file, an issue's custom
// field set, a work item added; docs/commands/youtrack.md. No verb deletes. Each returns the line to print; a refusal of
// what was given (an empty file, 0 minutes) throws before any call, and an update is made only from the version read.

type Kind = "issue" | "article";

// The key of the text under the summary: an issue's description, an article's content.
const TEXT = { issue: "description", article: "content" } as const;

export async function create(instance: Instance, project: string, kind: Kind, file: string): Promise<string> {
	const item = fromFile(kind, file);
	const found = await call(instance, `admin/projects/${project}`, { fields: "id,shortName" }, `YouTrack project ${project}`);
	const id = field(found, "id");
	if (typeof id !== "string") throw new Error(`instance ${instance.label}: the answer for YouTrack project ${project} has no id`);
	const made = await call(instance, `${kind}s`, { fields: "idReadable" }, `a new ${kind} in project ${project}`, { project: { id }, ...item });
	return `created ${String(field(made, "idReadable"))}: ${item.summary}`;
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

export async function addWork(instance: Instance, id: string, minutes: string, text: string | undefined): Promise<string> {
	if (!/^\d+$/.test(minutes) || Number(minutes) === 0) throw new Error(`a work item takes a whole number of minutes above 0, got ${minutes || "nothing"}; nothing was asked of YouTrack`);
	const body = { duration: { minutes: Number(minutes) }, ...(text ? { text } : {}) };
	const made = await call(instance, `issues/${id}/timeTracking/workItems`, { fields: "duration(minutes,presentation)" }, `the work items of issue ${id}`, body);
	const presentation = field(field(made, "duration"), "presentation");
	return `${id}: added ${typeof presentation === "string" ? presentation : `${minutes}m`} of work`;
}

// The file's first line, a Markdown heading's `#` dropped, is the summary; the rest the description or content.
function fromFile(kind: Kind, file: string): { readonly summary: string } & Partial<Record<(typeof TEXT)[Kind], string>> {
	const [first = "", ...rest] = readText(file).trim().split("\n");
	const summary = first.replace(/^#+(\s+|$)/, "").trim();
	if (summary === "") throw new Error(`${file} is empty or starts with an empty heading; its first line is the ${kind}'s summary, the rest its ${TEXT[kind]}; nothing was asked of YouTrack`);
	return { summary, [TEXT[kind]]: rest.join("\n").trim() };
}

// A file a write sends, a comment's too.
export function readText(file: string): string {
	try {
		return readFileSync(file, "utf8");
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
