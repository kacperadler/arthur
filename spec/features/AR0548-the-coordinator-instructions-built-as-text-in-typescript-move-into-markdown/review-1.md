# AR0548 - Review 1

- Job: 2026-11-10-review-116fa916
- Branch: arthur/2026-11-10-worker-00e9fdaf
- Commit reviewed: 636d3accb8e0dd4917b4969d407bc7f48f61900a
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch moves the fixed wording of all four coordinator messages into eight Markdown files under the packages' `roles/coordinator/` folders. The code fills in the live parts and sends the same text as before, word for word. Each message has a test that checks the exact text and another that checks the file is the one actually read. `npm run check` and `npm test` pass on `636d3acc`.

**What the ticket's Done means asks for:**
- **Wording in Markdown with named placeholders:** done.
  - Handoff request: `handoff-compact.md`, `handoff-restart.md` and `handoff-fresh.md`, with `{handoff}`.
  - CI `Why:` line: `ci-failed-worker.md` and `ci-failed-owner.md`, with `{branch}`, `{project}` and `{job}`.
  - FAIL review line: `review-failed.md` and `review-failed-limit.md`. The text lives in `review-wake.ts`, not in the `delivery.ts` the ticket names, but `delivery.ts:110` calls it with the `review-limit.md` path, so it reads the same folder.
  - Reply-not-sent reminder: `reply-not-sent.md`.
- **One word-for-word test per message:**
  - Handoff: `handoff-extension.test.ts`, for compact, restart and fresh.
  - CI: `github.test.ts:111,152,293`, which keep their literal strings.
  - FAIL line: `review-wake.test.ts`, at FAIL 1, 3 and 4.
  - Reminder: `inbox.test.ts:17,556`, where `AGAIN` is still a literal string.
- **The retro sees the new files:** `packages/manage/src/retro.ts:94` reads every `.md` in each plugin's `roles/coordinator`, so the new files are listed with no change.
- **Project override:** the prompt loader can only override a role file (`packages/core/src/roles.ts:134`). Every other procedure is read straight from its package, so the new files are as overridable as the others, which is not at all. That meets "as it covers the other procedures" literally. The Description's "a project can override them" is still not true, and the worker's F1 already records that gap.
- **No boundary or Shape rule broken:** no plugin imports another, there is no new dependency, and every changed source file stays under 200 lines (github.ts 174, inbox-extension.ts 195, handoff-extension.ts 150, review-wake.ts 50).
- **Docs updated:** `review.md`, `github.md`, `coordinator.md` and `session.md` each name their new procedure files.
- **The worker's final message matches what I saw:** the files, the commits, the test counts and the one surviving mutant.

## Notes
- (minor) packages/session/src/handoff-extension.ts:93: the new comment says "request.ts checks it is one of them", but the extension's own `found()` reads `request.json` without that check. A hand-edited request with any other `then` now fails with "the request did not reach the agent: ENOENT…". Before, it got the restart wording.
- (minor) packages/delivery/src/review-wake.ts:47, packages/github/src/github.ts:110: placeholders are looked up on a plain object, so a wording file containing `{constructor}` or `{toString}` would insert a function's source text instead of leaving the placeholder as written. Only matters for a wording file someone edits badly.

## Checks (on 636d3acc)
- `npm run check`: tsc passed with no errors.
- `npm test`: 1681 tests, 1617 pass, 0 fail, 64 skipped.
- `npm run mutate`: 25 mutants, 24 caught, 1 survived, 7 not run (`--max 25`), 839 s. The survivor is `packages/github/src/github.ts:107: hunk reverted to the base`. That hunk only deletes the old `const ci = …` line; putting it back adds a variable nothing reads, so behaviour is the same, and tsc rejects it as unused (TS6133).
- Hand mutations, each restored with `git checkout --`, `git status` clean afterwards:
  - `replaceAll("{handoff}", …)` changed to `replace(…)` in `handoff-extension.ts`: `handoff-extension.test.ts` gave 1 pass, 1 fail. Caught.
  - The `?? all` fallback for an unknown placeholder changed to `?? ""` in `github.ts`: the test "Why line is the wording…" gave 0 pass, 1 fail. Caught.

PASS