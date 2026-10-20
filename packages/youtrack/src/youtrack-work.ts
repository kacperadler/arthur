import { call, field, getAll, type Instance, remove } from "./youtrack-api.ts";

// An issue's work items (spec/roadmap.md, entry 45; AR0222): listed, one added, edited or deleted; docs/commands/youtrack.md.
// Returns the text to print; minutes that are not a whole number above 0, or a work item id of another form, are refused
// before any call. `verb` is `work`, `work list`, `work edit` or `work delete`.

export async function work(instance: Instance, verb: string, id: string, words: readonly string[]): Promise<string> {
	const path = `issues/${id}/timeTracking/workItems`;
	if (verb === "work list") {
		const items = await getAll(instance, path, { fields: "id,date,text,duration(minutes,presentation),author(login,name),type(name)" }, `the work items of issue ${id}`);
		const shown = items.map((each) => {
			const [author, date, text, type] = [field(each, "author"), field(each, "date"), field(each, "text"), field(field(each, "type"), "name")];
			const who = typeof field(author, "login") === "string" ? `${String(field(author, "name"))} (${String(field(author, "login"))})` : "nobody";
			const day = typeof date === "number" ? new Date(date).toISOString().slice(0, 10) : "unknown";
			const head = `work item ${String(field(each, "id"))}: ${String(field(field(each, "duration"), "presentation"))} by ${who} on ${day}${typeof type === "string" ? `, ${type}` : ""}`;
			return typeof text === "string" && text !== "" ? `${head}\n${text}` : head;
		});
		return shown.length === 0 ? `no work items on ${id}` : shown.join("\n\n");
	}
	// `work` adds one: its words are the minutes and the text; the others name the work item first.
	const [item = "", minutes = "", text] = verb === "work" ? ["", ...words] : words;
	if (verb !== "work" && !/^\d+-\d+$/.test(item)) throw new Error(`${item} is not a work item id such as 115-0, which arthur youtrack issue work list ${id} prints; nothing was asked of YouTrack`);
	if (verb === "work delete") {
		await remove(instance, `${path}/${item}`, `work item ${item} of issue ${id}`);
		return `${id}: deleted work item ${item}`;
	}
	if (!/^\d+$/.test(minutes) || Number(minutes) === 0) throw new Error(`a work item takes a whole number of minutes above 0, got ${minutes || "nothing"}; nothing was asked of YouTrack`);
	// An edit without a text keeps the one the work item has.
	const body = { duration: { minutes: Number(minutes) }, ...(text ? { text } : {}) };
	const what = verb === "work" ? `the work items of issue ${id}` : `work item ${item} of issue ${id}`;
	const made = await call(instance, verb === "work" ? path : `${path}/${item}`, { fields: "duration(minutes,presentation)" }, what, body);
	const presentation = field(field(made, "duration"), "presentation");
	const shown = typeof presentation === "string" ? presentation : `${minutes}m`;
	return verb === "work" ? `${id}: added ${shown} of work` : `${id}: work item ${item} set to ${shown}`;
}
