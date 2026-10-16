# AR0009 - Review 1

- Job: 2026-10-16-review-ar0009-command-re-f9c23721
- Branch: h/2026-10-16-ar0009-command-registry-daf148e5
- Commit reviewed: 6d50ae0f68048338bcc7a63d08f2a76a21fd358e
- Verdict: PASS

## Final message

Working tree clean. Final verification complete.

Findings: none that block.

Notes:
- `packages/core/src/plugin.ts` doesn't re-export `Command`/`Commands`/`CommandRegistry` types from `./commands.ts` through the `@arthur/core/plugin` subpath; a future plugin typing a `Command` literal explicitly would need its own import path. Not a boundary violation (core→plugin export surface is frozen at entry 51 per roadmap), and structural typing works fine through `Host.commands` without it — not a blocker.
- `--project` is accepted and handed through unchanged, with no validation against a project list (entry 41 not yet built); worker correctly filed this as finding F2, matching roadmap scope.

Checks run (in this worktree, against the stated range):
- `npm ci`: clean install, 5 packages added.
- `npm run check`: `tsc` passes clean, no output/errors.
- `npm test`: 83/83 pass, 0 fail — matches worker's claimed count exactly, including pre-existing `config-check.test.ts` (unmodified) still passing against the rewritten `cli.ts`, confirming `arthur config check` continues to work end to end.
- Mutation checks (throwaway edits, restored with `git checkout --`, confirmed clean via `git status --porcelain` and a final full `npm test` pass):
  - Removed the duplicate-name refusal in `commands.ts` → 2 tests failed (naming both plugins, including core, not enforced).
  - Made command lookup in `route()` case-insensitive → 1 test failed (`/Jobs` matched `jobs`).
  - Replaced the CLI's one-line thrown-error message with `error.stack` → 1 test failed (stack leaked instead of first-line message).
  - Removed the "`--project` given twice" refusal → 1 test failed (second value silently won instead of exiting 2).
  - Disabled the deleted-doc-file check in `printDoc` → 1 test failed, and the binary crashed with an uncaught `ENOENT` instead of the documented one-line message.
  - Every mutation to a key refusal/behavior named in the Focus was caught by the existing test suite; none passed silently.

Code review against roadmap entry 6's Done means and the Focus list: duplicate-name refusal names both plugins and counts the core's own commands (tested both ways); missing-doc-file refusal names plugin and file; bad-name refusal covers empty, leading/trailing dash, uppercase, slash, spaces; `route()` with no text replies via the command's own `reply("")`; unknown command lists only phone commands (commands without `phone` excluded); throwing phone command and throwing CLI command both reply with the first line only, no stack, no secret; name matching is case-sensitive both in `route()` and the CLI's command lookup; the fake host wraps the real registry (duplicate/missing-doc refusals reproduce, and `fake.commands` records registrations) — all directly exercised by `commands.test.ts`'s dedicated test and confirmed by mutation above; the `cli.ts` rewrite fully replaces the AR0006 stub (same file, same `config check` contract, verified by the untouched `config-check.test.ts` still passing) while adding the registry-backed dispatch, `--help`/`help` paths, unknown-command/wrong-usage exit codes, and `--project` parsing anywhere on the line; plugins reach commands only through `host.commands` (no plugin imports `commands.ts` directly; only `cli.ts`, `host.ts`, `plugin.ts`, `testing.ts` within `@arthur/core` do). File sizes (77–121 lines) stay well under the 200-line budget; no runtime dependency added; no class/enum; English only; docs page `help.md` added and matches CLI behavior; README status line updated accurately.

No requirement from entry 6, the ticket, or the Focus list is missing, stubbed, or only claimed without evidence. Worker's final message matches observed behavior and test counts exactly.

PASS
