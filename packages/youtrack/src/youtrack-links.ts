import { call, field, getAll, type Instance, remove } from "./youtrack-api.ts";

// An issue's links (spec/roadmap.md, entry 45; AR0222): listed, one added or removed; docs/commands/youtrack.md. A link type
// is named as the instance's link types name it from the issue's side: `depends on`, `is required for`, `subtask of`,
// `parent for`, `duplicates`, `relates to`. YouTrack lists every link type with its direction, so one read names them all.

export async function links(instance: Instance, verb: string, id: string, given: string, other: string): Promise<string> {
	const all = await getAll(instance, `issues/${id}/links`, { fields: "id,direction,linkType(name,sourceToTarget,targetToSource),issues(id,idReadable,summary)" }, `the links of issue ${id}`);
	// An inward link reads target to source; an outward one, and one without a direction (`BOTH`), source to target.
	const named = all.map((link) => {
		const type = field(link, "linkType");
		const phrase = field(type, field(link, "direction") === "INWARD" ? "targetToSource" : "sourceToTarget");
		const issues = field(link, "issues");
		return { link: String(field(link, "id")), phrase: typeof phrase === "string" && phrase !== "" ? phrase : String(field(type, "name")), issues: Array.isArray(issues) ? issues : [] };
	});
	if (verb === "links") {
		const shown = named.filter(({ issues }) => issues.length > 0).map(({ phrase, issues }) => `${phrase} (${issues.length})\n${issues.map((each) => `  ${String(field(each, "idReadable"))} ${String(field(each, "summary"))}`).join("\n")}`);
		return shown.length === 0 ? `no links on ${id}` : shown.join("\n\n");
	}
	const wanted = given.trim().replace(/\s+/g, " ").toLowerCase();
	const found = named.find(({ phrase }) => phrase.toLowerCase() === wanted);
	if (found === undefined) throw new Error(`${given} is not a link type of this instance; its link types: ${[...new Set(named.map(({ phrase }) => phrase))].join(", ") || "none"}; nothing was written`);
	if (verb === "link") {
		const target = field(await call(instance, `issues/${other}`, { fields: "id" }, `issue ${other}`), "id");
		await call(instance, `issues/${id}/links/${found.link}/issues`, { fields: "id" }, `the links of issue ${id}`, { id: target });
		return `linked: ${id} ${found.phrase} ${other}`;
	}
	const linked = found.issues.find((each) => field(each, "idReadable") === other);
	if (linked === undefined) throw new Error(`${id} has no link ${found.phrase} ${other}; arthur youtrack issue links ${id} lists its links; nothing was written`);
	await remove(instance, `issues/${id}/links/${found.link}/issues/${String(field(linked, "id"))}`, `link ${found.phrase} ${other} of issue ${id}`);
	return `unlinked: ${id} ${found.phrase} ${other}`;
}
