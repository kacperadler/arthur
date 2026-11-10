# AR0668 - Review 1

- Job: 2026-11-09-review-06251264
- Branch: arthur/2026-11-09-worker-bb08f8e6
- Commit reviewed: 34d053de326a839e17a30c50885d4d028fe76a78
- Verdict: FAIL

## Final message

## Findings

1. **`packages/orchestration/src/decision-proof.ts:17`: a hand mutation of the file-line exclusion survives.** I removed `video` from `/^\[(?:photo|video|voice|audio|file)\b/` and ran all 214 orchestration tests (`packages/orchestration/test/*.test.ts`): 175 passed, 0 failed, 39 skipped.
   - This is the key behavior of the third Done means point: a sent file's name is never his words.
   - A video gets a name the sender picks. Telegram keeps `file_name` in the path (`telegram/src/media-in.ts:58-59`). Discord makes `video/*` attachments kind `video` and puts the filename in both the path and the `[video <name> not saved: …]` line (`discord/src/media-in.ts:30-35`).
   - So a line like `[video, video/mp4] (/…/media/BAAD-AR-D12 yes, merge it.mp4)` would prove `AR-D12 yes, merge it` with the `video` alternative gone, and no test notices.
   - The new test in `decisions.test.ts` ("a file's line of a message never proves his words or the id…") covers `file`, `audio`, `photo` and `voice`, but no `video` line.
   - The review criteria count a survived mutation of a key behavior as a FAIL. Fix: one `video` row in that test: a core saved line, or Discord's `not saved` line with the name.

Everything else checks out:
- Fragment refusal: the probe rows `AR-D12`, `—`, `no`, `n`, `No,` are all refused.
- The notice quotes his whole message, redacted, cut after 400 code points with the cut marked, and the boundary is tested.
- Transcripts still count, with their path cut off.
- The docs (`decision.md`, `coordinator.md:53`, `take-main.md`) match the code.

The worker read the word rule as "a word besides the id, plus the id or a second word". That is the only reading under which the Done means test row (`no` refused) can pass, and the final message says so.

## Notes
- (risk) test/structure.test.ts:42: orchestration budget 2829 → 2846 (+17). The ticket's Decisions record no owner decision for it. The worker flags it as needing the owner's OK; the merge's outcome.md must show the raise.
- (risk) packages/orchestration/src/decision-proof.ts:25: any two words pass the fragment rule, as long as the message names the id elsewhere. With "AR-D12 no, do not merge", the quotes `do not` or `not merge` are accepted for a "yes". This fits the ticket's Out (meaning is not matched), so the whole-message notice is the only guard left.
- (minor) packages/orchestration/src/decision-proof.ts:26: `AR-D12 n` passes: the id plus one character. Done means refuses "a single character" only on its own, so it is in scope, but it is close to the fragment the ticket targets.
- (minor) packages/orchestration/src/decision-proof.ts:17: the video plugin's `[video <s> s] <transcript> frames: … (<path>)` line is dropped whole, its transcript included. Spoken words in a video never prove an answer; the ticket only asks for voice notes.
- (minor) packages/orchestration/test/silent.test.ts:118: the fixture still has the old notice wording. The worker already notes this.

## Checks (on 34d053de, detached checkout)
- `npm run check`: tsc passed.
- `npm test`, first run: 1 failure, in `packages/stats/test/stats.test.ts:151` (`seconds: 0` vs `2`). That file is not in the diff, and run alone (`node --import @arthur/core/testing --test packages/stats/test/stats.test.ts`) it passes 7/7, so it does not count against the branch.
- `npm test`, second run: tests 1678, pass 1614, fail 0, skipped 64.
- `npm run mutate`: "25 mutants, 25 caught, 0 survived; 53 not run (--max 25)". Matches the worker's claim.
- Hand mutations, each restored with `git checkout --`:
  - `video` removed from the file-line pattern: survived all orchestration tests (finding 1).
  - `rest.length > 1` → `>= 1`: caught (`"no"` accepted).
  - `whole.length > 400` → `>= 400`: caught.
- `git status --short` was empty after the checks, and `pgrep -af "review-06251264.*fake-agent"` found no fake agent left running.

FAIL