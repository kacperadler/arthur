# AR0641 - Outcome

- Merged: 2026-11-12, `bb47fe30`
- Branch: arthur/2026-11-12-worker-3d75af76
- Reviews: review-1.md PASS
- Cost: worker $4.48, reviews $1.13; review rounds 1

## What went in

- `.github/workflows/release.yml`: new; on a push to `main` that changes `package.json`, runs `node test/release.ts` with the workflow's own token (`contents: write` on the job), one run at a time.
- `test/release.ts`: new; the workflow's step. Makes no release when there is no version, the tag is already on origin, or `CHANGELOG.md` has no section for the version. Otherwise runs `npm ci`, `npm run check`, `npm test`, then `gh release create v<version> --target <HEAD> --notes-file -` with the section as notes; any failed step ends the run with exit 1.
- `test/release.test.ts`: new; runs `test/release.ts` in a clone of a real Git origin with fake `npm` and `gh`. Covers the release, each no-release case, each failed step, the last section of the file, a missing origin, and the workflow's trigger, permission and step.
- `packages/delivery/src/changelog.ts`: finds releases on HEAD's first-parent line from the root version and puts each ticket under its release. Writes `## Unreleased` and `## <version> (<date>)`, with `###` per day and `####` per kind; a project with no release gets the same file as before.
- `packages/delivery/test/changelog.test.ts`: tests on real Git histories: releases, merges, time zone, a release with no ticket, the by-day fallback, Unreleased, and byte-for-byte output for a version that never changed, a broken `package.json` and a replaced commit.
- `packages/delivery/test/merge-outcome.test.ts`: a release ticket's own `arthur merge` writes and commits its release section, with no Unreleased heading; the next merge's ticket goes under Unreleased.
- `packages/delivery/docs/commands/changelog.md`: new "Releases" section describing the per-release format and rules.
- `packages/core/docs/commands/version.md`: describes the `Release <version>` ticket, the release workflow and the cases that make no release.
- `test/structure.test.ts`: delivery's line budget goes from 2267 to 2318.
- `spec/features/AR0641-roadmap-105-the-release-workflow-and-the-changelog-per-release/findings.md`: new; F1, the first release 0.1.0.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1714/1785 passed.

## Left open

- Deferred (client summary): F1. A `Release 0.1.0` ticket cannot make release 0.1.0
- Deferred (client summary): F2. the job's `contents: write` token is in `GH_TOKEN` for the whole step, and `actions/checkout` saves the token in `.git/config` by default
- Deferred (client summary): F3. `concurrency: release` without a queue keeps only one pending run
- Deferred (client summary): F4. with v0.1.0 made by hand (AR-D659), `CHANGELOG.md` gets no `## 0.1.0` section
