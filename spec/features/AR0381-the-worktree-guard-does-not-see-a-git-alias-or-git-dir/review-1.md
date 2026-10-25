# AR0381 - Review 1

- Job: 2026-10-24-review-ar0381-guard-git-5b6e19ca
- Branch: h/2026-10-24-ar0381-guard-git-alias-8d3d8f05
- Commit reviewed: dd877e1c966f2b435965f11ab7489bff6a8dd423
- Verdict: PASS

## Final message

Findings: none that block merge.

Notes:
- Not inspected further: `GIT_INDEX_FILE`/`GIT_COMMON_DIR`/`GIT_OBJECT_DIRECTORY` gaps are explicitly deferred to open ticket AR0332 per worker's message, consistent with ticket scope (doesn't touch this ticket's Done means).

Checks run (in this worktree, against `1120972f0aa30ebba73b01f262dce9e2e227e4ea..dd877e1c966f2b435965f11ab7489bff6a8dd423`):
- `npm ci`: clean install.
- `npm run check`: clean, no tsc errors.
- `npm test`: 1086/1086 pass, 0 fail — matches worker's claim.
- `wc -l packages/core/src/worktree-guard.ts` → 200, matches claim. `BUDGETS.core` in `test/structure.test.ts` → 6017, matches claim; comment above it names AR0381 and the reason for +30, satisfying the styleguide's "a raise is a decision recorded in the ticket" — confirmed present: ticket.md gained a 2026-10-25 Decision line approving both the budget raise and the strict-refusal tradeoff.
- Read `git-writes.ts` and `worktree-guard.ts` in full; traced alias-expansion termination by hand: each recursive `gitCall` strips every `-c alias.<sub>=` definition matching the just-resolved `sub` before recursing, so the count of remaining `-c` alias options strictly decreases each step; new `-c` tokens can only come from parsing the matched value (bounded by the original command-line length). No cycle can grow without bound. Verified concretely: `git -c alias.a=b -c alias.b=a a` and `git -c alias.a=a a` (both in the "passing" list) resolve in 2–3 recursive steps and terminate; the test suite's "aliases: chains, case, last definition wins, quoted value, inside sh -c, named like a builtin" rows cover this.
- Confirmed ordinary job commands (status implicitly, `commit`, `diff` via no-op path, `log`, `branch`, `tag`, `remote`, `notes`, `checkout`, `switch`, `symbolic-ref`, `worktree add -b`) still pass, via the untouched first integration test (lines ~140-200 of `worktree-guard.test.ts`), which ran unmodified and green in the full suite.
- Independent mutation checks (throwaway edits via `sed`, restored with `git checkout --` after each), run with `node --test packages/core/test/worktree-guard.test.ts`:
  - Removing the `GIT_DIR=`/`GIT_WORK_TREE=`→`trees` line: test failed (caught).
  - `findLast`→`find` (last-definition-wins broken): failed (caught).
  - Dropping case-insensitivity on the `sub` side of alias match: failed (caught by the row added specifically for this).
  - Narrowing the `trees` regex from `GIT_(?:DIR|WORK_TREE)` to only `GIT_DIR`: failed (caught).
  - Dropping `config?.loads` from the guard's `if (unread || config?.loads)`: failed (caught).
  - Removing the recursive `alias === undefined ? undefined : git(alias, assignments)` judging call: failed (caught).
  - Replacing the assignments passed into `git(args, words.slice(0, at))` with `[]`: failed (caught).
  - All mutated files restored (`git checkout --`), confirmed via `git status --short` (clean).
- Diff scope: only `docs/deploy.md`, `packages/core/src/{git-writes,worktree-guard}.ts`, `packages/core/test/worktree-guard.test.ts`, the AR0381 `findings.md`/`ticket.md`, and `test/structure.test.ts` — matches the ticket's declared scope (`gitCall` hardening + guard wiring + docs/budget bookkeeping), no boundary crossed (core-only change, no plugin touched, no path outside `@arthur/core`).
- Findings entry F1 in `spec/features/AR0381.../findings.md` is well-formed, follows the template, Kind `security`, Status `fixed in 5ddb6918` — matches the `--attr-source` fix actually present in the diff (`VALUE_OPTIONS` now includes `--attr-source` and `--config-env`).

PASS
