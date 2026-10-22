# AR0269 - Review 1

- Job: 2026-10-22-review-ar0269-one-ssh-ca-452b42d9
- Branch: h/2026-10-22-ar0269-one-ssh-call-per-c337cff3
- Commit reviewed: 2dfdc272232207df0be963a43383502de49eb043
- Verdict: PASS

## Final message

Decision already present (verified earlier full read): all three Decisions lines including the 2026-10-22 line-budget acceptance are on `main`'s ticket. Worker's "Needs action" item is resolved.

**Findings:** none that block merge.

**Notes:**
- F1 (own-check outside a round still makes two ssh calls when `keepFree.disk>0`) is correctly scoped out and filed as an open finding rather than silently expanded — matches ticket's "Out: changing what is measured" and the round-specific Goal wording.
- `readDisk`'s header-filter/positional parsing relies on each df invocation producing exactly one header+one data line per existing path; brittle to a `df` that emits no header (e.g., `--no-headers` configured in `$PATH` elsewhere), but this is pre-existing behavior unchanged by this diff.

**Checks run (in this worktree, range `57801d0..2dfdc27`):**
- `npm ci`: clean install, no errors.
- `npm run check`: `tsc` passed, no output — matches claim.
- `npm test`: 1014/1014 passed, 0 failed — matches claim exactly.
- Line budgets: `cat packages/{machines,resources}/src/*.ts | wc -l` → 474 and 602 — matches claim and `test/structure.test.ts` BUDGETS entries; `main`'s ticket already records the raise as a Decision (worker's "Needs action" request is satisfied).
- Mutation tests (each applied then reverted with `git checkout --`):
  - Dropped the `.then(..., () => undefined)` rejection handler in `machines.ts`'s `asked` → new "answers name the paths" test failed with unhandled rejection "refused" (as expected: round would otherwise break on a rejected `machines.round` answer).
  - Forced `checkMachine(..., [])` instead of the resolved `named` paths → same test failed, asserting `disk: undefined` where `disk: {code:0,...}` was expected (round silently dropping df without this test catching it).
  - Forced `room.ts`'s `asked` to call `diskPaths` unconditionally (ignoring `floor > 0`) → "floor 0, or none, runs no df" test failed, catching a spurious `df -Pk` call when no floor is set.
  - All three confirm the tests genuinely assert the ticket's two focus behaviors: a rejected/non-`Map` `machines.round` answer still lets the round run, and paths are correctly threaded into the one ssh call.
- Traced the hang→offline path: `checkMachine`'s `host.jobs.run(..., left)` kills the whole `sh -c` script (now including the inline df loop) past `limitSeconds`, same mechanism the pre-existing "ten machines that hang" test exercises; docs (`machines.md`) state the new behavior explicitly. No dedicated test hangs `df` specifically (only the wrapping ssh), a minor gap but not a new untested code path — the kill-the-whole-script mechanism is unchanged, only what runs inside the script changed, and that script-content change is covered by the output-format/paths tests above.
- Verified script quoting/shell semantics (`shift 2`, named vs positional `$n`, command substitution `exit` scoping, "missing" vs "missing $tool" disambiguation) by hand-tracing `machine-check.ts`'s `SCRIPT`/`DF` against the new machines test's exact expected argv and output shapes — consistent.
- Boundary check: no plugin imports another plugin's files; `machines` and `resources` interact only via `host.collect`/`host.provide` on `machines.round`; confirmed by diff inspection.

PASS
