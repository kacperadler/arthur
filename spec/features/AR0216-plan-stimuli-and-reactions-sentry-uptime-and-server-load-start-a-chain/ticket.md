# AR0216 - Plan: stimuli and reactions, Sentry, uptime and server load start a chain

```json
{
  "id": "AR0216",
  "title": "Plan: stimuli and reactions, Sentry, uptime and server load start a chain",
  "date": "2026-10-19"
}
```

## Description

The owner, 2026-10-19 (his LinkedIn post of the same day): Arthur reacts to stimuli from production on its own, before a client calls. Examples: a new error in Sentry, a site down, a database eating CPU.

Each stimulus starts a chain:
1. Triage: is it a bug, a duplicate or noise, and how urgent is it. This is done first by a small, fast decision model (AR0129); an LLM comes in only when needed.
2. Find the cause and reproduce it.
3. A fix with tests.
4. A review on another model.
5. A small, safe change with green tests goes on by itself; a larger one goes to the owner.

After the deploy, the error is marked resolved in Sentry. A regression starts the chain again, knowing that the first fix failed. A second regression goes to the owner. The review reads the owner's earlier decisions (decision log, entry 96).

Built so far: the event stream (5), schedule (39–40) and autopilot (29). Planned: review on another model (52), auto-merge after PASS and green CI (59), the decision log (96), pre-approved decisions (AR0176) and the decisions plugin (AR0129).

Missing: the stimulus sources and the rule that maps a stimulus to a chain.

## Goal

A plan, written with the owner, that adds roadmap entries for:
- the stimulus plugins: Sentry, polled, since Arthur takes no webhooks; uptime of a URL; load of a machine or a database;
- the reaction rules per project in the config: stimulus, triage, chain, and who decides;
- the regression counter;
- marking resolved after the deploy;
- the limits that keep a flood of stimuli from burning usage or flooding the owner with approvals: deduplication, a rate cap, quiet hours.

- Kind: plan
- Plan: tak

## Done means

- `spec/roadmap.md` has the new entries, each with Done means and edge cases. The edge cases cover at least: the same error 100 times in a minute, Sentry unreachable, a fix whose deploy fails, a second regression, and a stimulus during quiet hours.
- The owner has approved the plan.

## Decisions

- 2026-10-19: The owner asked whether Arthur will allow such workflows. To be planned together with AR0129, the decisions plugin.
- 2026-10-19: The owner: planned after the switch, together (AR0129 and AR0216), when they are built.
