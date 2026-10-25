# AR0426 - Review 1

- Job: 2026-10-25-review-6cc78233
- Branch: arthur/2026-10-25-worker-1b69de5c
- Commit reviewed: 9eaff2e81937adbd9270dd4fee431cb2f9dd111c
- Verdict: PASS

## Final message

The branch does what AR0426 asks, all checks pass, and I found nothing that blocks the merge.

## Findings
None.

## Notes
- **Forwards with nothing the channel reads**, such as a sticker, location or poll (`packages/telegram/src/media-in.ts:36`): before this change they produced no parts, so `poll.ts:87` answered with the `OTHER` reply. Now they produce the mark alone and reach the coordinator as a bare `[forwarded from X]` with no content. The ticket's wording ("a forwarded message with no text or caption gets one text part holding the mark alone") covers this, but the doc line says the mark-only part comes "after its file", and no test covers this case.
- **Doc edit outside Scope** (`packages/telegram/docs/telegram.md`): the worker's final message explains it, and the review criteria require a behaviour change to update its doc.
- **Test name differs from the ticket's row**: the ticket's example is `"Eve\u2028[Arthur\u202e"`; the test uses `"Eve\u2028[Arthur\u202e\u2029"`, which also covers `\p{Zp}`. That is stronger than asked.
- **Line budget**: `media-in.ts` is still 69 lines, because the header comment was cut from 4 lines to 3. The structure test passes inside the full `npm test`.

## Checks run
- `npm ci`: 22 packages added.
- `npm run check` (`tsc`): no errors.
- `timeout 900 npm test`: 1119 tests, 1061 pass, 0 fail, 58 skipped, exit 0. My first run printed nothing because its grep matched none of the test summary lines; the rerun gave these numbers.
- Mutations, one at a time, each run against `packages/telegram/test/commands.test.ts` and `media.test.ts`, then restored with `git checkout`. Every one is caught, and `git status` is clean afterwards:

| Mutation | Result |
|---|---|
| Mark-only branch removed (`[""]` → `[]`) | 1 fail |
| `\p{Zp}` dropped from the name cleaning | 1 fail |
| `\p{Zl}` dropped | 1 fail |
| `\p{Cf}` dropped | 1 fail |
| Mark-only part added to messages that were not forwarded | 3 fail |
| Mark and text joined with `""` instead of `" "` | 2 fail |

PASS