# AR0352 - The always-review list never matches a path under `.agents/`: `**` does not enter a dot folder

```json
{
  "id": "AR0352",
  "title": "The always-review list never matches a path under `.agents/`: `**` does not enter a dot folder",
  "date": "2026-10-23"
}
```

## Description

with Node v24.21.0, `matchesGlob(".agents/arthur/roles/reviewer.md", "**/roles/reviewer.md")` is `false` and `matchesGlob(".agents/arthur/criteria/review.md", "**/criteria/review.md")` is `false`, while `matchesGlob("packages/delivery/roles/reviewer.md", "**/roles/reviewer.md")` is `true`: `**` does not enter a folder whose name starts with a dot, so the project's own reviewer override and review criteria, the files the list exists for, are never held; a worker's branch that changes only them gets `no review` (`review-needed.ts:65`), and `autopilot.ts:67` lets a ticket whose Scope names them through. The same holds for any pattern the owner writes with `**` for a file under `.agents/`, `.github/` (the default's `.github/workflows/**` names the folder, so it works) or another dot folder.

## Goal

The always-review list matches paths under dot folders such as `.agents/`, so a project's own reviewer and criteria files are always reviewed; tested.

- Kind: fix

Evidence:
- `packages/delivery/src/delivery-options.ts:16` (`**/roles/reviewer.md`, `**/criteria/review.md`, written to hold "the review rules themselves", `:13-15`), `packages/delivery/src/delivery.ts:49` (`matchesGlob`), `packages/delivery/test/review-needed.test.ts:167` (tests `packages/delivery/roles/reviewer.md`, never a project's `.agents/…` path)
- Found by: 2026-10-23-ar0322-security-check-8f253fd2 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: match each glob also against the path with its leading dot folders made plain, or add explicit entries `.agents/**/roles/reviewer.md`, `.agents/**/criteria/review.md` (and with F3, `.agents/**`); say in `docs/commands/review-needed.md` that `**` does not enter a dot folder unless the pattern names it. Tests in `review-needed.test.ts`: a branch changing only `.agents/arthur/roles/reviewer.md`, and one changing only `.agents/arthur/criteria/review.md`, each answered `review: … is on the always-review list`; `delivery.alwaysReview` answering both paths with the default list. Overlaps AR0324's area (what reaches main unreviewed); filed here as the files are the roles' prompts.
- `npm test` and `npm run check` pass.

## Scope

In:
- match each glob also against the path with its leading dot folders made plain, or add explicit entries `.agents/**/roles/reviewer.md`, `.agents/**/criteria/review.md` (and with F3, `.agents/**`); say in `docs/commands/review-needed.md` that `**` does not enter a dot folder unless the pattern names it. Tests in `review-needed.test.ts`: a branch changing only `.agents/arthur/roles/reviewer.md`, and one changing only `.agents/arthur/criteria/review.md`, each answered `review: … is on the always-review list`; `delivery.alwaysReview` answering both paths with the default list. Overlaps AR0324's area (what reaches main unreviewed); filed here as the files are the roles' prompts.

## Decisions

- 2026-10-23: Source: F4 of AR0322
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
