# AR0344 - Review 1

- Job: 2026-10-25-review-412e99e5
- Branch: arthur/2026-10-25-worker-26e85465
- Commit reviewed: a269fe70adbf1eac27dac727735be86b474d2d31
- Verdict: FAIL

## Final message

I'm failing this branch on test coverage. The fix works and every check passes, but the changed line has two halves, and two mutations of it pass all tests. One of them would let the core accept a value that is not a variable name.

## Findings

1. **`packages/core/src/env.ts:102`: deleting `!VARIABLE.test(name) ||` passes every test** (env and config-check: 24 pass, 0 fail). Before this branch, the test case `cEnv: "ghp_pasted-secret"` caught that deletion, because only the variable-name check hid that value. Now the new `!name.startsWith("ARTHUR_")` hides `ghp_pasted-secret` and `DEADBEEF0123` on its own. So no test reaches the variable-name check any more: it only matters for a value that starts with `ARTHUR_` but is not a variable name, and no test has one.

   Reading the code, without that check a value like `ARTHUR_YOUTRACK_ghp-x` gets past the prefix check on line 103 and the owner check on lines 105–106, so `nameProblem` returns `undefined` and the core accepts it as a variable name. The branch removed the only test of the refusal that keeps pasted text from being taken for a name. That is the "mutation not caught" FAIL in the review criteria.

   Fix: add a value like `fEnv: "ARTHUR_YOUTRACK_ghp-secret"` to the test "an option that is not a name is refused without showing it", and include it in the `doesNotMatch` check.

2. **`packages/core/src/env.ts:102`: changing `startsWith("ARTHUR_")` to `startsWith("ARTHUR")` passes every test** (24 pass, 0 fail). This moves the limit by one character, which the criteria name as a FAIL. With it, a value like `ARTHURTOKEN123`, which matches `VARIABLE`, would be printed back as `got ARTHURTOKEN123`. No test uses a value that starts with `ARTHUR` but not `ARTHUR_`.

## Notes
- The fix does what the ticket asks. `DEADBEEF0123` is now hidden, the requested test case and its `doesNotMatch` check are there, and the docs line in `docs/commands/config.md` is updated.
- Changing the old `YOUTRACK_TOKEN` test to expect the hidden line is correct: the ticket's Done means asks for exactly that.
- The worker's claims match what I see: 24 passing in `env.test.ts` + `config-check.test.ts`, `tsc` clean, and removing `|| !name.startsWith("ARTHUR_")` makes 2 tests fail.
- No boundary or Shape rule breaks, and the file's line count is unchanged.
- Leaving `CHANGELOG.md` alone is right, since the worker says `arthur changelog` writes it.

## Checks run
- `npm ci`: added 22 packages.
- `npm run check`: `tsc`, no errors.
- `npm test`: 1107 tests, 1049 passed, 0 failed, 58 skipped, exit 0.
- Mutations in `packages/core/src/env.ts`, each followed by `node --test test/env.test.ts test/config-check.test.ts`:
  - Remove `|| !name.startsWith("ARTHUR_")`: 2 tests fail (caught).
  - Change `||` to `&&`: 2 tests fail (caught).
  - Remove `!VARIABLE.test(name) ||`: 0 tests fail (**not caught**).
  - `"ARTHUR_"` → `"ARTHUR"`: 0 tests fail (**not caught**).
- After each mutation I restored the file with `git checkout -- src/env.ts`; `git status --short` is clean.

FAIL