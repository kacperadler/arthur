# AR0668 - Review 4

- Job: 2026-11-10-review-934694ab
- Branch: arthur/2026-11-09-worker-bb08f8e6
- Commit reviewed: 575962011b0a3f4d22aa4afd041bf40f603b707b
- Verdict: PASS

## Final message

## Findings

None block the merge. AR0668's three Done means points hold, and the extra rows the earlier reviews asked for are in:
- **Word rule.** The probe message is `AR-D12 no, do not merge — what is this?`. Each of these quotes is refused as a fragment: `AR-D12`, `—`, `no`, `No,`, `n`, `do`, `AR-D12 —`, `AR-D13 yes`, `A C-D1`, `n o`, `N O,`, `AC-D1 2` and `A C-D12` (the tests' own message uses the id `AC-D1`). The rule also runs on the text the quote matched in his message (`decision-proof.ts:46`).
- **Notice.** It quotes his whole message, redacted, cut after 400 code points with ` … (cut)` (`decision-writes.ts:63-66`). Both sides of the limit are tested, and so is the redaction.
- **File lines.** A file line of any of the six kinds, saved or not saved, never proves his words or the id. A transcript still does, without its path (`decision-proof.ts:15-18`).
- **Docs.** `decision.md`, `coordinator.md` and `take-main.md` are updated. The notice format in `decision.md` matches the code.
- **Worker's claims.** They match what I ran: 1678 tests and 1614 passed, mutate 25/25 with 67 not run, and the seven commits.

## Notes
- (risk) packages/orchestration/src/decision-proof.ts:26: a quote that is the id plus one word passes, so a coordinator steered by outside text can still quote `AR-D12 no` to record a "yes". With the id quoted or not, two words also pass when his message names the id somewhere else: `do not`, `what is`, or `yes, merge it` taken from `AR-D11 yes, merge it\nAR-D12 no`. This is what the ticket's Out allows, so the notice is the only guard. Review-1 raised it as a note, but it is not in findings.md.
- (risk) packages/orchestration/src/decision-proof.ts:16: an audio file's transcript counts as his words, not only a voice note's. Speech in a recording someone else made and he re-uploads can prove an answer: `yes merge it` was proved from an `[audio 30 s] … (/srv/media/x-song.mp3)` line. Review-2 raised it; it is not in findings.md.
- (minor) packages/orchestration/src/decision-proof.ts:17: commit 97e8adb5 makes the file-line mark case-sensitive, and no test covers it. Adding the `i` flag back passes all 43 tests in `decisions.test.ts`, and so does removing `\b`. Both only drop more of the owner's own lines (one typed `[Photo] …` or `[filed …`), which leads to a refusal, never to a false proof.
- (minor) packages/orchestration/src/decision-proof.ts:26: words are counted on `[\p{L}\p{N}]+`. So one word with a combining mark (NFD `não`), an apostrophe (`don't`) or an underscore (`x_y`) counts as two and passes without the id. It is no worse than the id-plus-word case above.
- (minor) test/structure.test.ts:42: the orchestration budget goes from 2829 to 2846. The merge's outcome.md must show the raise. The worker flagged that the coordinator must decide whether it needs the owner's OK.

## Checks (all on 57596201, detached checkout)
- `npm run check`: tsc passed.
- `npm test`: tests 1678, pass 1614, fail 0, cancelled 0, skipped 64.
- `npm run mutate`: "25 mutants, 25 caught, 0 survived; 67 not run (--max 25)".
- Hand mutations, each run with `node --import @arthur/core/testing --test test/decisions.test.ts` in `packages/orchestration` and restored with `git checkout -- src/decision-proof.ts`:
  - **Caught (1 failure each):**
    - the early `fragment(words)` check removed;
    - file lines kept;
    - the transcript's path kept;
    - the matched-text check run on the quote instead of the matched text;
    - the id looked for in the raw text, not the text without file lines;
    - the words matched in the raw text;
    - the id stripping removed.
  - **Survived (0 failures, the minor note):** the `i` flag added to the kind pattern, and `\b` removed from it.
- Throwaway probe in `/tmp/rv-934694ab`, removed afterwards: it called `proof()` on temporary inboxes, and the results are quoted in the notes above.
- After the runs, `git status --short` was empty and no fake agent from this checkout was still running.

PASS