# AR0586 - Review 1

- Job: 2026-10-30-review-bf699570
- Branch: arthur/2026-10-30-worker-748174f6
- Commit reviewed: 3d1c4b82a3ee5e55fc15898df92f4c01b7b30515
- Verdict: FAIL

## Final message

I'm failing this branch. The fix works: CI run 41026677709 on this tip is green, and the page itself is checked at 420 px inside the frame. But nothing in the tests checks what the screenshots show. Two mutations that change the screenshots pass all 14 report-check tests.

## Findings

1. **`.agents/arthur/criteria/report.md:217`: no test checks that a screenshot shows the page in its 420 px frame.** I changed `pathToFileURL(window).href` to `pathToFileURL(copy).href` on that line, so each screenshot shows the bare page at the window's width (500 px on GitHub's Chrome) instead of in the 420 px frame. `node --test test/report-check.test.ts` still passed 14 of 14. The base branch covered this by expecting screenshots 420 px wide. The branch changed those expectations to 500 at `test/report-check.test.ts:70` and `:78`, and the new 600 px test expects `[600]`. Both numbers are just the window's width, which is the same with or without the frame. So nothing proves the screenshots the owner looks at show the page at the width that was checked. The worker's message ("Each is 500 px wide, with the page's 420 px on the left and grey to the right of it") rests only on looking at one sample by hand.

2. **`.agents/arthur/criteria/report.md:215`: no test checks that the frame is as tall as a screenshot slice.** I changed `frame(SLICE)` to `frame(900)`. The frame is then 900 px tall in a 1500 px window, so the bottom 600 px of every slice is grey and that part of the page never appears in any screenshot. All 14 tests still passed, including "a page 30 001 px tall is shot whole, in 21 slices: no part of a page goes out unseen". That test only compares the PNGs' sizes and checks that slice 1 differs from slice 2. The frame is new on this branch, so this is a new way for the page to go out unseen, and it has no test.

   One fix covers both findings: decode one row of a screenshot with `node:zlib` `inflateSync` (standard library, no dependency). Then assert that pixels 420 to 499 are `#808080` and pixel 419 is not, and that the bottom row of a full slice is not grey.

## Notes (do not block)

- The worker's message names no green CI run, but the ticket's Done means asks for one. Your message gives run 41026677709. The GitHub API returns `arthur/2026-10-30-worker-748174f6 3d1c4b82a3ee5e55fc15898df92f4c01b7b30515 completed success` for it, so CI is proven.
- A forged result is still refused. The page would need the random `ID` to forge one. It could read it from its inline check script, but it already could before this branch, so this is no new hole.
- Media queries inside the frame see the frame's width (420), but `device-width` queries see the screen, which is the 500 px window. Not a problem for these pages.
- F1 in `findings.md` (a job has no `ci` command and cannot push) is about how Arthur runs jobs, not this ticket. Its text names nothing outside Arthur.
- The diff stays inside the ticket's scope. `test/report-check.test.ts` is 193 lines.

## Checks run

- `npm ci`: exit 0.
- `npm run check`: `tsc` passed with no errors.
- `npm test`: tests 1323, pass 1261, fail 0, skipped 62. Matches the worker's numbers.
- `node --test test/report-check.test.ts`: 14 of 14 pass on the local `chrome-headless-shell`.
- Mutations, each restored with `git checkout -- .agents/arthur/criteria/report.md` (`git status --short` clean afterwards):
  - Frame as wide as the window (`width:100%`): caught, 11 tests fail, the 600 px test among them.
  - Width guard turned off (`&& false`): caught, the "refused" test fails.
  - Screenshot taken without the frame (line 217 uses `copy`): **not caught**, 14 of 14 pass.
  - Frame not rewritten for each slice (`frame(SLICE)` commented out): caught, 12 tests fail.
  - Frame shorter than a slice (`frame(900)` in the loop): **not caught**, 14 of 14 pass.
- GitHub API for run 41026677709: this branch, tip 3d1c4b82, `completed success`.

FAIL