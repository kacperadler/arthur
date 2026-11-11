# AR0689 - The review gate needs 25 mutants, but mutate stops at 1500 s, so a branch touching slow core tests can never be reviewed

```json
{
  "id": "AR0689",
  "title": "The review gate needs 25 mutants, but mutate stops at 1500 s, so a branch touching slow core tests can never be reviewed",
  "date": "2026-11-11"
}
```

## Description

A branch whose mutants each run a slow package's tests cannot reach the 25 mutants the review gate asks for before `npm run mutate` stops at its 1500 s deadline, so `arthur review` refuses it forever and only the owner can unblock it. This ticket makes such a branch reviewable without lowering what the gate proves.

## Goal

Evidence, 2026-11-10/11: AR0671 (arthur/2026-11-10-worker-4b7cab02 at a298b582) ran `npm run mutate -- --max 25` three times, once with no other job on the server: each time `24 mutants, 23 caught, 1 survived; 1 not run (time)`, exit 1. `test/mutate.ts:68` stops starting mutants at 1500 s (the checks extension kills a call at 1800 s, AR0569/AR0599); the gate (AR0580, AR0637, `arthur review-needed --help`, "Before a review") needs min(25, all) mutants run.

- Plan: yes

- Kind: fix

## Done means

- A branch like AR0671's reaches the gate: the planner picks the smallest way (for example a mutate run that resumes where the last stopped and sums its lines, or a gate that counts a time-cut run whose mutants were all caught), and a test proves a run cut by time no longer blocks a review forever, while a run capped by `--max` below 25 still does.
- The project's checks pass.

## Scope

In:
- `test/mutate.ts` and/or the gate's check (the planner names the files).

Out:
- Making the core tests themselves faster: AR0671.

## Decisions
- 2026-11-11: Approve; the owner: "by recommendation: G13058" (AR-D635)
- 2026-11-11: AR0689 approved: a plan job picks the smallest fix, then a worker builds it; the owner: "AR-D636 - approve" (AR-D636)
- 2026-11-11: Test speed first: AR0689 (mutate limit), then AR0671 (faster tests) review and merge, before the rest of the queue; the owner: "speed up tests should be done first bcs this will improve how fast we can move" (AR-D642)

