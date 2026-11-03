# AR0613 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The telegram plugin's setup has no two-step verification step

- Kind: docs
- Found by: 2026-11-03-worker-d7444588 (worker), 2026-11-03
- Where: `packages/telegram/docs/telegram.md:74`
- What: "Setting it up" lists the bot token and the chat id, and nothing about the owner's own account, though whoever holds that Telegram account holds the VPS (`docs/deploy.md`, "Threat model"). Discord's setup has its 2FA step (`packages/discord/docs/discord.md:87`); Telegram's has none, so `docs/deploy.md` gives Telegram's step itself (Settings, Privacy and Security, Two-Step Verification) and says the plugin's doc does not cover it. Out of AR0613's Scope (the channel plugins' own docs).
- Suggestion: add a step to `telegram.md`'s "Setting it up": turn on Two-Step Verification in Settings, Privacy and Security, with a recovery email; then point `docs/deploy.md`'s channel bullet to that step instead of naming the setting itself. No code.
- Budget: 0.5
- Status: open
