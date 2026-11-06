# AR0607 - Review 1

- Job: 2026-11-06-review-51ff6ba5
- Branch: arthur/2026-11-06-worker-6674e97b
- Commit reviewed: aff5ba2084944ee962218be2b96ec1170712a402
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch does what the ticket and the approved plan (b3916091) ask. Step 5 of the runbook redeploys only on `answered by policy (<class id>)` or on your own recorded `Redeploy now`. A silent-mode grant's answer means asking you and waiting. That matches the plan's "otherwise ask the owner and stop there", and the doc page and roadmap entry 114 say the same.

- **Coordinator wake** (`packages/uptime/src/uptime.ts:93,103`): one `coordinator-message` goes out next to each down notice and each up notice. Its `{ text }` shape is what `packages/orchestration/src/inbox.ts:68-70` reads. No message goes out while this machine is offline, while a down site keeps failing, or for a site still down after a restart; the changed tests check each case.
- **A project's own runbook** (`uptime.ts:33-41`): the project's file is named only while it is a regular file inside the project folder and no symlink is on the way. The projects plugin passes the folder as its real path (`packages/projects/src/project-file.ts:62,65`), so the realpath comparison holds. The tests cover a missing file, a folder, a symlink and a symlinked folder.
- **`checkPiece`** (`uptime-options.ts:95-103`): refuses an absolute path, one that climbs out with `..`, an empty or non-string value, unknown keys, and a bare list or anything that is not an object, as the plan's Files list says.
- **Commands the runbook names**: the Dokploy error texts it quotes are real (`dokploy-api.ts:36,41`, `dokploy-command.ts:95`), `deploy --project` exists, and `decision ask --project/--recommend` and `decision close` are documented. A class matched on `redeploy <p>` will find the question, because the matcher splits words on letters and digits only (`decision-classes.ts:21`), so `<p>'s` still matches.
- **Docs and limits**: README, `spec/vision.md`, `arthur.mmd`, `arthur.config.example.ts`, roadmap entry 114 and its order note are all updated, and I found no stale mention of the old piece shape. The tests in `packages/projects` still write `{ uptime: [] }` but never load the uptime plugin, as the plan expected. The uptime line budget goes from 344 to 383 and the final message mentions it. `uptime.ts` has 157 lines, well under the 200-line limit. No real project name appears in the diff.

## Notes
- (risk) `packages/uptime/roles/coordinator/site-down.md:21`: while a silent-mode grant holds, `--recommend 1` makes the log record `Redeploy now` as answered by recommendation, even though nothing is deployed. The ask also prints "act on it as on the owner's answer" (`packages/orchestration/docs/commands/silent.md:17`), which contradicts this step. The worker raised this; dropping `--recommend 1` from step 5 would remove both.
- (minor) `packages/uptime/src/uptime.ts:37`: the runbook file is checked when the message is written, but the coordinator reads it later. Something could replace it with a symlink in between. Only the owner's own project folder is exposed to this.

## Checks (on aff5ba20)
- `npm run check`: tsc clean.
- `node --import @arthur/core/testing --test packages/uptime/test/*.test.ts test/structure.test.ts`: 52 tests, 52 passed, 0 failed. Per your instruction I did not rerun the full suite or `npm run mutate`; the worker reported 1526 of 1590 passing with 0 failed, and 23 of 25 mutants caught, the 2 survivors being the summary wording at `uptime-options.ts:15`.
- I made two mutations by hand, and the tests caught both:
  - Removing the realpath comparison in `runbook()` made the own-runbook test fail (0 pass, 1 fail).
  - Removing the `..` check in `checkPiece` made `uptime-options.test.ts` fail (6 pass, 1 fail).
  
  I restored both with `git checkout --`; `git status --short` is empty.

PASS