# AR0449 - The install at a job start and the merge checks run branch code outside the sandbox, where it can read the environment of arthur run

```json
{
  "id": "AR0449",
  "title": "The install at a job start and the merge checks run branch code outside the sandbox, where it can read the environment of arthur run",
  "date": "2026-10-26"
}
```

## Description

Two steps run code from a job's branch outside the job's sandbox: the install at a job start (its lifecycle scripts included) and the checks `arthur merge` runs on the merged main (install, `npm run check`, `npm test`). Outside the sandbox that code can read `/proc/<pid>/environ` of `arthur run` and the coordinator, and so their secrets. This ticket puts both inside the same sandbox the agent gets.

## Goal

Evidence: AR0440's plan (`spec/features/AR0440-*/plan.md`, Risks and Open questions): `packages/core/src/job-install.ts` (`install`, called at `wrapper.ts:123` before `sandboxed`) and `packages/delivery/src/merge-checks.ts` (`stepRunner`) run outside the Landlock domain; an unsandboxed child of the same user read its parent's and a sibling's environment in the planner's bare run, while a sandboxed one got `Permission denied` (AR0440's test in `packages/core/test/sandbox.test.ts`). AR0373 put both steps in a systemd scope with caps, which limits CPU, memory and time but not reads.

- Kind: security

## Done means

- The install at a job start runs inside the job's sandbox (`sandboxed` in `packages/core/src/job-sandbox.ts`), with the package managers' caches it needs writable (`~/.npm` and the like, named in `spawn.md`); a test like AR0440's shows an install script reading `/proc/<runner pid>/environ` gets `Permission denied`, and fails when the sandbox is removed from the install.
- Each merge check step runs in a sandbox of its own, writable only in the merge's worktree and those caches; a test shows a step cannot read the environment of the process running the merge, and fails without the sandbox.
- Both sandboxes hide the env file as AR0443's plan does for the agent (the same hidden path, `hidden(record)` in `job-sandbox.ts`): an install script or a merge check reading it gets `Permission denied` (AR-D77).
- Where the sandbox cannot be set up, both steps run as today and say so in one line, as the agent's `no sandbox: <why>` does.
- Docs: `spawn.md` (The sandbox), `merge.md`, `docs/deploy.md` (threat model) say so. `npm run check` and the changed test files pass.

## Scope

In:
- `packages/core/src/job-install.ts`, `wrapper.ts`, `job-sandbox.ts`: the install inside the sandbox.
- `packages/delivery/src/merge-checks.ts`: each step inside a sandbox (through what the core publishes; delivery imports no core file by path).
- Tests and docs above.

Out:
- Jobs as another Linux user, and hosts without the sandbox (AR0440's plan, AR-D64).

## Decisions
- 2026-10-26: AR0449 approved, worked after the short queue (AR-D65); the owner: "AR-D65 - 1" (AR-D71)

