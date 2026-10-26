# AR0339 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Doctor's env-file check compares paths as text

- Kind: fix
- Found by: reviews 1 to 4 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/src/requirements.ts:91`
- What: `relative(...)` on the text of the paths; an env file reached through a symlink into a checkout, or a config folder that is a symlink, reads `ok`.
- Status: dropped (AR-D53: only real risks get a ticket; AR0445 dropped)

## F2. Doctor's fix text ignores XDG_CONFIG_HOME

- Kind: fix
- Found by: reviews 2 and 4 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/src/requirements.ts:95`
- What: the fix text always names the default under `~/.config/arthur`; with `XDG_CONFIG_HOME` set, the real default lies under it, and a relative one resolves inside the config's folder without the text naming that cause.
- Status: dropped (AR-D53: only real risks get a ticket; AR0446 dropped)

## F3. The file name is `.env`, the ticket said `env`

- Kind: docs
- Found by: reviews 1 to 4 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/src/config.ts:109`
- What: the default file is named `.env`, not `env` as the ticket wrote, with no reason given in the branch.
- Status: dropped (deliberate: the `.env` name keeps the env guard refusing a direct read of the file by name; AR-D45 names only the folder)

## F4. Project paths on another machine are compared against the local path

- Kind: fix
- Found by: review 1 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/src/requirements.ts`
- What: doctor compares a remote project's path with the local env file's path.
- Status: dropped (worst case a false warning; the env file lives on this machine only)

## F5. README and the architecture diagrams still say `.env` generically

- Kind: docs
- Found by: review 1 (reviewer, non-blocking note), 2026-10-26
- Where: `README.md`, `docs/architecture/*.mmd`
- What: mentions of `.env` that do not name its folder.
- Status: dropped (generic, not misleading; `docs/setup.md` names the place)

## F6. An existing install must move its env file before the next start

- Kind: docs
- Found by: review 2 (reviewer, non-blocking note), 2026-10-26
- Where: `docs/setup.md`, step 6
- What: an install whose env file sits beside the config refuses to start until it is moved.
- Status: dropped (documented in step 6; this install's owner moved it on 2026-10-26)

## F7. The CLI tests pass XDG_CONFIG_HOME unset rather than empty when it is undefined

- Kind: test
- Found by: review 4 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/test/cli.test.ts:34,316,331,360`
- What: `XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME` gives the child no variable when it is undefined.
- Status: dropped (the test kit always sets it, so no test reaches the production path)
