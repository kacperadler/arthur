# AR0382 - Review 1

- Job: 2026-10-24-review-ar0382-remote-hoo-89c4adf1
- Branch: h/2026-10-24-ar0382-remote-hooks-4f172ca4
- Commit reviewed: b9db78b5133cdd4fb5d8a6c1024e6ceeed0d748c
- Verdict: PASS

## Final message

Worktree clean, no leftover edits.

---

**Findings:** none that block.

**Notes:**
- Finding F1 (push into remote repo still runs a config-named program via `core.alternateRefsCommand`, hooks off) is correctly filed as `open` rather than fixed here — it's a distinct attack surface (arbitrary config key, not a hook) needing `configRefusal`, reasonably deferred to a new ticket.
- The push fix (`job-machine.ts`) wasn't in the ticket's literal Scope bullet, but is within the Goal ("Arthur's git calls in a job's repository... hookless flags there too") and was flagged by the worker and retroactively approved via a Decision line already present in this branch's `ticket.md` (2026-10-25 entry). Properly recorded, not a silent scope creep.
- Budget raise (6017→6021) is justified: diff is net +4 lines (remote-job.ts +3, job-machine.ts +1), matches `--numstat`, comment above `BUDGETS` explains it, Decision line recorded in ticket.

**Checks run (in this worktree, against `413f8d6c4..b9db78b51`):**
- `npm ci`: clean, 22 packages.
- `npm run check`: exit 0, no tsc errors.
- `npm test`: 1087 tests, 1087 pass, 0 fail — matches worker's claim exactly.
- `node --test packages/core/test/machine.test.ts`: 32/32 pass, including the new test.
- Mutation 1 (`git()` helper in `remote-job.ts` without `HOOKLESS`): new test fails, `fsmonitor` ran — matches worker's table.
- Mutation 2 (`update-ref` without `HOOKLESS`): new test fails, `reference-transaction` ran — matches.
- Mutation 3 (push without `--receive-pack=…`): new test fails, `pre-receive`/`update`/`post-receive`/`post-update`/`reference-transaction` all ran — matches.
- Restored all three mutations; `git status --short` clean; reran `machine.test.ts` 32/32 pass.
- Verified `docs/commands/remote-job.md` is the live `--help` text (ran `arthur remote-job --help`), new sentences present under `repo` and `prune`.
- Confirmed `findings.md` is new on this branch (absent from `main`), `remote-job.ts`/`job-machine.ts` stay at 158/164 lines (well under the 200-line file cap).

PASS
