import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, globSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
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

// The command as the file writes it, `<page>` the page's path, from the repository's root, in `env`; `files` beside the page.
function check(html: string, env: NodeJS.ProcessEnv = process.env, files: Readonly<Record<string, string>> = {}) {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "page.html"), html);
	for (const [file, text] of Object.entries(files)) writeFileSync(join(folder, file), text);
	const run = spawnSync("/bin/bash", ["-c", COMMAND.replace("<page>", join(folder, "page.html"))], { cwd: ROOT, encoding: "utf8", env });
	assert.deepEqual(readdirSync(folder).sort(), ["page.html", ...Object.keys(files)].sort(), "the copy the browser read is gone");
	return { code: run.status, lines: `${run.stdout}${run.stderr}`.trim().split("\n") };
}

// A browser the check would find, for a wrapper around it.
const which = (name: string) => spawnSync("/bin/bash", ["-c", `command -v ${name}`], { encoding: "utf8" }).stdout.trim();
const BROWSER = [process.env.CHROME, ...["chromium", "chromium-browser", "google-chrome"].map(which), ...globSync(join(homedir(), ".cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell"))].find(Boolean);
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
	const hidden = '<p style="visibility:hidden;color:#ffffff">hidden</p><p style="display:none;color:#ffffff">gone</p><style>p::selection { color:#ffffff }</style>';
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

// Each case at the limit: exactly 420 px, or a box exactly as wide as its content, passes; 1 px more fails, named once,
// by its outermost box.
const edges = (over: number) =>
	[
		`<div style="width:${420 + over}px"><div>wide</div></div>`,
		`<div style="margin-left:-${over}px;width:100px">left</div>`,
		`<div style="overflow:hidden;width:100px"><div style="width:${100 + over}px">cut</div></div>`,
		`<div style="overflow-x:auto;width:100px"><div style="width:${100 + over}px">scroll</div></div>`,
		`<p style="margin:0;width:420px;direction:rtl;text-indent:-${over}px">past</p>`,
		`<p style="margin:0;text-indent:-${over}px">start</p>`,
	].join("");

test("a page exactly 420 px wide, with boxes exactly as wide as their content, passes", { skip: NO_BROWSER && "no Chrome or Chromium" }, () => {
	const { code, lines } = check(page("body { margin:0 }", edges(0)));
	assert.deepEqual([code, lines.length], [0, 1], lines.join("\n"));
	assert.match(lines[0] ?? "", /^ok: /);
});

test("1 px past either edge, 1 px scrolling or cut inside a box, and text 1 px past either edge each fail", { skip: NO_BROWSER && "no Chrome or Chromium" }, () => {
	const { code, lines } = check(page("body { margin:0 }", edges(1)));
	assert.equal(code, 1, lines.join("\n"));
	assert.deepEqual(lines.slice(0, 5), [
		"the page scrolls sideways: 421 px wide on a 420 px screen",
		'wider than the screen, 0 to 421 px: div "wide"',
		'wider than the screen, -1 to 99 px: div "left"',
		'cuts its text, 101 px in 100: div "cut"',
		'scrolls sideways inside, 101 px in 100: div "scroll"',
	]);
	assert.match(lines[5] ?? "", /^text wider than the screen, \d+ to 421 px: p "past"$/);
	assert.match(lines[6] ?? "", /^text wider than the screen, -1 to \d+ px: p "start"$/);
	assert.match(lines[7] ?? "", /^7 problems in .*page\.html at 420 px$/);
});

test("a page rendered at another width is refused, as with a browser that ignores the 420 px window", { skip: NO_BROWSER && "no Chrome or Chromium" }, () => {
	const wrapper = join(temporaryFolder(), "chrome");
	writeFileSync(wrapper, `#!/bin/sh\nexec ${JSON.stringify(BROWSER)} "$@" --window-size=500,900\n`);
	chmodSync(wrapper, 0o755);
	const { code, lines } = check(page("", "<p>fine</p>"), { ...process.env, CHROME: wrapper });
	assert.deepEqual([code, lines[0]], [1, "rendered 500 px wide, not 420"]);
});

test("with no browser it checks nothing and exits 2, never 0", () => {
	const { code, lines } = check(page("", "<p>x</p>"), { PATH: dirname(process.execPath), HOME: temporaryFolder() });
	assert.deepEqual([code, lines], [2, ["no browser found; set CHROME to a Chrome or Chromium binary"]]);
});

test("a page with a script, an on… handler, a forged result or no text fails, and text a script adds is read; markup that swallows the check exits 2", { skip: NO_BROWSER && "no Chrome or Chromium" }, () => {
	const late = `<script>document.addEventListener("DOMContentLoaded", () => document.body.insertAdjacentHTML("beforeend", '<p style="color:#eeeeee">late</p>'))</script>`;
	const forged = '<script type="application/json" id="page-check">{"texts":9,"problems":[]}</script>';
	const scripted = check(page("", `<p onclick="go()">tap</p>${late}${forged}`));
	const because = "which can change the page after the check";
	const named = [`a script in onclick, ${because}`, `a script, ${because}`, `a script, ${because}`, "contrast 1.16:1, #eeeeee on #ffffff"];
	assert.deepEqual([scripted.code, scripted.lines.slice(0, -1).map((line) => line.split(": ")[0])], [1, named]);
	assert.match(scripted.lines.at(-1) ?? "", /^4 problems in .*page\.html at 420 px$/, "the forged result is not read");
	const empty = check(page("", "<div></div>"));
	assert.deepEqual([empty.code, empty.lines.slice(0, -1)], [1, ["no text found to check"]]);
	const swallowed = check(page("", "<p>x</p><!--"));
	const never = "the check never ran in the page: it did not finish loading in 10 s, or its markup ends inside a comment or a <script>, <style> or <textarea>, which swallowed the check; close it";
	assert.deepEqual([swallowed.code, swallowed.lines], [2, [never]]);
});

test("text over or under a layer that is not its ancestor, further down the page, is named, never passed", { skip: NO_BROWSER && "no Chrome or Chromium" }, () => {
	const style = ".bar { position:relative; } .bar::before { content:''; position:absolute; inset:0; background:#0a0a0a; }";
	const body = [
		'<div style="height:2000px"></div>',
		'<div style="position:relative"><div style="position:absolute;inset:0;background:#0a0a0a"></div><p style="position:relative;margin:0;color:#111111">over black</p></div>',
		'<div style="position:relative"><p style="margin:0">under white</p><div style="position:absolute;inset:0;background:#ffffff;pointer-events:none"></div></div>',
		'<p class="bar">pseudo</p>',
	].join("");
	const { code, lines } = check(page(style, body));
	assert.deepEqual([code, lines.slice(0, -1)], [1, ['not checked, another element\'s background, div "": p "over black"', 'not checked, another element\'s background, div "": p "under white"', 'not checked, a ::before background: p.bar "pseudo"']]);
});

test("the page is checked once its images have loaded: an image without a size that widens it fails, and so does one that never loads", { skip: NO_BROWSER && "no Chrome or Chromium" }, () => {
	const wide = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="10"><rect width="900" height="10"/></svg>\n';
	const { code, lines } = check(page("body { margin:0 }", '<p>base</p><img src="wide.svg" alt="">'), process.env, { "wide.svg": wide });
	assert.deepEqual([code, lines.slice(0, -1)], [1, ["the page scrolls sideways: 900 px wide on a 420 px screen", 'wider than the screen, 0 to 900 px: img ""']]);
	const missing = check(page("", '<p>base</p><img src="missing.png" alt="">'));
	assert.deepEqual([missing.code, missing.lines.slice(0, -1)], [1, ["an image that did not load: missing.png"]]);
});

const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf";
test("the page is checked once its fonts have loaded: text a web font widens past the screen fails", { skip: (NO_BROWSER || !existsSync(FONT)) && `no Chrome or Chromium, or no ${FONT}` }, () => {
	const style = `@font-face { font-family: Wide; src: url("${pathToFileURL(FONT).href}"); } p { font: 60px Wide, serif; white-space: nowrap; margin: 0; } body { margin: 0 }`;
	const { code, lines } = check(page(style, `<p>${"i".repeat(15)}</p>`));
	assert.equal(code, 1, lines.join("\n"));
	assert.match(lines[0] ?? "", /^the page scrolls sideways: \d+ px wide on a 420 px screen$/);
	assert.match(lines[1] ?? "", /^text wider than the screen, 0 to \d+ px: p "i+"$/);
});

test("an animation or a transition, on an element or its ::before or ::after, is refused: it can change the page after the check", { skip: NO_BROWSER && "no Chrome or Chromium" }, () => {
	const style = "@keyframes fade { to { color:#eeeeee } } .a { animation: fade 0s 0.2s forwards } .t { transition: color 1s } .b::before, .c::after { content:''; animation: fade 1s } .d::before { content:''; transition: color 1s }";
	const { code, lines } = check(page(style, '<p class="a">fade</p><p class="t">move</p><p class="b">before</p><p class="c">after</p><p class="d">eased</p>'));
	const because = "which can change the page after the check";
	const refused = [`an animation, ${because}: p.a "fade"`, `a transition, ${because}: p.t "move"`, `an animation on ::before, ${because}: p.b "before"`, `an animation on ::after, ${because}: p.c "after"`, `a transition on ::before, ${because}: p.d "eased"`];
	assert.equal(code, 1);
	assert.deepEqual(lines.filter((line) => line.includes(because)), refused);
});

test("text the check cannot read is named, never passed; text in -webkit-text-fill-color and list markers is checked in that colour", { skip: NO_BROWSER && "no Chrome or Chromium" }, () => {
	const style = [
		'.x::after { content:" arthur repeats"; color:#eeeeee } .y::before { content:"> " }',
		".fill { -webkit-text-fill-color:#eeeeee } li::marker { color:#eeeeee }",
		".line::first-line { color:#eeeeee } .letter::first-letter { color:#eeeeee } .boxed::first-letter { background:#0a0a0a }",
	].join(" ");
	const effects = ["filter:invert(1)", "backdrop-filter:invert(1)", "mix-blend-mode:difference", "clip-path:inset(0 50% 0 0)", "mask-image:linear-gradient(transparent, #000)", "content-visibility:auto"];
	const fields = ['<input value="arthur repeats">', "<textarea></textarea>", "<select></select>", '<iframe srcdoc="<p>inside</p>"></iframe>', "<object></object>", "<embed>", "<video></video>", "<audio controls></audio>", "<canvas></canvas>"];
	const body = ['<p class="x">x</p><p class="y">y</p><p class="fill">fill</p><p class="line">line</p><p class="letter">letter</p><p class="boxed">boxed</p>', ...effects.map((effect, n) => `<p style="${effect}">e${n}</p>`), ...fields, "<ol><li>item</li></ol>"].join("");
	const { code, lines } = check(page(style, body));
	assert.deepEqual([code, lines.slice(0, -1)], [
		1,
		[
			'not checked, text in ::after: p.x "x"',
			'not checked, text in ::before: p.y "y"',
			'not checked, ::first-line styling: p.line "line"',
			'not checked, ::first-letter styling: p.letter "letter"',
			'not checked, ::first-letter styling: p.boxed "boxed"',
			...["filter", "backdrop-filter", "mix-blend-mode", "clip-path", "mask-image", "content-visibility"].map((property, n) => `not checked, ${property}: p "e${n}"`),
			...["input", "textarea", "select", "iframe", "object", "embed", "video", "audio", "canvas"].map((tag) => `not checked, a ${tag}: ${tag} ""`),
			'contrast 1.16:1, #eeeeee on #ffffff: p.fill "fill"',
			'contrast 1.16:1, #eeeeee on #ffffff: ::marker of li "item"',
		],
	]);
});
