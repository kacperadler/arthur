# AR0376 - Review 1

- Job: 2026-10-25-review-ar0376-job-sandbo-682427ba
- Branch: h/2026-10-24-ar0376-job-sandbox-retry-6b3fc3f2
- Commit reviewed: 6df481e8d0e3cf4679f101b6018ce6e31102eeae
- Verdict: PASS

## Final message

Clean. Final assessment.

**Checks run:**
- `npm ci`: clean, 22 packages.
- `npm run check`: `tsc` reports no errors.
- `npm test`: 1104/1104 pass, 0 skipped, 0 failed (213.8s) — matches worker's claim; sandbox tests actually ran (not skipped) since this host's kernel has Landlock ABI 4.
- Line counts: `wc -l packages/core/src/*.ts` = 6505 total, minus `testing.ts`+`fake-agent.ts` (349) = 6156, matching `BUDGETS.core` in `test/structure.test.ts` and the ticket Decision (6081→6156). `wrapper.ts` and `worktree-guard.ts` each exactly 200 lines. `job-sandbox.ts` is 75 lines, matching the recorded +75.
- `git diff main -- packages/core/src/worktree-guard.ts`: empty — confirms worker's claim the file matches main exactly after merge.
- No leftover `<<<<<<<`/`=======`/`>>>>>>>` conflict markers anywhere.
- Mutation tests (throwaway edits to `job-sandbox.ts`, restored after each, `git status` clean at end):
  1. No-op the seccomp `prctl` install → "in the sandbox a Unix socket is refused..." test fails (socket connects instead of EACCES). Caught.
  2. Add `"hooks"` to the repository's writable-paths list → both the `writable()` unit test and the end-to-end job test ("Git hooks written" vs expected "refused") fail. Caught.
  3. Invert `probe.status === 0` check (success/failure swapped) → the "without python3... the agent runs as it is" fallback test fails (sandboxed command returned instead of bare agent). Caught.
- Traced `note()` (passed into `sandboxed()`) to `wrapper.ts`'s `note`, which appends to the job's `log` file unconditionally on every branch (`sandbox: ...` or `no sandbox: <why>; ...`) — no silent fallback path exists.
- Confirmed writable set in code and in the dedicated `writable()` test: worktree, record, `.git/worktrees/<id>`, `objects`, `refs`, `logs`, `$TMPDIR`, `/dev`, `~/.omp`, per-extension plugin dirs; `.git/config` and `hooks` are excluded (and explicitly asserted refused in the integration test).
- `scope.test.ts`'s rework of the `oom_score_adj` reset (moved from the sandboxed fake-agent script to the unsandboxed test driver) is a sound adaptation: that reset is test-fixture-only determinism logic (disambiguating which process the kernel OOM-killer targets), not production code, and real `/proc` writes from inside the sandbox are now correctly blocked by Landlock — exactly the behavior under test elsewhere.
- Decision entries, findings.md (F1, accepted per review focus), and docs (`docs/deploy.md`, `packages/core/docs/commands/spawn.md`) all match the implementation and the ticket's Done-means/Decisions; no scope creep beyond the ticket and its follow-ups.

**Notes (non-blocking):**
- F1 (tmux/Unix-socket tests fail when run from inside a sandboxed job) is an open, clearly documented finding with a correct workaround path (`arthur merge` runs checks outside the sandbox); accepted per the review's stated focus.

No findings that block merge.

PASS
