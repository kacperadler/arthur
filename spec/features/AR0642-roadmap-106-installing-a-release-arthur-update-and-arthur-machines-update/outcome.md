# AR0642 - Outcome

- Merged: 2026-11-12, `0cebc800`
- Branch: arthur/2026-11-12-worker-967c43d8
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $13.85, reviews $1.79; review rounds 2

## What went in

- `packages/core/src/update.ts`: `arthur update [<tag or commit>]`: fetches the tags, checks out the newest `v*` tag or the target, runs `npm ci` and rolls back when it fails; prints the versions and who restarts `arthur run` (the restart guard under the service, else `systemctl`); refuses a core outside Git, changed tracked files, and a branch without an argument; a git step that prints nothing is reported by its exit code.
- `packages/core/src/core-commands.ts`: registers `update` (not `inJob`), passing it the enabled plugins.
- `packages/core/src/job-machine.ts`: `coreVersion`, `release` and `arthurVersion` take an optional core folder (default: this core).
- `packages/core/docs/commands/update.md`: the page `arthur update --help` prints.
- `packages/core/docs/commands/help.md`: `update` in the core command lists and among the commands refused in a job; `machines update` refused in a job.
- `packages/core/test/update.test.ts`: tests against real Git and real `npm ci`: newest tag, up to date, tag or commit given, restart line, every refusal (a silent git failure included), `npm ci` rollback, no replacement followed, usage.
- `packages/core/test/cli.test.ts`: `update` in the command lists and in the in-job refusal loop.
- `packages/machines/src/machine-update.ts`: `arthur machines update [<name>]`: `arthur update <HEAD here>` on each machine through `host.jobs.run`, cut after 600 s; offline machines named and skipped; a cut run said as possibly half-updated; each failure by the last line on stderr or its exit code; refusals.
- `packages/machines/src/machines.ts`: the `machines` command dispatches `update`; new usage line.
- `packages/machines/src/machine-check.ts`: the fixes for another version and for a missing `arthur` name `arthur machines update <name>`.
- `packages/machines/test/machines.test.ts`: tests for `machines update`: multi-line stderr, a silent failure, a cut run, the 600 s limit, a name with an empty list; an empty `arthur version` line; new fix texts and usage line.
- `packages/machines/docs/commands/machines.md`: usage, the "Updating" section with each outcome, the fix texts.
- `packages/machines/docs/machines.md`: mentions `arthur machines update`.
- `docs/setup.md`: step 4 installs a full clone at the newest release tag; a checkout of `main` leaves out the checkout line.
- `docs/deploy.md`: "Updating" is `arthur update` for a tag install, `git pull` for a checkout of `main`, then `arthur machines update`; the one-time update by hand of an old machine; machine step 2.
- `test/structure.test.ts`: core budget 7607, machines budget 583.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1725/1796 passed.

## Left open

- Findings: none; no findings.md on this ticket.
