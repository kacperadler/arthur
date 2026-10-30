# AR0594 - Retro: a worker sent back after a FAIL fixes the cause, not only the reviewer's examples

```json
{
  "id": "AR0594",
  "title": "Retro: a worker sent back after a FAIL fixes the cause, not only the reviewer's examples",
  "date": "2026-10-30"
}
```

## Description

From the retro of 2026-10-30 (`spec/retro/2026-10-30.md`, proposal 1). Workers handed back a FAIL patch the example each finding gives, so the next review finds the next example of the same cause; the worker role gains a line asking to fix the cause, try the class, and answer each finding by number.

## Goal

the hand-back tells the worker to "Fix every finding below" (`hand-back.ts:146`), and workers patched the example each finding gave, so the next review found the next example. Those rounds cost: AR0496 had 9 rounds ($26.99), AR0555 4 rounds ($30.76), AR0564 5 rounds ($21.31). AR0572's new review line now makes most guard bypasses a note, but AR0564, AR0532 and AR0555 are not guard tickets, so this still applies there.

- Kind: chore

Evidence:
- AR0564 review-2.md F1: the check passes a page before its images load, which review 1's finding 2 already reported for scripts.
- AR0564 review-3.md F1: "Review 2's finding 2 is fixed for its six probes but not at its cause."
- AR0532 review-2.md F1: "the same kind of gap review-1 reported for the bracket and quote characters, now for the whitespace class."
- AR0555 review-3.md F1: "This is F1's problem in a new form"; the wake for a dropped ticket's review still names steps the round removed.
- AR0335 review-3.md F1: "the same hole review 2 found, through a second spelling" (`--end-of-options` instead of `--`).
- AR0420 review-2.md F1: a quoted or escaped `}` "reopens review 1's finding 1."
- AR0493 review-3.md F2: "Finding 3 of review 2 was not addressed … The worker's final message does not mention them."
- AR0496 review-6.md F1: "extglob patterns in a declared name still pass (review 5, finding 2, not fixed)."

## Done means

- The worker role (`packages/core/roles/worker.md`) holds the After text of proposal 1 word for word, in place of the Before bullet; `npm run check` and `npm test` pass.

## Scope

In:
- packages/core/roles/worker.md, the "How you work" bullet that starts "Try each invariant". The worker reads it when the hand-back continues its run after a FAIL.

Before:
> - Try each invariant of the ticket against every way it could still break (a later unrelated call, a background process, a change undone before the next check), not only against the ticket's examples. A way that still breaks it misses the Goal: fix it, or ask, as below.

After:
> - Try each invariant of the ticket against every way it could still break (a later unrelated call, a background process, a change undone before the next check), not only against the ticket's examples. A way that still breaks it misses the Goal: fix it, or ask, as below. When your task hands back a FAIL review, each finding is one example of its cause (one spelling, character, layer or path among others): fix the cause, try the other members of that class you can name, add a test row for each, and answer every finding by its number in the final message with the fix and the test that pins it, or the Decision or ticket that leaves it open.

## Decisions

- 2026-10-30: Source: retro spec/retro/2026-10-30.md
