# AR0280 - Review 1

- Job: 2026-10-22-review-ar0280-eval-scena-880f269a
- Branch: h/2026-10-22-ar0280-eval-scenarios-4e8abbcc
- Commit reviewed: 34fd6d60b9201df7d12fbc3c3b6c11b897b4862c
- Verdict: FAIL

## Final message

Reviewed the diff, ran the full check suite, and mutation-tested the scoring logic.

**Findings**

- `packages/github/evals/ci-failed/scenario.json:3,8` — the turn and the stub's CI output use `https://github.com/kacper/shop/...` and reference org `kacper/shop`. `kacper` is the real owner's name (git author on every commit here is `Kacper (agent) <kontakt@kacperadler.pl>`, workstation home `/home/kacper`), not a made-up one. Every other GitHub fixture in this repo, including the plugin's own tests (`packages/github/test/github.test.ts:32,78,86,97...`, default origin `git@github.com:acme/shop.git`), uses the made-up org `acme`. This is a new file in this diff, so it is a fresh deviation, not a carried-over convention. Review guide: "The owner's work leaks: a committed file ... names a real client ... Arthur's repository is public and is about Arthur alone; use made-up names (acme, web-shop)." This is exactly that leak, committed in two places in one tracked file. No other new fixture in the range repeats it (checked every `packages/*/evals/**` file for `kacper`, `/home/<realname>`, `kontakt@kacperadler` — clean elsewhere; `/home/owner` is the established generic placeholder and is fine).

**Notes (non-blocking)**

- `test/structure.test.ts`: develop's line budget raised 584→622, documented only in the test's own comment and the commit body (`f79ccd2`), not as a Decision line in `spec/features/AR0280.../ticket.md`. Sibling tickets in the same family (AR0276, AR0260) record the raise as a ticket Decision, but in both cases that line was added by the coordinator in a follow-up commit after accepting the branch (e.g. `7855efc docs(AR0260): worker pick accepted`, added on `main` after merge, not by the worker pre-merge). Treating as the coordinator's job at merge time, consistent with precedent — not a worker defect.
- F3 in `findings.md` (stub answers `--help` with the scripted command's result) is fixed only by hand-adding `(?!.*--help)` to every affected scenario's regex, not in `eval-stub.ts` itself; worker is explicit about this being a workaround and defers the real fix to the pre-existing AR0278. Reasonable given AR0278 already exists to own that fix.
- Low baseline rates are measurements per the ticket's Focus note, not scored as failures.

**Checks run**

- `npm ci` — succeeds, no lockfile changes.
- `npm run check` (tsc) — passes, clean.
- `npm test` — 988/988 pass, matches worker's claim exactly.
- Mutation tests (reverted after each, `git diff` clean on `eval-run.ts` afterward):
  - Disabled `expect.reply.lines` check → caught by `orchestration/night-one-line` in `scenarios.test.ts`.
  - Removed the `expect.tools` scoring loop → caught by `orchestration/env-refusal` (missing the `printenv` tool-call failure).
  - Removed `--set-upstream` from the eval's `git push` → caught by `manage/audit-autopilot` and `manage/retro` (their "right" sequence's bare `git push -q` then fails to move `origin:refs/heads/main`).
- `evals/baseline.json` content matches the worker's reported table exactly (19 scenarios, each `passed`/`runs` as listed).
- `arthur.config.ts` confirmed absent from `git ls-files` and present in `.gitignore`.
- Scope check: every changed path outside `packages/develop`, `README.md`, `arthur.mmd`, `evals/baseline.json`, `test/structure.test.ts`, `findings.md` is under an `evals/` folder of a plugin package — matches ticket Scope.
- `scenarios.test.ts` enumerates all 19 scenarios named in roadmap entry 68's Delivers list, one per package whose procedure it tests; `found.size === 19` assertion passes.

The leaked real name in a committed, public-repo fixture is a direct review-guide FAIL condition and a real regression against this very plugin's own established fixture convention (`acme/shop`).

FAIL
