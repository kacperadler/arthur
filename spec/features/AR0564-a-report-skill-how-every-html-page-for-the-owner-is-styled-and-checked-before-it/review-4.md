# AR0564 - Review 4

- Job: 2026-10-30-review-9cd423c8
- Branch: arthur/2026-10-29-worker-0af16231
- Commit reviewed: cb7f48561c188924708a4073e9bf154b60324c9b
- Verdict: FAIL

## Final message

**Findings**

1. `.agents/arthur/criteria/report.md:208`: no test covers the 20-slice cap on screenshots, and past that cap pages go out half-checked without any message. The loop runs `n < Math.min(Math.max(Math.ceil(height / SLICE), 1), 20)`. I changed `20` to `19`, and in a second run removed `Math.min(…, 20)` altogether. `node --test test/report-check.test.ts` passed both times (`fail 0`). This is a "limit moved by one that the tests do not catch", which the review criteria count as a reason to fail.
   - **Why it matters:** a page taller than 30 000 px gets screenshots of its top 30 000 px only. The script still prints `screenshots, look at each before sending: …` and exits 0. Line 104 tells the writer to read "every one of those screenshots", so he believes he saw the whole page. That weakens the required screenshot step, which is a Done means point.
   - **Worker's claim:** the final message says its 26 mutations covered "every kept condition, limit and exit code". For this limit, that does not reproduce.
   - **Fix:** either test the cap (a 30 001 px page gives 20 slices and says the rest was not shot) or drop the cap.

**Notes (not blocking)**
- `report.md:208`: `Math.max(…, 1)` is effectively dead code. `documentElement.scrollHeight` is never below the 900 px window, so it is at least 1 slice anyway.
- A semi-transparent background is blended over white, not over its ancestor's background. This is in line with "declared colours", and the file already says the check is not complete.
- `report.md` is 224 lines: Markdown with a 110-line script embedded in it. The 200-line limit applies to source files, and the ticket asks for the script in this file.

**Done means**
- **Skill file:** palette, type, layout, components and the four rules the ticket names are all present.
- **Simple check:** renders at 420 px after load, refuses a sideways scroll, and checks text colour against its own or the nearest ancestor's background at 4.5:1. The file says the check does not catch everything. The screenshot step is required. The old refusal code and its tests are gone.
- **Who reads the file:** the coordinator, retro and auditor criteria lists include `report`.
- **`arthur init`:** it writes the skeleton, and the docs and the onboarding role are updated.
- **Prompt tests:** the coordinator's and the retro's assembled prompts are asserted to hold the file, and so is the audit's.

**Checks run**
- **`npm run check`** (tsc) passes. **`npm test`**, run in the same bash call as `npm run check`: 1321 tests, 1259 pass, 0 fail, 62 skipped. This matches the worker's numbers.
- **`node --test test/report-check.test.ts`:** 12 pass, 0 skipped. A browser was available, so every check test really ran.
- **Mutations of the check caught by its tests:**
  - `ratio < 4.5` changed to `< 4.4`;
  - the ancestor walk cut off (`at = null`);
  - `left < 0` removed;
  - `right > innerWidth + 1`;
  - the `getClientRects` hidden-element skip removed;
  - `texts === 0` disabled;
  - alpha compositing of the text colour removed;
  - the exit forced to 0;
  - the width guard disabled;
  - `ceil` changed to `floor + 1`;
  - the default background made opaque;
  - `wide > innerWidth + 1`;
  - the slice offset changed by 1 px;
  - a failed screenshot counted as taken.
- **Mutations not caught:** the slice cap changed from 20 to 19, and the cap removed (finding 1).
- **Registration mutations, each caught:**
  - `report` removed from the coordinator's criteria: `context.test.ts` fails 3;
  - removed from the retro's: `retro.test.ts` fails 1;
  - removed from the auditor's: `audit.test.ts` fails 1.
- I restored every mutated file with `git checkout --`, and `git status --short` was empty afterwards.

FAIL