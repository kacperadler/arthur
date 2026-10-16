# AR0006 - Review 1

- Job: 2026-10-16-review-ar0006-config-env-e12daee8
- Branch: h/2026-10-16-ar0006-config-env-names-8aca9224
- Commit reviewed: 754ac52f40b2ea3d4b88f1db1980e508c0dceacc
- Verdict: PASS

## Final message

## Review: AR0006 — Config env names, `.env`, and `arthur config check`

### Verification performed

**Setup/build:**
- `npm ci` — clean install, 5 packages added, no errors.
- `npm run check` (`tsc`) — passes, no output.
- `npm test` — 44/44 pass, matches worker's claim exactly (same test names, same counts).

**Mutation testing** (each mutation applied, tests run, then `git checkout -- packages/core/src/env.ts` to restore — worktree confirmed clean via `git status --short` after):
1. Swapped shell/file precedence (`file.values.get(name) ?? shell[name]`) → "empty shell variable wins" test fails as expected (caught).
2. Disabled `if (plugin.options.enabled === false) continue` → two tests fail (disabled-plugin-skip test, and binary smoke test lists the disabled plugin's variable) (caught).
3. Disabled the longer-prefix foreign-owner check (`other = taken.find(() => false && …)`) → two tests fail (cross-plugin-name refusal, named-instance isolation) (caught).
4. Disabled the "not a valid variable name → hide it" guard (`VARIABLE.test` branch) → **the pasted-secret test in `config-check.test.ts` fails with the actual secret value appearing in the assertion diff** — confirms this guard is load-bearing for the ticket's core secret-leak requirement, and the test genuinely catches its removal (caught).
5. Disabled the "line without `=` or bad key" refusal → two tests fail, including the exact-count assertion in the known-secret leak test (caught).

All five mutations of the ticket's key behaviors (shell-wins-even-empty, disabled-plugin-not-read, name-prefix collision, secret-hiding, malformed-line refusal) are caught by the existing test suite — no gap found.

**Manual smoke test** (independent of worker's claims, temp dir, non-`.env` file name):
- `arthur config check` with missing var → `missing ARTHUR_YOUTRACK_TOKEN (youtrack.tokenEnv)`, exit 1.
- With shell var set → `set     ARTHUR_YOUTRACK_TOKEN (youtrack.tokenEnv)`, exit 0.
- `arthur nope` → `usage: arthur config check`, exit 2.
- `arthur config --help` → prints `packages/core/docs/commands/config.md`.
All match the worker's final-message claims.

### Findings

No blocking findings. Reviewed in detail:

- **F1 (open, logged by worker)**: equal-length prefix collision between a plugin named `X-Y` and plugin `X`'s instance named `Y` (`nameProblem`'s `entry.prefix.length > own.length` only catches *strictly longer* foreign prefixes, not same-length siblings). Verified the mechanism: `own` for an instance and the colliding plugin's own prefix are equal length, so the `>` comparison never fires. This is a real gap, but it is not one of the roadmap's named edge cases (which are all about a name either lacking the `ARTHUR_` prefix or falling inside *another* owner's strictly-contained namespace — tested and working). The worker found it via code reasoning, reproduced it, logged it transparently as `findings.md` F1 rather than hiding it, and it's not reachable from the shipped example config. Acceptable to leave as an open finding for a future ticket.
- **F2 (open, logged by worker)**: `README.md` still says "no feature code exists" — stale since AR0005, not touched by this diff's scope. Correctly logged as cleanup, not a Done-means item of this ticket.

### Notes (non-blocking)

- `env.ts`'s `resolveEnv`/`checkEnv`/`Shell` types aren't part of `@arthur/core`'s published `exports` (only `.` → `config.ts`). Entry 4/6 will need these; not required now, and the worker's final message already flags the binary and plugin-shape decisions for those entries.
- The redundant `typeof name !== "string"` check in `checkEnv` (dead branch — `nameProblem` already handles it) is harmless, not worth flagging as a defect.

### Scope / Decisions check

- Plugin entry shape `{ name, options }` with `enabled` inside `options`: implemented consistently in `asPlugin`/`checkEnv`, matches the ticket's recorded Decision.
- Temporary `arthur` binary (`cli.ts`, 18 lines, `config check` + `config --help` only): present, matches Decision, matches `bin` field in `packages/core/package.json` (and lockfile, consistent 1:1 diff).
- `spec/roadmap.md` untouched, as claimed.
- `arthur.config.example.ts`: one doc comment added, no new option — consistent with styleguide ("a new option updates the example config"; no new option here).
- Doc page `packages/core/docs/commands/config.md` wired to `--help`, matches styleguide requirement for command docs.
- No runtime dependency added (`package.json` has no `dependencies` key); no `index.ts`/`types.ts`/`utils.ts`; no class/enum; all files well under the 200-line/package-budget limits (verified via `structure.test.ts`, unchanged, still passing at 4000-line core budget).
- Test fixtures use `mkdtempSync(tmpdir())` with unique per-test subfolders, non-`.env` file names (`"vars"`, `"env"`), cleaned via `after(() => rmSync(...))` — no production resource names used.
- Everything in the worker's final message (file list, line counts, test counts, checks run, CLI behavior) matches what I observed directly.

PASS
