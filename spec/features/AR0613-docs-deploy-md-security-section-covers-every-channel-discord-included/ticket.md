# AR0613 - docs/deploy.md security section covers every channel, Discord included

```json
{
  "id": "AR0613",
  "title": "docs/deploy.md security section covers every channel, Discord included",
  "date": "2026-11-03"
}
```

## Description

The deploy guide's security section names only Telegram as the channel that controls the server. It changes to cover every channel plugin, says whoever holds the Discord account or the Telegram chat holds the VPS, points to each plugin's 2FA steps, and names Discord's outbound gateway beside the polled services.

## Goal

The hardening checklist covers a channel the owner has switched off (AR-D441) and leaves out Discord, the one that now holds the VPS.

- Kind: docs

Evidence:
- `docs/deploy.md:32`: "A channel is a shell. The coordinator acts on what the allowed Telegram chat sends … Turn on Telegram's two-step verification."
- `docs/deploy.md:29`: "Every plugin calls out (Telegram and GitHub are polled)"; no mention of Discord's outbound gateway, which `spec/vision.md` ("What stays true") names.
- AR-D441 (`spec/decisions.jsonl:891`): "Switch Telegram off now; all communication moves to Discord".
- `packages/discord/docs/discord.md:80,87`: Discord's hardening steps (2FA on the account, "Require 2FA for moderator actions", exactly 2 server members), absent from `deploy.md`.

## Done means

- `docs/deploy.md`'s channel bullet covers every channel plugin, says whoever holds the Discord account or the Telegram chat holds the VPS, and points to each plugin's 2FA steps.
- Line 29 names Discord's outbound gateway.
- No code changes; `npm run check` and `npm test` pass.

## Scope

In:
- `docs/deploy.md`.

Out:
- Code, and the channel plugins' own docs.

## Decisions

- 2026-11-03: Source: audit spec/quality/2026-11-03.md
- 2026-11-03: Pre-approved by policy: docs from audit spec/quality/2026-11-03.md, 1 Scope file, budget $1 of the $3 cap
