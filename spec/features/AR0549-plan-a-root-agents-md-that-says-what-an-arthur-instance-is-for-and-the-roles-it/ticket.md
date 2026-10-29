# AR0549 - Plan: a root AGENTS.md that says what an Arthur instance is for, and the roles it may need

```json
{
  "id": "AR0549",
  "title": "Plan: a root AGENTS.md that says what an Arthur instance is for, and the roles it may need",
  "date": "2026-10-28"
}
```

## Description

Plan for the owner's wish of 2026-10-28: a root AGENTS.md that tells the coordinator what the instance it runs is for (on GitHub, Arthur itself; in an installed instance, e.g. a software development coordinator), and a role file for each kind of agent the instance may need, such as a tester or a researcher.

- Plan: yes

## Goal

The owner wants (2026-10-28) a root `AGENTS.md` that tells the coordinator the goal of the instance and what it works on, and a Markdown role file for every role or agent. Arthur has none at the root today (AR-D236 kept it so; this reverses it). Role files exist for coordinator, worker, reviewer, planner, plan-reviewer, auditor, retro and onboarding (`arthur roles`); there is no tester or researcher role.

The plan answers:
- where the instance's own description lives (a root `AGENTS.md` in the instance's home, written at `arthur init` or setup), and how the public repository's `AGENTS.md` describes Arthur itself without naming any client or project of the owner (spec/vision.md);
- how it reaches the coordinator and each role: the prompt loader, beside the role file and criteria, and whether omp also reads it on its own;
- which new roles to add (tester, researcher, others), each with its job kind, what it may change, and how it is reviewed;
- how a project overrides any of them, as it does a role file today.

- Kind: feat

## Done means

- A `plan.md` the owner approves, naming the files, the prompt loader change, the new roles with their kinds, the tickets to build them, and their line budgets.

## Scope

In:
- `spec/features/AR0549-*/plan.md`.

Out:
- Building it: the tickets the plan names.
- Moving the fixed coordinator texts out of TypeScript: AR0548.

## Decisions

