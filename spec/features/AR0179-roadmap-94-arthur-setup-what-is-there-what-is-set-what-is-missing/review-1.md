# AR0179 - Review 1

- Job: 2026-10-19-review-ar0179-arthur-set-44bd7e59
- Branch: h/2026-10-19-ar0179-arthur-setup-9194f26c
- Commit reviewed: 651e64be06fbe9e7f7ec2d469d2668428870c265
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

---

**Findings:** none that block merge.

**Notes:**
- `packages/core/src/setup.ts:29` elides a `(…)` block in my earlier read tool view only — file itself is fine; no issue, just a read-tool quirk.
- F1 (plugins' requirements unchecked while an env variable is missing) is correctly filed as `open`, matches `host.ts:37`'s `resolveEnv` throwing before any plugin `setup`; accepted by the ticket's Decisions, not a blocker here.

**Checks run:**
- `npm ci`: clean, 11 packages.
- `npm run check`: `tsc` clean, no errors.
- `npm test`: 584/584 pass, 0 fail (243 s; matches worker's claimed 584/584).
- Line-budget claim verified independently: `cat packages/core/src/*.ts | wc -l` = 5736; minus `testing.ts` (198) and `fake-agent.ts` (146) = 5392, matching the raised budget and its comment exactly.
- Mutation checks (own, in this worktree, reverted after):
  - Inverted exit-code logic (`return 0` unconditionally) → 2 setup tests fail as expected (exit-code tests catch it).
  - Inverted the on/off branch condition in the Config section → 2 setup tests fail (config on/off tests catch it).
  - Confirmed `EnvVariable` type (`env.ts:10`) carries only `set: boolean`, no value field — the "never print a variable's value" requirement is structurally enforced, not just convention; no bypass path through `options()`, `envLine()`, or the re-imported config module (which only reads `core` options for the `Config` section, itself never secret-bearing).
- Traced roadmap entry 94's edge cases against `setup.test.ts`'s 10 tests: no config, config-does-not-load, hanging/failing/silent/stderr-only/ENOENT tool versions (cut at 5 s, others unaffected, <20 s total), installed package without `./options`, `enabled:false` plugin (env unread, listed under Can still go), nothing-missing (exit 0), Next ordering (config→env→critical→rest, de-duplicated fixes), missing-variable gating of plugin doctor lines (F1), and the shell+file secret non-leak — all present and exercised.
- Verified `docs/setup.md` step 5 is indeed "`arthur.config.ts`" (referenced by the "no config" Next step) and step 15 documents `arthur setup` consistent with `packages/core/docs/commands/setup.md`.
- README/`arthur.mmd` "94 built", 25-of-27-core-entries count independently verified against roadmap's entry list (1-22, 51, 71, 80, 93, 94 = 27; merged 1-22, 80, 93, 94 = 25).
- Boundary check: `installed.ts` loads `./options` via `pathToFileURL(join(folder, exported))` (direct path), never a bare specifier; `structure.test.ts`'s "the core imports no plugin" test passes.

All four named departures from the roadmap's literal wording are explicitly accepted in the ticket's 2026-10-19 Decision, and the diff matches that decision in each case (F1 filed open; "writes nothing" scoped to doctor's own writes; version = first digit-bearing word; lists show bare length).

PASS
