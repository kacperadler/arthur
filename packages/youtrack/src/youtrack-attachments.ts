import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { field, getAll, type Instance, request } from "./youtrack-api.ts";

// An issue's attachments (spec/roadmap.md, entry 46), on its description and its comments, saved into `<folder>/<id>/`
// (`.arthur/youtrack/SHOP-12/`): docs/commands/youtrack.md. Returns one line per file: `<path> <bytes> B <mime>`.

export async function saveAttachments(instance: Instance, folder: string, id: string): Promise<string> {
	const found = await getAll(instance, `issues/${id}/attachments`, { fields: "id,name,url,mimeType,comment(id)" }, `the attachments of issue ${id}`);
	if (found.length === 0) return `no attachments on ${id}`;
	// The token goes with each download, so every one is checked to be on the instance's own server before the first.
	const origin = new URL(instance.base).origin;
	const items = found.map((item) => ({ item, url: new URL(String(field(item, "url")), origin) }));
	const away = items.find(({ url }) => url.origin !== origin);
	if (away !== undefined) throw new Error(`instance ${instance.label}: attachment ${String(field(away.item, "id"))} of ${id} is on another server than the one in ${instance.urlEnv}, which its token is not sent to; nothing was saved`);
	const into = join(folder, id);
	mkdirSync(into, { recursive: true });
	const [taken, lines] = [new Set<string>(), [] as string[]];
	for (const { item, url } of items) {
		// A name stays a file in `into`: `/`, `\` and control characters become `_`, and so do leading dots, so `..` is no
		// folder above; a name taken already in this run gets `-2`, `-3` before its extension.
		const clean = String(field(item, "name") ?? "").replace(/[/\\\u0000-\u001f\u007f]/g, "_").replace(/^\.+/, (dots) => "_".repeat(dots.length)) || "attachment";
		let name = clean;
		for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${clean.slice(0, clean.length - extname(clean).length)}-${n}${extname(clean)}`;
		taken.add(name.toLowerCase());
		const bytes = await request(instance, url, `attachment ${String(field(item, "id"))} of issue ${id}`);
		// Written under a temporary name and renamed, so a reader never sees half a file.
		writeFileSync(join(into, `.${name}.part`), bytes);
		renameSync(join(into, `.${name}.part`), join(into, name));
		const comment = field(field(item, "comment"), "id");
		lines.push(`${join(into, name)} ${bytes.length} B ${String(field(item, "mimeType") ?? "unknown")}${typeof comment === "string" ? ` (comment ${comment})` : ""}`);
	}
	return lines.join("\n");
}
