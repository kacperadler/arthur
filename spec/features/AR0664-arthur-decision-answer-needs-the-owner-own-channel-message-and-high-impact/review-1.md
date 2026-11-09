# AR0664 - Review 1

- Job: 2026-11-09-review-814e9bce
- Branch: arthur/2026-11-09-worker-886b0650
- Commit reviewed: d72fa5ad137b10b5d28f58d660f45e8b9f28e94a
- Verdict: FAIL

## Final message

**Verdict: FAIL.** There are two blocking findings: one doc line still describes the shell grant the branch now refuses, and one protective matching condition can be removed without any test failing. The rest of the ticket is met. I hand-mutated the main guards (the shell grant refusal, the phone grant's bound check, the forward check, the "after the ask" time check, the `message` check in `decision.owner`, the id rule for budget and class answers, the notice, and the silent hold) and each mutation was caught by a test.

1. **`packages/models/docs/commands/usage.md:17` still names the old shell grant.** It says `models.usage` "bounds the owner's grant of `arthur silent on --usage <percent>`". The branch makes that shell form refuse (`silent.ts:139-142`); the grant is now only the phone form `/silent on … --usage … --recommend`. The review criteria fail any doc line that still says what the branch changed, unless the file is in the Scope's Out, and this one isn't. The worker edited delivery's `take-main.md` for the same reason, so this file needed the same update.

2. **`packages/orchestration/src/decision-proof.ts:10`: removing the word-start check goes unnoticed.** I deleted the lookbehind `(?<![\p{L}\p{N}])` from the regex in `holds` and ran `decisions.test.ts`: 41 pass, 0 fail. This check is what stops the owner's words from being matched inside a longer word. The worker's final message names exactly this example ("ok" does not match "look"), but no test uses it. The only boundary row, "Looking good, gopher", is also rejected by the word-end check, so it doesn't test the word start. At the tip, a probe calling `proof(dir, "ok", 0)` on a message "look" correctly refuses. The behavior is there; no test protects it.

## Notes
- (security) `packages/orchestration/src/decision-proof.ts:31`: the words aren't checked against `--decided`, so an attacker can quote just the id or one punctuation mark. A probe on the owner's message "AR-D12 no, do not merge — what is this?" returned proof `2` for the words `AR-D12`, `—` and `no` with the id required. A steered coordinator can therefore record a high-impact "yes" from his "no". The only thing that would reveal it is the notice, which shows the words, not his whole message.
- (risk) `packages/orchestration/src/decision-proof.ts:29`: `[file, <mime>] (<path>)` lines (the path holds the sent file's name) and voice/audio/video transcripts are part of the message text. They count as "his words" like typed text.
- (minor) `test/structure.test.ts:42`: the orchestration line budget goes from 2764 to 2829. This raise has to appear in the merge's `outcome.md`.

## Checks run on d72fa5ad
- `npm run check`: tsc reported no errors.
- `npm test`: exit 0. 1675 tests: 1611 pass, 0 fail, 64 skipped (458 s). None of the changed files is yellow or red. The two `decisions.test.ts` failures the worker saw once in an earlier run did not happen here.
- `npm run mutate`: 25 mutants, 25 caught, 0 survived; 131 not run.
- Hand mutations, each restored with `git checkout -- <file>`; the tree was clean afterwards:
  - **Caught:**
    - In `decision-proof.ts`:
      - the `box === "answered"` check removed
      - `asked + 1000` changed to `asked`
      - the forward check removed
      - the word-end check removed
      - the `i` flag removed
      - the `\s*` join removed
    - In `decision-writes.ts`:
      - `picked === 1` changed to `true`
      - the budget id rule removed
      - the notice disabled
    - In `decision-use.ts`: the `message === undefined` refusal disabled.
    - In `silent.ts`:
      - the shell `--recommend` refusal disabled
      - the phone grant's bound refusal disabled
      - `"decision"` removed from the notices silent mode lets through
  - **Survived:** removing the word-start lookbehind in `decision-proof.ts:10` (finding 2).
- Probe script calling `proof()` on a temporary inbox: the outputs are quoted in finding 2 and the first note.

FAIL