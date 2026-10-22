# AR0278 - Review 1

- Job: 2026-10-22-review-ar0278-a3e59ae8
- Branch: h/2026-10-22-ar0278-c88bc117
- Commit reviewed: 63b401de6023319bb89a850d75f3febb487322e6
- Verdict: PASS

## Final message

## Findings

None blocking.

## Notes

- `docs/plugin-api.md` AR0278 line and `commands.docs()` row match the actual `commands.ts`/`plugin-host.ts` code exactly (checked by hand and by the passing `test/plugin-api.test.ts` "exactly the members" test).
- `eval-stub.ts`'s help detection (`--project` strip, `rest.includes("--help")`, `name === "help" && rest.length === 1`) mirrors `packages/core/src/cli.ts`'s `parseFlags`/`main()`/`help` command exactly; `printDoc` in the live CLI does `process.stdout.write(readFileSync(command.doc, "utf8"))`, and `eval-command.ts` builds `pages` from the identical `readFileSync(doc, "utf8")`, so the stub's printed bytes are provably the same file content, not just "cmp"-claimed.
- AR0288 ("stub never answers `--help`/`help <command>` with a scripted result, in the stub itself"): **not fully fixed by this branch.** The stub only intercepts help when `pages[name]` exists, i.e. only for a command the current eval's own load registers. For a `--help`/`help <command>` call naming a command from a plugin *not* loaded by that scenario, the call still falls through to `reply()` and can match a scripted `stub` answer — the exact class of bug AR0288 reports, just scoped down to "plugin not in this scenario's load" instead of "plugin not loaded at all". The worker's own F1 finding states this explicitly ("It still matters for a command the load does not register... orchestration's `night-one-line` guards `arthur merge`"). So AR0278 fixes the reported instance (same-package commands, which covers the `delivery/check-failed` case since `merge` is registered there) but leaves AR0288's general case open; AR0288 should not be closed as a duplicate.
- F1 (dead `(?!.*--help)` guards) correctly left open rather than fixed inline — removing it per-scenario is explicitly out of this ticket's scope and the finding says why.

## Checks run

- `npm ci` — 22 packages added, clean.
- `npm run check` — `tsc`, exit 0, no output.
- `npm test` — 1015/1015 pass, 0 fail (matches worker's claim).
- Mutation `eval-stub.ts`: `const page = undefined` (help branch off) → `eval.test.ts` help test fails as expected (3 `--help`/`help` calls wrongly scored against `expect.never`). Restored.
- Mutation `eval-run.ts`: removed `.filter((entry) => entry.help !== true)` (help calls counted in scoring) → same help test fails identically. Restored.
- Mutation `eval-stub.ts`: dropped the `--project` filter → help test fails (`arthur --project shop eval --help` no longer recognized as help). Restored.
- Mutation `commands.ts`: `docs: () => []` → `commands.test.ts`'s "plugins register their commands..." test fails; `test/plugin-api.test.ts`'s "exactly the members" test still passes (correctly, since it only checks the key exists, not its return value) — matches worker's own mutation table.
- Mutation `plugin-host.ts`: dropped `docs: commands.docs` from the published host → `test/plugin-api.test.ts`'s "exactly the members" test fails (host missing `commands.docs`). Restored.
- `git status --porcelain` clean after each mutation restore.
- Line budgets: `wc -l packages/develop/src/*.ts` = 628 total, matches `BUDGETS.develop` and the ticket's accepted Decision; `test/structure.test.ts`'s "the repository keeps every rule" test passed in the full suite run above, confirming core's 5751 too.

No boundary violation: changes confined to `@arthur/core`'s published `Commands`/host surface and `@arthur/develop`'s own eval files; no plugin-to-plugin import, no secret, no production resource name, no class/enum, each touched file plain functions.

PASS
