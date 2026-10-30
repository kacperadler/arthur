# AR0586 - Outcome

- Merged: 2026-10-30, `8c271b51`
- Branch: arthur/2026-10-30-worker-748174f6
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $2.20, reviews $0.93; review rounds 2

## What went in

- `.agents/arthur/criteria/report.md`: the page check loads a page 500 px wide that shows the report in a frame exactly 420 px wide, so the page is checked and shot at 420 px whatever window the browser keeps (GitHub's Chrome keeps at least 500); the frame posts its result, read only under the random id; the 420 px guard stays; screenshots are 500 px wide with grey right of the page.
- `test/report-check.test.ts`: a wrapper browser that widens any window to 600 px; each screenshot's top and bottom rows decoded with `node:zlib` to assert the page is exactly 420 px wide in every slice; a forged `postMessage` with a wrong id is not read.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1259/1327 passed.

## Left open

- Deferred (client summary): F1. A worker is told to run `arthur ci`, but a job's CLI has no `ci` command
- Deferred (client summary): F2. test/report-check.test.ts is 222 lines.
- Deferred (client summary): F3. frame(900) runs outside the try that removes the copy and the frame page.
