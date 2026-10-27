# AR0483 - The coordinator, the agent that reads the most outside text, runs with no sandbox and no worktree guard

```json
{
  "id": "AR0483",
  "title": "The coordinator, the agent that reads the most outside text, runs with no sandbox and no worktree guard",
  "date": "2026-10-27"
}
```

## Description

F2 of AR0403 (spec/features/AR0403-security-review-of-our-own-code-part-2-injection-into-shell-git-ssh-and-tmux-and-prompt-injection/findings.md).

- Kind: security
- Severity: high
- Found by: 2026-10-27-worker-999ff80a (worker), 2026-10-27
- Where: `packages/orchestration/src/coordinator.ts:115-121` (`omp --auto-approve`, every tool, extensions env-guard, inbox and context only), `docs/deploy.md:31`, `:42`, `:45`
- Input: the same text as F1, which reaches the coordinator as quoted messages, tool output and its system prompt (F4).
- Why the check misses it: the job sandbox (AR0376) and the worktree guard bind jobs only; AR0329's owner decision of 2026-10-23 keeps the coordinator outside the sandbox, since it turns plugins on in `arthur.config.ts` and restarts. Every gate of the CLI (`arthur merge`'s review and checks, the decision id) is a convention the coordinator's own bash can step around. The stray-commit check (`docs/deploy.md:42`) sees a commit on main only at the next `arthur merge`, after a push already reached origin, and its way out, `take-main --decision`, is F1's. `arthur send` reads any file Arthur's user can read (`packages/telegram/src/media-out.ts:28-41` checks size and kind only).
- What: a steered coordinator can `git merge` and `git push` a branch in a main checkout without `arthur merge`, write Arthur's install or another project's checkout, read `~/.ssh` into its transcript, or send any readable file to the channel. `docs/deploy.md:45` describes outside text steering a job; it does not say the coordinator is the one agent whose prompt is the only bound.
- Suggestion: give the coordinator a bound of its own that keeps the AR0329 decision: load the worktree guard in the coordinator with its places (Arthur's install, every main checkout but its board files, `~/.ssh`, `~/.config/systemd`, Git config) and refuse `git push`, `git merge`, `git reset` and `git update-ref` on a main branch from its tool calls, so only `arthur merge` moves main; longer term, run the coordinator under Landlock writing only its folder, Arthur's home and the config folder, and have `arthur run` perform merges and pushes on its request. Say in `docs/deploy.md` that the coordinator's prompt is its only bound until then. Which of these is wanted is a decision for the owner.

## Goal

Close F2 of AR0403 (severity high): a steered coordinator can `git merge` and `git push` a branch in a main checkout without `arthur merge`, write Arthur's install or another project's checkout, read `~/.ssh` into its transcript, or send any readable file to the channel. `docs/deploy.md:45` describes outside text steering a job; it does not say the coordinator is the one agent whose prompt is the only bound.

- Kind: security
- Plan: yes

## Done means

- `plan.md` in this folder: the options to close this gap, each with what it costs and what the owner would notice, and a recommendation; the security review's suggestion is one option:
  > give the coordinator a bound of its own that keeps the AR0329 decision: load the worktree guard in the coordinator with its places (Arthur's install, every main checkout but its board files, `~/.ssh`, `~/.config/systemd`, Git config) and refuse `git push`, `git merge`, `git reset` and `git update-ref` on a main branch from its tool calls, so only `arthur merge` moves main; longer term, run the coordinator under Landlock writing only its folder, Arthur's home and the config folder, and have `arthur run` perform merges and pushes on its request. Say in `docs/deploy.md` that the coordinator's prompt is its only bound until then. Which of these is wanted is a decision for the owner.
- No code; `npm test` and `npm run check` pass.

## Scope

In:
- `plan.md` only.

Out:
- Building the chosen option: follow-up tickets after the owner picks.

## Decisions

- 2026-10-27: Source: F2 of AR0403
