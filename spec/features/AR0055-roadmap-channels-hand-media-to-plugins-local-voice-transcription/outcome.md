# AR0055 - Outcome

- Merged: 2026-10-16, `d4e23cc`
- Branch: h/2026-10-16-ar0055-media-parts-and-v-0c085301
- Reviews: review-1.md PASS
- Cost: worker $1.16, reviews $0.52; review rounds 1

## What went in

- `spec/roadmap.md` entry 49: `message-received` carries `channel` and typed `parts`; the core asks `collect("message.part")` before the coordinator's turn; unclaimed media reach it as paths, an unclaimed voice note as one line. New entry 81: `voice`, local whisper.cpp, one at a time, `[voice <s> s] <transcript> (<path>)`, its doctor requirements.
- `arthur.config.example.ts`: the voice plugin's options.

## Checks on main

- `npm run check`: passed.
- `npm test`: 230/230 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0057 (F1), AR0058 (F2).
