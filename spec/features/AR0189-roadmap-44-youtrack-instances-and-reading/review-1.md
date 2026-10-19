# AR0189 - Review 1

- Job: 2026-10-19-review-ar0189-youtrack-3b1786b3
- Branch: h/2026-10-19-ar0189-youtrack-502e11ad
- Commit reviewed: 5d770ac5db4ddf661f5d1403b8e092195f526fe2
- Verdict: PASS

## Final message

Worktree clean, all throwaway mutations restored.

---

**Findings:** none that block merge.

**Notes (non-blocking):**
- `timeoutSeconds` option (not named by roadmap entry 44) is a defensible, minimal addition: a single numeric option, 1 line in the option table, needed to make the timeout Done-means point (`a timeout … give[s] one line`) testable without a real multi-second wait — the test sets `timeoutSeconds: 0.3` and waits for the actual `AbortSignal.timeout` to fire, satisfying "wait for the state they assert, never a fixed time." Reasonable per-call timeout tuning is also plausible operator value, matching the project's convention of exposing comparable knobs (`jobs.timeoutMinutes`, `poll.everySeconds`). Not scope creep worth failing over.
- `arthur.config.example.ts`'s pre-existing `youtrack({...})` block (added by an earlier, unrelated ticket, not touched by this diff) doesn't show the new `timeoutSeconds` option, unlike other optional numeric settings elsewhere in that file (`poll.everySeconds`, `check.everySeconds`). Minor doc-convention gap, not functionally blocking.
- F1/F2 in `findings.md` are correctly scoped (F1 explicitly out-of-scope per ticket's Scope: Out; F2 is a legitimate owner-facing product decision, not a bug this ticket must fix).

**Checks run (in this worktree, against `b4fe895..5d770ac`):**
- `npm ci`: clean install, 12 packages.
- `npm run check` (tsc): exit 0, no errors.
- `npm test`: 609/609 pass, 0 fail (232 s). Includes all 9 `packages/youtrack/test/youtrack.test.ts` tests, the structure/boundary tests (plugin import isolation, line budgets, no runtime deps, no class/enum, no `index.ts`/`types.ts`/`utils.ts`), and `option-tables.test.ts` with youtrack wired in.
- GitHub `ci` on tip `5d770ac5db4ddf661f5d1403b8e092195f526fe2` via GitHub Actions check-runs API: `build` → success, `check` → success, `deploy` → skipped (expected for a non-main branch). Matches worker's claim.
- Smoke test (throwaway script, `packages/youtrack/smoke.mjs`, deleted after): real `youtrack()` plugin + `fakeHost`, a real `http.createServer` fake YouTrack on an OS-picked loopback port, `arthur youtrack issue list` returns `SHOP-1 Hi`, exit 0; `command.doc` resolves to the real `docs/commands/youtrack.md` file on disk (backs the `--help` claim).
- Mutation testing on key security/behavior lines (edit → run `node --test test/youtrack.test.ts` in `packages/youtrack` → restore with `git checkout`):
  - Removed `.replaceAll(token, "[token]")` in `youtrack-api.ts:25` → the 401/token-redaction test fails, asserting the token leaked. Caught.
  - Removed `.replaceAll(url.host, "[url]")` in `youtrack-api.ts:25` → the 500-error test fails, asserting the loopback host leaked. Caught.
  - Inverted the `tracker.project` shape check in `youtrack.ts:31` (`!SHORT_NAME.test` → `SHORT_NAME.test`) → the load-refusal test fails with the wrong error. Caught.
  - Disabled the out-of-project id refusal in `youtrack-command.ts` (`if (prefix.toUpperCase() !== short.toUpperCase())` → `if (false)`) → the "refused before any call" test fails (no refusal thrown). Caught.
- Verified `package.json` boundary compliance (`"private": true`, no `dependencies`, exports limited to `.` and `./options`) matches sibling plugins (`schedule`); no file exceeds 200 lines (largest source file 89 lines; test file 294 lines, excluded from budget per convention).
- Confirmed via GitHub API that CI's `check-runs` for the exact tip SHA are green, independent of the worker's self-report.

PASS
