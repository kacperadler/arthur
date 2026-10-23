# AR0250 - A pull request closed and reopened has its reviews told again

```json
{
  "id": "AR0250",
  "title": "A pull request closed and reopened has its reviews told again",
  "date": "2026-10-21"
}
```

## Description

the state keeps only the open pull requests; one that is closed drops out, and when it is reopened every review it has is new to the state, so each is emitted as `pull-request-review` and wakes the coordinator again. Documented in `packages/github/docs/github.md`, "Pull request reviews".

## Goal

A reopened pull request does not wake the coordinator again for reviews it already had: a review of a pull request new to the state is told only when submitted after the project's previous poll (kept in the state), with a test that reopens one.

- Kind: fix

Evidence:
- `packages/github/src/github-pulls.ts` (`newReviews`), `packages/github/src/github-state.ts`
- Found by: 2026-10-21-ar0246-roadmap-58-github-56fccda8 (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: tell a review of a pull request new to the state only when it was submitted after the project's previous poll (keep that time in the state), with a test that reopens one.
- `npm test` and `npm run check` pass.

## Scope

In:
- tell a review of a pull request new to the state only when it was submitted after the project's previous poll (keep that time in the state), with a test that reopens one.

## Decisions

- 2026-10-21: Source: F3 of AR0246
- 2026-10-21: Approved by the owner (Telegram).
- 2026-10-21: Coordinator (free hand): github line budget 586 to 595 (+9) accepted, after the worker cut comments first.
