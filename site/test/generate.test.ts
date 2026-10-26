import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { diagramPage, logoFiles } from "../scripts/generate.ts";

const root = mkdtempSync(join(tmpdir(), "arthur-site-logo-"));
after(() => rmSync(root, { recursive: true, force: true }));

function folder(name: string, files: readonly string[]): string {
	const path = mkdtempSync(join(root, `${name}-`));
	for (const file of files) writeFileSync(join(path, file), "");
	return path;
}

test("the small PNG icon is the favicon and the full logo the hero", () => {
	assert.deepEqual(logoFiles(folder("png-logo", ["arthur.png", "arthur-favicon.png"])), { logo: "arthur.png", favicon: "arthur-favicon.png" });
	assert.deepEqual(logoFiles(folder("svg-logo", ["arthur.svg", "arthur-favicon.png"])), { logo: "arthur.svg", favicon: "arthur-favicon.png" });
});

test("without a small PNG icon the full logo is the favicon too", () => {
	assert.deepEqual(logoFiles(folder("png", ["arthur.png"])), { logo: "arthur.png", favicon: "arthur.png" });
	assert.deepEqual(logoFiles(folder("svg", ["arthur.svg"])), { logo: "arthur.svg", favicon: "arthur.svg" });
	assert.deepEqual(logoFiles(folder("svg-icon", ["arthur.png", "arthur-favicon.svg"])), { logo: "arthur.png", favicon: "arthur.png" });
});

test("an SVG logo wins over a PNG logo", () => {
	assert.deepEqual(logoFiles(folder("all", ["arthur.png", "arthur.svg", "arthur-favicon.png"])), {
		logo: "arthur.svg",
		favicon: "arthur-favicon.png",
	});
});

test("no logo, an icon alone, and a missing folder", () => {
	assert.deepEqual(logoFiles(folder("empty", ["logo.png"])), { logo: undefined, favicon: undefined });
	assert.deepEqual(logoFiles(folder("icon", ["arthur-favicon.png"])), { logo: undefined, favicon: "arthur-favicon.png" });
	assert.deepEqual(logoFiles(join(root, "missing")), { logo: undefined, favicon: undefined });
});

test("the diagram page drops its outline and holds the diagram as a Mermaid block", () => {
	const page = diagramPage("flowchart LR\n  a --> b\n");
	const [, head, body] = page.split("---\n");
	assert.match(head, /^tableOfContents: false$/m);
	assert.match(head, /^title: "Diagram"$/m);
	assert.ok(body.endsWith('<pre class="mermaid">\nflowchart LR\n  a --&gt; b\n</pre>'));
	assert.match(body, /\(https:\/\/github\.com\/kacperadler\/arthur\/blob\/main\/arthur\.mmd\)/);
});
