# AR0573 - Review 1

- Job: 2026-10-30-review-9e7f9abd
- Branch: arthur/2026-10-30-worker-769a85a5
- Commit reviewed: 647f70de76e08c187fb4489a1e6bd65529fd7b8c
- Verdict: PASS

## Final message

I found no blocking issues, so the branch can be merged. The merge now writes `## What went in` one line per file and commits the ticket's side as `spec: <id> merged` before `github.push`. Every Done means point is met, and both checks and all three new or changed tests behave as the worker says.

## Findings

None that block the merge.

## The points you asked me to check

**1. Only tickets that `findings.onMerge` makes go in the commit.**
- `merge-outcome.ts:79` takes the board's ids before and after the merge and adds the folders of the new tickets only.
- **Yes, `spec/build.json` can then name a ticket folder that is not committed.** The new What went in test proves it: a ticket made before the merge ends up listed in the committed `spec/build.json`, while its folder stays untracked (`?? <folder>/`).
- After `github.push`, origin has a board entry whose `ticket.md` is not in that commit, until the coordinator commits the ticket. `coordinator.md` already says to commit the ticket and the board before a spawn.
- Nothing breaks because of it:
  - The main checkout still has the folder on disk.
  - CI's `test/ticket-kinds.test.ts` finds tickets by globbing `spec/features/*/ticket.md`, not by reading the board.
  - The plan's Risks accept that the commit takes in the coordinator's uncommitted board moves.
- The other way would put the coordinator's half-written planning ticket into another ticket's `spec:` commit. The worker's choice is the safer one, so this is a note, not a FAIL.

**2. The session evals and the dropped coordinator push.**
- The plan's Files list names `packages/session/evals/*` for T5. Those evals also had to change, because `scenarios.test.ts` requires every merge stub's output to end with the current `after-merge.md`.
- The `after-merge.md` step that told the coordinator to `git push` is gone, and the stub's merge output prints `nothing pushed: no plugin provides github.push`. So expecting `origin:refs/heads/main` to move would now be wrong; dropping it is right.

**3. Hooks off, after the identity and config checks.**
- `settleTicket` gets the merge's own git (`core.hooksPath=/dev/null`, `core.fsmonitor=false`, `--no-replace-objects`), from `merge-command.ts:162`.
- The identity check runs before `git merge`, and `configRefusal(root)` is asked again right before `git add` (`merge-outcome.ts:82`).
- The commit is `git commit -- <paths>`, so anything the owner staged elsewhere stays out of it.

**4. A failed commit.** It only logs `spec: <id> merged not committed: <why>; commit <paths>`. The merge stays in, and `after-merge.md` step 3 tells the coordinator what to do with that line.

## Notes (non-blocking)

- The eval stubs (`delivery/evals/{merge,review-pass}`, `session/evals/*`) print `committed spec: … merged: <hash>`, but the eval stub (`eval-stub.ts`) only writes files and never commits them. In `review-pass`, `refs/heads/main: moved` is now met by the coordinator's own commit when it files the review, not by the merge.
- A gitignored path in the list (for example a project that ignores `CHANGELOG.md`) makes `git add` fail. That case ends in the `not committed` line, which is safe.
- In `wentIn`, `--no-renames` lists both paths of a renamed file. That matches `worker.md`'s "deleted ones included".

## Checks I ran

- **Full suite:** `npm ci && npm run check && npm test` in one call, timeout 1800 s. tsc was clean; 1343 tests, 1281 passed, 0 failed, 62 skipped, which matches the worker's numbers. No `limits.test.ts` failure, so it did not need a separate run.
- **Base vs tip:** I put the base's `merge-outcome.ts` and `merge-command.ts` back and ran three tests: the main merge test, "What went in…" and "a key that may name a program…". All three failed on the base; on the tip they pass in the full suite.
- **Mutations:** I broke each behaviour once and ran its test; each was caught, and I restored every file with `git checkout`:

| What I broke | Test that failed |
|---|---|
| config check before the commit skipped (`refusal = ""`) | the config test |
| commit run with a plain git, hooks on | "the review's checkout and the merge run no hook and no fsmonitor…" |
| every board ticket's folder committed (the before/after filter removed) | What went in test |
| `not described` lines removed | What went in test |
| the section no longer ending at the next heading | What went in test |
| failed commit throws instead of logging | the config test |
| fallback to commit subjects removed | main merge test |

- **Sizes:** `merge-command.ts` is 199 lines and `merge-outcome.ts` 107. The structure test passes with the delivery budget at 1762, the raise recorded in AR-D355.
- The working tree is clean after all of the above.

PASS