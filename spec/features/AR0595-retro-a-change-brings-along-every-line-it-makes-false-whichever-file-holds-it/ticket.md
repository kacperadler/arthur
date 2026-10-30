# AR0595 - Retro: a change brings along every line it makes false, whichever file holds it

```json
{
  "id": "AR0595",
  "title": "Retro: a change brings along every line it makes false, whichever file holds it",
  "date": "2026-10-30"
}
```

## Description

From the retro of 2026-10-30 (`spec/retro/2026-10-30.md`, proposal 2). Stale lines a change leaves in docs, diagrams, the roadmap, roles and comments each became their own ticket; the worker role gains a line asking to fix every line the change makes false and search the repository before the final message.

## Goal

each stale line costs a ticket of its own, with the owner's approval, a spawn and a merge, or a FAIL round. The worker role names only the usage line, the doc page and the example config, so workers file the rest as findings whenever the Scope does not list the file.

- Kind: chore

Evidence:
- AR0055 → AR0057: the vision's plugin table and two diagrams were left behind, because "AR0055's Scope names only `spec/roadmap.md` and `arthur.config.example.ts`".
- AR0063 → AR0064: the same for the models plugin: "This ticket's Scope names only the roadmap and the example config".
- AR0134 → AR0151: the example config and two diagrams still called Discord a later plugin; "its Scope names only those four files".
- AR0044 → AR0050: roadmap entry 8 still described events before the replay AR0044 built.
- AR0228 → AR0230: two code comments still described the host API before AR0228 froze it.
- AR0307 → AR0408 and AR0409: `versions.mmd` and the example config's header still described the time before the switch.
- AR0508 → AR0514: `spawn.md` still listed a limit that the hidden `~/.ssh` ended.
- AR0554 → AR0568: the core's message still named the renamed voice plugin, "deferred as outside that ticket".
- AR0339 review-1.md F3: doc pages printed by `--help` still described the old default.
- AR0541 review-1.md F2: `spawn.md:76` claimed more than the fix did.
- AR0335 review-1.md F2: `docs/deploy.md` claimed more than the code did.
- AR0478 review-1.md F1: `plugin.md:30` gave the wrong condition for a conflict.

## Done means

- The worker role (`packages/core/roles/worker.md`) holds the After text of proposal 2 word for word, in place of the Before bullet; `npm run check` and `npm test` pass.

## Scope

In:
- packages/core/roles/worker.md, the "How you work" bullet that starts "Stay inside the task". The worker reads it before it commits.

Before:
> - Stay inside the task. A new or changed command or option brings its usage line, its doc page and its line in the example config with it, whether the task names them or not.

After:
> - Stay inside the task. A change brings with it every line it makes false, whether the task or the ticket's Scope names that file or not, unless the Scope's Out does: for a new or changed command or option, its usage line, its doc page and its line in the example config; for any behavior, name, number or message, each place the README, the docs, a diagram, the roadmap, a role or a code comment states it. Search the repository for each one you changed before the final message; a line of the vision, which is the owner's, goes into `findings.md` instead.

## Decisions

- 2026-10-30: Source: retro spec/retro/2026-10-30.md
