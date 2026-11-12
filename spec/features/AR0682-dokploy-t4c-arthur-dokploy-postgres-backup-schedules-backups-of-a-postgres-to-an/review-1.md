# AR0682 - Review 1

- Job: 2026-11-11-review-df08da7f
- Branch: arthur/2026-11-11-worker-ecc8d982
- Commit reviewed: 6cb1bf9785d23e40b24733c146f8793d69f4322b
- Verdict: PASS

## Final message

No blocking findings. The diff does what AR0682 and the T4c part of the approved AR0655 plan ask, from end to end:
- **Request body:** `backup.create` sends `postgresId`, `destinationId`, `schedule`, `keepLatestCount` (only with `--keep`), `enabled: true`, `prefix: "/"`, `database`, `databaseType: "postgres"` and `backupType: "database"`. After it, `postgres.one` is read again and the backup it lists is printed.
- **Refusals:**
  - Before any request, each ending `nothing was asked of Dokploy`: a bad Postgres id, a `--schedule` that is not five cron fields, a `--keep` outside 1 to 9999.
  - After the reads and before any write, each ending `nothing was changed`:
    - an unknown destination, with its names listed;
    - two destinations of that name, or one with no id;
    - a database answer with no database name;
    - the same destination and schedule set with another count, or disabled.
- **Destination S3 keys:** only each destination's name and id are read. Both fake S3 keys were added to `SECRETS`, and a test asserts that `SECRETS` holds every key `destination.all` returns.
- **Fake Dokploy:** `destination.all` is recorded in `dokploy-shapes.json` and covered by `fake-shapes.test.ts`.
- **Departures from the plan, each explained in the final message:**
  - The plan prints `already set` for the same destination and schedule. The branch prints it only when the count and `enabled` also match, and refuses otherwise.
  - `--keep` is optional. The approved plan writes it `[--keep <n>]`; the ticket's Done means line shows it without brackets. Both are acceptable.
- **Docs:** the README, roadmap entry 113 (title, Tickets, Delivers), the vision's dokploy row, both dokploy doc pages, `docs/setup.md`, `coordinator.md` and `arthur.config.example.ts` all name the new verb. No stale mention of `postgres create|status` as the full set is left.
- **Shape rules:** `dokploy-postgres.ts` is 135 lines, so it stays green. The line-budget raise to 887 is stated in the final message. No boundary, dependency or `.arthur/` rule is broken.

## Notes
- (minor) packages/dokploy/src/dokploy-postgres.ts:120: a listed backup with no `keepLatestCount` key at all (undefined, not null) and no `--keep` is refused as "set another way", because `undefined !== null`. Dokploy v0.30.10 returns the column as null, so this does not happen today.
- (minor) packages/dokploy/src/dokploy-args.ts:24: a missing `--destination` exits 2 with the usage line and no line of its own. The Done means "refused with its line" is met only through the usage line.
- (minor) test run: three tests in files this diff does not touch failed in the full suite (two in `packages/herdr/test/herdr.test.ts`, one in `packages/uptime/test/uptime.test.ts`). Both files pass when run alone, so they do not count against the branch.

## Checks (on 6cb1bf97)
- `npm run check`: tsc reported no errors.
- `npm test`: 1744 tests, 1677 pass, 3 fail, 64 skipped. The 3 failures are the herdr and uptime tests above.
- Those files alone: `herdr.test.ts` 11 of 11 pass; `uptime.test.ts` 25 of 25 pass.
- `npm run mutate`: 25 mutants, 23 caught, 2 survived, 222 not run (`--max 25`). The two survivors are:
  - `dokploy-postgres.ts:79`: putting the old inline backup formatting back. It builds the same string as `backupLine`.
  - `fake-dokploy.ts:118`: putting the old inline destination object back. It has the same keys and values as `destinationRecord` minus its two S3 keys.

  Neither changes behavior.
- Hand mutations, each followed by a run of `dokploy-postgres.test.ts` and restored with `git checkout -- <file>`. Every one made 1 test fail:
  - in `backupPostgres`, the id check removed;
  - the `enabled` check on an existing backup removed;
  - the `keepLatestCount` check on an existing backup removed;
  - the two-destinations refusal disabled;
  - the missing-database refusal disabled;
  - the "not listed after create" refusal disabled;
  - the `destinationId` match removed from `same`;
  - the `schedule` match removed from `same`;
  - the `--keep` pattern widened to allow 0 and 5 digits;
  - `enabled: true` flipped to `false`;
  - in `dokploy-args.ts`, the per-sub-verb flag restriction removed;
  - the requirement for `--destination` and `--schedule` removed.

  The worktree was clean after the restores.

PASS