# AR0158 - Review 1

- Job: 2026-10-18-review-ar0158-8a5799ce
- Branch: h/2026-10-18-ar0158-f5a05899
- Commit reviewed: 83295c4b03add7e0d944d122972905652899f983
- Verdict: FAIL

## Final message

Clean, no leftover throwaway edits (test file and script were created outside the git tree / removed already).

## Findings

**packages/schedule/src/entry.ts:57-60 (`markdownInside`) and packages/schedule/src/sweep.ts:76-83 (`procedureText`) — the procedure-path symlink refusal only checks the leaf file, not intermediate directory components.**

The ticket's Decision commits to a specific trust boundary: "a procedure is a relative .md inside the run folder (absolute, `..`, non-.md, symlinks refused)," explicitly so "an edit to `spec/schedule.json` can't make the coordinator's message carry `.env`." `markdownInside` only rejects paths that are absolute, climb with `..`, or don't end in `.md`; it does not resolve or check any path segment. `procedureText` then does `lstatSync(resolve(root, path))` and refuses only if *that final path* is itself a symlink — it never checks whether any directory on the way there is a symlink.

I reproduced the bypass through the real `sweeper()` code path (not a synthetic fs test):
```
root/procedures/link -> ..        (a symlinked directory, committed like any git symlink)
entry: { procedure: "procedures/link/secret.md" }
```
`secret.md` sits one level above `procedures/`, outside the intended sandbox. The sweep emits `coordinator-message` with the secret file's content under it — confirmed with a live `sweeper()` run producing `'[scheduled leak] x\n\nSECRET CONTENT'`. The existing test (`schedule.test.ts`, "an action's procedure…") only symlinks the *leaf* file (`procedures/linked.md` -> `../secret.md`), which this implementation does correctly refuse; it never exercises a symlinked *directory* component, so this family of bypass is both real and untested. The worker's own final message claims a "mutation check" on "the symlink refusal," but that check only removed the leaf `lstatSync` branch — it doesn't cover the directory-component case, so the claim of a closed trust boundary is overstated.

This matters because the schedule's whole point of refusing symlinks is to stop a job/PR that can write files in the repo (which is exactly what Arthur's jobs do) from using a schedule entry to make the coordinator read and relay an arbitrary file via a seemingly innocuous relative `.md` path — the attack is defeated for the already-covered leaf case but wide open via one symlinked directory anywhere on the path. The fix needs to check every path segment (e.g., require `realpathSync(file) === resolve(root, normalize(path))`, or walk ancestors and refuse if any `lstatSync` is a symlink), closing the whole family rather than only the leaf case.

## Notes (non-blocking)

- `schedule({ entries })`'s `fromFile` reports `ids.has(id)` ambiguously as "an entry of the config" vs "an earlier entry of the file" by checking `configured.some(...)` after already adding file ids to the same `ids` set — correct as written (test confirms both messages), just worth a glance if this file is touched again.
- F1 in `findings.md` (registered-entry procedures as absolute paths, deferred to entry 40) is reasonable and explicitly scoped out of this ticket; not a reason to fail this one.

## Checks run

- `npm ci` — clean.
- `npm run check` (tsc) — no errors.
- `npm test` — 524/524 passed (matches worker's claim exactly), including all 11 `packages/schedule/test/schedule.test.ts` tests (daily/late/new-entry/one-off/broken-entry/race/day-list/DST/procedure/job-spawn/options).
- `wc -l packages/schedule/src/*.ts` → 277, matches the new `schedule: 277` budget in `test/structure.test.ts` and the ticket's recorded Decision exactly.
- Verified import boundaries: `packages/schedule/src/*.ts` and `test/*.ts` import only `@arthur/core`, `@arthur/core/clock`, `@arthur/core/plugin`, `@arthur/core/testing` — no deep core paths, no other plugin. `host.folder`/`host.clock`/`host.events`/`host.jobs` all match the published `Host` type in `packages/core/src/plugin.ts`. Core (`packages/core/`) untouched by this diff.
- Reproduced the directory-symlink bypass live against the real `sweeper()` from `packages/schedule/src/sweep.ts` in a throwaway test file (created and removed outside the committed tree; `git status --short` is clean).
- README/`arthur.mmd`/`arthur.config.example.ts` diffs checked against the actual state (schedule "1 of 2 entries", doc page present, option table present) — consistent with the worker's final message.

FAIL
