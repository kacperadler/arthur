# AR0572 - Defaults T4: a job with no sandbox refuses to start unless core.jobs.unsandboxed is on

```json
{
  "id": "AR0572",
  "title": "Defaults T4: a job with no sandbox refuses to start unless core.jobs.unsandboxed is on",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T4: P10. The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

When `sandboxed()` reports `no sandbox:`, the job ends `failed: no sandbox: <why>; set core.jobs.unsandboxed: true ...`, unless the new core option `core.jobs.unsandboxed` is on. The spawn passes the option to the wrapper as a record field; the test kit's runner turns it on, so tests on a bare host behave as today. `review.md` gets: "a guard bypass whose write the sandbox refuses is a note; a plain command the base refused and the tip lets through is a FAIL".

- Kind: security

## Done means

- `sandbox.test.ts:161` changes to "refuses unless opted in".
- `arthur doctor` and the refusal name the opt-in.
- `spawn.md:126` rewritten; `docs/deploy.md` and `arthur.config.example.ts` name the option.
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (core +10), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/job-sandbox.ts`, `packages/core/src/core-options.ts`, the job record writer, `packages/core/src/wrapper.ts`, `.agents/arthur/criteria/review.md`, `packages/core/docs/commands/spawn.md`, `docs/deploy.md`, `arthur.config.example.ts`, their tests, `test/structure.test.ts`.

Out:
- Anything of another of the plan's tickets.
- The macOS `sandbox-exec` profile.

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)
- 2026-10-30: AR0572 raised to $14 and continued from where it stopped; the owner: "i have to focus on my work, go with recomendations and do not cross 70% of weekly usage, do to silent mode" (AR-D385)
- 2026-10-30: Raise the core line budget by what the fix needs, without asking the owner; pre-approved by policy (AR-D63)
- 2026-10-30: AR0572 keeps core 6518 as measured (+15, the doctor sandbox line); the review checks the lines; the owner: "i have to focus on my work, go with recomendations and do not cross 70% of weekly usage, do to silent mode" (AR-D387)
