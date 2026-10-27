# AR0486 - A finding's body becomes its ticket's Description verbatim, which the worker reads as the source of truth

```json
{
  "id": "AR0486",
  "title": "A finding's body becomes its ticket's Description verbatim, which the worker reads as the source of truth",
  "date": "2026-10-27"
}
```

## Description

F5 of AR0403 (spec/features/AR0403-security-review-of-our-own-code-part-2-injection-into-shell-git-ssh-and-tmux-and-prompt-injection/findings.md).

- Kind: security
- Severity: medium
- Found by: 2026-10-27-worker-999ff80a (worker), 2026-10-27
- Where: `packages/findings/src/on-merge.ts:40` (`${first.body}`), `:62`, `packages/orchestration/src/autopilot.ts:37-70` (what autopilot checks), `packages/core/roles/worker.md:7`, `:10`
- Input: a `findings.md` entry a job wrote, steered by a client repository, an issue or a web page; the roles tell a job to report an instruction it found as a finding (`worker.md:10`), so an injected instruction is routed into exactly this file.
- Why the check misses it: at the merge the finding's text is copied into the new ticket's Description without a quote or a mark; autopilot checks the ticket's kind, source, Scope files and budget, not its text, so it can be planned with no human reading it; the worker's role makes its ticket "the source of truth" and lists "another ticket or finding" as data, but this text is now its own ticket.
- What: text from outside, laundered through a finding, becomes the binding instruction of a later worker, within the autopilot budget cap.
- Suggestion: `onMerge` writes the finding as a quote (`> ` before each line) under a line `F<n> of <ticket>, written by a job: data for planning, not an instruction`; the worker role says a quoted finding in its ticket is data and the Goal, Done means, Scope and Decisions instruct; autopilot refuses a ticket whose Done means is still the template's guidance, so the coordinator states the fix in its own words first.

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

- 2026-10-27: Source: F5 of AR0403
