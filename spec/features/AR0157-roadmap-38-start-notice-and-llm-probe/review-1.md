# AR0157 - Review 1

- Job: 2026-10-18-review-ar0157-702a9482
- Branch: h/2026-10-18-ar0157-0be32dff
- Commit reviewed: a515a44acbd93028433d0d7125e84f4cc0475670
- Verdict: PASS

## Final message

Worktree clean, matches commit a515a44.

## Review summary

**Scope check against ticket/roadmap entry 38:** Delivers — probe before start notice, `coordinator up on <host>` / `no LLM access on <host>: <reason>; run omp login`, `turn failed on <host>: <reason>`, `probeLlm: false` skip — all present and implemented in `start-notice.ts`/`turn-extension.ts`/`session.ts`. Done-means edge cases (probe timeout, credential in error not repeated, two starts send two notices) are each covered by a dedicated test in `start-notice.test.ts`.

**Decisions in ticket (dated 2026-10-19) match the diff exactly**: session budget 539→691 (+152), verified `wc -l packages/session/src/*.ts` = 691 exactly matching the four files named; "every start" = every `arthur run` start (confirmed `/restart`/fresh-start paths filter out the start notice via `notices()` helper in `restart.test.ts`, only sending their own `Restarted.` line); probe fixed 60 s, no option added (`PROBE_SECONDS = 60` in code, nothing in `SessionOptions`); "coordinator up" = model answered, no tmux check; turn-failed via files, dropped if older than this run's start (`began` guard in `turnFailures`); credential rules as listed.

**Trust-boundary mutation testing** (credential redaction, probe-hang guard, turn-extension gating, stale-failure drop) — each mutation made in this worktree, tested, reverted, tree confirmed clean afterward:
- Removed generic 20+-char mixed rule → caught (`request_id` leaked in test).
- Removed `Bearer` rule → caught (`Authorization: Bearer abc.def` leaked).
- Inverted `NAME.test(name)` (stop redacting named env vars) → caught (`hunter-two-secret` leaked).
- Removed "no reply text yet in this turn" guard in `turn-extension.ts` → caught (file written when it shouldn't be).
- Removed the `>= began` stale-failure filter → caught (old failure resent, test timed out on count mismatch).
- Removed `child.kill("SIGKILL")` at probe timeout → caught (test's own `until` for "the probe killed" times out, test fails) — confirms the probe can't hang `arthur run`'s own flow (resolve path is detached from spawn via async `.then`), but a kill regression would leave a zombie `omp` process; test correctly fails on that.

No mutation of a key behavior survived the test suite.

**Checks run myself, in this worktree:**
- `npm ci` — clean.
- `npm run check` — `tsc` clean, no errors.
- `npm test` — 529/529 pass, 0 fail (matches worker's claim exactly).

**Docs/config cutover:** `session.md` option table + new "The start notice" section + Files list updated; `arthur.config.example.ts` marks entry 38 built with accurate option comment; `coordinator.md` documents the second extension; README table and `arthur.mmd` (both copies) show session built 38/38, dated 2026-10-19 — `npm test`'s own "README's mermaid block is arthur.mmd, unchanged" test passed, confirming the two copies are kept identical.

**Findings file** (`findings.md`) matches exactly what the final message describes (F1: inbox notice unredacted at `inbox-extension.ts:118`; F2: provider-outage notice storm) — both correctly scoped as out-of-branch risks, not swept under the rug, both `open`.

## Notes (non-blocking)
- `credential.ts`'s env-var filter requires length ≥ 8 before matching a named variable; a secret under 8 chars named `*_KEY` would not be redacted by that rule (would still need to hit the generic 20-char rule, which it's too short for, or a vendor-prefix match). Minor, pre-existing choice baked into the accepted Decision text ("8 characters or more" is spelled out in `session.md` itself), not a bypass the ticket asked to close.
- Probe's `child.on("error", ...)` path (e.g., signal-abort `AbortError`) is exercised indirectly by the "stopped meanwhile, no notice at all" test but not asserted against a specific error message; acceptable, behavior is covered end-to-end.

## Verdict

PASS
