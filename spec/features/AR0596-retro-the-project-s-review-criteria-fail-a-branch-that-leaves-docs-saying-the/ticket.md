# AR0596 - Retro: the project's review criteria fail a branch that leaves docs saying the old thing

```json
{
  "id": "AR0596",
  "title": "Retro: the project's review criteria fail a branch that leaves docs saying the old thing",
  "date": "2026-10-30"
}
```

## Description

From the retro of 2026-10-30 (`spec/retro/2026-10-30.md`, proposal 3). Reviewers saw stale doc lines and passed, since the project's FAIL list does not name them; the project's review criteria gain that FAIL reason, as the shipped delivery criteria already have.

## Goal

reviewers here saw the stale lines and passed anyway, because nothing in the project's FAIL list covers them; each one then became a ticket. The reviewer reads this list before its verdict.

- Kind: chore

Evidence:
- AR0110 review (PASS) → AR0114: the review saw the README row still calling entries 24 and 26 not built, filed it as a finding and passed the branch.
- AR0554 review-1.md (PASS): "F1 is filed correctly: the core's `NOT_TRANSCRIBED` … still says 'the voice plugin is not enabled'". That became AR0568.
- AR0508 review 2026-10-27-review-bc8c068f (PASS) → AR0514: the stale `spawn.md:120` was filed and passed.
- AR0307 review 2026-10-25-review-fce9638a (PASS) → AR0410: setup step 5 was noted and passed.
- The shipped `packages/delivery/criteria/review.md` lists "A changed command, option or behavior whose docs still say the old thing" under "Fails the branch". The project's `.agents/arthur/criteria/review.md` has the doc rule only under "How code here should look", not in its FAIL list: the drift AR0297 warned of.

## Done means

- `.agents/arthur/criteria/review.md` holds the After text of proposal 3 word for word, in place of the Before bullet; `npm run check` and `npm test` pass.

## Scope

In:
- .agents/arthur/criteria/review.md, the first bullet under "FAIL when any one holds", after proposal 2.

Before:
> - A requirement is missing, stubbed, faked, or only claimed in the final message.

After:
> - A requirement is missing, stubbed, faked, or only claimed in the final message; or a line of the docs, the README, a diagram, the roadmap, a role or a code comment still says what the branch changed (search for each name, number and message the diff changes), in a file the Scope's Out does not name.

## Decisions

- 2026-10-30: Source: retro spec/retro/2026-10-30.md
