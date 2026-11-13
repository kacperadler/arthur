# AR0699 - The changelog counts the v0.1.0 tag as a release, so the next release lists only its own tickets

```json
{
  "id": "AR0699",
  "title": "The changelog counts the v0.1.0 tag as a release, so the next release lists only its own tickets",
  "date": "2026-11-13",
  "budget": 2
}
```

## Description

`CHANGELOG.md` has no `## 0.1.0` section: release 0.1.0 was tagged by hand (AR-D659) on the merge where `package.json` first got a version, and the changelog counts a release only where the version changes from one to another. So the next version bump puts every ticket since the start under its own heading and sends all of them as its GitHub release notes. After this fix the changelog counts a `v<x.y.z>` tag on main as that version's release, and the next release lists only its own tickets.

## Goal

The next release will publish wrong notes, listing everything already in 0.1.0. That breaks roadmap 105's per-release changelog and AR0698's Done means, and it grows each day toward GitHub's limit, where the release fails.

Evidence:
- `packages/delivery/src/changelog.ts:95-106` (`releasesOf`): a commit counts as a release only when both it and its first parent have a `version`, and the two differ.
- `git show b62e8f9f^:package.json | grep version` printed nothing (exit 1). `git show b62e8f9f:package.json` shows `"version": "0.1.0"`. So AR0640's merge, where 0.1.0 appears, is not counted as a release.
- `grep -n '^## ' CHANGELOG.md`: only day headings. There is no `## 0.1.0` and no `## Unreleased`. The file is 62 262 bytes with 614 ticket lines.
- `packages/delivery/docs/commands/changelog.md:36` documents the same rule: "A version that appears where there was none … is no release".
- AR0698's Done means: "The next version change on main makes its release through the workflow, with v0.1.0 as the one before it". `test/release.ts:21-28` sends the whole `## <next>` section to `gh release create` as the notes; GitHub caps a release body at 125 000 characters (AR0641 review-1).

- Kind: fix

## Done means

- A `v<x.y.z>` tag on main's first-parent line counts as that version's release at its commit, even where `package.json` history shows no version change; `CHANGELOG.md` rebuilt on a checkout with the v0.1.0 tag has a `## 0.1.0` section holding the tickets up to that merge, and later tickets go under the next release or the unreleased part.
- The merge fetches tags into the main checkout before it rebuilds the changelog, so the tag is there.
- A test in `packages/delivery/test/` with a tag on a version that appeared where there was none fails on today's `releasesOf` and passes after; the existing changelog tests pass.
- `packages/delivery/docs/commands/changelog.md` states the new rule.

## Scope

In:
- `packages/delivery/src/changelog.ts`: `releasesOf` reads `v<x.y.z>` tags on the first-parent line.
- `packages/delivery/test/changelog.test.ts`: the tag test.
- `packages/delivery/docs/commands/changelog.md`: the rule.

Out:
- `release.yml` and `test/release.ts` stay as they are.

## Decisions

- 2026-11-13: Source: audit spec/quality/2026-11-13.md
- 2026-11-13: Source: F4 of AR0641
- 2026-11-13: Pre-approved by policy: fix from audit spec/quality/2026-11-13.md, 3 Scope files, budget $2 of the $3 cap
- 2026-11-13: AR0699 worker budget $2 -> $5; the owner: "AR-D666 merge" (AR-D666)
