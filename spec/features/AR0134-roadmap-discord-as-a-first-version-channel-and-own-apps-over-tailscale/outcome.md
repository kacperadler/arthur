# AR0134 - Outcome

- Merged: 2026-10-18, `0a41782`
- Branch: h/2026-10-18-ar0134-d1d258df
- Reviews: review-1.md PASS; merged unreviewed (--unreviewed): no PASS on 540684d (last PASS: e730d2d, 9 commits since)
- Cost: worker $3.33, reviews $0.58; review rounds 1

## What went in

- `spec/roadmap.md`: a `## Discord` section between the API freeze (51) and Delivery holds entries 89 (Discord plugin: `bots` with token, guild, user and channel env names; a main channel for the coordinator, every other channel a project's `place`; built-in WebSocket, no discord.js; doctor blocks a bad token or a missing MESSAGE_CONTENT intent and warns on a server without 2FA or with other members; permissions View Channels, Send Messages, Attach Files) and 90; a new later entry 95: the owner's own apps reach the VPS by its Tailscale name, push notifications decided when the app is planned.
- `spec/vision.md`, `README.md`, `arthur.mmd`: Discord is a first-version channel next to Telegram.
- CI failed once on the branch's first commit and passed after main was merged in, with no code change.

## Checks on main

- `npm run check`: passed.
- `npm test`: 504/504 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0151 (F1), AR0152 (F2).
