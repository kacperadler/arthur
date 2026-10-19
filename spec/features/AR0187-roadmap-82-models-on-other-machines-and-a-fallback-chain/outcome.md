# AR0187 - Outcome

- Merged: 2026-10-19, `bb71f18`
- Branch: h/2026-10-19-ar0187-models-d5226cf4
- Reviews: review-1.md PASS; merged unreviewed (--unreviewed): no PASS on 6cba0e3 (last PASS: 2c2fe6a, 5 commits since)
- Cost: worker $13.03, reviews $1.76; review rounds 1

## What went in

- The `models` plugin (roadmap 82): named Ollama or OpenAI-compatible providers on loopback, private or Tailscale addresses only (a name is resolved again at each probe); a role's model may be an ordered list, and at spawn the core asks `models.pick` for the first available one, with the reason on the spawn line.
- Probes run with curl on the job's own machine, the key on stdin; a job on a provider model gets the provider's variables in its own environment only.
- `arthur usage` and `/usage` show each account's limit windows; a model whose provider is at `stopAt` is skipped, windows over `warnAt` reach the spawn line and the coordinator's context. `arthur doctor` checks curl, each provider and model.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 622/622 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0190 (F1), AR0191 (F2), AR0192 (F3), AR0193 (F4).
