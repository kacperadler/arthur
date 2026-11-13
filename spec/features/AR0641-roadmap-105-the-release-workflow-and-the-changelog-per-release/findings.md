# AR0641 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A `Release 0.1.0` ticket cannot make release 0.1.0

- Kind: chore
- Found by: 2026-11-12-worker-3d75af76 (worker), 2026-11-12
- Where: `package.json` (root), set to 0.1.0 by AR0640's merge `b62e8f9f`; `packages/delivery/src/changelog.ts` (`releasesOf`); `test/release.ts`
- What: AR0640 added `"version": "0.1.0"` to every `package.json`, where there was no version before. This branch counts a release only when the version differs from the first parent's and both have one, so a project's first `package.json` (version `1.0.0` from `npm init`) gets no fake release, and its `CHANGELOG.md` stays the same byte for byte (entry 105's Done means). By that rule, AR0640's merge is no release: Arthur's own `CHANGELOG.md` gets no `## 0.1.0` section, and `release.yml` on a later push that changes `package.json` prints `CHANGELOG.md has no section 0.1.0: no release of v0.1.0; a release ticket's merge writes it` and makes none. A `Release 0.1.0` ticket (this ticket's Scope, Out) cannot help: its worker's `npm version 0.1.0 --workspaces --include-workspace-root --no-git-tag-version` changes nothing when the version is already 0.1.0 (npm refuses `Version not changed` without `--allow-same-version`), so its merge makes no release commit. Seen by running the changelog on this checkout: `CHANGELOG.md` came out byte for byte as at `613b55ea`.
- Suggestion: the owner picks one. (1) The first release is the next version, `Release 0.1.1` or `Release 0.2.0`, through the workflow as built. (2) Release 0.1.0 by hand once: `gh release create v0.1.0 --target <main's commit> --notes '<text>'`, and the workflow takes over from the next version. (3) Count a version that appears as a release: then AR0640's merge is 0.1.0 with the tickets up to it, but `release.yml` would tag v0.1.0 at the next push that changes `package.json`, past those tickets, and every project whose `package.json` came after its first commit would get a release heading it never made.
- Status: deferred (client summary)

## F2. the job's `contents: write` token is in `GH_TOKEN` for the whole step, and `actions/checkout` saves the token in `.git/config` by default

- Kind: fix
- Found by: 2026-11-12-review-c5df69e3 (review), 2026-11-12
- Where: `.github/workflows/release.yml:17-30`
- What: So `npm ci` (dependency install scripts) and all of `npm test` run while holding a token that can write. Splitting into a read-only test job and a separate job that only runs `gh release create` would avoid that.
- Status: deferred (client summary)

## F3. `concurrency: release` without a queue keeps only one pending run

- Kind: fix
- Found by: 2026-11-12-review-c5df69e3 (review), 2026-11-12
- Where: `.github/workflows/release.yml:20`
- What: If a newer push arrives while one run is going, the older pending run is cancelled, and its version gets no release until someone reruns that run by hand.
- Status: deferred (client summary)

## F4. with v0.1.0 made by hand (AR-D659), `CHANGELOG.md` gets no `## 0.1.0` section

- Kind: fix
- Found by: 2026-11-12-review-c5df69e3 (review), 2026-11-12
- Where: `packages/delivery/src/changelog.ts:43-58`
- What: The first release the workflow makes will therefore list every ticket since the start: 602 tickets, about 61 KB today. GitHub limits a release body to 125,000 characters; at that limit `gh release create` fails.
- Status: ticket AR0699
