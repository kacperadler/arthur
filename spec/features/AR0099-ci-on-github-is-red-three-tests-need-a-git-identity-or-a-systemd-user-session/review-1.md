# AR0099 - Review 1

- Job: 2026-10-17-review-ar0099-ci-red-14e3027a
- Branch: h/2026-10-17-ar0099-ci-red-8906f65e
- Commit reviewed: f4c9c73822177ce4836c0b66858f032d37392761
- Verdict: PASS

## Final message

## Review: h/2026-10-17-ar0099-ci-red-8906f65e (f4c9c73)

### Findings
None blocking.

### Notes
- The third commit (`wrapper.test.ts` guard-line strip) goes beyond the ticket's literal "In" scope (the three named tests / what the missing session shows wrong) — the worker's own message says this race "isn't tied to having no session." It's justified in the final message by concrete measurement (4/7 failures in CI-like runs) and serves the ticket's actual Goal ("CI is green and means something"). Confirmed by reading `worktree-guard.ts`: with no `projects` plugin in this test's `setup()`, `<home>/projects/checkouts` never exists, so `declaredPlace` throws on the first `tool_call` and the extension's own process appends the "worktree guard: the project list is unreadable…" line directly to the shared `log` file — a second writer racing the wrapper's own `save("log", …)` appends. The mechanism is real; I didn't reproduce the actual interleaving in ~20 local runs (env -i, isolated + full-suite), consistent with a rare/load-dependent race, not disproof.
- `findings.md` untouched, `.github/workflows/ci.yml` untouched — matches worker's claim and the ticket's "Out" scope.
- Test files exceed 200 lines (536/447/239) but the structure test (`a package over its line budget… tests do not count`) exempts test files — not a violation.
- Ticket's "CI run on the branch's tip is green" Done-means point is explicitly left open by the worker (can't push) and the task's Focus note states the coordinator checks that separately before merge — consistent, not something this review can or should gate on.

### Checks run (in this worktree, on the reviewed commit)
- `npm ci`: clean install, 7 packages.
- `npm run check`: `tsc` passes, no errors.
- `npm test` (normal, with this VPS's git identity/user session): **354 tests, 354 pass, 0 fail, 0 skipped** — matches worker's claim exactly.
- `npm test` under `env -i PATH=$PATH HOME=<empty> CI=true` (ticket's repro recipe), run 4 times: every run **354 tests, 346 pass, 0 fail, 8 skipped** — matches worker's claimed post-fix counts, no flake observed across 4 runs.
- Confirmed via `node --test --test-reporter=tap` that all 8 skips carry reason `# SKIP no systemd user manager`, and specifically the two job-control.test.ts scoped variants (holder-scope, two-continues-in-scope) skip only when scoped, while their bare counterparts always run and pass — matches the existing `scope.test.ts`/`config.test.ts`/`testing.test.ts`/`machine.test.ts` convention for detecting `systemctl --user show-environment`.
- Verified `worktree-guard.ts` has exactly one log-emission site for the "worktree guard:" line (`said` latch ⇒ emitted at most once), so the wrapper.test.ts non-global `.replace()` strip is safe and specific — it cannot swallow any other line.
- **Mutation 1** (ticket's core fix): reverted `machine.test.ts:100` to drop the `-c user.name=... -c user.email=...` flags, ran under `env -i … HOME=<empty>`: reproduces the exact ticket failure, `fatal: unable to auto-detect email address`. Restored; test passes again.
- **Mutation 2** (job-control.test.ts scope behavior): commented out the `endScope(id)` call at `wrapper.ts:139` (manager present on this VPS), ran the scoped holder test: fails with `Error: timed out waiting for the holder's end` — exactly the worker's claimed mutation result. Restored `wrapper.ts`, confirmed clean (`git status --short` empty).
- `git status --short` clean after all throwaway mutations were reverted.

All three named ticket tests fixed correctly and verified by direct reproduction and mutation; skip conditions match the ticket's "skip only when the behaviour cannot exist without a user session" requirement and the project's existing pattern; the extra wrapper fix is narrow, justified, and verified not to over-strip.

PASS
