# AR0129 - Plan: a decisions plugin for typed decision models, local or by API

```json
{
  "id": "AR0129",
  "title": "Plan: a decisions plugin for typed decision models, local or by API",
  "date": "2026-10-18"
}
```

## Description

The owner wants Arthur to use typed decision models (System 1 style: a state plus a typed question in, a calibrated probability per allowed answer out, one forward pass, no text), served locally or by API; example: an open 31B Polish and English decision model fine-tuned from Gemma 4, served by its own engine at `POST /v1/systemone`. This ticket writes the plan, for the owner to approve before any code.

## Goal

Small, frequent yes/no and pick-one decisions are made fast, without spending the main model's limit, and with a confidence that says when to hand the decision to the coordinator's model or the owner.

- Kind: improvement
- Plan: tak

## Done means

- `plan.md` in this folder:
  - Where Arthur would ask such a model, each with its question type and what happens below the confidence threshold: whether an owner message is a question, a task or a decision (silent mode, AR0127); which project an incoming message belongs to (project agents, 85 to 88); whether a job's final message is blocked on the owner (27); whether a CI failure looks flaky (58); a finding's kind and autopilot eligibility (29); review needed beyond the rules (53); which model a ticket's worker needs.
  - The plugin's shape: `decisions` with named providers (`url`, `keyEnv`, the same private-address rule as `models`, entry 82), `ask(state, questions)` for other plugins, the threshold per question type, and the fallback when no provider answers (the coordinator's model, or no automatic decision).
  - Hardware: what runs where (a 31B model needs about 62 GB of GPU memory; smaller ones or an API), and the cost against the Claude limits.
  - How a decision is checked before it is trusted: an eval set from real board history (entry 67).
  - Where it lands in the roadmap: entry numbers and dependencies.
- No code; `npm test` and `npm run check` pass.

## Scope

In:
- `plan.md` only.

Out:
- The roadmap and vision edits: a follow-up ticket after the owner picks.

## Decisions

- 2026-10-18: The owner wants Arthur to support decision models, local and by API, and asked what they would be for; the coordinator proposes a plan first.
