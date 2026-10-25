# AR0419 - Review 2

- Job: 2026-10-25-review-12911be4
- Branch: arthur/2026-10-25-worker-37272db5
- Commit reviewed: aa45dc7eba3fa3d0c2c85469b9fe6c6679197f0e
- Verdict: PASS

## Final message

Nothing blocks the merge. The branch does what AR0419 asks, the checks pass, and the worker's claims reproduce.

**Findings:** none. The range changes only the workflow test in `test/structure.test.ts:692-702`, which the ticket's Scope names.
- **`.yaml` files:** `test/structure.test.ts:695` now matches files with `/\.ya?ml$/`, so `.yaml` workflows are read too.
- **Exact block:** `test/structure.test.ts:699` requires a column-0 `permissions:` header with exactly `["  contents: read"]` under it, once blank and comment lines are dropped.
- **Both mutations from the ticket fail the test:** `contents: write`, and `permissions: write-all` with the `contents` line removed.
- **Job-level grants:** deploy's `pages: write` and `id-token: write` in `site.yml` still pass, so the Out scope holds.

**Notes (not blocking):**
- A second top-level `permissions:` key gets past the test, because `match` reads only the first block. I saw this two ways: a later `permissions:\n  contents: write` before `jobs:`, and a quoted `"permissions":` with `contents: write` placed first. Both passed. I believe GitHub rejects workflows with duplicate keys, so neither would run, but I didn't check that [INFERENCE].
- The check is strict about form: a trailing comment on `  contents: read`, CRLF line endings, or a flow mapping like `permissions: {contents: read}` all fail it. That fails safe, and the worker's message says so.
- The test can't catch a mutation of itself (for example, putting the filter back to `.yml` only), because the repo has no `.yaml` workflow. That's built into a test that reads the real repo files.
- Both commits use Conventional Commits with `AR0419` as the scope.

**Checks I ran:**
- `npm ci`: added 22 packages.
- `npm run check` (`tsc`): no errors.
- `timeout 900 npm test`: 1108 tests, 1050 pass, 0 fail, 58 skipped.
- I mutated the workflows, ran `node --test --test-name-pattern="CI workflow" test/structure.test.ts` after each change, and restored after each run. `git status --short` was clean at the end.

| Mutation | Result |
|---|---|
| `ci.yml`: `contents: write` | fail |
| `ci.yml`: `permissions: write-all`, `contents` line removed | fail |
| new `x.yaml` with unpinned `actions/checkout@v4` | fail |
| `x.yaml` with no `permissions` | fail |
| `x.yaml` with `contents: write` | fail |
| `x.yaml` valid (control) | pass |
| blank line, then `  pull-requests: write` | fail |
| `# c` at column 0, then `  id-token: write` | fail |
| whitespace-only line, then an extra grant | fail |
| tab-indented extra grant | fail |
| `  actions: write` before `contents: read` | fail |
| anchor `permissions: &p` | fail |
| a second top-level `permissions:` with `contents: write` | pass (note above) |
| a quoted `"permissions":` with `contents: write` placed first | pass (note above) |
| control: comments and blank lines after `contents: read` | pass |

PASS