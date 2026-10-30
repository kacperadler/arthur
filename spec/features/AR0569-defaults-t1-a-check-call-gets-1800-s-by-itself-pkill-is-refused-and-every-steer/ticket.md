# AR0569 - Defaults T1: a check call gets 1800 s by itself, pkill is refused, and every steer is an event

```json
{
  "id": "AR0569",
  "title": "Defaults T1: a check call gets 1800 s by itself, pkill is refused, and every steer is an event",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T1: P1, P3, P22's job-steered event. The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

A check command with no timeout or a short one runs with 1800 s; `pkill` and `killall` are refused by the guard wherever it finds a verb; `arthur steer` and `arthur continue` emit `job-steered` (`{ id, kind, text, via: steer|continue }`).

- Kind: feat

## Done means

- In `checks.test.ts`, a check call with no timeout runs with 1800, one at 2400 keeps 2400, and any other command is unchanged; `fake-agent.ts` applies the last returned `input`, as omp does.
- One real-omp job shows the 1800 s value took effect (the plan's first Risk), in the final message.
- New rows in `worktree-guard.test.ts` refuse `pkill` and `killall` (through `bash -c`, `eval` and `sudo` too); `kill <pid>` still passes.
- A test that `steer` and `continue` emit `job-steered`.
- Deleted: `packages/core/roles/worker.md:19`, the 1800 s line in `spawn.md`.
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (core +4, core/testing +3, delivery +3), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/src/checks-extension.ts`, `packages/core/src/fake-agent.ts`, `packages/core/src/worktree-guard.ts`, `packages/core/src/jobs.ts` or `job-commands.ts`, `packages/core/roles/worker.md`, `packages/core/docs/commands/spawn.md`, their tests, `test/structure.test.ts`.

Out:
- Anything of another of the plan's tickets.
- The Landlock signal scope (needs Linux 6.12; the plan's Option 1).

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)
