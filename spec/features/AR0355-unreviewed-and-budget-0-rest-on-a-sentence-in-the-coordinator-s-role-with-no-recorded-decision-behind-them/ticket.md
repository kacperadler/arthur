# AR0355 - `--unreviewed` and `--budget 0` rest on a sentence in the coordinator's role, with no recorded decision behind them

```json
{
  "id": "AR0355",
  "title": "`--unreviewed` and `--budget 0` rest on a sentence in the coordinator's role, with no recorded decision behind them",
  "date": "2026-10-23"
}
```

## Description

`arthur merge <job> --unreviewed` lets a branch with no PASS, or a FAIL, into main (`merge.test.ts:142`), and `arthur spawn … --budget 0` or `arthur continue … --budget 0` starts a job that no cost stops (`limits.test.ts:72`, `:152`), for whoever runs the line: the coordinator acting on a message that only reads as the owner's (AR0322), or a job (F1). The decision log (`arthur decision`) records the owner's answers with an id, but neither flag asks for one; `plans.ts:82-88` shows the shape of such a check and applies it to pre-approved tickets only.

## Goal

`--unreviewed` and `--budget 0` need a recorded owner decision (its id), checked by the command, not only a sentence in the role; tested.

- Kind: risk

Evidence:
- `packages/delivery/src/merge-command.ts:35`, `:82` (the flag taken as given; the message says "on the owner's word only"); `packages/core/src/flags.ts:6` and `packages/core/src/job-limits.ts:27-28` (`0` is no limit), `packages/core/src/spawn-command.ts:42`, `packages/core/src/job-commands.ts:34-36` (a continue's `--budget`); `packages/orchestration/roles/coordinator.md:25`, `:81`; the one check of its kind, `packages/orchestration/src/plans.ts:82-88`, holds a pre-approved ticket's worker to its recorded budget until an owner's line under its Decisions
- Found by: 2026-10-23-ar0323-security-check-4d9a06d2 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: `--unreviewed` and `--budget 0` (on a paid model; a free model's 0 stays, `jobs.ts:164`) take a decision id, `--decision <id>`, that `arthur decisions <id>` answers as the owner's, answered not by policy, for this job's ticket (or this job, for one without a ticket), and unused by an earlier merge or spawn; refused without one, naming the ask to make: `arthur decision ask --kind merge --question …`. Tests in `merge.test.ts` and `spawn.test.ts`: refused without the flag, with an unknown id, with a policy answer, with another ticket's id, with an id already used; the merge goes in and the spawn starts with the owner's. `docs/commands/merge.md`, `spawn.md`, `continue.md` and `coordinator.md:25` say so. Out: the hand-written review task and the PASS of another tip (AR0324, AR0311 F6).
- `npm test` and `npm run check` pass.

## Scope

In:
- `--unreviewed` and `--budget 0` (on a paid model; a free model's 0 stays, `jobs.ts:164`) take a decision id, `--decision <id>`, that `arthur decisions <id>` answers as the owner's, answered not by policy, for this job's ticket (or this job, for one without a ticket), and unused by an earlier merge or spawn; refused without one, naming the ask to make: `arthur decision ask --kind merge --question …`. Tests in `merge.test.ts` and `spawn.test.ts`: refused without the flag, with an unknown id, with a policy answer, with another ticket's id, with an id already used; the merge goes in and the spawn starts with the owner's. `docs/commands/merge.md`, `spawn.md`, `continue.md` and `coordinator.md:25` say so. Out: the hand-written review task and the PASS of another tip (AR0324, AR0311 F6).

## Decisions

- 2026-10-23: Source: F3 of AR0323
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
