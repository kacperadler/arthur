import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { frontmatter, splitTitle, toPage } from "./markdown.ts";

type Plugin = { readonly name: string; readonly state: string; readonly summary: string };

/** Each package's line in the README's Features list, `- **name**, state: summary ([links]).`, by name. */
export function readmeFeatures(readme: string): Map<string, { state: string; summary: string }> {
	const features = new Map<string, { state: string; summary: string }>();
	for (const line of readme.split("\n")) {
		const match = /^- \*\*([a-z0-9-]+)\*\*, ([^:]+): (.+)$/.exec(line);
		if (match) features.set(match[1], { state: match[2], summary: match[3].replace(/\s*\(\[.*\)\.?$/, "").replace(/\.$/, "") });
	}
	return features;
}

/** The plugins of `spec/vision.md`'s plugin table that no package builds yet, each with its first sentence. */
export function plannedPlugins(vision: string, packages: readonly string[]): Plugin[] {
	const lines = vision.split("\n");
	const head = lines.findIndex((line) => /^\| Plugin \|/.test(line));
	if (head === -1) throw new Error("spec/vision.md: no plugin table (a row starting `| Plugin |`)");
	const planned: Plugin[] = [];
	for (const line of lines.slice(head + 2)) {
		if (!line.startsWith("|")) break;
		const [cell, , does] = line.split(/(?<!\\)\|/).slice(1).map((each) => each.trim().replaceAll("\\|", "|"));
		const name = cell.split(" ")[0];
		if (!packages.includes(name)) planned.push({ name, state: "planned", summary: (does ?? "").split(/\.(?:\s|$)/)[0] });
	}
	return planned;
}

/** A command page as a section of its plugin's page: every heading one level down, outside fenced blocks. */
export function demote(markdown: string): string {
	let fence: string | undefined;
	return markdown
		.split("\n")
		.map((line) => {
			const mark = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
			if (fence === undefined && mark) fence = mark;
			else if (fence !== undefined && mark?.[0] === fence[0] && mark.length >= fence.length && line.trim() === mark) fence = undefined;
			else if (fence === undefined && /^#{1,5} /.test(line)) return `#${line}`;
			return line;
		})
		.join("\n");
}

/** The Plugins page: every package, then the planned plugins, each with its summary and state; a package links its page. */
export function pluginsPage(built: readonly Plugin[], planned: readonly Plugin[]): string {
	const cell = (text: string) => text.replaceAll("|", "\\|");
	const rows = [
		...built.map((each) => `| [${each.name}](${each.name}/) | ${cell(each.state)} | ${cell(each.summary)} |`),
		...planned.map((each) => `| ${each.name} | planned | ${cell(each.summary)} |`),
	];
	const intro = "Arthur is a small core and plugins that `arthur.config.ts` turns on, each with its options. Each built one has a page: its overview, then each of its commands as `arthur <command> --help` prints it. The planned ones are the plugins of `spec/vision.md` with no package yet.";
	return `${frontmatter({ title: "Plugins" })}${intro}\n\n| Plugin | State | What it does |\n| --- | --- | --- |\n${rows.join("\n")}\n`;
}

/** The landing page's Features list with each package's name linking its page. */
export function linkFeatures(body: string, packages: readonly string[]): string {
	return body.replace(/^- \*\*([a-z0-9-]+)\*\*/gm, (line, name: string) => (packages.includes(name) ? `- [**${name}**](plugins/${name}/)` : line));
}

/**
 * Writes `plugins.md` and `plugins/<name>.md` into `pages` from `root`'s `packages/`, `README.md` and `spec/vision.md`,
 * and returns the packages, core first. A package without a docs folder or its overview, `docs/<name>.md`, or with two
 * command pages whose names differ only in case, fails the build, as does one without a line in the README's Features.
 */
export function writePlugins(root: string, pages: string): string[] {
	const names = readdirSync(join(root, "packages"), { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort((a, b) => (a === "core" ? -1 : b === "core" ? 1 : a.localeCompare(b)));
	const features = readmeFeatures(readFileSync(join(root, "README.md"), "utf8"));
	mkdirSync(join(pages, "plugins"), { recursive: true });
	const built = names.map((name, order) => {
		const docs = `packages/${name}/docs`;
		if (!existsSync(join(root, docs))) throw new Error(`${docs}: missing; every package documents itself there`);
		const overview = `${docs}/${name}.md`;
		if (!existsSync(join(root, overview))) throw new Error(`${overview}: missing; every package has its overview there`);
		const feature = features.get(name);
		if (!feature) throw new Error(`README.md: no line \`- **${name}**, <state>: <summary>\` in its Features list`);
		const commandDir = join(root, docs, "commands");
		const commands = existsSync(commandDir) ? readdirSync(commandDir).filter((file) => file.endsWith(".md")).sort() : [];
		const seen = new Map<string, string>();
		for (const file of commands) {
			const other = seen.get(file.toLowerCase());
			if (other) throw new Error(`${docs}/commands: ${other} and ${file} are two command pages of the same name`);
			seen.set(file.toLowerCase(), file);
		}
		const body = [toPage(splitTitle(readFileSync(join(root, overview), "utf8"), overview).rest, overview)];
		for (const file of commands) {
			const source = `${docs}/commands/${file}`;
			body.push(demote(toPage(readFileSync(join(root, source), "utf8").trim(), source)));
		}
		writeFileSync(join(pages, "plugins", `${name}.md`), frontmatter({ title: name, sidebar: { order } }) + body.join("\n\n"));
		return { name, ...feature };
	});
	writeFileSync(join(pages, "plugins.md"), pluginsPage(built, plannedPlugins(readFileSync(join(root, "spec/vision.md"), "utf8"), names)));
	return names;
}
