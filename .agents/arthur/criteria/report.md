# Report

How every HTML page sent to the owner looks, and the check it passes before `arthur send`: the night report, the pyramid report, a retro's or an audit's page, a before and after page. The coordinator reads this file, and so does every role that writes such a page. The plain page `arthur ticket file` writes beside a retro's report sets no colours and is not one of them.

## Palette (AR-D298)

- Black and white: ink `#0a0a0a` on paper `#ffffff`. Grey `#f2f2f2` for a quiet background (a note, a before column), `#d0d0d0` for lines.
- Blue `#0033ff` is the one accent: ids, the after side, a goal, a note's bar.
- Red `#d40000` only for what needs the owner: his decision, his answer, a risk he must see. Never decoration.
- Muted text `#555555` on paper or grey, `#cfcfcf` on ink; nothing lighter.
- Hex colours only, through the variables of the base style below. No `opacity`, no `rgba()`, no gradient or image behind text.
- One light page: `<meta name="color-scheme" content="light">`, no `prefers-color-scheme` rule.

## Type

- `16px/1.5 -apple-system, "Helvetica Neue", Arial, sans-serif`; headings weight 800.
- Commands, ids and paths in `code` (monospace, 13 px). Nothing below 12 px.
- Each number says what it counts: `44 steers`, `36% of reviews FAIL (91 of 251)`.

## Layout

- Phone first: `<meta name="viewport" content="width=device-width, initial-scale=1">`, `box-sizing: border-box`, and nothing scrolls sideways at 420 px.
- Content centred: a header, then `main` at most 900 px wide with `margin: 0 auto`; headings and the lead line centred, body text left.
- Columns and grids become one column under 640 px (`@media (max-width: 640px)`).
- Tables wrap: `width: 100%`, at most 4 columns, `overflow-wrap: anywhere` in cells and `code`, `white-space: nowrap` only on a short id. A wider table becomes a list. No fixed width above 380 px.

## Components

Each is a class of the base style below.

- Number tiles, `.nums`: a grid of `<div><b>44</b><span>steers sent by hand</span></div>`; `.r` makes the number red (needs the owner), `.b` blue.
- Before and after, `.cols`: two `<div>`s, the second `.after` with a blue border; one column on a phone.
- Tables: `th` ink with paper text, `td.id` blue and bold, `td.before` grey.
- Notes, `.note`: a blue bar on grey. Warnings, `.warn`: a red bar on grey, the place for what the owner must do.
- Tags for layers, `.tag`: `.code` paper on ink, `.static` blue, `.prose` muted, `.you` red (the owner's call).
- A command block, `.cmd`: an ink heading with paper text, its body on paper.

## Readable text

- Every rule that sets a `background` sets `color` in the same rule: text never inherits a colour chosen for another background.
- A chip (`code`, a `.tag`) inside a dark block (`header`, `th`, `.cmd h3`) has a rule for that block: `header code, th code, .cmd h3 code { background: var(--paper); color: var(--ink); }`. The pyramid report broke on this: a `code` on grey inherited the white of its black heading, so `arthur repeats` was white on grey, 1.1:1.
- Red only for what needs the owner; every command and id in full (no ellipsis, no cut), readable on what is behind it.
- At least 4.5:1 between every text and its background, large text included.
- Text sits on its own ancestors' backgrounds: no text positioned over another element, none in an image or an SVG.

## The base style

Start every page from this; add rules that follow the ones above.

```css
:root { --ink:#0a0a0a; --paper:#ffffff; --grey:#f2f2f2; --line:#d0d0d0; --blue:#0033ff; --red:#d40000; --muted:#555555; }
* { box-sizing:border-box; }
body { margin:0; background:var(--paper); color:var(--ink); font:16px/1.5 -apple-system, "Helvetica Neue", Arial, sans-serif; }
header { background:var(--ink); color:var(--paper); padding:32px 18px 24px; text-align:center; border-bottom:6px solid var(--blue); }
header h1 { margin:0 auto; max-width:860px; font-size:30px; line-height:1.1; font-weight:800; }
header p { margin:12px auto 0; max-width:720px; color:#cfcfcf; }
main { max-width:900px; margin:0 auto; padding:0 16px 48px; }
h2 { font-size:22px; line-height:1.2; font-weight:800; margin:40px 0 6px; padding-bottom:6px; border-bottom:3px solid var(--ink); text-align:center; }
h2 small { display:block; font-weight:400; font-size:14px; color:var(--muted); }
p.lead { text-align:center; max-width:720px; margin:10px auto; }
code { font:13px ui-monospace, Menlo, monospace; background:var(--grey); color:var(--ink); padding:1px 4px; overflow-wrap:anywhere; }
header code, th code, .cmd h3 code { background:var(--paper); color:var(--ink); }
.nums { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); border:2px solid var(--ink); margin:24px 0 8px; }
.nums div { padding:14px 12px; border-right:2px solid var(--ink); border-bottom:2px solid var(--ink); text-align:center; }
.nums b { display:block; font-size:36px; line-height:1; font-weight:800; }
.nums .r b { color:var(--red); } .nums .b b { color:var(--blue); }
.nums span { font-size:13px; }
table { width:100%; border-collapse:collapse; margin:12px 0; font-size:14.5px; }
th, td { text-align:left; vertical-align:top; padding:8px; border-bottom:1px solid var(--line); overflow-wrap:anywhere; }
th { background:var(--ink); color:var(--paper); font-size:12.5px; text-transform:uppercase; }
td.id { font-weight:800; white-space:nowrap; color:var(--blue); }
td.before { background:var(--grey); color:var(--ink); }
.tag { display:inline-block; font-size:12px; font-weight:700; padding:1px 6px; border:1.5px solid var(--ink); border-radius:3px; background:var(--paper); color:var(--ink); white-space:nowrap; }
.tag.code { background:var(--ink); color:var(--paper); }
.tag.static { border-color:var(--blue); color:var(--blue); }
.tag.prose { border-color:var(--muted); color:var(--muted); }
.tag.you { border-color:var(--red); color:var(--red); }
.note, .warn { border-left:6px solid var(--blue); background:var(--grey); color:var(--ink); padding:10px 14px; margin:14px 0; }
.warn { border-left-color:var(--red); }
.cols { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.cols > div { border:2px solid var(--ink); padding:12px 14px; }
.cols > div.after { border-color:var(--blue); }
.cmd { border:2px solid var(--ink); margin:16px 0; }
.cmd h3 { margin:0; padding:10px 14px; background:var(--ink); color:var(--paper); }
.cmd > div { padding:10px 14px; }
footer { max-width:900px; margin:0 auto; padding:16px 16px 40px; font-size:13px; color:var(--muted); text-align:center; border-top:3px solid var(--ink); }
@media (max-width:640px) { .cols { grid-template-columns:1fr; } header h1 { font-size:26px; } th, td { padding:6px; } }
```

## The check

Before every `arthur send` of a page, run from the repository's root, `<page>` being the page's path:

~~~sh
node -e 'eval(String(require("fs").readFileSync(".agents/arthur/criteria/report.md")).split("```js page-check\n")[1].split("\n```")[0])' <page>
~~~

It renders the page in headless Chrome 420 px wide and prints one line per problem: a text below 4.5:1 against its background (`contrast 1.12:1, #ffffff on #f2f2f2: code "arthur repeats"`), a text it cannot check (an image, an SVG, `opacity`, a colour that is not plain RGB), and anything wider than the screen or scrolling sideways inside it. Exit 0 with `ok: ...` when there is none, 1 with the problems; fix each and run it again. Exit 2 when no browser runs: set `CHROME` to a Chrome or Chromium binary (Playwright's `chrome-headless-shell` will do). Send only a page that printed `ok`.

```js page-check
const { spawnSync } = process.getBuiltinModule("node:child_process");
const { globSync, readFileSync, rmSync, writeFileSync } = process.getBuiltinModule("node:fs");
const { homedir } = process.getBuiltinModule("node:os");
const { basename, dirname, join, resolve } = process.getBuiltinModule("node:path");
const { pathToFileURL } = process.getBuiltinModule("node:url");

// Runs inside the page: every element with its own text against the backgrounds of its ancestors, then the width.
function check(width) {
	const problems = [];
	const rgb = (value) => (/^rgba?\(/.test(value) ? value.match(/[\d.]+/g).map(Number) : undefined);
	const over = ([r, g, b, a = 1], under) => [r, g, b].map((c, i) => c * a + under[i] * (1 - a));
	const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
	const lum = (c) => c.map((v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
	const name = (el) => `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).join(".")}` : ""} "${el.textContent.trim().replace(/\s+/g, " ").slice(0, 40)}"`;
	if (innerWidth !== width) problems.push(`rendered ${innerWidth} px wide, not ${width}`);
	const seen = new Set();
	let texts = 0;
	const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
	for (let node = walk.nextNode(); node; node = walk.nextNode()) {
		const el = node.parentElement;
		if (!node.data.trim() || seen.has(el)) continue;
		seen.add(el);
		if (el.getClientRects().length === 0 || getComputedStyle(el).visibility !== "visible") continue;
		if (el.closest("svg")) {
			problems.push(`not checked, text in an SVG: ${name(el)}`);
			continue;
		}
		texts++;
		let [back, unknown] = [[255, 255, 255], undefined];
		const chain = [];
		for (let at = el; at; at = at.parentElement) chain.unshift(at);
		for (const at of chain) {
			const style = getComputedStyle(at);
			if (Number(style.opacity) < 1) unknown = "opacity";
			if (style.backgroundImage !== "none") unknown = "a background image";
			const fill = rgb(style.backgroundColor);
			if (fill === undefined) unknown = `the background ${style.backgroundColor}`;
			else back = over(fill, back);
		}
		const color = rgb(getComputedStyle(el).color) ?? (unknown ??= `the colour ${getComputedStyle(el).color}`);
		if (unknown !== undefined) {
			problems.push(`not checked, ${unknown}: ${name(el)}`);
			continue;
		}
		const front = over(color, back);
		const [light, dark] = [lum(front), lum(back)].sort((a, b) => b - a);
		const ratio = (light + 0.05) / (dark + 0.05);
		if (ratio < 4.5) problems.push(`contrast ${ratio.toFixed(2)}:1, ${hex(front)} on ${hex(back)}: ${name(el)}`);
	}
	const wide = document.documentElement.scrollWidth;
	if (wide > innerWidth) problems.push(`the page scrolls sideways: ${wide} px wide on a ${innerWidth} px screen`);
	// The outermost element past the screen's edge, or scrolling or cut inside; then text past the edge outside them.
	const out = new Set();
	const inside = (el) => out.has(el) || (el.parentElement !== null && inside(el.parentElement));
	for (const el of document.body.querySelectorAll("*")) {
		const { left, right, width: size } = el.getBoundingClientRect();
		const overflow = getComputedStyle(el).overflowX;
		const outside = size > 0 && (right > innerWidth + 1 || left < -1);
		const hides = overflow !== "visible" && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1;
		if (!outside && !hides) continue;
		if (!inside(el)) problems.push(outside ? `wider than the screen, ${Math.round(left)} to ${Math.round(right)} px: ${name(el)}` : `${/auto|scroll/.test(overflow) ? "scrolls sideways inside" : "cuts its text"}, ${el.scrollWidth} px in ${el.clientWidth}: ${name(el)}`);
		out.add(el);
	}
	const range = document.createRange();
	for (const el of seen) {
		range.selectNodeContents(el);
		const { left, right } = range.getBoundingClientRect();
		if ((right > innerWidth + 1 || left < -1) && !inside(el)) problems.push(`text wider than the screen, ${Math.round(left)} to ${Math.round(right)} px: ${name(el)}`);
	}
	const result = document.createElement("script");
	result.type = "application/json";
	result.id = "page-check";
	result.textContent = JSON.stringify({ texts, problems }).replaceAll("<", "\\u003c");
	document.body.append(result);
}

const WIDTH = 420;
const page = process.argv[1];
if (page === undefined) {
	console.error("usage: the command above, with the page's path");
	process.exit(2);
}
// A copy beside the page, so its relative links load; the check runs after the page's own markup.
const copy = join(dirname(resolve(page)), `.${basename(page)}.check.html`);
writeFileSync(copy, `${readFileSync(page, "utf8")}\n<script>(${check})(${WIDTH})</script>\n`);
const caches = [".cache", "Library/Caches"].flatMap((cache) => globSync(join(homedir(), cache, "ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell")).sort().reverse());
let run;
try {
	for (const browser of [process.env.CHROME, "chromium", "chromium-browser", "google-chrome", ...caches].filter(Boolean)) {
		// No sandbox: Ubuntu 23.10+ refuses Chrome's, and the page is one Arthur wrote, not a site.
		run = spawnSync(browser, ["--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--window-size=${WIDTH},900`, "--dump-dom", pathToFileURL(copy).href], { encoding: "utf8", timeout: 60_000 });
		if (run.error?.code !== "ENOENT") break;
	}
} finally {
	rmSync(copy, { force: true });
}
const found = /<script type="application\/json" id="page-check">(.*?)<\/script>/s.exec(run?.stdout ?? "");
if (found === null) {
	const why = run === undefined || run.error?.code === "ENOENT" ? "no browser found" : (run.error?.message ?? run.stderr.trim().split("\n").at(-1));
	console.error(`${why}; set CHROME to a Chrome or Chromium binary`);
	process.exit(2);
}
const { texts, problems } = JSON.parse(found[1]);
for (const problem of problems) console.log(problem);
console.log(problems.length === 0 ? `ok: ${page} at ${WIDTH} px: ${texts} texts at 4.5:1 or more, nothing wider than the screen` : `${problems.length} problems in ${page} at ${WIDTH} px`);
process.exit(problems.length === 0 ? 0 : 1);
```
