# AR0331 - Review 1

- Job: 2026-10-23-review-ar0331-worktree-p-a2446152
- Branch: h/2026-10-23-ar0331-worktree-pointed-04fedd33
- Commit reviewed: ae9005d75b53511fb81216094d53dc467c656bd3
- Verdict: PASS

## Final message

Worktree clean, no leftover mutation edits.

## Review summary

**Scope check against ticket (AR0331):** Done means requires refusing, in the guard's `git`: `--ignore-other-worktrees` on `switch`/`checkout`; `symbolic-ref HEAD <ref>` to a non-own ref; and `<worktree>/.git` writes as main-checkout writes — with `switch -c`, `checkout -- .`, `symbolic-ref HEAD refs/heads/<own>` passing. Merge-time tip check explicitly deferred to AR0361 per the 2026-10-23 coordinator decision, and core budget raise 5845→5869 explicitly accepted by the same decision. The diff delivers exactly this, plus three additional closing routes (`checkout -B`/`switch -C` force-create, `worktree add --force`, non-HEAD `symbolic-ref`) that the worker found and documented as closed, not silently added scope — consistent with "closes what the ticket's own risk implies."

**Code trace:** `pointsAt` in `git-writes.ts` correctly distinguishes case (`-C`/`-B` force vs `-c`/`-b` create), handles abbreviations (`--ignore-o`, `--forc`) via literal-prefix matching, treats ambiguous bundled/attached forms (`-qB`, `-Bmain`) conservatively as "unknown ref" (`""`), which always fails the equality check against the job's own branch — i.e., any parse ambiguity fails safe (refuse), never fails open. `worktree-guard.ts`'s `refusal()` now folds `<worktree>/.git` into the main-checkout place for `edit`/`write`/bash writes, reached through the existing `theirs`→`refusal` path.

**Verification performed (in this worktree, not the main checkout):**
- `npm ci`: clean, 22 packages, no errors.
- `npm run check` (`tsc`): exit 0.
- `npm test`: 1058/1058 pass, 0 fail — matches the worker's claim.
- `node --test packages/core/test/worktree-guard.test.ts` alone: 9/9 pass.
- Mutation testing (throwaway edits, restored via `git checkout --` after each):
  - Deleted the `points` refusal line entirely → caught (`switch --ignore-other-worktrees main` no longer refused).
  - Disabled `--ignore-other-worktrees` detection → caught.
  - Inverted the `symbolic-ref` `HEAD` check → caught (own-branch-pointing non-HEAD symref wrongly allowed).
  - Broke the `.git`-link path (`link` pointed at a nonexistent name) → caught (symbolic-ref-to-own-branch row failed, confirming the link guard is load-bearing for that assertion chain too).
  - Removed `-B`/`-C` force-branch regex → caught (`checkout -B main` no longer refused).
  - Removed `worktree add --force`/`-f` detection → caught (`worktree add -f ... main` no longer refused).
  - All six mutations caught by the existing test; none slipped through.

**Findings F1/F2:** Legitimately out of ticket scope — `.git`/`commondir` written *outside* the worktree and `git replace` are not among the four named Done-means routes; correctly filed as `open` findings with repro, located code, and suggested fix, following the repo's existing `findings.md` convention (seen elsewhere, not invented here).

**Docs:** `docs/deploy.md` updated accurately to describe the new refusals and the newly-named limit (`.git`/`commondir` outside the worktree); matches implementation.

**Scope of diff:** touches only `git-writes.ts`, `worktree-guard.ts`, its test, `docs/deploy.md`, the ticket's `findings.md`, and the line-budget comment/number in `test/structure.test.ts` — all required or explicitly decision-approved. No unrelated changes.

Notes (non-blocking):
- Some bundled-flag forms (e.g. `-Bmybranch` attached, long abbreviated `--ignore-s...` for an unrelated checkout flag) are handled by refusing conservatively rather than parsing precisely; this can over-refuse a legitimate own-branch command in rare spacing styles, never under-refuse. Not a security gap.
- `git replace` writing from a job's worktree already passed before this ticket (pre-existing `WRITES_CHECKOUT` gap); correctly out of scope here and filed as F2.

PASS
