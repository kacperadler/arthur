# AR0134 - Roadmap: Discord as a first-version channel, and own apps over Tailscale

```json
{
  "id": "AR0134",
  "title": "Roadmap: Discord as a first-version channel, and own apps over Tailscale",
  "date": "2026-10-18"
}
```

## Description

The owner wants to pick the channel he uses (Telegram, WhatsApp, Signal, Discord, Slack) and leans to Discord: one channel per project plus one main channel with the coordinator. Today the roadmap builds Telegram first (47 to 50) and Discord late (89, 90, after project agents). Later he wants his own mobile app (Expo) and web app, both reaching the VPS over Tailscale.

## Goal

The first version ships the channel the owner will use, and the roadmap shows the way to his own apps.

- Kind: improvement

## Done means

- `spec/roadmap.md`, `spec/vision.md`, README and `arthur.mmd`: Discord (89, 90) moves into the first version next to Telegram, one server, a main channel for the coordinator and one channel per project (`place`), before project agents use them; each channel stays a plugin the config picks.
- A new later entry: a mobile app (Expo) and the web panel (77) reach the server plugin (75, 76) by the VPS's Tailscale name, no public port.
- Dependencies and the coverage table stay consistent; `npm test` and `npm run check` pass.

## Scope

In:
- `spec/roadmap.md`, `spec/vision.md`, `README.md`, `arthur.mmd`.

Out:
- Any code.

## Decisions

- 2026-10-18: The owner wants a choice of channel and leans to Discord (a channel per project plus a main one), and own apps over Tailscale later; proposed by the coordinator, waits for the owner's pick.
- 2026-10-18: The owner asked whether Signal could be the first channel instead; the coordinator laid out the tradeoffs (signal-cli with Java, a second number, groups instead of channels, no command menu); the pick is still open.
- 2026-10-18: The owner picked Discord as the first-version channel (Telegram stays in the plan as an option). Security notes to carry into the roadmap: the bot answers only the owner's user id on one server; a private server with 2FA required; the bot token only in the environment; the least gateway intents and permissions; no secrets pasted in channels.
