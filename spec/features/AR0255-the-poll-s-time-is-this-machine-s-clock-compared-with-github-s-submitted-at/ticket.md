# AR0255 - The poll's time is this machine's clock, compared with GitHub's `submitted_at`

```json
{
  "id": "AR0255",
  "title": "The poll's time is this machine's clock, compared with GitHub's `submitted_at`",
  "date": "2026-10-21"
}
```

## Description

`polled` is taken from `Date.now()` before the list of pull requests is asked, and a review of a pull request new to the state is told only when its `submitted_at` (GitHub's clock) is at or after it. With this machine's clock ahead of GitHub's by `s` seconds, a review submitted within `s` seconds after a poll began, on a pull request that poll did not list (opened just then), is never told. [INFERENCE: not reproduced; follows from the comparison in `newReviews`.]

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: risk

Evidence:
- `packages/github/src/github-pulls.ts:31` (`polled`)
- Found by: 2026-10-21-ar0250-reopened-pr-revie-8bb4c889 (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: take the poll's time from the `date` header of GitHub's answer to the list (`ask` would return it beside `until`), so both times are GitHub's; the rest of the rule stays.
- `npm test` and `npm run check` pass.

## Scope

In:
- take the poll's time from the `date` header of GitHub's answer to the list (`ask` would return it beside `until`), so both times are GitHub's; the rest of the rule stays.

## Decisions

- 2026-10-21: Source: F1 of AR0250
- 2026-10-21: Approved by the owner (Telegram).
- 2026-10-21: Worker: github line budget 621 to 625 (+4), after the comment was cut to two lines first; each file's share in `test/structure.test.ts`.
