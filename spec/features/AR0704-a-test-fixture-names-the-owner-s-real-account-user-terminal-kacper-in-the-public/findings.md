# AR0704 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Other test fixtures and one doc example name the owner's account, kacper

- Kind: test
- Found by: 2026-11-13-worker-bfa8ad2d (worker), 2026-11-13
- Where: `packages/telegram/test/fake-bot-api.ts:36`, `packages/discord/test/fake-discord.ts:31`, `packages/core/test/fake-machine.ts:32`, `packages/core/docs/commands/spawn.md:35`
- What: outside this ticket's Scope (In: `packages/activity/test/log-command.test.ts` only), `grep -rn kacper packages` still finds the owner's name as a fixture: the Telegram fake's `from`/`chat` (`first_name: "Kacper"`, `username: "kacper"`) and `"@kacper"` in `packages/telegram/test/telegram.test.ts:57`; the Discord fake's author `user(OWNER, "kacper")` at `fake-discord.ts:31,261`, `menu.test.ts:179` and `"@kacper"` in `discord.test.ts:54`; the GitHub reviewer `user: "kacper"` at `packages/github/test/github.test.ts:838,847,856,860,873,885`; the fake SSH refusal `kacper@<host>` at `packages/core/test/fake-machine.ts:32,91`, `packages/core/test/job-machine.test.ts:120,273`, the home `/Users/kacper/.arthur` at `job-machine.test.ts:251`, and the example `kacper@gpu: Permission denied (publickey).` in the `arthur spawn` doc page `spawn.md:35`. The only other hit, `https://github.com/kacperadler/arthur` in `packages/discord/src/rest.ts:21` and `packages/discord/test/gateway.test.ts:17`, is Arthur's own repository URL in the Discord User-Agent, which is about Arthur and stays; it alone keeps `grep -rn kacper packages/*/test` from finding nothing.
- Suggestion: rename each fixture to a made-up name (`alice`, `Alice`, `alice@gpu`, `/Users/alice/.arthur`) and the `spawn.md` example with it; leave the repository URL. No source change.
- Status: fixed in 2f46ed0a
