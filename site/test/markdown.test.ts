import assert from "node:assert/strict";
import { test } from "node:test";
import { frontmatter, splitReadme, splitTitle, toPage } from "../scripts/markdown.ts";

const blob = "https://github.com/kacperadler/arthur/blob/main/";
const raw = "https://raw.githubusercontent.com/kacperadler/arthur/main/";

test("links resolve against the source file's folder; images go to the raw URL", () => {
	const page = toPage(
		"See [deploy](deploy.md#vps), [vision](../spec/vision.md) and ![logo](logo/arthur.svg \"Logo\").",
		"docs/setup.md",
	);
	assert.equal(
		page,
		`See [deploy](${blob}docs/deploy.md#vps), [vision](${blob}spec/vision.md) and ![logo](${raw}docs/logo/arthur.svg "Logo").`,
	);
});

test("anchors, absolute URLs and code spans stay as written", () => {
	const text = "[Licence](#licence), [site](https://example.com/a.md), [mail](mailto:a@b.c), `[x](y.md)`";
	assert.equal(toPage(text, "README.md"), text);
});

test("an image inside a link and a raw <img> are rewritten", () => {
	assert.equal(
		toPage('[![badge](b.svg)](docs/a.md) <img src="docs/logo/arthur.svg" width="200">', "README.md"),
		`[![badge](${raw}b.svg)](${blob}docs/a.md) <img src="${raw}docs/logo/arthur.svg" width="200">`,
	);
});

test("nothing inside a fenced block is rewritten", () => {
	const text = "````md\n[a](b.md)\n```\n````\n~~~\n![i](i.png)\n~~~\n\n[c](d.md)";
	assert.equal(toPage(text, "README.md"), `\`\`\`\`md\n[a](b.md)\n\`\`\`\n\`\`\`\`\n~~~\n![i](i.png)\n~~~\n\n[c](${blob}d.md)`);
});

test("a mermaid fence becomes an escaped pre that Mermaid draws", () => {
	const text = 'Before\n\n```mermaid\nflowchart TD\n  a[x<br/>y] -->|"&"| b\n\n  b --> c\n```\n\n[after](a.md)';
	assert.equal(
		toPage(text, "README.md"),
		`Before\n\n<pre class="mermaid">\nflowchart TD\n  a[x&lt;br/&gt;y] --&gt;|&quot;&amp;&quot;| b\n\n  b --&gt; c\n</pre>\n\n[after](${blob}a.md)`,
	);
});

test("an unclosed mermaid fence runs to the end of the file", () => {
	assert.equal(toPage("```mermaid\na --> b", "README.md"), '<pre class="mermaid">\na --&gt; b\n</pre>');
});

test("the README splits into title, its first paragraph as HTML, and its body from the first ##", () => {
	const readme = splitReadme(
		"# Arthur\n\nArthur runs `omp` <jobs> & reads\n[the vision](spec/vision.md).\n\nMore.\n\n## Status\n\nText.",
	);
	assert.equal(readme.title, "Arthur");
	assert.equal(readme.tagline, `Arthur runs <code>omp</code> &lt;jobs&gt; &amp; reads <a href="${blob}spec/vision.md">the vision</a>.`);
	assert.equal(readme.body, "## Status\n\nText.");
});

test("a README without an H1 or a first paragraph fails", () => {
	assert.throws(() => splitReadme("Arthur\n\nText."), /README\.md: no H1 title/);
	assert.throws(() => splitReadme("# Arthur\n\n## Status\n"), /README\.md: no first paragraph/);
	assert.throws(() => splitReadme("# Arthur\n"), /README\.md: no first paragraph/);
});

test("a page's title is its H1", () => {
	assert.deepEqual(splitTitle("# Setup\n\nStep one.\n", "docs/setup.md"), { title: "Setup", rest: "Step one." });
	assert.throws(() => splitTitle("Setup\n", "docs/setup.md"), /docs\/setup\.md: no H1 title/);
});

test("frontmatter values are JSON, so quotes and colons survive", () => {
	assert.equal(frontmatter({ title: 'A: "b"', sidebar: { order: 1 } }), '---\ntitle: "A: \\"b\\""\nsidebar: {"order":1}\n---\n\n');
});
