# AR0668 - Review 5

- Job: 2026-11-10-review-58c3ee7f
- Branch: arthur/2026-11-09-worker-bb08f8e6
- Commit reviewed: 3c1d1f2986fee6068e937d329cdf4e109a9c5d07
- Verdict: FAIL

## Final message

## Findings

1. **`packages/orchestration/src/decision-proof.ts:16`: no test covers a transcript whose length has a decimal, so a mutation that breaks every Discord voice note survives.** The Done means requires that "a transcript of his voice note still is" matched. listen writes `[${kind} ${done.seconds} s] …` (`listen/src/listen.ts:27`). It takes `seconds` from the channel unrounded (`transcribe.ts:59`, `known ?? Math.round(...)`). Discord sends `duration_secs` as a float and passes it through as is (`discord/src/media-in.ts:43`). So a Discord voice note's line looks like `[voice 3.52 s] AR-D12 yes (/…)`, and only the `(?:\.\d+)?` in `own()` lets it count.
   - **Mutation:** `\d+(?:\.\d+)? s\]` → `\d+ s\]`.
   - **Result:** `decisions.test.ts` still passes 43/43, 0 failed.
   - **Impact:** with that change, `said()` throws away every Discord voice transcript, and it does this for every answer, not only high-impact ones. Each of the owner's spoken answers on Discord would then be refused as "no message of the owner holds these words", and nothing would catch it.
   - **Fix:** the file-line test (`decisions.test.ts`, the voice rows near line 336) only uses whole seconds (`[voice 4 s]`). It needs a row with a decimal length.

## Notes
- (risk) `packages/orchestration/src/decision-proof.ts:26`: Review-4 noted this and it is still not in `findings.md`. The id plus one word (`AR-D12 no`) passes. So do two words with no id (`do not`, or `yes, merge it` taken from another id's line) when his message names the id somewhere else. A steered coordinator can still record a "yes" from his "no". The ticket's Out leaves this to the notice.
- (risk) `packages/orchestration/src/decision-proof.ts:16`: Review-4 noted this and it is still not in `findings.md`. An `[audio …]` transcript counts as his words, so speech from someone else's recording that he re-uploads can prove an answer. No test pins audio either way: the mutation `(?:voice|audio)` → `voice` passes all 43 tests.
- (minor) `packages/orchestration/src/decision-proof.ts:17`: no test covers the `\b` after the kind list. Removing it passes all 43 tests. The only effect would be dropping more of the owner's own lines (`[filed …`), which leads to a refusal, never to a false proof.
- (minor) `test/structure.test.ts:42`: in this range the orchestration budget goes from 2846 to 2863; from main before AR0548 it is 2829 → 2863. The merge's outcome.md must show the raise.

## Checks (on 3c1d1f29, detached checkout)
- `npm run check`: tsc passed.
- `npm test`: 1695 tests, 1631 passed, 0 failed, 0 cancelled, 64 skipped. The structure test listed seven yellow files, all in core, delivery and session; none in orchestration.
- `npm run mutate` (default max): "25 mutants, 25 caught, 0 survived; 67 not run (--max 25)".
- Hand mutations, each followed by `node --import @arthur/core/testing --test packages/orchestration/test/decisions.test.ts` (43 tests at baseline, 0 failed) and restored with `git checkout -- <file>`:
  - **Caught, 1 test failing each:**
    - `said()` keeps file lines;
    - the transcript's path is kept;
    - the 2-word minimum lowered to 1;
    - the 1-word minimum lowered to 0;
    - the matched-text check removed;
    - the id stripping removed;
    - the id looked for in the raw text;
    - the words matched in the raw text;
    - the notice cut at 399 instead of 400;
    - `> 400` changed to `>= 400`;
    - the notice's redaction removed;
    - the early `fragment(words)` check removed.
  - **Survived, 0 failing:**
    - decimal seconds removed (finding 1);
    - audio removed from the transcript kinds;
    - `\b` removed.
- The worker's claims match what I ran: check passes, 1695/1631/0 for the tests, mutate 25/25 with 67 not run, and the nine commits.
- After the runs, `git status --short` was empty.

FAIL