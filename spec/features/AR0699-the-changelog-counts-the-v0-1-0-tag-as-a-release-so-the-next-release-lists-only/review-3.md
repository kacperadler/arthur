# AR0699 - Review 3

- Job: 2026-11-16-review-d40eec5c
- Branch: arthur/2026-11-13-worker-c147cfc8
- Commit reviewed: 909a89e4c480f5dbba2afaf0e7a3e5ee11b62444
- Verdict: FAIL

## Final message

I'm failing this branch. The tag rule meets the ticket's Done means and the earlier findings are fixed (the terminal prompt, the non-timeout errors). The problem is one credential-redaction rule that no test covers, and the worker says no test can reach it, which is wrong.

## Findings

1. **`packages/delivery/src/changelog.ts:139`: the URL redaction rule is reachable, but no test covers it.**
   - **The surviving mutation:** `npm run mutate` on `909a89e4` printed `survived: … said.replace(/\S+:\/\/\S+|\S*@\S+/g, "origin") => said.replace(/\S*@\S+/g, "origin")`.
   - **What the worker claims:** no git message prints a URL without quotes and without an `@`, so "no test can reach this part".
   - **What I saw with git 2.43:** with origin set to `https://127.0.0.1:1/t0ken%0a/shop.git`, a fetch prints `fatal: credential url cannot be parsed: https://127.0.0.1:1/t0ken%0a/shop.git/`. The URL has no quotes and no `@`, and git prints it before it tries to connect, so a test runs fast and the same way every time.
   - **The leak:** I called `writeChangelog(…, true)` from a throwaway script:
     - On the branch it said `git fetch: fatal: credential url cannot be parsed: origin`.
     - With the mutation it said `… cannot be parsed: https://127.0.0.1:1/t0ken%0a/shop.git/`, path and all.
   - **Why it fails the branch:** this rule keeps a credential in a URL's path or query out of the merge's output. The review criteria count an uncaught mutation of a guard like this as a FAIL, and they count a credential printed in an error as a secret leak.
   - **Fix:** add this URL to the transport test in `changelog-fetch.test.ts`, and assert the line ends in `cannot be parsed: origin` and does not contain `t0ken`.

## Notes
- (minor) `packages/delivery/src/changelog.ts:131`: removing `GCM_INTERACTIVE: "never"` or `SSH_ASKPASS_REQUIRE: "never"` from the fetch's env breaks no test in `changelog-fetch.test.ts` or `changelog.test.ts` (10 pass, 0 fail each time). The test machine has no Git Credential Manager and no `DISPLAY`, so these two settings change nothing there.

## Checks (all on `909a89e4`)
- **`npm run check`:** `tsc` passed.
- **`npm test`:** 1873 tests, 1809 pass, 0 fail, 0 cancelled, 64 skipped. A first run passed with no `not ok` line, but my grep dropped its counts; these counts are from a second run. The structure test passed, and `merge-command.ts` is at 220 lines (yellow), the same as at the base `6f50daf3`.
- **`changelog-fetch.test.ts` alone:** 4 pass, 0 skipped. `script` is installed here, so the terminal test did run.
- **`npm run mutate`:** 100 mutants, 96 caught, 4 survived, 9 not run (`--max 100`); this matches the worker's numbers.
  - The two cuts of the condition at `merge-command.ts:165` cannot be caught: `ticket` and `folder` are always set together.
  - `core.fsmonitor=true` behaves the same as `false` on Linux.
  - The `://` survivor is finding 1.
- **Hand mutations:** each run on `changelog-fetch.test.ts` and `changelog.test.ts`, then restored with `git checkout --`. The checkout is clean.
  - Caught, with 1 or 2 failures each:
    - `detached: true` removed;
    - the config refusal turned off;
    - `--refmap=` removed;
    - `GIT_PROTOCOL_FROM_USER` removed;
    - the tag pattern's `$` anchor removed;
    - `at === -1` removed;
    - `each.version === tag` removed;
    - `peeled || own` changed to `own`;
    - the tag sort order reversed;
    - the `(?<!transport )` exception removed;
    - the `\S*@\S+` rule removed;
    - `GIT_ASKPASS: ""` removed.
  - Not caught (10 pass, 0 fail): `GCM_INTERACTIVE` and `SSH_ASKPASS_REQUIRE` removed (see Notes).
- **Goal on the real history:** I cloned this repository to a temporary folder, tagged `v0.1.0` at `b62e8f9f`, and rebuilt `CHANGELOG.md` with `writeChangelog` through `fakeHost`. It wrote 624 merged tickets: `## Unreleased` with 70, then `## 0.1.0 (2026-11-07)` with 554, AR0640 (`b62e8f9f`) at the top of that section. The folder is removed.
- **Redaction probe:** the throwaway script from finding 1, run in a temporary folder, with the mutation applied by `sed` and then restored.

FAIL