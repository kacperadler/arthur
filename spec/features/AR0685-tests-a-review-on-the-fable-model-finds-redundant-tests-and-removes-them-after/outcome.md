# AR0685 - Outcome

- Merged: 2026-11-10, `c957ad44`
- Branch: arthur/2026-11-10-worker-3ef1c02b
- Reviews: review-1.md PASS
- Cost: worker $4.53, reviews $0.67; review rounds 1

## What went in

- `packages/core/test/core-commands.test.ts`: deleted; its one test (`arthur ticket status <id> planned asks the loaded owner…`) duplicated `cli.test.ts` "arthur ticket status <id> planned asks decision.owner…", which fails when `ticket-command.ts:50` skips the ask (shown by hand, `fail 1`).
- `packages/core/test/ticket-command.test.ts`: the planned-decision test and the wrong-usage test removed with their `USAGE` constant; `cli.test.ts:306/:233/:272` hold those cases (by-hand break of `ticket-command.ts:50`: `fail 1`); the `after`/`file` test and `load()` stay.
- `packages/core/test/run.test.ts`: the stale-lock takeover test removed; `lock.test.ts` "a lock of a dead pid, one that names no pid, or one an earlier boot wrote is taken over" fails when `lock.ts:109` never takes over (`fail 1`).
- `packages/core/test/jobs.test.ts`: "two spawns at once get distinct ids, branches and worktrees" removed; `spawn.test.ts` "two arthur spawn processes at once…" fails with a constant draw at `job-record.ts:80` (`fail 1`).
- `packages/core/test/job-records.test.ts`: the prune, stop and continue empty-id tests removed; the kept steer test fails when `job-commands.ts:83` drops `words.includes("")` (`fail 1`).
- `packages/delivery/test/merge.test.ts`: the AR0665 owner-decision merge test removed; `merge-command.test.ts` "after a PASS, a merge asks the owner's decision for itself…" fails when `merge-command.ts:129` asks nothing for a plain merge (`fail 1`).
- `packages/delivery/test/review-wake.test.ts`: the verbatim `review-failed.md` wording test removed with `PROCEDURE` and the `readFileSync` import; the throwaway-template test stays.
- `packages/orchestration/test/context.test.ts`: the 8 `coordinator.md` sentence-regex tests removed; `ROLE` stays for the context test.
- `packages/orchestration/test/morning-report.test.ts`: the 8 `morning-report.md` sentence tests and the `procedure()` helper removed; the registration, no-option and no-schedule tests stay.
- `packages/resources/test/disk.test.ts`: the test asserting `spec/vision.md`/`roadmap.md` quote the refusal string removed.
- `test/outside-text.test.ts`: the fixed role-file list test and the coordinator one-sentence test removed; the per-job-prompt rule test stays and discovers roles by `readdirSync`.
- Counts on this server: `npm test` 1725 tests / 491.8 s before (main's tree), 1696 / 488.3 s after (`074c341f`); CI figures not visible to a job.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1625/1696 passed.

## Left open

- Findings: none; no findings.md on this ticket.
