import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { frontmatter, mermaidHtml, repo, splitReadme, splitTitle, toPage } from "./markdown.ts";
import { parseBoard, parseRoadmap, roadmapPage } from "./roadmap.ts";

/** Builds every page of the site from the repository's files into `src/content/docs/`, from scratch. */
if (import.meta.main) {
	const site = join(import.meta.dirname, "..");
	const root = join(site, "..");
	const read = (file: string) => readFileSync(join(root, file), "utf8");
	const pages = join(site, "src/content/docs");
	const assets = join(site, "src/assets");
	const favicon = join(site, "public/favicon.svg");
	rmSync(pages, { recursive: true, force: true });
	rmSync(assets, { recursive: true, force: true });
	rmSync(favicon, { force: true });
	mkdirSync(pages, { recursive: true });

	const logo = existsSync(join(root, "docs/logo/arthur.svg"));
	if (logo) {
		mkdirSync(assets, { recursive: true });
		mkdirSync(join(site, "public"), { recursive: true });
		copyFileSync(join(root, "docs/logo/arthur.svg"), join(assets, "arthur.svg"));
		copyFileSync(join(root, "docs/logo/arthur.svg"), favicon);
	}
	const setup = existsSync(join(root, "docs/setup.md"));

	const readme = splitReadme(read("README.md"));
	const actions = [
		{ text: "Roadmap", link: "roadmap/", variant: "primary" },
		{ text: "Diagram", link: "diagram/", variant: "secondary" },
		...(setup ? [{ text: "Setup", link: "setup/", variant: "secondary" }] : []),
		{ text: "GitHub", link: repo, variant: "minimal", icon: "github" },
	];
	const image = logo ? { image: { file: "../../assets/arthur.svg", alt: "Arthur's logo" } } : {};
	const hero = { title: readme.title, tagline: readme.tagline, ...image, actions };
	writeFileSync(
		join(pages, "index.md"),
		frontmatter({ title: readme.title, template: "splash", hero, sidebar: { order: 0 } }) + toPage(readme.body, "README.md"),
	);

	const board = parseBoard(read("spec/build.json"));
	const commit = execFileSync("git", ["log", "-1", "--format=%h %H %cs"], { cwd: root, encoding: "utf8" }).trim().split(" ");
	const roadmap = [
		`Each entry of [\`spec/roadmap.md\`](${repo}/blob/main/spec/roadmap.md) with its ticket on the board, [\`spec/build.json\`](${repo}/blob/main/spec/build.json).`,
		roadmapPage(parseRoadmap(read("spec/roadmap.md")), board),
		`Built from commit [\`${commit[0]}\`](${repo}/commit/${commit[1]}) of ${commit[2]}.`,
	];
	writeFileSync(join(pages, "roadmap.md"), frontmatter({ title: "Roadmap", sidebar: { order: 1 } }) + roadmap.join("\n\n"));

	const diagram = `The source is [\`arthur.mmd\`](${repo}/blob/main/arthur.mmd).\n\n${mermaidHtml(read("arthur.mmd"))}`;
	writeFileSync(join(pages, "diagram.md"), frontmatter({ title: "Diagram", sidebar: { order: 2 } }) + diagram);

	if (setup) {
		const { title, rest } = splitTitle(read("docs/setup.md"), "docs/setup.md");
		writeFileSync(join(pages, "setup.md"), frontmatter({ title, sidebar: { order: 3 } }) + toPage(rest, "docs/setup.md"));
	}
}
