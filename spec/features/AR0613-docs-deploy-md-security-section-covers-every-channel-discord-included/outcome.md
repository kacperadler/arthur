# AR0613 - Outcome

- Merged: 2026-11-03, `2ca886e9`
- Branch: arthur/2026-11-03-worker-d7444588
- Reviews: none
- Cost: worker $0.60, reviews $0.00; review rounds 0

## What went in

- docs/deploy.md: the threat model names Discord's gateway as an outbound connection. The channel bullet covers every channel plugin the config turns on (Discord and Telegram), says whoever holds the Discord account or the Telegram chat holds the VPS, and that a channel with `enabled: false` lets nothing in. It gives each channel's 2FA steps: Discord's from step 2 of `discord.md`'s setup plus its two `arthur doctor` checks, Telegram's two-step verification by its menu path.
- spec/features/AR0613-docs-deploy-md-security-section-covers-every-channel-discord-included/findings.md: F1, `telegram.md`'s setup has no two-step verification step (open).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1431/1502 passed.

## Left open

- Deferred (client summary): F1. The telegram plugin's setup has no two-step verification step
