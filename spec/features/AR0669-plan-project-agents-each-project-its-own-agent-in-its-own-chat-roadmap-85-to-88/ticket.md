# AR0669 - Plan: project agents, each project its own agent in its own chat (roadmap 85 to 88)

```json
{
  "id": "AR0669",
  "title": "Plan: project agents, each project its own agent in its own chat (roadmap 85 to 88)",
  "date": "2026-11-09"
}
```

## Description

A plan for the project agents of `spec/vision.md` (decision 20) and `spec/roadmap.md` entries 85 to 88: a project with a `chat` in its project file gets its own interactive agent, which talks with the owner in that project's channel and directs only that project's jobs, while the coordinator keeps `maxAgents`, the morning report and the work across projects. The plan splits the four entries into tickets the owner approves.

## Goal

Roadmap 85 to 88 are the first entries after the first version, and the vision says they come once the other projects have moved to Arthur, which they have (three projects besides Arthur run on its board). None of the four entries has a ticket yet. A plan first, because they touch the coordinator's process, its inbox and wake, its context, and the session plugin at once.

- Plan: yes
- Kind: feat

## Done means

- `plan.md` in this folder: the follow-up tickets for roadmap 85 (processes and `arthur attach <project>`), 86 (routing, wake, `arthur agent tell`), 87 (context) and 88 (session for every session), each with its files, order, line-budget cost and tests; what a project agent may and may not do compared with the coordinator (approvals, merges, the decision log, spawns counted against `maxAgents`); how the owner's decisions stay his in a project chat; the open questions put to the owner.
- No code; `npm test` and `npm run check` pass.

## Scope

In:
- `plan.md` only.

Out:
- Building the entries: follow-up tickets after the owner approves the plan.
- Agents above projects and the company edition (roadmap 79): not planned now, per decision 20.

## Decisions
- 2026-11-09: Approve AR0669; its plan runs after the queue; the owner: "AR-D585 - 1" (AR-D585)
- 2026-11-13: Plan approved by the owner: plan.md at 8ead6d4c; the owner: "AR-D670 yes" (AR-D670)
