# AR0663 - Review 2

- Job: 2026-11-09-review-948eddfa
- Branch: arthur/2026-11-09-worker-e677416d
- Commit reviewed: f510be7bb0916550aba9ccde19813d862156b624
- Verdict: FAIL

## Final message

The branch fails this review. Globs and powers now stay as typed, but a `**` that cannot be closed still pairs with a later bold mark on the same line. Bold can therefore span text that is not a word run, which is the same kind of defect as review-1's finding 1.

## Findings

1. **`packages/manage/src/report-file.ts:83`: a bold span can contain a bare `**`, so a lone mark that can only open takes the closing mark of a later bold.** The content group `(.+?)` is lazy but does not exclude `**`. The match starts at the first mark that qualifies as an opening one and runs to the first mark that qualifies as a closing one, even when a real bold opens in between. I ran `reportPage` on f510be7b:
   - `f(**kw) and **bold**` became `f(<strong>kw) and **bold</strong>`. This is code losing its `**`, the case the ticket is about. A Python `**kwargs` left outside backticks does the same thing: `pass **kwargs and **opts**` gives `<strong>kwargs and **opts</strong>`. That second result comes from the same regex; I did not run that input.
   - `**x**y and **z**` became `<strong>x**y and **z</strong>`. The new test asserts that `**x**y stays` as typed, but only when it is alone on its line.

   The Done means says "`**` becomes `<strong>` only around a word run". `kw) and **bold` is not a word run, and the test does not cover a refused mark followed by a real bold on the same line. CommonMark pairs a closing mark with the nearest opening one and would render `f(**kw) and <strong>bold</strong>`. Fix: stop the content at an inner `**`, for example `((?:(?!\*\*).)+?)`, and add these two lines to the test.

2. **`packages/manage/test/retro.test.ts:183-197`: the tests do not catch a change to the set of characters a closing mark may come before.** I mutated the closing lookahead at `report-file.ts:83` from `[^\s)\]\x22\x27.,;:!?]` to `[^\s)\]\x22\x27.,;]`. The whole manage suite still passed (71 pass, 0 fail). As a result, `**x**:`, `**x**!` and `**x**?` could silently stop being bold, although `docs/manage.md:115` and the comment at `report-file.ts:80` promise bold before "a stop". The review criteria count an uncaught mutation of a key behavior as a FAIL.

## Notes
- (minor) `packages/manage/src/report-file.ts:103`: only backtick fences count. A `~~~` fence in a Before/After quote shows its fence lines and formats `**x**` as bold (checked on f510be7b).
- (minor) `packages/manage/src/report-file.ts:103`: inside an open fence, a line like ```` ```ts ```` closes the block. CommonMark allows no info string on a closing fence, so the rest of the block is formatted as prose.
- (minor) `packages/manage/src/report-file.ts:83`: `<**b**>` and `**bold**—dash` stay as typed. After escaping, the opening mark follows `;`, and the closing set has no dash. The doc's rule technically allows both results.

## Checks (all on f510be7b)
- `npm run check`: tsc clean.
- `npm test`: 1671 tests, 1607 pass, 0 fail, 64 skipped, exit 0. Seven yellow files are printed, none of them in this diff; `report-file.ts` is 148 lines.
- `npm run mutate`: 25 mutants, 25 caught, 0 survived, 26 not run (`--max 25`).
- With `report-file.ts` put back to cec635c8, the new test "a page keeps a glob…" fails (pass 0, fail 1). It passes on the tip.
- Hand mutations, each run against the new test and restored with `git checkout`:
  - dropping the `fenced = false` reset: caught.
  - `{0,3}` changed to `{0,4}`: caught.
  - removing the opening lookahead: caught.
  - `escape(quoted)` changed to `inline(quoted)`: caught.
  - dropping `:!?` from the closing lookahead: survived the whole manage suite (finding 2).
- `node -e` probes of `reportPage`: produced the outputs quoted in finding 1 and in the notes.
- `.cols p` uses `white-space:pre-wrap` and a monospace font, so fenced text does show as code.
- `git status --short` was empty after all runs.

FAIL