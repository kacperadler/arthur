# AR0641 - Review 1

- Job: 2026-11-12-review-c5df69e3
- Branch: arthur/2026-11-12-worker-3d75af76
- Commit reviewed: bfc73ec7179908672ef581dcd26e89fd9f2ee854
- Verdict: PASS

## Final message

No blocking findings. The branch delivers roadmap entry 105's Delivers and Done means. Not counting a version's first appearance as a release matches the owner's decision AR-D659 (make v0.1.0 by hand once on GitHub). Every claim in the worker's final message that I checked reproduces.

- **Changelog per release:** the work is in `releasesOf` and `releaseOf` in `packages/delivery/src/changelog.ts`.
  - A release is a commit on HEAD's first-parent line whose version differs from its parent's, and the merge commit of a side branch counts. The tests in `changelog.test.ts` cover this on real Git histories.
  - A ticket goes under the first release at or after its merge hash; a ticket with no hash goes by day.
  - The `core.timeZone` date is tested, and so is the release with no ticket.
  - A project whose version never changed gets the same file byte for byte, also with a broken `package.json` and with a planted `refs/replace`.
  - In `merge-outcome.test.ts`, the release ticket's own merge commits its release section.
- **Workflow and step:** `.github/workflows/release.yml` and `test/release.ts` are tested by `test/release.test.ts`, against a real bare Git origin with fake `npm` and `gh`.
  - It makes no release when the tag exists, when there is no version, or when `CHANGELOG.md` has no section for the version.
  - `"0.2"` does not match `## 0.2.0 (`, and the existing tag `v0.2.0-rc.1` does not count as `v0.2.0`.
  - If `npm ci`, `npm run check`, `npm test`, `gh` or the origin check fails, the run fails and nothing after it runs.
  - The trigger, the `contents: write` permission and the `GH_TOKEN` step are checked.
- **Line budget:** delivery goes from 2267 to 2318, and the final message names it. The +51 is exact: net +50 lines in `packages/delivery/src/changelog.ts` (62 added, 12 removed), plus 1 for its one line over 160 characters.
- **Docs:** the `arthur changelog` and `arthur version` help pages are updated. No other doc still describes the old format in a way that is now false.
- **Boundaries and size:** no plugin imports another, no runtime dependency, nothing non-erasable; `changelog.ts` is 115 lines.

## Notes
- (risk) .github/workflows/release.yml:17-30: the job's `contents: write` token is in `GH_TOKEN` for the whole step, and `actions/checkout` saves the token in `.git/config` by default. So `npm ci` (dependency install scripts) and all of `npm test` run while holding a token that can write. Splitting into a read-only test job and a separate job that only runs `gh release create` would avoid that.
- (risk) .github/workflows/release.yml:20: `concurrency: release` without a queue keeps only one pending run. If a newer push arrives while one run is going, the older pending run is cancelled, and its version gets no release until someone reruns that run by hand.
- (risk) packages/delivery/src/changelog.ts:43-58: with v0.1.0 made by hand (AR-D659), `CHANGELOG.md` gets no `## 0.1.0` section. The first release the workflow makes will therefore list every ticket since the start: 602 tickets, about 61 KB today. GitHub limits a release body to 125,000 characters; at that limit `gh release create` fails.
- (minor) packages/delivery/docs/commands/changelog.md:51-53: the example puts `AC0005 Release 0.2.0` under `#### Other`. A release ticket has kind `chore`, which goes under `Changed`, as the branch's own tests show.
- (minor) spec/features/AR0641-roadmap-105-the-release-workflow-and-the-changelog-per-release/findings.md:14: F1 is still `Status: open` although AR-D659 decided it. If it stays open, the merge files a planning ticket for a question already answered.
- (minor) packages/delivery/src/changelog.ts:44: `releaseOf` scans the whole first-parent line again for each ticket and each release. One run with one release on this history (602 tickets, 2916 commits) took 396 ms; the time grows with each release.
- (minor) packages/delivery/src/changelog.ts:89: the one surviving mutant (`return undefined;` deleted) behaves exactly the same as the original, so no test can catch it.

## Checks (all on bfc73ec7)
- `npm run check`: exit 0. `npm test`: 1768 tests, 1704 pass, 0 fail, 64 skipped.
- `npm run mutate`: 25 mutants, 25 caught, 0 survived. `npm run mutate -- --max 200`: 147 mutants, 146 caught, 1 survived (`changelog.ts:89`, the one above).
- Smoke run of the changelog, through the fake host, on a scratch clone of this checkout with one extra commit raising the version to 0.1.1:
  - It printed `wrote CHANGELOG.md: 602 merged tickets` in 396 ms.
  - The only `## ` heading was `## 0.1.1 (2026-11-12)`, with no Unreleased.
- Smoke run of `node test/release.ts` in that same clone: no tag on its origin and the section was found, so it went on to `npm ci` and into the checks. The 300 s tool timeout stopped it during the checks, so the end of that run has no result.
  - It never reached `gh`, and the `gh` here cannot load its config in the sandbox anyway.
  - No process is left, and the scratch folder is removed.
- `npx arthur changelog --help` could not run here: there is no `arthur.config.ts`, so the command is unknown. I read the help page's source instead.

PASS