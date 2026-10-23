# AR0330 - Review 1

- Job: 2026-10-23-review-ar0330-git-config-e9ba03da
- Branch: h/2026-10-23-ar0330-git-config-eb39f9d4
- Commit reviewed: 1b922b4020d7702143cfe7e51811671ab286593e
- Verdict: PASS

## Final message

Findings: none blocking.

Notes (non-blocking):
- Final message claims "27 refused forms" in `worktree-guard.test.ts`; the `refused` array actually has 26 entries (`45` passing claim is exact). Cosmetic miscount, not a functional gap.
- Abbreviated/unmatched options (e.g. `--fil`, future unrecognized flags) fall through to a generic "write to main checkout" refusal even when their real target would be harmless (e.g. a `/tmp` file) — safe (fail-closed) but can over-refuse; not required by the ticket and not a security gap.

Checks run (in this worktree, range `2a99baf9..1b922b4`):
- `npm ci`: clean.
- `npm run check`: no errors.
- `npm test`: 1058/1058 pass, 0 fail (full run, ~198s).
- Read full diff of `git-writes.ts`, `worktree-guard.ts`, the six hookless-flag call sites, all four hook-trap tests, `structure.test.ts` budget comment, `findings.md`; cross-checked `git diff --numstat` against the structure-test comment's claimed line deltas (`git-writes.ts` +24/-2, `worktree-guard.ts` +13/-9, `git.ts` net +2) — all match exactly.
- `wc -l` on every changed source file: all ≤200 lines (max 191, `worktree-guard.ts`). No new runtime deps, `index.ts`/`types.ts`/`utils.ts`, class or enum introduced.
- Mutation testing (throwaway edits, restored via `git checkout --` after each, confirmed clean with `git status --short`):
  - Disabled `--no-` negation safety in `configWrite` → caught (`--worktree --no-worktree` case wrongly passed).
  - Removed the `--worktree` scope exemption in the guard → caught (own-worktree `--worktree` write wrongly refused).
  - Removed the `config?.file !== undefined` branch → caught (file elsewhere wrongly refused as main-checkout write).
  - Disabled `CONFIG_READS` regex → caught (plain reads wrongly refused).
  - Removed `-f`/`--file` from `CONFIG_VALUES` → caught (wrong key extracted/refusal text).
  - Zeroed the hookless `GIT` flags array in `core/src/git.ts` → caught by the new `job-records.test.ts` hook-trap test (hooks ran, file populated, test failed as expected).
- Real git 2.43 probes (same version worker used) directly reproduced two of the branch's load-bearing claims: `--file a --file b key val` writes only to `b` (last-file-wins), and `--worktree --no-worktree key val` writes the shared `main/.git/config`, not a worktree-specific file — both match the implementation's conservative handling.
- `findings.md` F1–F4 correctly scoped as out-of-ticket risks (LFS pre-push, other config-driven programs, git aliases/`GIT_DIR`, the remote-machine bare repo), each with evidence and a suggestion, matching the project's findings workflow; none contradicts the ticket's Decisions.
- `docs/deploy.md` updated to describe the new refusal and name aliases/`GIT_DIR` as limits, consistent with code.

Ticket's Done means (gitCall config detection, refusal wording for `--global`/`--system`, `--worktree` pass-through, plus AR0324's hookless flags on Arthur's own git calls) are all met and tested; Focus's required checks (scopes, `--file` incl. last-wins, abbreviated/`--no-` options, subcommands, reads passing, self-development path) verified directly against real git and via mutation testing, not just by trusting the worker's narrative.

PASS
