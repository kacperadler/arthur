# AR0148 - Review 1

- Job: 2026-10-19-review-ar0148-3b21f3aa
- Branch: h/2026-10-19-ar0148-daa7de8b
- Commit reviewed: b13d38f780d2800691ae6a7185cd06f8f47d744e
- Verdict: PASS

## Final message

Clean tree confirmed (`git status --short` empty) after all three mutation reverts.

**Findings:** none blocking.

**Notes (non-blocking):**
- `packages/session/test/session.test.ts:128` (`a session busy for compactWaitSeconds…`) flaked once with `SyntaxError: Unexpected end of JSON input` during my first full `npm test` run — a pre-existing race in the unchanged `messages()`/`lines()` test helper (reads a JSONL file while the coordinator process may still be mid-append), not touched by this diff. Reproduces identically on base commit (`0db7272`, unrelated full-suite run also flake-free there); passed on isolated rerun and on a second full-suite rerun on the branch tip (552/552). Pre-existing flake, not introduced by this branch.
- `told` Set in `session.ts` grows unbounded for the life of the process if many distinct error messages occur; not a concern for the scenarios the ticket targets (fixed file paths), but worth noting if intermittent errors ever embed variable text.

**Checks run (in this worktree):**
- `npm ci`: clean.
- `npm run check` (tsc): clean.
- `npm test` (full suite, first run): 552 tests, 551 pass, 1 fail (`session.test.ts:128`, pre-existing unrelated flake, see Notes).
- `npm test` rerun (branch tip, isolated): 552/552 pass, 273s.
- `npm test` on base commit `0db7272` in a side worktree (`/tmp/ar0148-base`): 548/548 pass (branch adds exactly 4 new tests: 552−548).
- `node --test session.test.ts --test-name-pattern "a session busy…"` in isolation: pass — confirms the earlier fail was a load-induced flake, not a regression.
- Mutation 1: removed the per-tick `try/catch` in `session.ts` → the new `arthur run` integration test fails (`EACCES` crashes the child process, `run.exitCode` assertion fails instead of `null`). Reverted, tree clean.
- Mutation 2: restored old ordering (`restart(); console.log(); then [night,tried]=[plan(),undefined]`) in `restart.ts`'s `settle()` → `a night's restart that throws is told, and the next night tries again` hangs/times out (the night never advances since the reset after a throwing `restart()` call never runs). Reverted, tree clean.
- Mutation 3: restored print-before-remove order in `request.ts` → `a file that is not a request, in a folder it cannot be removed from, is named once it is dropped, not at every tick` fails, reprinting the drop message on every tick instead of once. Reverted, tree clean.
- Verified the `restarts()` fix in `restart.ts` (`tried = night.at` only after `put(file, …)` succeeds) and the matching new test (`a fresh try whose request cannot be written is told once, and made at the first tick that can write it`) by reading the code path: before the fix `tried` was set unconditionally before `put()`, so a throwing write left `tried` set forever, stalling retries — this is the second of the two described stall fixes and is exercised by its own dedicated test, distinct from mutation 2 above.
- Confirmed the `+9` line-budget raise (`session: 691 → 700`) is explicitly accepted in the ticket's Decisions (`2026-10-19: … session 691 -> 700 (+9, one comment line cut first) accepted`), and `wc -l packages/session/src/*.ts` = 700, matching the `BUDGETS` entry and its comment in `test/structure.test.ts`.
- Confirmed scope: diff touches only `session.ts`, `request.ts`, `restart.ts`, their tests, `docs/session.md`, the ticket's `findings.md`, and `structure.test.ts`'s budget — all within the ticket/instruction. No plugin-boundary violations (no new imports across package lines), no new runtime dependency, no class/enum, no `index.ts`/`types.ts`/`utils.ts`, all source files under 200 lines.
- `chmod 555`/`chmod 000` based tests follow the repository's existing pattern (`packages/session/test/restart.test.ts:394-398` pre-dates this branch) and run as a non-root user in this environment (`id -u` = 1000), consistent with CI.

Done-means met end to end: each of the three ticks is individually caught, logged once per distinct error in the required format, and the loop continues; the two stall bugs in `restart.ts` are fixed and each has a dedicated, mutation-verified test; the new `arthur run` integration test exercises all three failure modes together without requiring root, waits on real state via `until`, and is sized reasonably for a 2-core runner. `npm run check` and `npm test` pass as claimed (the one observed flake is pre-existing and unrelated to the diff).

PASS
