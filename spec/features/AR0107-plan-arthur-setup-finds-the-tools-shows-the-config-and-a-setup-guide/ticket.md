# AR0107 - Plan: arthur setup finds the tools, shows the config, and a setup guide

```json
{
  "id": "AR0107",
  "title": "Plan: arthur setup finds the tools, shows the config, and a setup guide",
  "date": "2026-10-17"
}
```

## Description

The owner (2026-10-17): a setup guide, and Arthur helping with setup itself through `arthur setup`.

## Goal

A new owner goes from a fresh VPS to a running Arthur by following one guide and one command that tells them what is there and what is missing.

- Kind: feat
- Plan: tak

## Done means

- A setup guide (`docs/setup.md`, also a site page): from a fresh VPS to a running Arthur, step by step, each step with the command that checks it; where a step is not built yet, it says so.
- The plan proposes how Arthur itself helps with setup: an `arthur setup` that walks the owner through each missing step, built on `arthur doctor` (roadmap entry 80: every requirement with its check and its one-command fix) and `arthur init` (entry 42); which roadmap entries this adds or moves. What it shows (the owner, 2026-10-17): the tools it finds on the machine (git, Node, omp, tmux, Docker, ffmpeg, whisper-cli, ssh, ...) with versions; each plugin, on or off, and for one that is on, which of its options are set, which are missing and which env variables are set or missing (never their values); and what else can go in `arthur.config.ts`: every plugin not yet enabled and every option it takes, with a one-line meaning, read from the plugins' own option checks, so the list never drifts from the code.
- The plan says which roadmap entries `arthur setup` adds or changes (80 `arthur doctor`, 42 `arthur init`), its order among them, and how its output reads, with one example run.
- `npm test` and `npm run check` pass.

## Scope

In:
- The plan; `docs/setup.md` after approval.

Out:
- The site page itself (AR0105 links it).

## Decisions

- 2026-10-17: The owner: the command is `arthur setup`; it finds the tools, shows what is configured and what is not, and what can still go in the config.
- 2026-10-17: The owner approved it for the overnight run of six tickets (AR0107, AR0084, AR0081, AR0085, AR0110, AR0098), done in order and merged after PASS and green GitHub CI.
