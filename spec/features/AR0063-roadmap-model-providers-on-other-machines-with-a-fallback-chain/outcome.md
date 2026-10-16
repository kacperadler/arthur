# AR0063 - Outcome

- Merged: 2026-10-16, `0fc8be3`
- Branch: h/2026-10-16-ar0063-providers-and-fal-c8dd47f8
- Reviews: review-1.md PASS
- Cost: worker $1.53, reviews $0.59; review rounds 1

## What went in

- `spec/roadmap.md` entry 82 (`## Models`, plugin `models`): named providers (Ollama or OpenAI-compatible on loopback, private or Tailscale addresses); a role's or kind's ordered model list, the first available at spawn wins (probe within `probeSeconds`, cached briefly); the record says the choice and why; omp gets the provider through the job's env (`OLLAMA_BASE_URL`, `LM_STUDIO_BASE_URL`); free models keep their time limit; doctor lines.
- `arthur.config.example.ts`: a `mac` provider; the worker role `["mac/qwen3-coder", "anthropic/claude-haiku-5-5"]`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 243/243 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0064 (F1).
