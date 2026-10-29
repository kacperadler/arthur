import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "@arthur/core/testing";

// AR0564: the check of `.agents/arthur/criteria/report.md`, run as its line says, on pages in a temporary folder; it needs a
// Chrome or Chromium, which GitHub's runners have, and is skipped without one.

const ROOT = join(import.meta.dirname, "..");
const SKILL = readFileSync(join(ROOT, ".agents/arthur/criteria/report.md"), "utf8");
const COMMAND = SKILL.split("\n~~~sh\n")[1]?.split("\n~~~")[0] ?? "";
const STYLE = SKILL.split("\n```css\n")[1]?.split("\n```")[0] ?? "";
const page = (style: string, body: string) =>
	`<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>T</title><style>${style}</style></head><body>${body}</body></html>\n`;

// The command as the file writes it, `<page>` the page's path, from the repository's root.
function check(html: string) {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "page.html"), html);
	const run = spawnSync("bash", ["-c", COMMAND.replace("<page>", join(folder, "page.html"))], { cwd: ROOT, encoding: "utf8" });
	assert.deepEqual(readdirSync(folder), ["page.html"], "the copy the browser read is gone");
	return { code: run.status, lines: `${run.stdout}${run.stderr}`.trim().split("\n") };
}

const NO_BROWSER = check(page("", "<p>x</p>")).lines.at(-1)?.startsWith("no browser found") === true;

test("a page of the base style and every component passes at 420 px", { skip: NO_BROWSER && "no Chrome or Chromium" }, () => {
	const body = [
		"<header><h1>Night <code>arthur repeats</code></h1><p>Lead <code>/pyramid X</code></p></header><main>",
		'<div class="nums"><div class="r"><b>44</b><span>steers</span></div><div class="b"><b>96%</b><span>answers</span></div></div>',
		'<p class="lead">At <code>spec/features/AR0561-a-long-folder-name-that-goes-on-and-on-and-on/audit/report.md</code></p>',
		'<table><tr><th>Id <code>x</code></th><th>Before</th><th>After</th><th>Layer</th></tr><tr><td class="id">AR0561</td><td class="before"><code>npm test</code></td>',
		'<td>averyveryverylongwordwithoutanyspacethatwouldpushthetablewideonaphone</td><td><span class="tag code">code</span> <span class="tag static">static</span> <span class="tag prose">prose</span> <span class="tag you">you</span></td></tr></table>',
		'<div class="cols"><div>a</div><div class="after">b</div></div><div class="note">n <code>arthur send</code></div><div class="warn"><b>AR-D1</b>: approve?</div>',
		'<div class="cmd"><h3>AR0562 · <code>arthur repeats</code></h3><div><code>/repeats</code></div></div></main><footer>f <code>spec/</code></footer>',
	].join("");
	const { code, lines } = check(page(STYLE, body));
	assert.deepEqual([code, lines.length], [0, 1], lines.join("\n"));
	assert.match(lines[0] ?? "", /^ok: .*page\.html at 420 px: \d+ texts at 4\.5:1 or more, nothing wider than the screen$/);
});

test("a chip on grey in a black heading, as in the pyramid report, fails with its contrast, and so do light grey and see-through text", { skip: NO_BROWSER && "no Chrome or Chromium" }, () => {
	const style = "h3 { background:#0a0a0a; color:#ffffff; } code { background:#f2f2f2; } p { color:#777777; }";
	const hidden = '<p style="visibility:hidden;color:#ffffff">hidden</p><p style="display:none;color:#ffffff">gone</p><script>"no text of a page"</script>';
	const { code, lines } = check(page(style, `<h3>AR0562 · <code>arthur repeats</code></h3><p>quiet</p><p style="color:#767676">just enough</p><p style="color:rgba(10,10,10,.4)">see-through</p>${hidden}`));
	const found = ['contrast 1.12:1, #ffffff on #f2f2f2: code "arthur repeats"', 'contrast 4.48:1, #777777 on #ffffff: p "quiet"', 'contrast 2.71:1, #9d9d9d on #ffffff: p "see-through"'];
	assert.deepEqual([code, lines.slice(0, -1)], [1, found], "#767676, 4.54:1, passes; hidden text is not read");
	assert.match(lines.at(-1) ?? "", /^3 problems in .*page\.html at 420 px$/);
});

test("text the check cannot read against its background is named, never passed", { skip: NO_BROWSER && "no Chrome or Chromium" }, () => {
	const body = '<p style="opacity:.9">faded</p><p style="background-image:linear-gradient(#fff,#eee)">shaded</p><p style="color:oklch(0.3 0.1 200)">modern</p><p style="background:oklch(0.9 0.05 200)">tinted</p><svg width="90" height="20"><text y="15">chart</text></svg>';
	const { code, lines } = check(page("", body));
	const named = ['not checked, opacity: p "faded"', 'not checked, a background image: p "shaded"', 'not checked, the colour oklch(0.3 0.1 200): p "modern"', 'not checked, the background oklch(0.9 0.05 200): p "tinted"', 'not checked, text in an SVG: text "chart"'];
	assert.deepEqual([code, lines.slice(0, -1)], [1, named]);
});

test("a line wider than 420 px, a table that scrolls inside, and text cut at the edge each fail", { skip: NO_BROWSER && "no Chrome or Chromium" }, () => {
	const long = "word ".repeat(10).replaceAll(" ", "-");
	const body = `<pre>${long.repeat(3)}</pre><div style="overflow-x:auto"><table style="width:900px"><tr><td>wide</td></tr></table></div><p style="overflow:hidden;white-space:nowrap">${long.repeat(3)}</p>`;
	const { code, lines } = check(page("body { margin:0 }", body));
	assert.equal(code, 1, lines.join("\n"));
	assert.match(lines[0] ?? "", /^the page scrolls sideways: \d+ px wide on a 420 px screen$/);
	assert.match(lines[1] ?? "", /^scrolls sideways inside, 900 px in 420: div "wide"$/);
	assert.match(lines[2] ?? "", /^cuts its text, \d+ px in 420: p "word-word-/);
	assert.match(lines[3] ?? "", /^text wider than the screen, 0 to \d+ px: pre "word-word-/);
	assert.equal(lines.length, 5, lines.join("\n"));
});
