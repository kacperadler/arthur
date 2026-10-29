# AR0562 - arthur repeats and /repeats: what the owner decides again and again and what agents keep hitting, and a decisions retro

```json
{
  "id": "AR0562",
  "title": "arthur repeats and /repeats: what the owner decides again and again and what agents keep hitting, and a decisions retro",
  "date": "2026-10-29"
}
```

## Description

The owner, 2026-10-29: "after our decisions, at this point there is more than 250 AR decisions, what are the most common issues my agents run into while working and what are the decisions that repeat often. Go through history, decisions, tasks on this project and check, create maybe a command or skill for this for the future. I want two new commands, the one from the post that will check other codebases and projects and another for this retro, to trigger them by conversation or by slash command."

The first analysis was done by hand: `spec/features/AR0561-*/audit/decisions.md`. 335 decisions: 85 answered by policy, 86 under a standing "go with your recommendation" grant, 145 by the owner, who took the recommendation 96.4% of the time. The shapes that repeat: merge after PASS 96, line-budget raise 52, approve as written 44, second FAIL 31 (28 "another round"), queue order 23. The class mechanism misses them: `class propose` is only used when the coordinator notices a repeat (4 proposals in 335 decisions), matches the coordinator's own words (12 misses, 1 false match), and needs identical decided texts. The retro has never run, never reads the decision log, and may not propose code.

## Goal

The owner asks "what repeats?" from a channel or the terminal and gets, without a model, the repeated decision shapes, the grants, his overrides and the recurring issues of a project, with a ready `class propose` line for each repeat a class can hold; and "a decisions retro" turns that into proposals through the existing retro.

- Kind: feat

## Done means

- `arthur repeats [--project <name>] [--since <date|decision id>]` prints a Markdown digest, read-only and without a job:
  - decisions by kind and by who answered (policy, standing grant, owner, closed);
  - repeated shapes (kind plus normalised options, else the question's first words), each with 3 or more asks: count, picks, agreement with the recommendation, example ids, the class that covers it, and either a ready `arthur decision class propose ...` line or why no class fits ("decided texts differ", "picks split: a code default");
  - standing grants and the answers under each; the owner's overrides of the recommendation;
  - recurring issues from ticket history: findings-to-ticket chains, tickets with 2 or more FAILs, blocked-on-user questions by cause, budget raises per package, drops by source.
- `/repeats` sends the same digest as a page in the report style (black and white, blue accent, red only for what matters); `/repeats retro [<focus>]` and `arthur repeats --retro ['<focus>']` start the existing retro kind with the digest in its prompt; `/retro` alone never starts a job.
- The retro's prompt gets the digest of its period; its role and criteria may propose a policy class (`Kind: class`, filed as an ask naming its agreement rate, never a ticket) or a code default as a ticket, for a decision answered the same way 3 or more times.
- The coordinator role has one line: when the owner asks what repeats or for a decisions retro, run these.
- orchestration provides the parsed decision log (`decision.entries`) so manage parses it once.
- Tests over a fixture log that holds a false class match, a grant and an override; the digest of this repository's own log reproduces the counts of the hand analysis.

## Scope

In:
- `packages/manage/src/repeats.ts`, `repeats-command.ts` (new), `retro.ts`, `roles/retro.md`, `roles/coordinator/retro-ended.md`, `docs/commands/repeats.md` (new), `docs/manage.md`, `test/repeats.test.ts` (new).
- `packages/orchestration/src/` (`decision.entries`), `roles/coordinator.md` (one line).
- `.agents/arthur/criteria/retro.md`.
- Line budgets: manage about +190, orchestration about +5.

Out:
- Changing how classes match or bounded delegation: AR0561 (P12, P13).
- The pyramid audit command: AR0563.

## Decisions
- 2026-10-29: AR0562 worker stays stopped at its $12 budget; its uncommitted work stays in its worktree; the owner: "AR-D346 2" (AR-D346)
