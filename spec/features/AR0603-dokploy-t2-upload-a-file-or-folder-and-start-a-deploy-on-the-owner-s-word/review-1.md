# AR0603 - Review 1

- Job: 2026-11-06-review-53a48921
- Branch: arthur/2026-11-06-worker-8af99dd8
- Commit reviewed: 2b492bd3153be8d58f8ac4ae880dcffd4b5bfda9
- Verdict: FAIL

## Final message

**Findings**

1. `README.md:27`: the Status paragraph still says "Next, to close the first version: Docker's job labels, cleanup and leftover sweep (roadmap entries 70 to 72) **and dokploy's upload and deploy**". The branch updated README lines 50, 55 and 71, along with `arthur.mmd`, the roadmap and the docs, to say upload and deploy are built. This line still lists them as work to come. `README.md` is in the ticket's Scope In, and the review criteria fail any README line that still says what the branch changed. Fix: remove "and dokploy's upload and deploy" from the "Next" sentence.

Beyond that line, the branch meets the ticket and the AR0588 plan's Ticket 2:
- **Zip:** `dokploy-zip.ts` writes regular files only. It refuses a symlink, a special file, a missing or unreadable path, an empty folder, more than 65535 files, and a zip of more than 4 GiB.
- **Upload:** it reads the app first, refuses to switch the source without `--replace-source` (only for an app that has deployments, as the plan says), and keeps `dropBuildPath`.
- **Deploy:** `deploy` posts JSON to `application.deploy`.
- **Order:** an ambiguous instance is refused before any request, and so is a bad path (test at `dokploy.test.ts` ~385).
- **Tests:** a zip read-back test, Content-Type checks, and the fake's shapes recorded in `dokploy-shapes.json` and `fake-shapes.test.ts`.
- **Role:** the coordinator role has the two lines the plan asks for.
- **Vision:** `spec/vision.md:77` already said this before the branch (AR0601).

**The mutate results you asked me to judge** (I did not rerun mutate):
- **`dokploy-options.ts:42`, the `tokenEnv` wording:** acceptable. Only the description text changes, and a test that pins wording would break the styleguide.
- **`dokploy-zip.ts:32`, `>` against `>=`:** acceptable, and `>` is the right bound. The two differ only when the zip's upper bound is exactly `0xffffffff`. That still fits the zip's 32-bit size and offset fields, and no entry's size or offset can reach the `0xffffffff` zip64 marker under that bound. The refusal one byte past the limit is tested, as are 65535 files accepted and 65536 refused.

## Notes
- (risk) `packages/dokploy/src/dokploy-zip.ts:18`: a ready `.zip` is sent unchecked. A `.zip` that starts with `PK\x03\x04` goes to Dokploy as it is, so symlink entries inside it are never refused. The plan approves sending it as it is, but "the zip holds regular files only" does not hold for this path.
- (minor) `CHANGELOG.md`: not touched, though the ticket's Done means names it. Git history shows the coordinator adds CHANGELOG entries in its "spec: X merged" commits, so this is the existing convention, not a gap in the branch.
- (minor) `packages/dokploy/src/dokploy-zip.ts:43`: the whole zip, up to 4 GiB, is built in memory with `Buffer.concat`. A single file over 2 GiB fails earlier, at `readFileSync`, with "cannot be read (ERR_FS_FILE_TOO_LARGE)", after the size check has passed.

## Checks (on 2b492bd3)
- `node --import @arthur/core/testing --test packages/dokploy/test/dokploy.test.ts packages/dokploy/test/fake-shapes.test.ts packages/dokploy/test/dokploy-options.test.ts`: 20 tests, 20 pass, 0 fail.
- `node --import @arthur/core/testing --test test/structure.test.ts`: 20 tests, 20 pass, 0 fail. The dokploy sources are 418 raw lines in total; the budget is 450.
- I did not run the full `npm run check && npm test` or `npm run mutate`, as you asked. The worker reports tsc passing; 1588 tests with 1524 passing, 0 failing and 64 skipped; and mutate at 24 of 25 caught.

FAIL