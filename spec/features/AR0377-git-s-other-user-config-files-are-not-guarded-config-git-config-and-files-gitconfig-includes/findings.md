# AR0377 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The user's systemd folder is guarded at `~/.config/systemd` only, not at `$XDG_CONFIG_HOME/systemd`

- Kind: security
- Found by: 2026-10-24-ar0377-git-config-guard-55ed335e (worker), 2026-10-24
- Where: `packages/core/src/job-place.ts:24`
- What: `guardedPlaces` writes `systemd <home>/.config/systemd` whatever `XDG_CONFIG_HOME` holds. systemd's user manager reads units from `$XDG_CONFIG_HOME/systemd/user` when that is set, so with `XDG_CONFIG_HOME=/srv/cfg` a job's `write` of `/srv/cfg/systemd/user/x.service` passes the worktree guard [INFERENCE: systemd's unit search path per systemd.unit(5); not run here].
- Suggestion: add a second `systemd` line for `$XDG_CONFIG_HOME/systemd` when it differs, as AR0377 does for `gitxdg`, with a test that sets `XDG_CONFIG_HOME`.
- Status: ticket AR0388

## F2. `test/ticket-kinds.test.ts` fails on main: AR0387's ticket keeps the template's Kind line

- Kind: test
- Found by: 2026-10-24-ar0377-git-config-guard-55ed335e (worker), 2026-10-24
- Where: `spec/features/AR0387-the-harness-still-reads-the-old-kinds-in-this-repository-until-the-switch/ticket.md:19`
- What: at base `8940bb85` the ticket's line 19 is `- Kind: feat | fix | security | perf | refactor | test | docs | build | ci | chore | ux` (`git show 8940bb85:<path> | grep -n 'Kind:'`), so `npm test` fails "every ticket's Kind under its Goal is one of the template's" on every branch cut from main.
- Suggestion: give AR0387 its one Kind (its Goal reads as `fix` or `chore`), the test unchanged.
- Status: dropped (fixed on main in d1877289 by the coordinator)

## F3. `places` in `guardedPlaces` lost its tuple type

- Kind: refactor
- Found by: 2026-10-24-review-ar0377-git-config-026900e2 (review), 2026-10-24
- Where: `packages/core/src/job-place.ts:23`
- What: the array of `[key, path]` literals has no `as const`, so TypeScript infers `string[][]`; `tsc` passes and destructuring works.
- Suggestion: none needed.
- Status: dropped (cosmetic, the reviewer called it not worth a change)
