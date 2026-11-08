# AR0657 - Review 1

- Job: 2026-11-08-review-2fa6640d
- Branch: arthur/2026-11-08-worker-fb3fd68f
- Commit reviewed: f289565f1db1a165e233970f54b4ab5ac3f65b1e
- Verdict: PASS

## Final message

## Findings

None. The commit (`f289565f docs(AR0657): reviewer leaves out notes findings.md already holds`) changes one line: `packages/delivery/roles/reviewer.md:24`. With `--word-diff`, the only change is the inserted sentence "Read the ticket's `findings.md` on the branch first: what one of its entries already says (the worker's `F<n>`, or an earlier review's) is no note; a note that adds to an entry names its `F<n>` and says only what is new." That sentence sits between the notes-kind clause and "Then the checks you ran". The paragraph now reads word for word as the ticket's After text.

The ticket's Done means asks for two things:
- **A note that only restates an entry is left out.** The sentence says such an entry "is no note".
- **A note that adds to an entry names it and says what it adds.** The sentence says it "names its `F<n>` and says only what is new".

Nothing changed outside the ticket's In. I searched for the old and new wording. It appears only in the ticket itself and in `spec/retro/2026-11-06.{md,html}`, which quote the proposal's Before and After, so no doc still describes the old behavior. What the worker's final message claims (the file, the commit, the check counts, 0 mutants) matches what I saw.

## Notes

- (minor) packages/delivery/roles/reviewer.md:24: Nothing tests the prose. The change is only role-file text, so mutate has nothing to mutate. The ticket itself says a check cannot judge whether a note adds to an entry.

## Checks (on f289565f)

- `npm run check`: `tsc` passed with no errors.
- `npm test`, run twice: the first run's output filter missed the summary lines, so I ran it again for the counts. 1647 tests: 1583 passed, 0 failed, 0 cancelled, 64 skipped (they need a Unix socket, tmux or systemd, which this host doesn't provide). Exit 0. The structure test printed 7 yellow files, none of them touched by this branch.
- `npm run mutate`: `0 mutants, 0 caught, 0 survived`, exit 0. Only prose changed.

PASS