# AR0004 - Review 1

- Job: 2026-10-16-review-ar0004-repository-ad156147
- Branch: h/2026-10-16-ar0004-repository-rules-e926d472
- Commit reviewed: 2d90904199420954ea93c81fa1517d056ae9ae72
- Verdict: PASS

## Final message

## Review: AR0004 — Repository rules as a test

### Verification performed

**Environment checks** (run in this worktree, not main checkout):
- `npm ci` — clean, 5 packages added.
- `npm run check` — `tsc`, no errors.
- `npm test` — 12/12 pass (1 from `packages/core/test`, 11 from the new `test/structure.test.ts`), matches worker's claim exactly.

**Mutation testing** (throwaway edits to `test/structure.ts`, restored via `cp`/`git checkout` after each, confirmed clean with `diff`/`git status` afterward):
- Disabled `CLASS.test` → caught (`a class or an enum fails` test fails).
- `>` → `>=` on the 200-line boundary → caught (`a source file of exactly 200 lines...` fails, correctly flags a 200-line file).
- Disabled the outside-package relative-import rule → caught (`the core imports no plugin` test fails on the missing relative-path line).
- Disabled the core-exports subpath check (`pkg.coreExports.includes(subpath)`) → caught (missing `@arthur/core/src/host.ts` / `@arthur/core/testing/extra` refusals).
- Removed comment/string stripping before the class/enum scan → caught (false positives on `words.ts` fixture).

All five mutations were caught by exactly the test designed for that rule — the suite is not vacuous.

**Manual trace of edge cases in `test/structure.ts`**:
- Specifier regex (`\bfrom|\bimport|\brequire`) correctly matches `import type {...} from`, dynamic `await import(...)`, and `export * from`, while a real string containing escaped quotes (`"import \"@arthur/youtrack\""`) does not spuriously match because the regex requires an unescaped quote immediately after `import`/`from`.
- Self-import by package name (`@arthur/telegram` importing `@arthur/telegram`) and same-package relative import are both correctly excluded, matching the non-failing lines in the "imports no other plugin" fixture.
- `lineCount` handles the no-trailing-newline case correctly (200 lines with trimmed trailing `\n` still counts as 200, not 199 or 201) — verified by hand against the `trimEnd()` fixture.
- Root `package.json`/`tsconfig.json` changes are minimal and correct: `npm test` glob extended to include `test/**/*.test.ts` alongside the existing per-package pattern; `tsconfig` include extended likewise. No duplicate test execution observed (12 tests, no repeats).

**Worker's three readings, checked against the diff**:
1. Only `src/` counts toward the 200-line cap and the budget (`if (path.split(sep)[0] !== "src") continue;` before line counting) — confirmed in code and in the "tests do not count" fixture.
2. A package without a budget entry fails rather than defaulting — confirmed (`if (budget === undefined) report(...)`).
3. `spec/roadmap.md` is untouched — confirmed, diff stat touches only `package.json`, `tsconfig.json`, `test/structure.ts`, `test/structure.test.ts`, `findings.md`.

**Budget decision**: Ticket (`main`) already records `2026-10-16: Coordinator: the core line budget is 4000 lines of src/ ... raises are the coordinator's call`, matching the branch's `BUDGETS = { core: 4000 }` exactly. Decision closed, not left open in the code.

**Findings F1/F2**: both correctly filed as `open` risk/improvement in the ticket's findings file, not blocking entry 1's scope (F1 is about a later roadmap entry, F2 about a styleguide rule entry 1 doesn't ask for). Neither contradicts a ticket Decision.

**Boundary/shape check**: `test/structure.ts` and `test/structure.test.ts` live at repo root (as the roadmap entry specifies, not inside any package), add no runtime dependency, declare no class/enum, aren't named `index`/`types`/`utils`, and stay under 200 lines (103 and 165 respectively). They don't import any package internals improperly — they read `package.json`/source text via `node:fs`, which is test infrastructure, not a plugin-to-plugin or plugin-to-core-internal import.

### Notes (non-blocking)
- `checkPackage`'s package-level messages (budget overrun, no budget, no test) report the package directory rather than a specific file; reasonable since those rules are inherently package-scoped, not file-scoped — already covered by F2/F1-adjacent findings discussion, not a defect.

### Checks run
- `npm ci` — clean.
- `npm run check` — clean, no tsc errors.
- `npm test` — 12 pass, 0 fail (matches worker's claim).
- 5 targeted mutations to `test/structure.ts`, one at a time, each restored before the next — all caught by the suite.
- `git status --short` — clean after restoring mutations.

No requirement from roadmap entry 1 or the ticket is missing, stubbed, or only claimed. No styleguide boundary or shape rule is broken by the diff.

PASS
