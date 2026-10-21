# AR0273 - Delivery ships no review criteria, so `arthur init` still writes `review.md` as `# Review`

```json
{
  "id": "AR0273",
  "title": "Delivery ships no review criteria, so `arthur init` still writes `review.md` as `# Review`",
  "date": "2026-10-21"
}
```

## Description

`arthur init` now writes the `criteria/<name>.md` a loaded package ships, but delivery ships none for `review`; with delivery loaded, `arthur init shop` printed `.agents/arthur/criteria/review.md` among the created files and the file holds `# Review` alone, so a new project's reviewer has no review criteria until someone writes them. `packages/delivery/roles/reviewer.md` relies on them: "the review criteria say what fails a branch".

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: improvement

Evidence:
- `packages/delivery/src/delivery.ts:50` (the reviewer reads `review`), no `packages/delivery/criteria/`
- Found by: 2026-10-21-ar0264-init-audit-criter-5fdc1131 (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: ship `packages/delivery/criteria/review.md` (what fails a branch, what does not), in the form of `packages/manage/criteria/audit.md`; `arthur init` then writes it with no code change. Its wording is the owner's to approve. Out: the files of projects given earlier.
- `npm test` and `npm run check` pass.

## Scope

In:
- ship `packages/delivery/criteria/review.md` (what fails a branch, what does not), in the form of `packages/manage/criteria/audit.md`; `arthur init` then writes it with no code change. Its wording is the owner's to approve. Out: the files of projects given earlier.

## Decisions

- 2026-10-21: Source: F1 of AR0264
