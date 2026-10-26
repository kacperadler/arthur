# AR0457 - A merge check can leave a git hook or config in main's checkout, which runs outside the sandbox at the next git call

```json
{
  "id": "AR0457",
  "title": "A merge check can leave a git hook or config in main's checkout, which runs outside the sandbox at the next git call",
  "date": "2026-10-26"
}
```

## Description

F4 of AR0449 (spec/features/AR0449-the-install-at-a-job-start-and-the-merge-checks-run-branch-code-outside-the/findings.md).

- Kind: security
- Found by: 2026-10-26-review-47ad9a71 (reviewer), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts:114` (`stepSandbox`), `packages/delivery/src/merge-command.ts:124`
- What: `stepSandbox` makes all of main's checkout writable, its `.git/hooks` and `.git/config` included; the agent's sandbox writes only `.git`'s objects, refs and logs. The reviewer ran a throwaway script: a step in a set-up sandbox wrote `.git/hooks/post-commit` and set `core.fsmonitor`, exit 0, both still there after; `git reset --keep` after a failed check does not undo them. The owner's next own `git status` or `git commit` in that checkout runs the planted code outside any sandbox, where it reads `arthur run`'s environment and the env file. Where `core.home` or `arthur.config.ts` sit inside the checkout, the step can write those too.
- Suggestion: give each merge step the agent's write rules for `.git` (objects, refs, logs only), and the checkout's files outside `.git` minus Arthur's own home and config. Out: the git-config limit `docs/deploy.md` already names for jobs.

## Goal

A merge's checks run branch code; since AR0449 they run in a sandbox, but `stepSandbox` (`packages/core/src/job-sandbox.ts:114`) makes all of main's checkout writable, `.git/hooks` and `.git/config` included. A step can plant a hook or a `core.fsmonitor` that the owner's next own git call in that checkout runs outside any sandbox, with the env file readable. The agent's sandbox already writes only `.git`'s objects, refs and logs (`writable` in the same file).

- Kind: security

## Done means

- Each merge check step can write the checkout's files outside `.git`, and in `.git` only what a build or test needs (objects, refs, logs, index), never `.git/hooks`, `.git/config` or `.git/info`; Arthur's own home and `arthur.config.ts`, where they sit inside the checkout, are not writable either.
- A test in the delivery or core suite: a step in a set-up sandbox that writes `.git/hooks/post-commit` and runs `git config core.fsmonitor ...` fails with a permission error, and neither file changed after; a step writing an ordinary file in the checkout still works. Skipped, as the other Landlock tests, where the sandbox cannot be set up.
- The ticket's checks pass; `docs/commands/merge.md` and `docs/deploy.md` name what a step may write.

## Scope

In:
- `packages/core/src/job-sandbox.ts` (`stepSandbox`): the writable paths.
- `packages/core/test/sandbox.test.ts` or `packages/delivery/test/merge-checks.test.ts`: the test.
- `packages/delivery/docs/commands/merge.md`, `docs/deploy.md`.

Out:
- The shared package caches: AR0454.
- The install's write to the job record: AR0458.

## Decisions

- 2026-10-26: Source: F4 of AR0449
- 2026-10-26: Raise the core line budget by what the fix needs, without asking the owner; pre-approved by policy (AR-D63)
