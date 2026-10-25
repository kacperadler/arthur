# AR0393 - Review 1

- Job: 2026-10-25-review-ar0393-remote-url-199e9b82
- Branch: h/2026-10-25-ar0393-remote-url-transp-1c8e5d95
- Commit reviewed: e6d72b7147b141f7873abd8286a05636308ee6b0
- Verdict: PASS

## Final message

## Review: AR0393 remote URL transport hardening

**Findings:** None blocking.

**Notes (non-blocking):**
- F1 filed in findings.md (remote named as a job-machine's `ssh:` URL can redirect push/fetch to another host) is a real residual risk, correctly scoped out of this ticket (ticket's Done means only covers the `<word>::`/helper-execution vector, not general URL redirection) and properly recorded as an open finding rather than silently dropped.
- F2 (git-lfs transport policy unchecked, git-lfs not installed) is honestly marked `[INFERENCE]` and filed as open — appropriate given the environment limit.
- Worker's chosen approach (`GIT_PROTOCOL_FROM_USER=0` over `<word>::` refusal in `configRefusal`) is the stronger of the ticket's two offered options; justified with concrete bypasses (`evil://` without `::`, local-folder hooks) that the simpler option would have missed. This is a documented, reasoned departure within the ticket's own "or" scope, not scope creep.

**Checks run (in this worktree, not the main checkout):**
- `npm ci` — clean, 22 packages.
- `npm run check` — `tsc` clean, no errors.
- `npm test` — 1094 tests, 1094 pass, 0 fail. Matches worker's claim exactly.
- Line-budget arithmetic verified against `git diff --numstat`: `job-machine.ts` +4/−2 (core 6071→6073), `github-git.ts` +6/−3 (github 651→654); matches `test/structure.test.ts` `BUDGETS` edit and the new Decision entry in `ticket.md`.
- Mutation 1 — removed `GIT_PROTOCOL_FROM_USER: "0"` from `github-git.ts push()`: new github test fails (`actual 'github: pushed main to origin: [new branch]'` vs expected refusal) — folder push went through. Matches worker's claim. Restored via `git checkout --`.
- Mutation 2 — removed the `(?<!transport )` lookbehind from the stderr-sanitizing regex: same new github test fails (`fatal: transport origin not allowed` instead of naming the transport). Matches worker's claim. Restored.
- Mutation 3 — removed `GIT_PROTOCOL_FROM_USER: "0"` from `job-machine.ts gitOver`: new machine test fails (`git push: ` empty error instead of the transport refusal — the fake helper ran silently). Matches worker's claim. Restored.
- Confirmed via `packages/core/src/git-config.ts:14` that `remote.*.url`/`pushurl` are in the allowed (non-refused) key set, consistent with the worker's reasoning for why `configRefusal` alone doesn't close this.
- Confirmed all pre-existing tests that push to a local-folder origin (`github.push pushes a branch…`, `…checkout's own config sets a key…`, `…filter=lfs…`) were updated to set `GIT_CONFIG_GLOBAL: FOLDERS_ALLOWED`; none left broken by the new default refusal — consistent with full-suite green.
- `git status --porcelain` clean after all mutation restores — no stray edits left behind.
- Reviewed `docs/deploy.md` diff: accurately describes the new refusal, the `protocol.<name>.allow` escape hatch, and the still-open `ssh` redirect risk; no secret, no non-English text, no new public listener introduced.

Boundaries, Shape rules (no runtime deps, no new `index.ts`/`types.ts`/classes, line budgets honored with Decision recorded), and test conventions (own temp folders/configs, no production resource names) all hold.

PASS
