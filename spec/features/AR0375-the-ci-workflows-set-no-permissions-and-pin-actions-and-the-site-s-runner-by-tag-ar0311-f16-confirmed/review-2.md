# AR0375 - Review 2

- Job: 2026-10-25-review-ff67b5de
- Branch: arthur/2026-10-25-worker-47922f4a
- Commit reviewed: 56659c9c4039f51b2f14e5c698108f877d1b3159
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0375 asks, and every check I ran reproduces what the worker claimed.

**What the diff does, checked against the ticket's "Done means"**
- `permissions: contents: read` is at the top of `.github/workflows/ci.yml:7-8` and `.github/workflows/site.yml:8-9`. `deploy` keeps its own `pages: write` and `id-token: write` (`site.yml:34-36`).
- Every `uses:` is pinned to a 40-hex commit, with the tag as a comment. `git ls-remote --tags` on each action's repository shows each pin is the commit its tag points at:

  | Action | Commit | Tag |
  |---|---|---|
  | `checkout` | `11d5960a…` | v4 / v4.4.0 |
  | `setup-node` | `49933ea5…` | v4 / v4.4.0 |
  | `upload-pages-artifact` | `fc324d35…` | v5 / v5.0.0 |
  | `deploy-pages` | `368f8252…` | v5 / v5.0.1 |

  None of these tags has a `^{}` entry, so they are lightweight tags and each pin is a commit.
- Both jobs in `site.yml` now use `runs-on: ubuntu-24.04`, as `ci.yml` does.
- The new test is at `test/structure.test.ts:692-702`. It reads `.github/workflows/*.yml` and checks two things: each file has a `permissions:` at column 0, and each `uses:` matches `@[0-9a-f]{40}`.
- `packages/develop/test/plugin-new.test.ts:14` now copies `.github` into its copy of the repository. Without that, the new structure test throws ENOENT inside the plugin-new test (reproduced below).
- Both commits follow Conventional Commits with `AR0375` as the scope. The diff touches nothing outside the ticket.

**Notes (do not block the merge)**
- `test/structure.test.ts:698`: the test only checks that a top-level `permissions:` exists, not what it grants. When I mutated `contents: read` to `contents: write`, the test still passed. A top-level `permissions: write-all` would pass too. The ticket only asks for the block to be there, so this is not a finding.
- The test reads only `*.yml` files, so a future `.yaml` workflow would go unchecked. The ticket names `*.yml`.
- The `uses:` pattern fails safe: a quoted pin like `"x@<sha>"`, or the text `uses:` inside a `run:` line, fails the test rather than slipping through.

**Checks run**
- `npm ci`: added 22 packages, no errors.
- `npm run check` (`tsc`): no errors.
- `npm test`: 1107 tests, 1049 pass, 0 fail, 58 skipped (~392 s).
- Pins compared against the tags from `git ls-remote --tags` for all four actions: all match.
- Mutations of the workflows, each run against the new test with `--test-name-pattern="pins every action"`. Each one fails the test:
  - removed `permissions:` from `ci.yml`
  - `site.yml` checkout changed to `@v4`
  - `deploy-pages` changed to `@v5`
  - `site.yml` `permissions:` indented so it is no longer top-level
  - `setup-node` SHA cut to 39 hex
  - `uses: "actions/checkout@v4"` (quoted tag)
  - no `.yml` files in the folder
- Mutation of `contents: read` to `contents: write`: the test passes, as noted above.
- Mutation removing `.github` from `FILES` in `plugin-new.test.ts`: 4 pass, 1 fail, with `ENOENT … scandir '…/arthur/.github/workflows'`. So the worker's fix is needed.
- Every mutation was restored with `git checkout --`. The temporary folder `/tmp/ar0375-bk` that I used for the empty-folder mutation is removed, and `git status --short` is clean.

PASS