# AR0564 - Review 1

- Job: 2026-10-29-review-1d31b642
- Branch: arthur/2026-10-29-worker-0af16231
- Commit reviewed: a47c1761df25e5401af50935ae91cec5627222a5
- Verdict: FAIL

## Final message

## Findings

1. **The phone-width check's limits and refusals are not caught by the tests.** The four tests in `test/report-check.test.ts` only feed the check content that is far too wide (900 px tables, 150-character lines), so every width limit can move without a test failing. I mutated `.agents/arthur/criteria/report.md` and ran `node --test test/report-check.test.ts` after each change. All of these still gave 4 pass, 0 fail:
   - `:151`: `wide > innerWidth` → `wide > innerWidth + 1`, and also `+ 100`. The page-scroll limit moved by one, then by 100.
   - `:158`: `right > innerWidth + 1` → `+ 60`. An element 60 px past the screen edge is no longer reported as an element.
   - `:158`: removed `|| left < -1`. Elements past the left edge are no longer checked.
   - `:159`: `el.scrollWidth > el.clientWidth + 1` → `+ 400`. Inner scrolling and cut text under 400 px are no longer seen.
   - `:168`: `right > innerWidth + 1` → `+ 60` in the text-past-edge test.
   - `:115`: replaced the "rendered N px wide, not 420" guard with `if (false)`. The worker said this cannot be tested, which is wrong. I pointed `CHROME` at a small wrapper that appends `--window-size=500,900`, and the check printed `rendered 500 px wide, not 420`, exit 1. A test can do the same.
   - `:201`: "no browser found" `process.exit(2)` → `process.exit(0)`. A page that was never checked would then exit 0.

   "Nothing scrolls sideways at 420 px" is a Done means point, and the review criteria fail a branch when a mutation of a key behaviour goes uncaught (limit moved by one, refusal disabled). The worker's claim that 16 mutations were all caught does not cover these.

2. **The check passes a page whose text is added by the page's own script.** `.agents/arthur/criteria/report.md:185` adds the check as an inline script after the page's markup, so it runs during parsing, before `DOMContentLoaded` and `load`. A page that inserts `<p style="color:#eeeeee">late</p>` in a `DOMContentLoaded` handler gave `ok: … 0 texts at 4.5:1 or more`, exit 0. The skill does not forbid page scripts, and it accepts a result of 0 texts as `ok`.

3. **Text placed over a dark layer that is not its ancestor passes.** A `position:absolute` black div with `#111` text placed over it gave `ok`, exit 0. The skill's "Readable text" section forbids this layout, but the check only adds up the text's own ancestors' backgrounds and does not report it.

## Notes

- **Is evaluating a script read out of a Markdown file a risk?** Low risk here. The code it runs is the committed `.agents/arthur/criteria/report.md` in the current directory. Anyone who can edit that file can already edit code Arthur runs (`npm test`, the hooks), so it opens no new way in when run from main's root. Run from a worker's worktree, it would execute that branch's version, the same as running that branch's tests. If someone breaks the file by hand, `eval` throws with exit 1 and a stack trace. That is the same exit code as "problems found", but no `ok` line is printed, so the rule "send only a page that printed ok" still holds.
- **Is `--no-sandbox` on a local page a risk?** Low risk here. The page is a local file written by Arthur, and Chrome is killed after 60 s. Two caveats:
  - If a page quotes outside text (an issue or channel message) without escaping it, a script in that text runs in a Chrome without its sandbox and with network access. Escaping from there needs a Chrome renderer exploit.
  - Any script or markup in the page can fake the result. A page that already contains `<script type="application/json" id="page-check">{"texts":9,"problems":[]}</script>` got `ok`, exit 0, because the regex at `:197` takes the first match.
- **Misleading message for an unclosed tag.** A page ending in an unclosed `<!--` swallows the check script. The check then prints Chrome's last stderr line (`Failed to adjust OOM score…; set CHROME to a Chrome or Chromium binary`) with exit 2. The page is not passed, but the message points at the wrong cause.
- **No skeleton or ticket problems.** `arthur init` writing headings only matches what the ticket asks ("the file's skeleton, as it does the other criteria"). The ticket's Decisions are not contradicted.
- **Line counts.** `.agents/arthur/criteria/report.md` is 207 lines. It is a Markdown file, not a source file, and the structure test passes. As instructed, no line budget changed.

## Checks run

- `npm ci`: exit 0.
- `npm run check` (tsc): passed.
- `npm test`: 1313 tests, 1251 pass, 0 fail, 62 skipped. This matches the worker's numbers. Nothing in `packages/core/test/limits.test.ts` failed.
- `node --test test/report-check.test.ts`: 4 pass, 0 skipped, so Chrome was found and the check tests really ran.
- Mutations caught by the tests: threshold 4.5 → 4.4 and 4.5 → 4.6, exit code forced to 0 on problems, opacity check removed, SVG check removed.
- Mutations not caught: the seven listed in finding 1.
- Bypass probes using the documented command:
  - collapsed `<details>`: caught, exit 1;
  - forged result element: `ok`, exit 0;
  - text added on `DOMContentLoaded`: `ok`, exit 0;
  - unclosed comment: exit 2 with the misleading message;
  - dark overlay: `ok`, exit 0;
  - 440 px paragraph: caught, exit 1;
  - `CHROME` wrapper at 500 px: guard fires, exit 1.
- Every mutation was restored with `git checkout --` and the throwaway files under `/tmp` were removed. `git status --short` is clean.

FAIL