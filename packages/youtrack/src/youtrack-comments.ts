import { call, field, getAll, type Instance } from "./youtrack-api.ts";
import { readBytes } from "./youtrack-write.ts";

// An issue's comments (spec/roadmap.md, entry 46): listed, added and edited from a file, and deleted the way YouTrack's own
// delete does it, `deleted: true`, which YouTrack can restore; never an HTTP DELETE. docs/commands/youtrack.md. Returns the
// text to print; a comment id of another form, or an empty file, is refused before any call.

export async function comments(instance: Instance, verb: string, id: string, words: readonly string[]): Promise<string> {
	const path = `issues/${id}/comments`;
	if (verb === "list") {
		const all = await getAll(instance, path, { fields: "id,text,created,deleted,author(login,name)" }, `the comments of issue ${id}`);
		const shown = all
			.filter((each) => field(each, "deleted") !== true)
			.map((each) => {
				const [author, created, text] = [field(each, "author"), field(each, "created"), field(each, "text")];
				const who = typeof field(author, "login") === "string" ? `${String(field(author, "name"))} (${String(field(author, "login"))})` : "nobody";
				const day = typeof created === "number" ? new Date(created).toISOString().slice(0, 10) : "unknown";
				return `comment ${String(field(each, "id"))} by ${who} on ${day}\n${typeof text === "string" ? text : ""}`;
			});
		return shown.length === 0 ? `no comments on ${id}` : shown.join("\n\n");
	}
	if (verb === "add") {
		const made = await call(instance, path, { fields: "id" }, `the comments of issue ${id}`, { text: fromFile(words[0] ?? "") });
		return `${id}: added comment ${String(field(made, "id"))}`;
	}
	const [comment = "", file = ""] = words;
	if (!/^\d+-\d+$/.test(comment)) throw new Error(`${comment} is not a comment id such as 4-17, which arthur youtrack comment list ${id} prints; nothing was asked of YouTrack`);
	const body = verb === "edit" ? { text: fromFile(file) } : { deleted: true };
	await call(instance, `${path}/${comment}`, { fields: "id,deleted" }, `comment ${comment} of issue ${id}`, body);
	return verb === "edit" ? `${id}: edited comment ${comment}` : `${id}: deleted comment ${comment}; YouTrack can restore it`;
}

// The whole file, trimmed, is the comment's text.
function fromFile(file: string): string {
	const text = readBytes(file).toString("utf8").trim();
	if (text === "") throw new Error(`${file} is empty; the whole file is the comment's text; nothing was asked of YouTrack`);
	return text;
}
