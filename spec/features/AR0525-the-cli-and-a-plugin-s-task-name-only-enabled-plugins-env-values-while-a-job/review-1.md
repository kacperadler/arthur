# AR0525 - Review 1

- Job: 2026-11-05-review-a290a81b
- Branch: arthur/2026-11-05-worker-80a33a81
- Commit reviewed: 0c6351b31fd2867a1c53271c938e78042989de69
- Verdict: PASS

## Final message

The branch does what the ticket asks: outside a job, the CLI and a plugin's task now replace every env-file value with its variable's name, including values under no enabled plugin's name. I found nothing that blocks the merge.

- `packages/core/src/host.ts:50`: outside a job, `hide` is now built by `envFileNames([config.core.envFile], <enabled plugins' values>)`. So it names every env-file value under whatever name, plus the enabled plugins' resolved values. When the shell overrides a value, both the file's and the shell's values are named. Inside a job it names only the shell values, as before, which matches the Out item ("values set only in the shell: unchanged").
- `packages/core/src/secret-names.ts:12,43`: `secretNames` now also takes `[name, value]` pairs, so one name can carry two values. `envFileNames` still skips a path that is not a file. A missing env file names nothing. An env file that is a folder is refused earlier, in `resolveEnv`, and the existing EISDIR test covers that.
- The "Done means" point is met. In `packages/core/test/secret-names.test.ts`, the real CLI runs with `ARTHUR_SIGNAL_ACCOUNT` (a disabled plugin's variable) and `ARTHUR_LOOSE_KEY` (no plugin's) in the env file. An uncaught exception, an unhandled rejection and raw stdout bytes all print the names and never the values. The new test in `packages/core/test/host.test.ts` would fail if either the job check or the merge of the plugins' values were removed.
- The worker's claims reproduce: `host.secrets` is unchanged; `packages/core/docs/commands/config.md:18` is updated; I found no other doc line that still describes the old set. The structure test passes, so the core is within its 7210-line budget. No file moved into yellow or red. The diff stays within the Scope's files plus the matching doc line.

## Notes
- (risk) `packages/orchestration/src/credential.ts:8`: plugins' `[redacted]` still uses `host.secrets`, which holds only enabled plugins' values. An env-file value of a disabled plugin, or one no plugin reads, can therefore be written raw into a plugin's own files, such as the decision log, which do not go through `hide`. This is outside this ticket's scope (CLI output and a task's error).
- (minor) `packages/core/src/host.ts:50`: the one-line `const` chain grew longer. It is still within the line-width count.

## Checks (run on `0c6351b3`)
- `npm run check`: tsc passed with no errors.
- `npm test`: 1563 tests, 1499 passed, 0 failed, 64 skipped. The structure tests passed; only existing yellow files were reported, none touched by this branch.
- `npm run mutate`: 14 mutants, 14 caught, 0 survived.

PASS