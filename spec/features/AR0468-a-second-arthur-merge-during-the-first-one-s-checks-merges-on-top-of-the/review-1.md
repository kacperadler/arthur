# AR0468 - Review 1

- Job: 2026-10-27-review-a16e2570
- Branch: arthur/2026-10-27-worker-7e4ae6b3
- Commit reviewed: 692fde3c6ddd0333d191dd0d84db1b2771ec0852
- Verdict: PASS

## Final message

No findings. The branch does what AR0468 asks: while one `arthur merge` runs its checks, a second merge of the same project is refused, main stays unchanged, and the lock is removed however the first merge ends. The test fails when any part of the fix is taken out.

**How the lock works** (`packages/delivery/src/merge-command.ts:58-74`)
- A new `locked()` function takes core's `takeLock` on `<delivery folder>/<project>/merge.lock`. It does this right after finding the job, before the first refusal or the first read of main, so the order the ticket's suggestion gives is kept.
- A held lock gives `a merge of <job> is in progress on <project>`. The job is read from `merging`, written to a temporary name and then renamed. If `merging` isn't written yet, the message names the pid instead.
- Both files are removed in a `finally`. A merge whose process died is taken over because core sees its pid as dead.
- Within one process, the second merge in the test is refused because core counts its own held lock (by inode) as live.
- Docs: `docs/commands/merge.md` gets the refusal and what the coordinator does with it.
- Per AR-D146, the delivery budget raise to 1572 is not a finding. The file is 199 lines, under the limit of 200. It adds no runtime dependency and crosses no package boundary: the import is `@arthur/core/lock`, which `packages/core/package.json` exports.

**Notes (not blocking)**
- `merge-command.ts:65`: two small races, both only about wording; main is safe either way.
  - Between the existence check and the read of `merging`, the first merge can remove it. The second merge is then still refused, but with an ENOENT message (the worker reported this).
  - Just after a dead holder's lock is taken over, a leftover `merging` can briefly name the dead merge's job.
- The test never checks that a merge of a different project is still allowed during a run. Changing the lock to one global path would pass the test. The ticket asks for a per-project lock, and the code does it that way.
- The lock is keyed by project name. Two project entries pointing at the same checkout folder would each get their own lock. That would be a configuration mistake, outside this ticket.

**Checks run**
- `npm run check` (tsc): clean.
- `node --import @arthur/core/testing --test packages/delivery/test/merge.test.ts test/structure.test.ts`: 40 tests, 39 pass, 0 fail, 1 skipped (the systemd scope test: no systemd user manager here). This matches the worker's numbers: 23+1 for merge and 16 for structure.
- Full `npm test` was not run, as you asked. Your host result: 1196 tests, 1190 pass, 0 fail, 6 skipped.
- Mutations, each run alone against the new test (`--test-name-pattern="second merge"`), each restored with `git checkout --`:

| Mutation | Result | What the test saw |
|---|---|---|
| Lock replaced by a no-op | caught | the second merge got `undefined` where the refusal was expected |
| `lock.release()` removed | caught | the first merge was refused `a merge of pid …` |
| `rmSync(merging)` removed | caught | the pid-holder case named the old job instead of the pid |
| Lock and `merging` released only on success, not in `finally` | caught | the first merge was refused after the earlier refused merge |

  My first round of three mutations ran in parallel and edited the same file at once, so those results mean nothing. The four above were rerun one at a time. `git status --short` was empty at the end.

PASS