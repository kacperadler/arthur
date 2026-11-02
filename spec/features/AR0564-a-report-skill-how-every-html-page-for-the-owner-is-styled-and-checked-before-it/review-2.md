# AR0564 - Review 2

- Job: 2026-10-29-review-03d81d35
- Branch: arthur/2026-10-29-worker-0af16231
- Commit reviewed: 42306dbc2e3601321df42fd1a582114fd55bb47f
- Verdict: FAIL

## Final message

## Findings

1. **`.agents/arthur/criteria/report.md:216`: the check passes a page that scrolls sideways once its images load.** The check is an inline script added after the page's markup, so it runs while Chrome is still parsing the page, before `load`. An image without a set size takes no width until it loads. Line 214 says the copy is placed beside the page "so its relative links load", but nothing waits for them. Probe: a page with `<p>base</p><img src="wide.svg" alt="">`, where `wide.svg` is 900 px wide. The documented command printed `ok: … 1 texts at 4.5:1 or more, nothing wider than the screen` and exited 0. The same page in the same headless shell, measured on `load`, gave `scrollWidth` 900 on a 420 px screen. "Nothing scrolls sideways at 420 px" is a Done means point. Screenshots on a before-and-after page (AR0563) are exactly this case, and the skill does not forbid images. This is review 1's finding 2 again (the check runs before the page is finished), now through images instead of scripts. Web fonts arrive late the same way and can change widths too [INFERENCE, not probed]. No test covers either.

2. **Some low-contrast text gets `ok` from the documented command.** It neither checks this text nor names it as unchecked, and the skill promises to name text it cannot check. Each probe below printed `ok`, exit 0:
   - **Text from `::after` / `::before`:** `p.x::after{content:" arthur repeats";color:#eeeeee}`. Line 164 only looks at a generated element's background, never at its text.
   - **`-webkit-text-fill-color:#eeeeee`:** line 167 reads `color`, which this property overrides on screen.
   - **`filter:invert(1)`:** dark text turns white on white. `filter` is never read; only `opacity` is.
   - **An animation that changes colour later:** `animation: f 0s 0.2s forwards` to `#eeeeee`. The colour changes after the check has read it, the same way a script would.
   - **`<input value="arthur repeats" style="color:#eeeeee">`:** an input's value is not a text node, so the walk never sees it.
   - **Text inside an `<iframe srcdoc>`:** never checked.

   The pseudo-element and animation cases are the most realistic, since a tag or chip label is easily written as `content:`. The skill's "Readable text" rules do not forbid any of these six.

## Review 1 findings: fixed

I mutated the check myself, 29 mutations. After each one I ran `node --import @arthur/core/testing --test test/report-check.test.ts`, then put the file back.

- **Finding 1 (width limits and refusals):** fixed. Each of these was caught:
  - each width limit moved by 1 px: page width, box past the right edge, box past the left edge, the left-edge test removed, scrolling inside a box, the overflow condition, text past either edge;
  - the guard that the page rendered at 420 px disabled;
  - "no browser" made to exit 0;
  - the exit code 2 for "could not check" changed to 0;
  - reporting the outermost box only, disabled.
- **Finding 2 (text added by the page's script):** fixed for scripts. Each of these was caught:
  - the `<script>` refusal disabled;
  - the `on…` attribute refusal disabled;
  - the random result id replaced by a fixed one (the forged result is then read);
  - the "no text found" refusal disabled;
  - the message for markup that swallows the check disabled.

  Finding 1 above is the same timing gap, through images.
- **Finding 3 (text over another element's layer):** fixed. Each of these was caught:
  - the layer test disabled;
  - the `pointer-events` override removed;
  - the scroll to text further down the page removed;
  - the `::before`/`::after` background test disabled.
- **Contrast tests:** caught each of these:
  - the 4.5 limit moved to 4.4 and to 4.6;
  - the `opacity` test disabled;
  - the background image test disabled;
  - the `visibility` test disabled.
- **Survived:** three mutations, none of them a key limit:
  - removing `x < 0 || x >= innerWidth` before `elementsFromPoint`;
  - removing `size > 0` from the past-the-edge test;
  - removing `el.clientWidth > 0` from the cut-or-scroll test.

## Notes

- The worker's claims match what I saw: the 9 check tests run and pass, `npm test` gives 1318 tests with 1256 pass and 62 skipped, and no line budget changed.
- The prompt wiring matches the ticket. The coordinator (`orchestration.ts`), the retro (`retro.ts`) and the auditor (`audit.ts`) list `report` among their criteria. `arthur init` writes a skeleton of headings only (`skeleton/criteria/report.md`). Prompt tests were added in `context.test.ts`, `retro.test.ts`, `audit.test.ts` and `init.test.ts`. AR0563's pyramid role does not exist yet, so it is correctly left out.
- Text over another element's background is checked only at the first text node of each element (`layer(node, el)`). One probe with a second text node over a layer was still caught, through the element's first text node.
- The only problem left in the check's own reporting: the "Exit 2" sentence of `## The check` was cut off in my read output, so I did not check its wording.

## Checks run

- `npm ci`: exit 0.
- `npm run check`: exit 0.
- `npm test` (1800 s timeout): 1318 tests, 1256 pass, 0 fail, 62 skipped, exit 0. Nothing in `packages/core/test/limits.test.ts` failed.
- `node --import @arthur/core/testing --test test/report-check.test.ts`: 9 pass, 0 skipped, so a browser was found and the tests really ran.
- The 29 mutations above: 26 caught, 3 survived (listed above). Each was put back from the original text, and `git status --short` is clean.
- Probe pages, each run through the documented command in a temporary folder of their own:
  - the late-loading image: `ok`, exit 0, against `scrollWidth` 900/420 measured on `load`;
  - `::after` text, `-webkit-text-fill-color`, `filter`, the delayed animation, `<input value>` and `<iframe srcdoc>`: `ok`, exit 0 each;
  - `mix-blend-mode`, white text with a `text-shadow`, and a second text node over a layer: caught, exit 1.

  The probe folder is removed.

FAIL