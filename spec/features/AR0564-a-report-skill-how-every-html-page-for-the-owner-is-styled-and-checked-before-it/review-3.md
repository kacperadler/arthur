# AR0564 - Review 3

- Job: 2026-10-29-review-d949a560
- Branch: arthur/2026-10-29-worker-0af16231
- Commit reviewed: b69049d53a6ba7f0a0373ac64a8715d6cc18f753
- Verdict: FAIL

## Final message

## Findings

1. **Review 2's finding 2 is fixed for its six probes but not at its cause.** AR-D347 says the check "refuses every kind of text it cannot read". The check still treats the colours of the text's own ancestors as the whole background (`.agents/arthur/criteria/report.md:162-176`). It counts something else at the text's place as a layer only when `opaque()` sees a background (`:116`, `:156`). Anything else drawn behind the text is missed, and the check prints `ok … texts at 4.5:1 or more`, exit 0. I took a screenshot of each page; dark `#111` text sits on solid black in all four:
   - **SVG shape behind the text:** `<svg style="position:absolute">` holding `<rect fill="#000">`, under `<p style="position:relative;color:#111">arthur repeats</p>`.
   - **Image behind the text:** an absolutely positioned `<img>` (a black SVG) under the same `<p>`.
   - **Border behind the text:** another element, `position:absolute;inset:0;border:40px solid #000`, under the same `<p>`.
   - **Inset shadow on an ancestor:** `box-shadow: inset 0 0 0 200px #000` on the text's parent. `judge` never reads `box-shadow`, and no rule at `:42-46` forbids it.

   The first three break the rule at `:44` ("no text positioned over or under another element"), and the check passes them anyway. The page that started this ticket was white-on-grey text that looked fine to its author. These are the same failure: the check computes a ratio against a background that is not the one on screen.

2. **`.agents/arthur/criteria/report.md:202`: text in a `::marker`'s `content` passes when `list-style` is `none`.** Probe: `li{list-style:none} li::marker{content:"arthur repeats ";color:#eeeeee}`. Chrome draws "arthur repeats" in `#eeeeee` on white (screenshot), and the check prints `ok`, exit 0. The marker loop skips any `listStyleType: none`. The `content` refusal looks only at `::before`/`::after` (`:131`). This is the `::after` probe from review 2 written as a `::marker`, and it contradicts `:45`, "List markers are checked as text".

3. **`.agents/arthur/criteria/report.md:192`: text with no layout box is skipped without a word.** Probe: `<details><summary>more</summary><p style="background:#f2f2f2;color:#eeeeee">arthur repeats</p></details>` gives `ok`, exit 0. The owner opens it on the phone and reads 1.1:1. The check cannot read text inside a closed `<details>`, and it neither refuses nor names it. No rule forbids `<details>`.

## Review 2's findings

- **Finding 1 (check ran before load): fixed at its cause.**
  - The check now starts after `load` and then `document.fonts.ready`, and Chrome gets `--virtual-time-budget=10000`.
  - The 900 px image probe now prints `the page scrolls sideways: 900 px wide on a 420 px screen`, exit 1.
  - Removing the wait for `load` fails 3 tests; removing `--virtual-time-budget` fails 5.
- **The `fonts.ready` gap: the worker's claim holds as far as I tested.**
  - Removing only the `fonts.ready` wait leaves 0 tests failing, as the worker said.
  - [INFERENCE] On a static page, fonts are requested during layout before `load`, and virtual time pauses while they are fetched, so the second wait has nothing left to wait for in this Chrome. I don't count this against the branch.
- **Finding 2 (text the check cannot read): partly fixed.** All six probes from review 2 now exit 1:
  - `::after` text → `not checked, text in ::after`;
  - `-webkit-text-fill-color` → `contrast 1.16:1`;
  - `filter:invert(1)` → `not checked, filter`;
  - delayed animation → `an animation, which can change the page after the check`;
  - `<input>` → `not checked, a input`;
  - `<iframe srcdoc>` → `not checked, a iframe`.

  Findings 1–3 above are the same cause in forms the worker's lists don't name.

## Notes

- Line 100 says the check names "each thing the rules above forbid". It doesn't refuse a `prefers-color-scheme` rule (`:15` forbids one): `@media (prefers-color-scheme: dark){code{color:#eeeeee}}` gives `ok`, exit 0. It also doesn't check the 12 px minimum: 4 px text gives `ok`.
- Other probes that gave `ok`, exit 0:
  - `:hover` colour changes;
  - `<meta http-equiv="refresh">`;
  - dark text with a heavy dark `text-shadow`.

  They are edge cases, listed in case the next round widens the rules.
- The three non-key mutations review 2 listed are still not caught, as the worker says.
- The prompt wiring and the `arthur init` skeleton are unchanged since review 2, which checked them. No line budget changed.
- `.agents/arthur/criteria/report.md` is 268 lines. It is Markdown, not a source file, and the structure test passes.

## Checks run

- `npm ci`: exit 0.
- `npm run check`: exit 0.
- `npm test` (1800 s timeout): 1322 tests, 1260 pass, 0 fail, 62 skipped. Nothing in `packages/core/test/limits.test.ts` failed. This matches the worker's numbers.
- `node --import @arthur/core/testing --test test/report-check.test.ts`: 13 pass, 0 skipped. Chrome was found and `DejaVuSansMono-Bold.ttf` exists, so the font test really ran.
- 22 mutations of the round-3 code, each followed by that test file. 21 were caught; the one that survived is dropping `fonts.ready` alone. The caught ones:
  - dropping the wait for `load` and the fonts, and dropping virtual time;
  - reading `color` instead of the fill colour;
  - turning off the "image did not load" refusal;
  - dropping each of `mix-blend-mode`, `clip-path`, mask, `content-visibility` and `backdrop-filter`;
  - turning off the `::first-line` colour test and its background test;
  - turning off the marker check and the pseudo-element `content` refusal;
  - turning off animations on pseudo-elements, transitions on pseudo-elements, and the transition limit;
  - dropping `canvas`, `select`, `object`/`embed`, `audio`/`video` and `textarea`.

  The file was restored after each one, and `git status --short` is clean.
- 21 probe pages run through the documented command in a temporary folder. Results are as quoted above. The renders were confirmed with `chrome-headless-shell --screenshot`. The folder is removed.

FAIL