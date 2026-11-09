# AR0668 - Review 2

- Job: 2026-11-10-review-2539324f
- Branch: arthur/2026-11-09-worker-bb08f8e6
- Commit reviewed: 9378731dce145a539800bfbb727db24505af988f
- Verdict: FAIL

## Final message

**Findings**

1. `packages/orchestration/src/decision-writes.ts:64`: no test covers the redaction of the owner's message in the new notice. The branch adds his whole message to the high-impact notice and claims it is "redacted". I replaced `[...redact(proved.text.trim(), host.secrets)]` with `[...proved.text.trim()]` and ran every orchestration test file: tests 214, pass 175, fail 0. The mutant survived. Telegram sends this notice text as it is (`telegram.ts:59-61` does no redaction), so it is the only thing keeping a token he pastes (a `ghp_…`, a `Bearer …`, an env file value) off the channel and out of the notice event. Every other notice that repeats outside text redacts it: `inbox.ts:185` and `blocked-notice.ts`. The review criteria fail a branch when a new behavior's test would still pass with the behavior removed. The fix is a test with a secret in the proving message that asserts the notice holds `REDACTED` and not the value.

Everything else the ticket asks for is there:
- The fragment rule refuses `AR-D12`, `—`, `no` and `n`.
- The notice holds his whole message, cut after 400 code points with the cut marked.
- File lines of every kind, saved and not saved, never prove his words or the id. A voice transcript still does, without its path.
- The docs are updated in `decision.md`, `coordinator.md` and `take-main.md`.

## Notes
- (security) `packages/orchestration/src/decision-proof.ts:17`: the file-line exclusion assumes one line per part. The core's saved line puts the raw `part.mime` in it, and Telegram passes the client's `mime_type` through unchanged (`telegram/src/media-in.ts:34`). A mime holding `\n` would split the line, and the text after the newline would count as his words. [INFERENCE: not verified that Telegram delivers a newline in `mime_type`]
- (risk) `packages/orchestration/src/decision-proof.ts:16`: an audio file's transcript counts as his words like a voice note's. The ticket keeps only "a transcript of his voice note", so speech in an audio file someone else recorded can prove an answer.
- (risk) `packages/orchestration/src/decision-proof.ts:26`: the rest-of-words count splits another decision's id into two words (`AR-D13` → `AR`, `D13`). So the quote `AR-D13`, or `AR-D13 yes`, passes AR-D12's fragment rule whenever his message also names AR-D12. Only the notice shows it.
- (minor) `test/structure.test.ts:42`: the orchestration budget goes from 2829 to 2846. The styleguide only requires an existing package's raise to show in the merge's outcome.md, so the worker's request for the owner's OK is the coordinator's call. The raise does not fail the branch.
- (minor) `packages/orchestration/src/decision-proof.ts:26`: the word rule is stricter than the Done means text: one word alone, without the id, is refused. This matches the ticket's own test row (`no` refused), and the worker flagged it.

## Checks (on 9378731d)
- `npm run check`: tsc passed.
- `npm test`: tests 1678, pass 1614, fail 0, skipped 64. No file is yellow from this branch; the seven yellow lines are core, delivery and session files.
- `npm run mutate` (default max): 25 mutants, 25 caught, 0 survived; 53 not run.
- Hand mutations, each run on `packages/orchestration/test/*.test.ts` and then restored with `git checkout -- <file>`:
  - Notice redaction removed (`decision-writes.ts:64`): survived (fail 0).
  - Latest-message sort inverted (`decision-proof.ts:46`): caught (fail 2).
  - Two-word limit `rest.length > 1` changed to `> 2` (`decision-proof.ts:27`): caught (fail 5).
  - Transcript path strip removed (`decision-proof.ts:16`): caught (fail 1).
- `npx arthur decision --help` in this checkout: did not run, since there is no `arthur.config.ts` ("unknown command decision"). The command's path is exercised through the tests' `run("decision", …)`.
- `git status --short` after the mutations: empty.

FAIL