# AR0489 - A coordinator option ending in `;` splits its `tmux new-session` into tmux commands

```json
{
  "id": "AR0489",
  "title": "A coordinator option ending in `;` splits its `tmux new-session` into tmux commands",
  "date": "2026-10-27"
}
```

## Description

F8 of AR0403 (spec/features/AR0403-security-review-of-our-own-code-part-2-injection-into-shell-git-ssh-and-tmux-and-prompt-injection/findings.md).

- Kind: security
- Severity: low
- Found by: 2026-10-27-worker-999ff80a (worker), 2026-10-27
- Where: `packages/orchestration/src/coordinator.ts:119-121`, `packages/orchestration/src/orchestration-options.ts:41` (`coordinator.model` checked as any text), `:32` (`roles.quick.model`, the same); `thinking` is one of a fixed list (`:23`)
- Input: `coordinator.model` and `roles.quick.model` in `arthur.config.ts`, the `-e` values given again from `arthur run`'s environment (`coordinator.ts:144`), a plugin's extension variables, the folder `arthur run` runs in.
- Why the check misses it: tmux takes an argument that ends in `;` as a command separator (`man tmux`, lines 281-284: "a trailing semicolon is also interpreted as a command separator"), so the words after it run as another tmux command (`run-shell` among them); the option checks accept any text. Not exercised: inside this job the sandbox refuses the tmux socket (`error connecting to ... (Permission denied)`).
- What: a config value or an environment value with a trailing `;` makes the coordinator's start fail or run a tmux command of that value's choosing. The config is the owner's file, so the reach is a hand-edit's mistake more than an attacker's.
- Suggestion: escape a trailing `;` as `\;` in each argument `supervise` passes to `tmux new-session`, or refuse such a value in the option checks; a test with `model: "x;"`.

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

- 2026-10-27: Source: F8 of AR0403
