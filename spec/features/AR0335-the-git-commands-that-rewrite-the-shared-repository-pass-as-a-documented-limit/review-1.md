# AR0335 - Review 1

- Job: 2026-10-26-review-14a49c28
- Branch: arthur/2026-10-26-worker-cba914c7
- Commit reviewed: 3da7c9fd2fb3ff106d00d7421a40496116686347
- Verdict: FAIL

## Final message

**Findings**

1. **`packages/core/src/worktree-guard.ts:153`: the `-C` form of the `worktree add`/`move` refusal is untested.** If I change `located(dir, word)` to `located(cwd, word)`, so the target is resolved from the shell's folder and `git -C` is ignored, the guard tests still pass (11 pass, 0 fail). Under that change, my probe showed `git -C /tmp worktree add x` passes, though it creates a worktree at `/tmp/x` outside the worktrees folder. The real code refuses that command naming the main checkout, but no test row covers it. The tests only cover the `cd /tmp && git worktree add wt` form. The review criteria count a key-behavior mutation the tests do not catch as a FAIL. A row like ``[`git -C /tmp worktree add x`, MAIN]`` would catch it.

2. **`packages/core/src/git-writes.ts:67`: `gc` still runs if a job sets it up through `-c` config.** Git runs `gc --auto` by itself after `commit`, `merge` or `fetch`, using the config given with `-c`. This command passes the guard: `git -c gc.auto=1 -c gc.pruneExpire=now -c gc.reflogExpireUnreachable=now commit --allow-empty -m c`. I ran that same `-c` setup in a temporary repository: after the commit, a commit that had been reset away (no longer reachable) was deleted from the object store. That is exactly the loss the ticket names ("unreachable objects of another job's reset"). The guard already follows a `-c` alias into what it runs, but it does not follow `-c gc.*` or `maintenance.*` into the auto gc. `docs/deploy.md` now says these commands are refused "wherever they run". This route is not listed under "Not seen" either, so the doc claims more than the code does.

**Notes (not blocking)**

- **Reflog choice:** the worker refuses only `reflog expire`, `delete` and `drop`, while the ticket says "any but `show`". I accept the stated reason. In Git 2.43, `git reflog <ref>` and `git reflog -n 3 HEAD` run as `show`, and `exists` and `list` only read. I also checked that Git does not accept the subcommand after an option: `git reflog -n1 expire`, `git reflog --verbose expire` and `git reflog --end-of-options expire` all fail as unknown revisions. So putting an option first does not get past the `rest[0]` check.
- **Two mutations the tests do not catch, but neither weakens the refusal:**
  - Changing `place.worktrees` to `place.worktree` in the `adds` check makes no difference. A target in the worktrees folder outside the job's own worktree is already refused as "another job's worktree", for example `git worktree add ../job3`.
  - Removing the `-`-option filter in `adds` only makes the check stricter.
- **Other probes that are refused naming the main checkout:** `command`, `exec`, `nohup`, `nice`, `env` and `xargs` before `git gc`; `git -c alias.x='reflog expire --all' x`; `git worktree add ~/x`; `git worktree add -B br /tmp/x`; `git worktree add ../../acme/x`; `git -C .. worktree add ../outside`.
- **Other probes that pass:** `git pack-refs --all --prune`, `git multi-pack-index expire` and `repack`, `git commit-graph write` and `git worktree repair /tmp/x`. The ticket does not list any of them.
- **Line budget:** the core budget goes 6184 → 6189, written up in `test/structure.test.ts` under AR-D29's standing rule, as earlier reviews accepted. `worktree-guard.ts` is exactly 200 lines.

**Checks run**

- `npm ci` then `npm run check`: no errors.
- `npm test`: 1144 tests, 1086 pass, 0 fail, 0 cancelled. The rest skipped.
- `node --test packages/core/test/worktree-guard.test.ts`: 11 pass, matching the worker's count.
- `node --test test/structure.test.ts`: 16 pass, 0 fail.
- **Mutations the guard tests catch** (10 pass, 1 fail each):
  - dropping `shared` from the refusal;
  - removing `drop` from the reflog words;
  - refusing every `reflog`;
  - removing `move` from `adds`;
  - removing `worktree prune`;
  - removing `gc`;
  - removing `filter-repo`;
  - flipping `!inside` to `inside`.
- **Mutations the guard tests miss** (11 pass, 0 fail each):
  - `dir` → `cwd` (finding 1);
  - `place.worktrees` → `place.worktree` (no observable effect);
  - removing the option filter (only stricter).
- A throwaway script calling `worktreeRefusal` on a fake place in a temporary folder gave the probe results above.
- A real Git run in a temporary repository confirmed the auto-gc deletion in finding 2.
- I restored every mutation with `git checkout --`. `git status --short` shows nothing, and I removed the temporary folders.

FAIL