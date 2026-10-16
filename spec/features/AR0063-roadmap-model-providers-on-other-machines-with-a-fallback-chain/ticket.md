# AR0063 - Roadmap: model providers on other machines, with a fallback chain

```json
{
  "id": "AR0063",
  "title": "Roadmap: model providers on other machines, with a fallback chain",
  "date": "2026-10-16"
}
```

## Description

A new roadmap entry: Arthur uses models served elsewhere (Ollama or any OpenAI-compatible server on the owner's Mac, reached over Tailscale), and each role or kind names an ordered list of models: the first one that is available at the job's start is used. Example: `mac/qwen3-coder`, else `anthropic/claude-haiku-5-5`. Docs only; the entry is built later.

## Goal

Cheap or private work runs on the owner's own hardware when it is on, and never stalls when it is off.

- Kind: improvement

## Done means

- `spec/roadmap.md`, a new entry (the next free number), in the existing shape, Package `models` (or the core, said why):
  - Options: `providers` (named): `{ kind: "ollama" | "openai-compatible", url, keyEnv? }`; a url must be loopback, a private or Tailscale address (refused at load otherwise).
  - Roles and kinds take `model` as one name or an ordered list; `provide("roles.model")` (AR0013) returns the first available: a provider model is available when its server answers its model list within `probeSeconds` (default 3) and lists the model; a built-in provider model is always available.
  - The job's record names the model chosen and why (`mac/qwen3-coder unreachable: <reason>; using anthropic/claude-haiku-5-5`); the wrapper passes the provider to omp (its `models.yml` or the env it reads, written into the job's own folder, never the owner's global file).
  - A job whose model is free (cost 0) keeps its time limit; its budget never stops it, and the record says so.
  - A model lost mid-job (the Mac goes to sleep): the job fails with the reason; it is not switched mid-run.
  - Its `doctor` requirements (80): each provider reachable, each listed model present; a provider down is not critical when a later fallback exists.
  - Edge cases: every model in the list unavailable (spawn refused naming each reason), a slow probe, a provider whose list lacks the model, a key read from the env file, two jobs probing at once (one probe cached for a short time).
- `arthur.config.example.ts`: a `mac` provider and one role using `["mac/qwen3-coder", "anthropic/claude-haiku-5-5"]`.
- `npm test` and `npm run check` pass. English only.

## Scope

In:
- `spec/roadmap.md`, `arthur.config.example.ts`.

Out:
- Code; picking a model by measured quality (the list is the owner's order).

## Decisions

- 2026-10-16: The owner: Arthur can use a model on his Mac (Ollama, over the network); if that model is not available, it takes another available model of similar strength, for example Anthropic's Haiku 5.5 instead of Qwen3 Coder on the laptop.
- 2026-10-16: Coordinator: OK on refusing a spawn whose explicit --model is unavailable, with no fallback.
