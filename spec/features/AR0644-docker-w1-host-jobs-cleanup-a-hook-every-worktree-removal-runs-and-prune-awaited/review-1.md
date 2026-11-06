# AR0644 - Review 1

- Job: 2026-11-06-review-976f4367
- Branch: arthur/2026-11-06-worker-926f0a0f
- Commit reviewed: fafa3715f70b4e9c4a1f7f1df5cace22a0bdcf55
- Verdict: PASS

## Final message

No blocking findings. The branch does everything W1 of the approved AR0604 plan asks for.

- **Hooks:** `packages/core/src/job-cleanup.ts` runs each plugin's hooks one at a time, in setup order, each limited to 120 s by default. A throw, a rejection or the time limit gives one core `notice` naming the job, the machine and the plugin. Text a hook returns is trimmed and joins the line as `<plugin>: <text>`; empty text is left out.
- **Where they run:** `packages/core/src/job-records.ts:167` and `:173`, inside `prune`. They run after every check that keeps the whole job: not ended, offline, no `root`, moved, planted config. Locally they run right before `git worktree remove`; for a job on another machine, before `arthur remote-job prune`. Their texts stay in the line even when Git or SSH then keeps the job (`:169`, `:176`).
- **Prune awaited:** `prune` and `jobUpkeep.prune` are async and handle jobs one after another. Every caller now awaits them: `job-commands.ts`, `ticket-prune.ts`, `merge-command.ts` and manage's `cleanup.ts`. In `delivery.ts:83`, the drop run after a job ends now catches a rejection and logs it; the `ticket-moved` handler returns the drop's promise (`:96`).
- **Tests:** the plan's "How to test" lines for W1 are all covered:
  - order, text, throw, the time limit at 50 ms, and that a job kept for not having ended or for planted config calls no hook (`job-records.test.ts:163`);
  - a second prune calls the hooks again;
  - a job on another machine, and one whose machine does not answer (`machine.test.ts:766`, `:1231`);
  - the fake host names the plugin (`testing.test.ts:125`).
- **Docs:** `plugin-api.md` has the `jobs.cleanup` row, the `jobs.prune` promise and the AR0644 entry; `prune.md`, README, `arthur.mmd`, `core-and-plugins.mmd`, the roadmap and the vision all agree. A search for `cleanup hook`, `jobs.prune` and `later in the core` found nothing out of date.
- **Budget and boundaries:** the core budget goes from 7239 to 7290 (+51), within the plan's "about +52". No boundary or Shape rule is broken: no class, no barrel, no runtime dependency, and the new file is 32 lines.
- **API changes:** the ticket's Decisions don't record them yet (the worker's F1). The ticket's Goal and AR-D520 approve them, so this doesn't block the merge.

## Notes
- (risk) packages/core/src/job-cleanup.ts:19: A hook past its limit is abandoned but keeps running. Its command keeps going beside the worktree's removal; this is already the worker's F2, and W3 has to limit its own commands.
- (risk) packages/core/src/job-records.ts:173: On another machine, the hooks run before the checks there (moved place, planted config, a worktree with changes). So a job that machine then keeps whole has already lost what the hook cleaned. The plan specifies this order, but it means "a kept job calls no hook" only holds here.
- (minor) packages/core/src/job-records.ts:183: The `keep(job)` refactor survives mutation with no visible effect, as the worker says.

## Checks (on fafa3715)
As instructed, I did not rerun `npm run check`, `npm test` or `npm run mutate`; the worker's results stand. I ran these instead:
- `node --import @arthur/core/testing --test --test-name-pattern="jobs.cleanup" packages/core/test/job-records.test.ts`: pass 1, fail 0.
- Hand mutations, each restored with `git checkout -- <file>`; the worktree is clean afterwards.
  - Hooks moved before the planted-config check: the `jobs.cleanup` test fails (pass 0, fail 1).
  - The `catch` in `prune` drops the hooks' texts: the `machine.test.ts` "cannot reach" test fails (pass 0, fail 1).
  - The `.catch` removed from the drop run after a job ends (`delivery.ts:83`): the `merge.test.ts` "prune that rejects" test fails (pass 0, fail 1). It passes again (1/0) once restored.

PASS