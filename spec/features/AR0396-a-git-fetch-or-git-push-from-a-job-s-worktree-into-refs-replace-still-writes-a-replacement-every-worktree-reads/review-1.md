# AR0396 - Review 1

- Job: 2026-11-03-review-d0bfde6d
- Branch: arthur/2026-11-02-worker-a6b72b8b
- Commit reviewed: 168985ed30e7cb1ce1ea900b5bb696ffebdcf9ac
- Verdict: PASS

## Final message

Nothing blocks the merge. The branch does what the ticket's second option asks: the guard now refuses a `git fetch`, `pull`, `push` or `send-pack` whose own words may write under `refs/replace`. That covers an explicit `…:refs/replace/…` in any letter case, a glob or brace list that may cover it, values after `=` (`--refmap=…`), push refspecs without `:` and the short `replace/…` names Git completes with `refs/`, `--mirror` and `--stdin` with their abbreviations, and the same command run through an alias. Refspecs defined in config, refspecs built at run time and refs another repository names are listed as limits in `packages/core/src/git-writes.ts:100-104` and `docs/deploy.md:42`, as the ticket requires. The core line budget goes from 7099 to 7116, which is already decided (AR-D463).

I looked for other forms that could get past the check and found none that is not a named limit:
- **Already caught:** quoting and `{…}` brace lists, `--` before the refspecs, a `*` glob anywhere in the destination (`refs/*/x`, `r*`), and an abbreviated `--refmap` given as a separate word.
- **Not a way past:** `?` and `[` are invalid in ref names, so Git refuses them itself. `:` (push matching branches), `--all` and `tag <name>` never write under `refs/replace`.
- **Over-refusal, which is safe:** the check also refuses some commands that would not write there, such as `git push origin 'refs/*'` and fetch destinations without `refs/` that hold a `*`.

## Notes
- (security) packages/core/src/git-writes.ts:104: Refspecs from config are not seen. `-c remote.<name>.fetch=…`, `remote.<name>.mirror` and `git remote update` still write `refs/replace`. This is the ticket's own named limit, and F1 records the owner's two ways to close it: `core.useReplaceRefs=false` or `receive.hideRefs=refs/replace`.
- (security) packages/core/src/git-writes.ts:5: The guard lets `git fast-import` write any ref, `refs/replace` and `refs/heads/main` included. Filed as F2. This is outside AR0396's scope, which covers fetch and push only.
- (minor) packages/core/src/bash-refusal.ts:27: The file is at 208 counted lines, yellow. It was 207 at the base, so the branch adds one comment line and does not move it into yellow. The worker said so.
- (minor) The worker's mutation claim covers only `npm run mutate -- --max 4`. My full `npm run mutate` did not finish (see the checks below), so I tested the key conditions by hand instead.

## Checks
- `npm run check`: tsc ran clean.
- `npm test` (run twice in full; the first run's filter dropped the totals): 1494 tests, 1430 pass, 0 fail, 64 skipped. This matches the worker's figures.
- `npm run mutate`: no result. It hit the 1800-second limit and was stopped. Afterwards `git status --short` was empty and no mutate or test processes were left running.
- Hand mutations of `intoReplace`, each followed by `node --test packages/core/test/worktree-guard.test.ts` and restored with `git checkout -- packages/core/src/git-writes.ts`. Every one made the test fail (1 fail, 16 pass):
  - dropped `.toLowerCase()`
  - dropped the brace-to-`*` replacement
  - dropped the glob branch (`"refs/replace/".startsWith(head)`)
  - dropped the push `refs/` completion
  - made the push refspec without `:` count as no destination
  - dropped the `--mirror` check
- Searched `docs`, `README.md`, `spec/roadmap.md`, `packages/core/src` and `.agents` for `refs/replace` and `git replace`: no text describes the guard's old behaviour.
- Read the new `findings.md`: it names no real client or other project of the owner, only the made-up `acme`.
- Leftover processes: I stopped pids 1861575 and 1861858, two `sleep 300` processes left under `systemd --user`. They started about four minutes earlier, during my test runs, so I take them to be leftovers of those runs. `ps` shows both gone.

PASS