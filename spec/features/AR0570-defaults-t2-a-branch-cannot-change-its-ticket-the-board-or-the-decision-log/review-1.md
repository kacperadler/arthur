# AR0570 - Review 1

- Job: 2026-10-30-review-d67293f2
- Branch: arthur/2026-10-30-worker-0bc169b2
- Commit reviewed: 2a8b570be5def878ead6a8d96c45314547111082
- Verdict: FAIL

## Final message

## Review of AR0570 (branch `arthur/2026-10-30-worker-0bc169b2`): FAIL

A worker branch can still remove an owner's Decision line from main: neither the guard nor `merge.check` stops it. Two key conditions also survive mutation.

### Findings

1. **`packages/orchestration/src/paper-check.ts:15`: a branch with two merge bases changes a ticket, and both layers let it through.**
   - **What's wrong:** `git diff HEAD...<branch>` uses only one merge base when there are several. Since the tip's ticket matches that base's copy, `merge.check` sees no change.
   - **Reproduced in a temporary repo with `paperCheck` on the fake host, normal commit order:**
     1. Main records a Decision in AC0001's `ticket.md`.
     2. Worker C merges a sibling worker's branch X to build on it, then merges main.
     3. C runs `git checkout arthur/x -- spec/features/AC0001-shop/ticket.md`. The guard allows this; I checked with `worktreeRefusal`.
     4. Main merges X.
   - **Result:** `git merge-base --all main arthur/c` gives 2 bases and `merge.check` answers `[undefined]`. After `git merge --no-ff arthur/c`, the same call `arthur merge` makes at `merge-command.ts:136`, main's ticket is `"# AC0001 - Shop\n"`. The owner's Decision line is gone.
   - **Why it matters:** this is exactly the change this security ticket exists to refuse, made through a merge commit on the branch.
   - **Fix:** either refuse when `git merge-base --all HEAD <branch>` gives more than one base, or diff HEAD against `git merge-tree --write-tree HEAD <branch>`, which is what the merge would actually change.
   - **No test covers it:** `paper-check.test.ts` has no merge commit at all.

2. **`packages/delivery/src/review-needed.ts:32`: the mutation `refusals.length > 0` → `refusals.length > 1` survives.**
   - `review-needed.test.ts` passes 8 of 8 with it.
   - The new test only gives two refusing answers at once. A single refusal, which is the real case (only orchestration refuses), is never tested; with this mutant it would be ignored and the review paid for.

3. **`packages/core/src/worktree-guard.ts:34`: dropping the regex's `$` anchor survives.**
   - `worktree-guard.test.ts` still passes 16 of 16.
   - With the mutant, a file such as `spec/features/X/ticket.md.orig` would be refused, and no test has a look-alike with a suffix. The worker reported the `^` anchor as caught but not `$`.

### Notes (not blocking)

- **Guard-only bypasses.** `merge.check` catches each of these on the branch, but the guard lets them through. The worker's summary says "a bash write … is refused", and only `git checkout` and `node -e` were named as exceptions. These also pass the guard; all from my probe through `worktreeRefusal`:
  - `cp -t spec/features/X /tmp/ticket.md`
  - `mv /tmp/ticket.md spec/features/X/`
  - `rsync /tmp/ticket.md spec/features/X/`
  - `rm -r spec/features/X`
  - `mv spec/features/X /tmp/x`
  - `find spec -name ticket.md -delete` and `-exec rm {} ;`
  - `git apply`, `patch -p1 < diff`, `git merge`, `git cherry-pick`, `git reset --hard`
  - `python3 -c`, `tar -xf`, `T=…; echo x > $T`
- **Correctly refused by the guard:** redirects, `sed -i`, `perl -pi`, `dd of=`, `truncate`, `ln -sf`, `install`, `git restore --source`, `git mv`, paths through a symlinked folder, `./`, `../` and `//`, and `cd` followed by a redirect.
- **`findings.md` stays writable:** `write`, `edit` and `>>` all pass.
- **`Ticket.md`** passes both layers. On Linux it is a different file. On a case-insensitive macOS file system the guard would let a write reach the real ticket. [INFERENCE]
- **A tag with the branch's name** wins in both `rev-parse` (`merge-command.ts:90`) and the check's diff. Both look at the same commit, so this is not a bypass.
- **Timing gap in the merge:** `merge.check` reads `job.branch` again at `merge-command.ts:132`, after `tip` was read at line 90 and after waiting on CI. If the branch moved during the merge, the check would judge a different commit than the one merged. [INFERENCE] This needs the job running again in the middle of a merge, and `merge.check` only receives the job, not the commit.
- **Budgets:** the raises are core +2, delivery +3, orchestration +25. AR-D355 allows measured raises, and the structure test passes with them.
- **Scope:** the doc edits outside the ticket's Scope list (`docs/plugin-api.md`, `merge.md`, `review-needed.md`) are the command doc updates the criteria require.

### Checks run
- **`npm ci`, `npm run check` and `npm test`** in one bash call with a 1800 s timeout. `tsc` printed no errors. `npm test` gave tests 1339, pass 1264, fail 0, skipped 75. No `limits.test.ts` failure, so the worker's numbers reproduce.
- **Guard probe:** 35 `worktreeRefusal` calls in a temporary test, results above, then restored.
- **`merge.check` probes:**
  - An evil merge of main back into the branch: refused.
  - A tag shadowing the branch name: answers `[undefined]` and is consistent with the merge.
  - A criss-cross with crafted commit dates: the check answers `[undefined]` and the merge reverts main's ticket.
  - The sibling-merge scenario of finding 1, with normal commit order: same result.
  - All restored afterwards.
- **Mutations**, each restored with `git checkout --`; `git status` is clean:
  - M1, guard `$` dropped: survives (16 pass, 0 fail).
  - M2, `-z` dropped in `paper-check.ts`: caught (1 fail).
  - M3, `> 0` → `> 1` in `review-needed.ts`: survives (8 pass, 0 fail).
  - M4, the ticket path broken in `paper-check.ts`'s regex: caught (1 fail).

FAIL