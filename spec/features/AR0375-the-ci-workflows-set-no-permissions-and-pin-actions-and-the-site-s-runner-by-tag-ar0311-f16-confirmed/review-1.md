# AR0375 - Review 1

- Job: 2026-10-25-review-6cce0e6f
- Branch: arthur/2026-10-25-worker-47922f4a
- Commit reviewed: 1f772099e11b0397c97bf3591e895f8c391ef0fc
- Verdict: FAIL

## Final message

I found one blocking issue: the branch's new test breaks an existing test, so `npm test` fails.

## Findings

1. **`test/structure.test.ts:693` breaks `packages/develop/test/plugin-new.test.ts:57`, and `npm test` fails.** The new test calls `readdirSync(<root>/.github/workflows)` without checking first that the folder exists. The plugin-new test copies part of the repository into a temporary folder and runs `test/structure.test.ts` there. Its file list (`FILES`, `plugin-new.test.ts:14`) has no `.github`, so in the copy the new test throws `ENOENT: no such file or directory, scandir '/tmp/arthur-test-…/arthur/.github/workflows'`. The test "a new package passes npm run check, its own test and the structure test as created; one without a budget still fails" then fails. This branch causes it: with `test/structure.test.ts` set back to the base version, the same file passes 5 of 5.
   - The ticket's "`npm test` and `npm run check` pass" is not met.
   - The worker's final message says "I did not run the full `npm test`" and calls the ticket done anyway.
   - One fix is to add `.github` to `FILES` in `plugin-new.test.ts`. Making the test skip a missing folder is not a fix, because it would also pass a repository with no workflows.

## Notes (not blocking)

- **Pins are correct.** I checked every SHA with `git ls-remote --tags`:
  - `checkout` and `setup-node` match both `v4` and `v4.4.0`.
  - `upload-pages-artifact` matches `v5` and `v5.0.0`.
  - `deploy-pages` matches `v5` and `v5.0.1`.
  - No `^{}` entries came back, so these are the commits themselves, not tag objects.
  - The comments name the exact release (`# v4.4.0`) rather than `# v4`, which is fine.
- **Workflows match the ticket.** Both have top-level `permissions: contents: read`, `deploy` keeps `pages: write` and `id-token: write`, and both `site.yml` jobs run on `ubuntu-24.04`.
- **Gaps the ticket allows:**
  - The test only checks that a top-level `permissions:` exists, so `permissions: write-all` passes.
  - It only reads `*.yml`, so a new `.yaml` workflow with `@v4` is not checked (I tried this: it passes).
  - Nothing tests `runs-on`.

## Checks run

- `npm ci`: OK, 22 packages added.
- `npm run check` (`tsc`): no errors.
- `npm test`: 1107 tests, 1048 pass, **1 fail** (the plugin-new test above), 58 skipped, exit 1.
- `node --test packages/develop/test/plugin-new.test.ts`: fails with the `ENOENT` scandir error above. With `test/structure.test.ts` set back to the base version: 5 pass, 0 fail. I restored the file with `git checkout 1f772099 -- test/structure.test.ts` and the tree is clean.
- **Mutations** on a temporary copy of `.github`, `test` and `package.json`, running the new test each time:

| Mutation | Result |
|---|---|
| Unchanged (baseline) | passes |
| `permissions` removed from `site.yml` | fails (caught) |
| `permissions:` indented in `ci.yml`, so not top-level | fails (caught) |
| `upload-pages-artifact@v5` | fails (caught) |
| 39-character SHA | fails (caught) |
| 43-character SHA | fails (caught) |
| Quoted `"actions/checkout@v4"` | fails (caught) |
| Extra `.yaml` file with `@v4` | passes (not caught; outside the ticket's scope) |

FAIL