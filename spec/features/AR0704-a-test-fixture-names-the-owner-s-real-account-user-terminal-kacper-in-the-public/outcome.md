# AR0704 - Outcome

- Merged: 2026-11-13, `254c2011`
- Branch: arthur/2026-11-13-worker-bfa8ad2d
- Reviews: review-1.md PASS
- Cost: worker $0.88, reviews $0.35; review rounds 1

## What went in

- packages/activity/test/log-command.test.ts: the activity log fixture's terminal user is `user:terminal:alice`.
- packages/core/docs/commands/spawn.md: the example of an ssh refusal is `alice@gpu: Permission denied (publickey).`
- packages/core/test/fake-machine.ts: the fake ssh refuses as `alice@<host>`, and `UNREACHABLE` names `alice@gpu`.
- packages/core/test/job-machine.test.ts: expects `alice@gpu` refusals; the test machine's home is `/Users/alice/.arthur`.
- packages/discord/test/discord.test.ts: the refused user id example is `@alice`.
- packages/discord/test/fake-discord.ts: the fake message author and interaction member are `alice`.
- packages/discord/test/menu.test.ts: the DM interaction's user is `alice`.
- packages/github/test/github.test.ts: the pull request reviewer fixture is `alice`, and the expected message says `alice reviewed`.
- packages/telegram/test/fake-bot-api.ts: the fake chat and sender are `Alice` / `alice`.
- packages/telegram/test/telegram.test.ts: the refused chat id example is `@alice`.
- spec/features/AR0704-a-test-fixture-names-the-owner-s-real-account-user-terminal-kacper-in-the-public/findings.md: F1, the other fixtures that named `kacper`, fixed in 2f46ed0a.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1757/1828 passed.

## Left open

- Tickets from findings: none open.
