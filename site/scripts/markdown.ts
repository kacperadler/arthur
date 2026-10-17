import { posix } from "node:path";

export const repo = "https://github.com/kacperadler/arthur";
const blob = `${repo}/blob/main/`;
const raw = "https://raw.githubusercontent.com/kacperadler/arthur/main/";

/** Frontmatter with every value as JSON, which YAML reads as is. */
export function frontmatter(data: Readonly<Record<string, unknown>>): string {
	const lines = Object.entries(data).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
	return `---\n${lines.join("\n")}\n---\n\n`;
}

export function escapeHtml(text: string): string {
	return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** A link or image target in a repository file, as a GitHub URL; anchors and absolute URLs stay. */
export function repoUrl(target: string, source: string, image: boolean): string {
	if (target.startsWith("#") || target.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(target)) return target;
	const file = target.startsWith("/") ? target.slice(1) : posix.join(posix.dirname(source), target);
	return (image ? raw : blob) + posix.normalize(file);
}

/** A Markdown file's title (its H1) and the rest of it. */
export function splitTitle(text: string, source: string): { title: string; rest: string } {
	const lines = text.split("\n");
	const at = lines.findIndex((line) => /^# \S/.test(line));
	if (at === -1) throw new Error(`${source}: no H1 title`);
	return { title: lines[at].slice(2).trim(), rest: lines.slice(at + 1).join("\n").trim() };
}

/** The README as the landing page: its title, its first paragraph as HTML, and everything from its first `##` on. */
export function splitReadme(text: string): { title: string; tagline: string; body: string } {
	const { title, rest } = splitTitle(text, "README.md");
	const lines = rest.split("\n");
	const end = lines.findIndex((line) => line.trim() === "");
	const paragraph = (end === -1 ? lines : lines.slice(0, end)).join(" ").trim();
	if (paragraph === "" || paragraph.startsWith("#")) throw new Error("README.md: no first paragraph under the H1");
	const body = lines.findIndex((line) => line.startsWith("## "));
	return { title, tagline: inlineHtml(paragraph, "README.md"), body: body === -1 ? "" : lines.slice(body).join("\n") };
}

/** Inline Markdown as HTML: code spans and links; everything else is escaped text. */
export function inlineHtml(text: string, source: string): string {
	let html = "";
	let last = 0;
	for (const match of text.matchAll(/`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g)) {
		html += escapeHtml(text.slice(last, match.index));
		html +=
			match[1] !== undefined
				? `<code>${escapeHtml(match[1])}</code>`
				: `<a href="${escapeHtml(repoUrl(match[3], source, false))}">${inlineHtml(match[2], source)}</a>`;
		last = match.index + match[0].length;
	}
	return html + escapeHtml(text.slice(last));
}

/** Mermaid source as a block that Mermaid draws in the browser. */
export function mermaidHtml(source: string): string {
	return `<pre class="mermaid">\n${escapeHtml(source.trimEnd())}\n</pre>`;
}

const inline =
	/(`+)[\s\S]*?\1|(!?)\[((?:[^[\]]|\[[^[\]]*\])*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)|(<img\b[^>]*?\bsrc=)(["'])([^"']*)\7/g;

function rewriteLine(line: string, source: string): string {
	return line.replace(inline, (all, code, bang, text, target, title, img, quote, src) => {
		if (code !== undefined) return all;
		if (img !== undefined) return `${img}${quote}${repoUrl(src, source, true)}${quote}`;
		return `${bang}[${rewriteLine(text, source)}](${repoUrl(target, source, bang === "!")}${title})`;
	});
}

/**
 * A repository Markdown file as a page body: relative links and images point to GitHub,
 * a `mermaid` fence becomes a drawn diagram, and every other fenced block stays as written.
 */
export function toPage(markdown: string, source: string): string {
	const out: string[] = [];
	let fence: { mark: string; mermaid: string[] | undefined } | undefined;
	for (const line of markdown.split("\n")) {
		if (fence === undefined) {
			const open = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/.exec(line);
			if (open === null) out.push(rewriteLine(line, source));
			else {
				fence = { mark: open[1], mermaid: open[2] === "mermaid" ? [] : undefined };
				if (fence.mermaid === undefined) out.push(line);
			}
			continue;
		}
		const close = line.trim();
		if (close.startsWith(fence.mark) && close === fence.mark[0].repeat(close.length)) {
			if (fence.mermaid === undefined) out.push(line);
			else out.push(mermaidHtml(fence.mermaid.join("\n")));
			fence = undefined;
		} else if (fence.mermaid === undefined) out.push(line);
		else fence.mermaid.push(line);
	}
	if (fence?.mermaid !== undefined) out.push(mermaidHtml(fence.mermaid.join("\n")));
	return out.join("\n");
}
