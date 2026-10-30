import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, globSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { temporaryFolder } from "@arthur/core/testing";

// AR0564: the check of `.agents/arthur/criteria/report.md`, run as its line says, on pages in a temporary folder; it needs a
// Chrome or Chromium, which GitHub's runners have, and is skipped without one.

const ROOT = join(import.meta.dirname, "..");
const SKILL = readFileSync(join(ROOT, ".agents/arthur/criteria/report.md"), "utf8");
const COMMAND = SKILL.split("\n~~~sh\n")[1]?.split("\n~~~")[0] ?? "";
const STYLE = SKILL.split("\n```css\n")[1]?.split("\n```")[0] ?? "";
const page = (style: string, body: string) =>
	`<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>T</title><style>${style}</style></head><body>${body}</body></html>\n`;
const SHOTS = "screenshots, look at each before sending: ";

// The command as the file writes it, `<page>` the page's path, from the repository's root, in `env`; `files` beside the page.
// `lines` is what it printed but the screenshots' line; `shots`, the screenshots that line names, each read as a PNG's size,
// `pngs` their bytes; `left`, what the screenshots' folder holds.
function check(html: string, env: NodeJS.ProcessEnv = process.env, files: Readonly<Record<string, string>> = {}) {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "page.html"), html);
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(dirname(join(folder, file)), { recursive: true });
		writeFileSync(join(folder, file), text);
	}
	const run = spawnSync("/bin/bash", ["-c", COMMAND.replace("<page>", join(folder, "page.html"))], { cwd: ROOT, encoding: "utf8", env });
	assert.deepEqual(readdirSync(folder).filter((name) => name.startsWith(".")), [], "the copy the browser read is gone");
	const all = `${run.stdout}${run.stderr}`.trim().split("\n");
	const paths = all.find((line) => line.startsWith(SHOTS))?.slice(SHOTS.length).split(", ") ?? [];
	const pngs = paths.map((path) => readFileSync(path));
	const shots = paths.map((path) => {
		const png = readFileSync(path);
		return { name: path.slice(folder.length + 1), width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
	});
	const left = existsSync(join(folder, "page.html.420px")) ? readdirSync(join(folder, "page.html.420px")) : [];
	return { code: run.status, lines: all.filter((line) => !line.startsWith(SHOTS)), shots, pngs, left };
}

// A browser the check would find, for a wrapper around it.
const which = (name: string) => spawnSync("/bin/bash", ["-c", `command -v ${name}`], { encoding: "utf8" }).stdout.trim();
const BROWSER = [process.env.CHROME, ...["chromium", "chromium-browser", "google-chrome"].map(which), ...globSync(join(homedir(), ".cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell"))].find(Boolean);
const NO_BROWSER = BROWSER === undefined;
const skip = { skip: NO_BROWSER && "no Chrome or Chromium" };
// A wrapper around the browser that runs `shell` first, with the browser's arguments in "$*".
function wrapper(shell: string): NodeJS.ProcessEnv {
	const file = join(temporaryFolder(), "chrome");
	writeFileSync(file, `#!/bin/sh\n${shell}\nexec ${JSON.stringify(BROWSER)} "$@"\n`);
	chmodSync(file, 0o755);
	return { ...process.env, CHROME: file };
}

test("a page of the base style and every component passes at 420 px, with one screenshot 420 px wide", skip, () => {
	const body = [
		"<header><h1>Night <code>arthur repeats</code></h1><p>Lead <code>/pyramid X</code></p></header><main>",
		'<div class="nums"><div class="r"><b>44</b><span>steers</span></div><div class="b"><b>96%</b><span>answers</span></div></div>',
		'<p class="lead">At <code>spec/features/AR0561-a-long-folder-name-that-goes-on-and-on-and-on/audit/report.md</code></p>',
		'<table><tr><th>Id <code>x</code></th><th>Before</th><th>After</th><th>Layer</th></tr><tr><td class="id">AR0561</td><td class="before"><code>npm test</code></td>',
		'<td>averyveryverylongwordwithoutanyspacethatwouldpushthetablewideonaphone</td><td><span class="tag code">code</span> <span class="tag static">static</span> <span class="tag prose">prose</span> <span class="tag you">you</span></td></tr></table>',
		'<div class="cols"><div>a</div><div class="after">b</div></div><div class="note">n <code>arthur send</code></div><div class="warn"><b>AR-D1</b>: approve?</div>',
		'<div class="cmd"><h3>AR0562 · <code>arthur repeats</code></h3><div><code>/repeats</code></div></div></main><footer>f <code>spec/</code></footer>',
	].join("");
	const { code, lines, shots } = check(page(STYLE, body));
	assert.deepEqual([code, lines.length], [0, 1], lines.join("\n"));
	assert.match(lines[0] ?? "", /^ok: .*page\.html at 420 px: \d+ texts at 4\.5:1 or more against their declared background, nothing scrolls sideways$/);
	assert.deepEqual(shots, [{ name: "page.html.420px/1.png", width: 420, height: 1500 }]);
});

test("a page 3001 px tall is screenshot in 3 slices of 1500 px, and the last run's slices are replaced", skip, () => {
	const stale = { "page.html.420px/9.png": "old" };
	const { code, shots, pngs, left } = check(page("body { margin:0 }", '<p style="margin:0;height:3001px">tall</p>'), process.env, stale);
	assert.notDeepEqual(pngs[0], pngs[1], "the second slice shows the page further down, not its top again");
	assert.equal(code, 0);
	assert.deepEqual(shots.map(({ name, width, height }) => [name, width, height]), [1, 2, 3].map((n) => [`page.html.420px/${n}.png`, 420, 1500]));
	assert.deepEqual(left.toSorted(), ["1.png", "2.png", "3.png"]);
	const exact = check(page("body { margin:0 }", '<p style="margin:0;height:3000px">tall</p>'));
	assert.equal(exact.shots.length, 2, "3000 px is two slices");
});

test("a screenshot that fails exits 2: no page is sent without one", skip, () => {
	const { code, lines } = check(page("", "<p>fine</p>"), wrapper('case "$*" in *--screenshot*) echo "cannot write" >&2; exit 1;; esac'));
	assert.deepEqual([code, lines.at(-1)], [2, "no screenshot: cannot write; the page is not sent without one"]);
});

test("a chip on grey in a black heading, as in the pyramid report, fails with its contrast, and so do light grey, see-through text and dark text on a dark ancestor", skip, () => {
	const style = "h3 { background:#0a0a0a; color:#ffffff; } code { background:#f2f2f2; } p { color:#777777; }";
	const body = [
		"<h3>AR0562 · <code>arthur repeats</code></h3>",
		'<p>quiet</p><p style="color:#767676">just enough</p><p style="color:rgba(10,10,10,.4)">see-through</p>',
		'<div style="background:#0a0a0a"><span><b style="color:#333333">dark on dark</b></span></div>',
		'<div style="background:rgba(0,0,0,.5)"><b style="color:#000000">on half black</b></div>',
		'<p style="display:none;color:#ffffff">hidden</p>',
	].join("");
	const { code, lines } = check(page(style, body));
	const found = [
		'contrast 1.12:1, #ffffff on #f2f2f2: code "arthur repeats"',
		'contrast 4.48:1, #777777 on #ffffff: p "quiet"',
		'contrast 2.71:1, #9d9d9d on #ffffff: p "see-through"',
		'contrast 1.57:1, #333333 on #0a0a0a: b "dark on dark"',
	];
	assert.deepEqual([code, lines.slice(0, -1)], [1, found], "#767676, 4.54:1, passes; black on half black is 5.3:1 against #808080; hidden text has no box");
	assert.match(lines.at(-1) ?? "", /^4 problems in .*page\.html at 420 px$/);
});

test("a text or background colour that is not plain RGB is named as not checked", skip, () => {
	const { code, lines } = check(page("", '<p style="color:oklch(0.3 0.1 200)">modern</p><div style="background:oklch(0.9 0.05 200)"><b>tinted</b></div>'));
	assert.deepEqual([code, lines.slice(0, -1)], [1, ['not checked, a colour that is not plain RGB: p "modern"', 'not checked, a colour that is not plain RGB: b "tinted"']]);
});

// Each case at the limit: exactly 420 px, or a box exactly as wide as its content, passes; 1 px more fails, a box past the
// edge named once, by its outermost box.
const edges = (over: number) =>
	[
		`<div style="width:${420 + over}px"><div>wide</div></div>`,
		`<div style="margin-left:-${over}px;width:100px">left</div>`,
		`<div style="overflow-x:auto;width:100px"><div style="width:${100 + over}px">scroll</div></div>`,
	].join("");

test("a page exactly 420 px wide, with a box exactly as wide as its content, passes", skip, () => {
	const { code, lines } = check(page("body { margin:0 }", edges(0)));
	assert.deepEqual([code, lines.length], [0, 1], lines.join("\n"));
	assert.match(lines[0] ?? "", /^ok: /);
});

test("1 px past either edge, or 1 px scrolling inside a box, each fail", skip, () => {
	const { code, lines } = check(page("body { margin:0 }", edges(1)));
	assert.deepEqual([code, lines.slice(0, -1)], [
		1,
		[
			"the page scrolls sideways: 421 px wide on a 420 px screen",
			'wider than the screen, 0 to 421 px: div "wide"',
			'wider than the screen, -1 to 99 px: div "left"',
			'scrolls sideways inside, 101 px in 100: div "scroll"',
		],
	]);
});

test("a page rendered at another width is refused, as with a browser that ignores the 420 px window", skip, () => {
	const { code, lines } = check(page("", "<p>fine</p>"), wrapper('case "$*" in *--dump-dom*) exec ' + JSON.stringify(BROWSER) + ' "$@" --window-size=500,900;; esac'));
	assert.deepEqual([code, lines[0]], [1, "rendered 500 px wide, not 420"]);
});

test("with no browser it checks nothing and exits 2, never 0", () => {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "page.html"), "<p>x</p>");
	const run = spawnSync("/bin/bash", ["-c", COMMAND.replace("<page>", join(folder, "page.html"))], { cwd: ROOT, encoding: "utf8", env: { PATH: dirname(process.execPath), HOME: temporaryFolder() } });
	assert.deepEqual([run.status, run.stdout, run.stderr], [2, "", "no browser found; set CHROME to a Chrome or Chromium binary\n"]);
});

test("text a page's script adds before load is checked, a forged result is not read, a page with no text fails, and markup that swallows the check exits 2", skip, () => {
	const late = `<script>document.addEventListener("DOMContentLoaded", () => document.body.insertAdjacentHTML("beforeend", '<p style="color:#eeeeee">late</p>'))</script>`;
	const forged = '<script type="application/json" id="page-check">{"texts":9,"height":10,"problems":[]}</script>';
	const scripted = check(page("", `<p>tap</p>${late}${forged}`));
	assert.deepEqual([scripted.code, scripted.lines.slice(0, -1)], [1, ['contrast 1.16:1, #eeeeee on #ffffff: p "late"']]);
	const empty = check(page("", "<div></div>"));
	assert.deepEqual([empty.code, empty.lines.slice(0, -1)], [1, ["no text found to check"]]);
	const swallowed = check(page("", "<p>x</p><!--"));
	const never = "the check never ran in the page: it did not finish loading in 10 s, or its markup ends inside a comment or a <script>, <style> or <textarea>, which swallowed the check; close it";
	assert.deepEqual([swallowed.code, swallowed.lines], [2, [never]]);
});

test("the page is checked once its images have loaded: an image without a size that widens it fails", skip, () => {
	const wide = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="10"><rect width="900" height="10"/></svg>\n';
	const { code, lines } = check(page("body { margin:0 }", '<p>base</p><img src="wide.svg" alt="">'), process.env, { "wide.svg": wide });
	assert.deepEqual([code, lines.slice(0, -1)], [1, ["the page scrolls sideways: 900 px wide on a 420 px screen", 'wider than the screen, 0 to 900 px: img ""']]);
});

const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf";
test("the page is checked once its fonts have loaded: text a web font widens past the screen fails", { skip: (NO_BROWSER || !existsSync(FONT)) && `no Chrome or Chromium, or no ${FONT}` }, () => {
	const style = `@font-face { font-family: Wide; src: url("${pathToFileURL(FONT).href}"); } p { font: 60px Wide, serif; white-space: nowrap; margin: 0; } body { margin: 0 }`;
	const { code, lines } = check(page(style, `<p>${"i".repeat(15)}</p>`));
	assert.equal(code, 1, lines.join("\n"));
	assert.match(lines[0] ?? "", /^the page scrolls sideways: \d+ px wide on a 420 px screen$/);
});
