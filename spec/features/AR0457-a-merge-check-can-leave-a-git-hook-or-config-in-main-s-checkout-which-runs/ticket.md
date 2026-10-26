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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-26: Source: F4 of AR0449
