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

A review submitted just after a poll began is never lost to this machine's clock running ahead of GitHub's: the comparison with `submitted_at` allows a margin, with a test.
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
- 2026-10-21: Coordinator (free hand) accepted the worker pick: the poll time comes from GitHub date header minus the request time, instead of a fixed margin; github budget 621 to 625.
