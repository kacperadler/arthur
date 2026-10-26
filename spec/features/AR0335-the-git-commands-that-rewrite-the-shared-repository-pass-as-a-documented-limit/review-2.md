# AR0335 - Review 2

- Job: 2026-10-26-review-e7f05b29
- Branch: arthur/2026-10-26-worker-cba914c7
- Commit reviewed: 2a669a2f30fecce2d1a554c9813e9f8c512276b6
- Verdict: FAIL

## Final message

**Findings**

1. **`packages/core/src/git-writes.ts:72`: a `worktree add` whose target comes after `--` and starts with `-` gets past the guard and makes a worktree outside the worktrees folder.** `adds` drops every word that starts with `-`, including real path operands after `--`. The guard therefore never resolves those paths. Inside the job's worktree such a relative path stays inside, which is harmless. But if the call runs from another folder with the job's own `.git` file as `--git-dir` (the guard lets that through as the job's own link), the target lands outside. I ran this in a scratch repository:
   - `cd <scratch>/out && git --git-dir=<worktrees>/job1/.git worktree add --detach -- -x` passes `worktreeRefusal`.
   - Run for real, Git made `<scratch>/out/-x` and listed it in `git worktree list` next to `job1`.
   - Two other forms of the same call also pass: `GIT_DIR=<own .git>` instead of `--git-dir`, and `git -C <outside> --git-dir=<own .git> worktree add --detach -- -x`. `worktree move … -- -y` would be open the same way, but I did not run it.
   - Without the leading `-` (`… worktree add y`), the same call is refused naming the main checkout.

   The ticket's Done means asks for "`worktree add` with a target outside the worktrees folder … a write of the main checkout wherever they run", and `docs/deploy.md` now says exactly that. So this is a requirement not fully met. The fix is to keep the words after `--` in `adds`, with a test row for this call.

**Notes (not blocking)**

- **Other routes that pass, which this range did not create:** the guard does not know a git binary called by its own path or settings exported before the call, for any git command (`cd <main> && /usr/lib/git-core/git-commit -m x` passes too). That lets these through:
  - `/usr/lib/git-core/git-gc --prune=now`
  - `/usr/lib/git-core/git-reflog expire --all --expire=now`
  - `/usr/lib/git-core/git-worktree prune`
  - `export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=gc.pruneExpire GIT_CONFIG_VALUE_0=now; git commit -m x`
- **Probes refused naming the main checkout, as they should be:**
  - case variants: `git -c GC.Auto=1 commit`, `git -c maintenance commit`
  - config writes: `git config --worktree --add|--replace-all|--unset gc.*`, `--no-get`, `--rename-section foo gc`, `config set --worktree --value=x gc.auto 1`, `--file=<x> gc.auto 1`
  - nested `-c` aliases that reach `gc` or `--config-env=gc.*`
  - wrappers: `/usr/bin/git gc`, `sh -c "git gc"`, `find … -exec git gc \;`
  - worktree targets: `git worktree add --reason x /tmp/y`, `~/x`, `"/tmp/a b"`, `git worktree move wt -- /tmp/zz`
  - `GIT_EDITOR=… git config --worktree --edit` is refused as config the guard does not read.
- **Probes that pass, as they should:** `git reflog`, `git reflog show`, `git worktree list`, `git config --worktree gc.pruneExpire` (a read), `git -c gcx.foo=1 commit`, and `git worktree add --reason=/tmp/y wt2` (target inside).
- **Stricter than needed, acceptable:** any `-c gc.*` or `maintenance.*` is refused, even `gc.auto=0`, and so is a `git config` write whose value is a word like `gc.auto`.
- **The worker's message matches what I see:** the 8 new rows plus one passing row, core budget 6184 → 6189 → 6193 written up under AR-D29, and `worktree-guard.ts` exactly 200 lines.

**Checks run**

- `npm ci`: 22 packages added.
- `npm run check`: `tsc` reported no errors.
- `npm test`: 1144 tests, 1086 pass, 0 fail, 0 cancelled, 58 skipped.
- **Mutations:** I ran `node --test packages/core/test/worktree-guard.test.ts` after each one, and each made it fail (10 pass, 1 fail):
  - in the gc config check: dropping the `-c` options, `configEnv`, or the written config's words (`config ? rest`); dropping the `i` flag; dropping `maintenance` from the pattern
  - in the command lists: dropping `delete` (reflog), `repack`, `prune`, `maintenance`, or `move`; `rest.slice(1)` changed to `slice(2)`
  - in the guard: `dir` changed to `cwd`; `shared` removed from the refusal
- A throwaway script calling `worktreeRefusal` on a made-up place in `/tmp/ar0335-review-*` gave the probe results above. A real Git run there showed the worktree from finding 1 being created.
- Every mutation was restored with `git checkout --`. `git status --short` is empty and the scratch folder is removed.

FAIL