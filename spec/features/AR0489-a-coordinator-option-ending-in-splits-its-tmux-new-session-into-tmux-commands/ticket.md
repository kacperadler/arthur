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

Close F8 of AR0403 (severity low): a config value or an environment value with a trailing `;` makes the coordinator's start fail or run a tmux command of that value's choosing. The config is the owner's file, so the reach is a hand-edit's mistake more than an attacker's.

- Kind: security

## Done means

- The fix the security review suggests, or one that closes the same gap with less code:
  > escape a trailing `;` as `\;` in each argument `supervise` passes to `tmux new-session`, or refuse such a value in the option checks; a test with `model: "x;"`.
- A test that fails before the change and passes after it, for the case the Description reproduces.
- The project's checks pass.

## Scope

In:
- `packages/orchestration/src/coordinator.ts`
- `packages/orchestration/src/orchestration-options.ts`

Out:
- Other findings of AR0403: their own tickets (AR0482 to AR0489).

## Decisions

- 2026-10-27: Source: F8 of AR0403
- 2026-10-28: Raise the orchestration line budget from 2430 to 2434 for AR0489; by recommendation under AR-D271; the owner: "Idz z wszystkich rekomendacjow i nie pytaj mnie (AR-D271, voice note)" (AR-D275)
