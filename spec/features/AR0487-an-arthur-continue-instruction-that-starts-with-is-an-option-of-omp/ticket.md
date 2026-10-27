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

- 2026-10-27: Source: F6 of AR0403
