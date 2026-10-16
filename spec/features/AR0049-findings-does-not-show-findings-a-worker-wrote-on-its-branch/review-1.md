# AR0049 - Review 1

- Job: 2026-10-16-review-ar0049-findings-f-ace14245
- Branch: h/2026-10-16-ar0049-findings-from-the-981bd630
- Commit reviewed: 75fac2be1541066643f5938c412ba9bd0b62aa5b
- Verdict: PASS

## Final message

## Review: AR0049 — `/findings` shows unmerged branch findings

### Diff inspected
`e4168d1..75fac2b`: `board-commands.ts` (+49/-9), its test (+66/-2), `cli.ts` (1-line signature wiring, Decision-approved), `docs/commands/findings.md` (stale "once merged" sentence corrected, justified in final message).

### Ticket conformance
- Done means: branch wins only when it exists, its own commits changed `findings.md`, text isn't main's → headed reply; otherwise main's. Implemented in `branchFindings`/`jobBranches`. Matches.
- Decisions: "own commits changed findings.md" gate present (`git diff --quiet HEAD...refs/heads/<name> -- path`, status `!== 1` → skip); cli.ts one-liner present, exactly as approved.
- Scope: only `board-commands.ts`+test touched beyond the two Decision/doc items the final message explains — acceptable per review guide ("changes nothing outside the instruction, unless the final message gives a reason").

### Verification performed (in this worktree)
- `npm ci`, `npm run check` (tsc): clean.
- `npm test`: 183/183 pass, matches worker's claim.
- Mutation checks (throwaway edits, restored via `cp` of original backup, confirmed `git status --short` clean afterward):
  - Removed project filter (`owner !== project`) → test fails, picks `arthur/shop` wrongly. Caught.
  - Inverted own-commits-changed gate (`status === 1` instead of `!== 1`) → test fails. Caught.
  - Disabled dot-record skip (`entry.name.startsWith(".")` → `false`) → test fails. Caught.
  - Removed "not main / not blank" guard (`show.stdout !== main && show.stdout.trim() !== ""` → `true`) → test fails. Caught.
  - Inverted commit-date sort (`--sort=-committerdate` → `--sort=committerdate`) → test fails. Caught.
  - All mutations caught by the single new test, confirming it isn't a tautology and exercises the stated edge cases (no job, no record, newest-wins, missing main file, deleted branch, merged branch, diverged-but-untouched branch, equal-to-main branch, other-ticket/other-project/write-in-progress/read-only/blank/missing-branch-key records all ignored).
- Injection check: branch names only ever reach git as `refs/heads/<name>`, `HEAD...refs/heads/<name>`, or `refs/heads/<name>:<path>` — always prefixed, never leading `-`, and only used via `spawnSync` arg arrays (no shell), and only after being confirmed as an actual existing ref via `for-each-ref` output filtered against the record list. No flag-injection or shell-injection vector found.
- `TICKET` regex and punctuation-stripping in `board-commands.ts` byte-for-byte match `jobs.ts`'s spawn pattern (verified via grep) — "copied rather than imported" claim holds.
- `cli.ts`: `Loaded.home` is `string`, so `loaded()?.home` is `string | undefined`, matching the new `boardCommands` signature; only two callers (`cli.ts`, test) and both updated.
- Read-only job's empty `branch` value: traced through `for-each-ref` pattern-matching-everything behavior and the subsequent `branches.includes(each)` filter — confirmed it cannot produce a false positive (test asserts this already, passes).
- Structure/line-budget/boundary tests (part of the 183) still pass with the new file; `board-commands.ts` is 117 lines, no runtime dependency added (only Node builtins), no classes/enums.

### Notes (non-blocking)
- Doc wording "not the main checkout's answers" (`findings.md`) is slightly awkward phrasing but not misleading.

No finding rises to a FAIL condition: all Done-means points hold, Decisions honored, checks reproduce as claimed, boundaries respected, no stubs/scaffolds, scope deviations are explained and narrow.

PASS
