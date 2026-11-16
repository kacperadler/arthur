# AR0699 - Outcome

- Merged: 2026-11-16, `47580408`
- Branch: arthur/2026-11-13-worker-c147cfc8
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md FAIL
- Cost: worker $14.33, reviews $3.51; review rounds 3

## What went in

- `packages/delivery/src/changelog.ts`: `releasesOf` counts a `v<x.y.z>` tag on the first-parent line as that version's release, one release per commit: the version change's, else the highest tag's. It skips an empty `git log` entry, so it never reads the index. `writeChangelog(host, project, fetch)` first fetches origin's `v*` tags when `fetch` is true, through `fetchTags`:
- `packages/delivery/src/merge-command.ts`: a merge without a ticket rebuilds the changelog with the tag fetch.
- `packages/delivery/src/merge-outcome.ts`: a ticket's merge rebuilds the changelog with the tag fetch.
- `packages/delivery/test/changelog-fetch.test.ts`: new; one test per guard of the tag fetch, each failing when its guard is removed. This includes the terminal-session test and the redaction of a quoted URL, an unquoted URL, a credential and userinfo.
- `packages/delivery/test/changelog.test.ts`: tag releases (plain, annotated, off the line, other names, a version a change already made, one release per commit), and `arthur changelog` ignoring a tag only origin has.
- `packages/delivery/test/merge-outcome.test.ts`: the merge's tag fetch end to end: a tag only origin had becomes a release, local tags stay, and a refused fetch or an unreachable origin is reported while the merge goes on.
- `packages/delivery/docs/commands/changelog.md`: "Releases" states the tag rule, one release per commit, the merge's fetch with what it never runs or writes (no terminal for ssh included), and each form of its failure line.
- `packages/delivery/docs/commands/merge.md`: step 7 fetches origin's `v*` tags before the rebuild and points to "Releases".
- `spec/roadmap.md`: entry 105's release rule includes the `v<x.y.z>` tag and the fetch.
- `spec/features/AR0699-the-changelog-counts-the-v0-1-0-tag-as-a-release-so-the-next-release-lists-only/findings.md`: new; F1, a tag of an annotated tag is no release, and F2, the 60 s limit has no test, both `Status: open`.
- `test/structure.test.ts`: the delivery line budget is 2370.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1813/1884 passed.

## Left open

- Deferred (client summary): F1. A tag of an annotated tag is no release
- Deferred (client summary): F2. The tag fetch's 60 s limit has no test
