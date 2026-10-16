# AR0032 - Outcome

- Merged: 2026-10-16, `5194823`
- Branch: h/2026-10-16-ar0032-phone-command-das-c4283e06
- Reviews: review-1.md PASS
- Cost: worker $0.69, reviews $0.57; review rounds 1

## What went in

- `packages/core/src/commands.ts`: a phone command's name has no dash and at most 32 characters, and its `about` 1 to 256 characters, not only spaces (Telegram's Bot API); refused at registration, naming the command. Commands without a phone side keep dashes.
- `docs/commands/help.md` lists the refusals.

## Checks on main

- `npm run check`: passed.
- `npm test`: 156/156 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
