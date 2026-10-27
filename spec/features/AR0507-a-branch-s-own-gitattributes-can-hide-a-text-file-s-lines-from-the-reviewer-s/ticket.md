# AR0507 - A branch's own `.gitattributes` can hide a text file's lines from the reviewer's diff

```json
{
  "id": "AR0507",
  "title": "A branch's own `.gitattributes` can hide a text file's lines from the reviewer's diff",
  "date": "2026-10-27"
}
```

## Description

F9 of AR0404 (spec/features/AR0404-security-review-of-our-own-code-part-3-channels-merge-and-delivery/findings.md).

- Kind: security
- Severity: low
- Found by: 2026-10-27-worker-d27fde45 (worker), 2026-10-27
- Where: `packages/delivery/src/review-command.ts:82` (`git diff <base>..<commit>`)
- Input: a branch that adds `.gitattributes` with `*.ts -diff`, or `binary`, for the files it changes.
- Why the check misses it: Git reads the attributes from the tree, so the reviewer's `git diff` prints `Binary files /dev/null and b/shop.ts differ` for a text file (probe P4). `review-needed` asks for a review (numstat `-`, `review-needed.ts:66`), and the reviewer sees the `.gitattributes` change, but no line of the code it judges.
- What: a reviewer that trusts the diff passes code it did not read.
- Suggestion: the task's commands become `git diff --text --no-ext-diff --no-textconv <base>..<commit>`, with F2's `GIT_NO_REPLACE_OBJECTS`. The reviewer role says a file shown as binary is read on disk, or the review fails. Add a test of the task's text in `review.test.ts`.

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F9 of AR0404
