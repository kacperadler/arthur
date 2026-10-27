# AR0487 - An `arthur continue` instruction that starts with `-` is an option of `omp`

```json
{
  "id": "AR0487",
  "title": "An `arthur continue` instruction that starts with `-` is an option of `omp`",
  "date": "2026-10-27"
}
```

## Description

F6 of AR0403 (spec/features/AR0403-security-review-of-our-own-code-part-2-injection-into-shell-git-ssh-and-tmux-and-prompt-injection/findings.md).

- Kind: security
- Severity: low
- Found by: 2026-10-27-worker-999ff80a (worker), 2026-10-27
- Where: `packages/core/src/wrapper.ts:88` (the instruction is the last argument, no `--` before it), `packages/core/src/job-control.ts:72`, `:102`
- Input: the instruction of `arthur continue <id> '<instruction>'`, the coordinator's text, which may quote a CI log or a review.
- Why the check misses it: `continueJob` refuses only an empty instruction. Probe with an empty `HOME` (no model reachable): `omp -p --no-session --mode json '--version'` printed `18.3.0` and exited 0; with `--` before it, `omp` took it as a message (`No models available ...`, exit 1).
- What: an instruction such as `--tools=...`, `--hook=<file>`, `--model=<name>` or `--version` changes how the resumed agent runs or ends it at once; one starting with `@` includes a file. The agent still runs in the job's sandbox, so the reach is that sandbox's.
- Suggestion: put `--` before the message in `args` (`wrapper.ts:88`), for the task's `@<record>/task` as well; a test that a continue with `--version` reaches the fake agent as its message.

## Goal

Close F6 of AR0403 (severity low): an instruction such as `--tools=...`, `--hook=<file>`, `--model=<name>` or `--version` changes how the resumed agent runs or ends it at once; one starting with `@` includes a file. The agent still runs in the job's sandbox, so the reach is that sandbox's.

- Kind: security

## Done means

- The fix the security review suggests, or one that closes the same gap with less code:
  > put `--` before the message in `args` (`wrapper.ts:88`), for the task's `@<record>/task` as well; a test that a continue with `--version` reaches the fake agent as its message.
- A test that fails before the change and passes after it, for the case the Description reproduces.
- The project's checks pass.

## Scope

In:
- `packages/core/src/job-control.ts`
- `packages/core/src/wrapper.ts`

Out:
- Other findings of AR0403: their own tickets (AR0482 to AR0489).

## Decisions

- 2026-10-27: Source: F6 of AR0403
- 2026-10-27: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D74)
