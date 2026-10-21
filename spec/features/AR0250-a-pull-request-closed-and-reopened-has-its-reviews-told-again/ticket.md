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

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: bug

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
