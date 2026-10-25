# AR0383 - Review 1

- Job: 2026-10-25-review-ar0383-git-file-c-c324cf02
- Branch: h/2026-10-25-ar0383-git-file-commondi-a61177b8
- Commit reviewed: 9bbb523ac93dd93b0e85d43dde3006841b8c30b1
- Verdict: PASS

## Final message

Findings: none that block merge.

Notes (non-blocking):
- Ticket's Done means explicitly scoped the fix to the literal `.git`/`commondir`-name rule only ("out: anything short of the sandbox"); the worker went further and added link-following detection (`git-link.ts`). This is disclosed prominently in the final message and recorded as a Decision in `ticket.md` ("Coordinator (free hand on Arthur...) kept the wider rule"), matching this repo's established convention for workers self-recording free-hand scope/budget decisions (seen identically in dozens of other tickets, e.g. AR0241, AR0242, AR0250). Technically justified: the literal-only rule leaves a gitfile of any other name wide open, demonstrated by a working probe. Accepted as consistent with project norms, not a scope violation.
- Disclosed limit (F1, open): a `.git`/`commondir` link made and used within the same bash call still bypasses the guard (static file read at judge time); honestly documented in `findings.md`, the big comment in `worktree-guard.ts`, and `docs/deploy.md:34`. Consistent with "not a sandbox" framing; real fix deferred to AR0329.
- Forged `.git` pointing at another job's worktree repo folder (`<root>/.git/worktrees/<id>`) is refused but mis-named "the main checkout" rather than "another job's worktree" — cosmetic, disclosed by worker, no security effect (write still refused).
- `worktree-guard.ts` is now exactly at the 200-line budget; tight but compliant.

Checks run (in this worktree, against `df0d0004..9bbb523a`):
- `npm ci`: clean, 22 packages.
- `npm run check`: no errors.
- `npm test`: 1088/1088 pass, 0 fail — matches worker's claim exactly.
- Isolated `packages/core/test/worktree-guard.test.ts`: 11/11 pass, including the new test with 26 refused + 10 passing cases (counted directly in the test source) and the 5-link "moves main for real" loop.
- Reproduced worker's mutation claims directly (throwaway edits, restored via `git checkout --`/backup afterward, `git status --short` clean at the end):
  - Dropping `"init"` from `WRITES_CHECKOUT`/`WRITES_OPERANDS` in `git-writes.ts` → new test fails (`git init --separate-git-dir=<root>/.git ...` passes when it should refuse).
  - Removing the back-check in `git-link.ts` (the `gitdir`-points-back exemption for `git worktree add`) → breaks normal worktree use: "a job of Arthur's own repository still builds a plugin..." and the new link test both fail, each job's own worktree wrongly refused as "the main checkout".
  - Removing `[place.worktree, ""]` from the `places` list in `worktree-guard.ts` → 8/11 tests fail exactly as the worker's table claims; every job's own worktree gets mis-matched against `place.worktrees` and refused as "another job's worktree" — confirms this entry is load-bearing, not cosmetic.
- FIFO probe: `mkfifo .git` then `linkedFolders` on its parent — 0 ms, no hang (uses `statSync().isFile()` before any read).
- Verified git-link.ts/git-writes.ts/worktree-guard.ts line deltas (`git diff --numstat`: +44/+1/+0) sum to the claimed core budget raise 6021→6066 (+45), reflected correctly in `test/structure.test.ts`.
- Verified `docs/deploy.md:34` and `findings.md` F1 line/content match the worker's description; findings.md boilerplate matches the project's existing template exactly (diffed against AR0092's).
- Confirmed `git-link.ts` and `worktree-guard.ts` are consistently absent from delivery's `ALWAYS_REVIEW` list, same as before this diff (`job-place.ts`, `git-writes.ts`) — no inconsistency introduced.
- `git status --short`: clean after review (no residual throwaway edits).

PASS
