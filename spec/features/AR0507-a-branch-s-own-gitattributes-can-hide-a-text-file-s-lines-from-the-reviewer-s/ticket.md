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

The reviewer reads every changed line of a text file, whatever the branch's own `.gitattributes` says. Today a branch that adds `*.ts -diff` (or `binary`) makes the reviewer's `git diff` print `Binary files ... differ` for a text file, so a review can pass code nobody read (F9 of AR0404; the command is built in `packages/delivery/src/review-command.ts:85`).

- Kind: security

## Done means

- The review task's commands are `git diff --text --no-ext-diff --no-textconv <base>..<commit>` (and the same flags wherever the task shows the diff), so attributes in the branch's tree cannot turn a text file's diff into `Binary files`, an external diff or a textconv.
- The reviewer role says a file the diff still shows as binary is read on disk, or the review fails.
- A test in `packages/delivery/test/review.test.ts` builds a branch whose `.gitattributes` sets `*.ts -diff`, runs the task's diff command as the task names it, and finds the changed line in its output; it fails without the new flags.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/src/review-command.ts`: the diff command the review task names.
- `packages/delivery/roles/reviewer.md`: a file shown as binary is read on disk, or FAIL.
- `packages/delivery/test/review.test.ts`: the test above.

Out:
- Replacements under `refs/replace` that change what the reviewer reads (`GIT_NO_REPLACE_OBJECTS`): AR0500.

## Decisions

- 2026-10-27: Source: F9 of AR0404
- 2026-11-02: Approved: build AR0507 after AR0562, as part of Groups 1 and 2; report progress as tasks X/Y and new Z; the owner: "complete the AR0562, then go with Group 1 and Group 2, but mesure this changes i mean, whan you start, add to messages tasks: X/Y new: Z (tasks: X is completed / Y is todo; new: Z is how many new are created when you do the Y tasks)" (AR-D434)
