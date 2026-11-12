# AR0641 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A `Release 0.1.0` ticket cannot make release 0.1.0

- Kind: chore
- Found by: 2026-11-12-worker-3d75af76 (worker), 2026-11-12
- Where: `package.json` (root), set to 0.1.0 by AR0640's merge `b62e8f9f`; `packages/delivery/src/changelog.ts` (`releasesOf`); `test/release.ts`
- What: AR0640 added `"version": "0.1.0"` to every `package.json`, where there was no version before. This branch counts a release only when the version differs from the first parent's and both have one, so a project's first `package.json` (version `1.0.0` from `npm init`) gets no fake release, and its `CHANGELOG.md` stays the same byte for byte (entry 105's Done means). By that rule, AR0640's merge is no release: Arthur's own `CHANGELOG.md` gets no `## 0.1.0` section, and `release.yml` on a later push that changes `package.json` prints `CHANGELOG.md has no section 0.1.0: no release of v0.1.0; a release ticket's merge writes it` and makes none. A `Release 0.1.0` ticket (this ticket's Scope, Out) cannot help: its worker's `npm version 0.1.0 --workspaces --include-workspace-root --no-git-tag-version` changes nothing when the version is already 0.1.0 (npm refuses `Version not changed` without `--allow-same-version`), so its merge makes no release commit. Seen by running the changelog on this checkout: `CHANGELOG.md` came out byte for byte as at `613b55ea`.
- Suggestion: the owner picks one. (1) The first release is the next version, `Release 0.1.1` or `Release 0.2.0`, through the workflow as built. (2) Release 0.1.0 by hand once: `gh release create v0.1.0 --target <main's commit> --notes '<text>'`, and the workflow takes over from the next version. (3) Count a version that appears as a release: then AR0640's merge is 0.1.0 with the tickets up to it, but `release.yml` would tag v0.1.0 at the next push that changes `package.json`, past those tickets, and every project whose `package.json` came after its first commit would get a release heading it never made.
- Status: open
