# AR0479 - A merge step reading an owner clone still deletes it when python3 cannot read the .git attributes, with a reason that hides why

```json
{
  "id": "AR0479",
  "title": "A merge step reading an owner clone still deletes it when python3 cannot read the .git attributes, with a reason that hides why",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0467 (spec/features/AR0467-a-merge-check-that-runs-git-inside-an-owner-clone-in-the-checkout-deletes-that/findings.md), from review 2026-10-27-review-45bea179.

## Goal

- Kind: fix

A merge step that only reads one of the owner's clones in the main checkout keeps it since AR0467, but only while `python3 -I` can read the extended attributes of the `.git` folder (`packages/delivery/src/merge-checks.ts:80`). When that call fails, the folder's change time counts again, so `git status` there removes the clone and its history, and the log says only "would run its config outside any sandbox". A host without python3, or a single failed call, loses the owner's history with no hint why.

## Done means

- When the attribute read fails, the log line says so (python3 failed, so a read could not be told from a change) instead of the generic reason; a test with a failing `python3` first on PATH asserts that line.
- A failed attribute read on the second reading is retried once before the clone is judged changed; a test with a python3 that fails once and then works keeps a clone that was only read.
- The project's checks pass.

## Scope

In:
- `packages/delivery/src/merge-checks.ts`: the reason line and one retry.
- `packages/delivery/test/merge-checks.test.ts`: the two cases above.
- `packages/delivery/docs/commands/merge.md`: the reason.

Out:
- Reading the attributes without python3: a new way to read them is a decision for the owner.

## Decisions

- 2026-10-27: Source: F1 of AR0467
- 2026-10-29: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
