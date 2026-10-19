# AR0187 - Roadmap 82: models on other machines, and a fallback chain

```json
{
  "id": "AR0187",
  "title": "Roadmap 82: models on other machines, and a fallback chain",
  "date": "2026-10-19"
}
```

## Description

This ticket builds roadmap entry 82, the models plugin:
- named providers (Ollama or OpenAI-compatible) on loopback, private or Tailscale addresses;
- a fallback chain, so that a job whose model is unavailable gets the next available model of similar strength;
- `arthur usage` and `/usage` with each account's limit windows.

## Goal

The specification is roadmap entry 82 in `spec/roadmap.md`: its Package, Delivers, Also delivers and Done means, with every edge case. Its dependencies 26, 12, 21 and 80 are merged. The owner asked for this on 2026-10-16: a model on his Mac over the network and, when it is not there, another available model; and each provider's limits seen simply.

- Kind: improvement
- Budget: 12

## Done means

- Everything that entry 82's Delivers, Also delivers and Done means list, each refusal and edge case in its own test, against the fake agent and the fake Ollama and OpenAI-compatible servers on loopback ports that the entry describes.
- Tests are deterministic on a 2-core CI runner: they wait for the very state they assert, never for a fixed time, and use only loopback ports chosen by the OS.
- README's table and `arthur.mmd` show 82 as built.
- `npm test` and `npm run check` pass, the branch is pushed, and GitHub `ci` is green on its tip.

## Scope

In:
- the new `packages/models` plugin;
- the core changes the entry names (a spawn's model as a list, an awaited `roles.model`, `host.jobs.prepare` variables, `host.jobs.run`);
- orchestration's use of them;
- docs, README, `arthur.mmd`;
- `test/structure.test.ts` budgets, raised only after naming what was cut first.

Out: decision models (AR0129).

## Decisions

- 2026-10-19: The coordinator starts this under the owner's 80% usage ceiling. 82 is the first unbuilt roadmap entry in roadmap order.
- 2026-10-19 (worker): line budgets. Cut first: jobs.ts's sweep (5 lines to 2) and orchestration's refusal of a role's list, which the core now makes. Then raised: core 5403 to 5448 (job-model.ts, a prepare's variables to the wrapper here and on stdin there, `ARTHUR_AGENT_MODEL`, `input` on `host.jobs.run`, `model-why`, an awaited `roles.model`, `--model a,b`), orchestration 1207 to 1213 (`models.lists`), models 485 (new). Recorded in `test/structure.test.ts`.
- 2026-10-19 (worker): the core, not orchestration's `roles.model`, calls `models.pick` for a role's list, so `roles.model` answers the list as written and `arthur roles`, which asks it, probes nothing (the entry's edge case); the answer is the same first available model.
