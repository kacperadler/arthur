# AR0482 - The coordinator writes the owner's answer itself, so every decision-gated step is its own word

```json
{
  "id": "AR0482",
  "title": "The coordinator writes the owner's answer itself, so every decision-gated step is its own word",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0403 (spec/features/AR0403-security-review-of-our-own-code-part-2-injection-into-shell-git-ssh-and-tmux-and-prompt-injection/findings.md).

- Kind: security
- Severity: high
- Found by: 2026-10-27-worker-999ff80a (worker), 2026-10-27
- Where: `packages/orchestration/src/decision-log.ts:180-191` (`answer`), `packages/orchestration/src/decision-use.ts:38-42` (what `decision.owner` accepts), `packages/orchestration/src/decision-commands.ts:64-66` (the only refusal: inside a job), `:92` (a class answers by policy), `packages/delivery/src/take-main.ts:55`, `packages/delivery/src/merge-command.ts:106`
- Input: any outside text the coordinator reads and is steered by: a job's final message, a GitHub review body, a CI log from `arthur ci`, a YouTrack issue, a project's vision (F4).
- Why the check misses it: `arthur decision answer <id> --decided ... '<words>'` is run by the coordinator itself; `answer` checks only that the words are not empty and do not start with "by policy", and `decision.owner` passes any answer not given by policy. Nothing ties the answer to a `[via <channel>]` message. The core's own test asks and answers from one caller in two calls and the gate passes (`packages/orchestration/test/decision-use.test.ts:53-55`; `node --import @arthur/core/testing --test packages/orchestration/test/decision-use.test.ts`: 4 pass, 0 fail). A class the coordinator proposes and answers `--picked 1` answers every later question of its kind (job, question, plan, review) by policy.
- What: a steered coordinator runs `arthur decision ask --kind merge --ticket <id>`, answers it, then `arthur merge <job> --unreviewed --decision <id>`, `--budget 0 --decision <id>`, or `arthur take-main --decision <id>`; the decision log then shows the owner's word he never gave. `arthur ticket status <id> planned`, `arthur spawn` and `arthur merge` after a PASS have no owner check at all (`packages/orchestration/roles/coordinator.md:85` is the only bound).
- Suggestion: record the owner's answer where his message arrives, not from the coordinator's shell: the inbox keeps each `[via <channel>]` message with a number, and `decision answer` must name one (`--message <n>`) whose text holds the words given, else it refuses; or a phone command (`/answer AR-D12 <words>`) the channel plugin records without the model. Out: the policy classes themselves, except that approving one needs the same proof.

## Goal

Close F1 of AR0403 (severity high): a steered coordinator runs `arthur decision ask --kind merge --ticket <id>`, answers it, then `arthur merge <job> --unreviewed --decision <id>`, `--budget 0 --decision <id>`, or `arthur take-main --decision <id>`; the decision log then shows the owner's word he never gave. `arthur ticket status <id> planned`, `arthur spawn` and `arthur merge` after a PASS have no owner check at all (`packages/orchestration/roles/coordinator.md:85` is the only bound).

- Kind: security
- Plan: yes

## Done means

- `plan.md` in this folder: the options to close this gap, each with what it costs and what the owner would notice, and a recommendation; the security review's suggestion is one option:
  > record the owner's answer where his message arrives, not from the coordinator's shell: the inbox keeps each `[via <channel>]` message with a number, and `decision answer` must name one (`--message <n>`) whose text holds the words given, else it refuses; or a phone command (`/answer AR-D12 <words>`) the channel plugin records without the model. Out: the policy classes themselves, except that approving one needs the same proof.
- No code; `npm test` and `npm run check` pass.

## Scope

In:
- `plan.md` only.

Out:
- Building the chosen option: follow-up tickets after the owner picks.

## Decisions

- 2026-10-27: Source: F1 of AR0403
