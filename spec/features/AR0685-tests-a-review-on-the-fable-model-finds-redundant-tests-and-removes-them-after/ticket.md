# AR0685 - Tests: a review on the fable model finds redundant tests and removes them, after the test speed work

```json
{
  "id": "AR0685",
  "title": "Tests: a review on the fable model finds redundant tests and removes them, after the test speed work",
  "date": "2026-11-10"
}
```

## Description

After the test speed work (AR0671), one job on the fable model reads the whole test suite and finds tests that check nothing another test does not already check, then removes them, so `npm test` gets shorter and a change breaks fewer tests that do not matter. The owner sees the list of tests to remove in the plan before any is deleted.

## Goal

The owner asked on 2026-11-10: "after we improve the tests speed i think we will need to run a review and rmove redundant tests, this review should be done on fable 5.2 model". The suite has 1716 tests (`npm test` in the AR0678 merge, 2026-11-10: 1645 of 1716 passed, the rest skipped), in about 12 minutes in CI (AR0671's evidence). Tests that pin the same path twice, or pin wording, wiring or an incidental default, cost time and break on harmless changes without catching a bug.

- Plan: yes
- Model: fable 5.2 for the plan and the worker (`--model`); OMP lists `claude-fable-5` and `claude-fable-5-1` today, no 5.2, see the decision.

- Kind: test

## Done means

- The plan lists every test to remove, by file and name, with its reason: a duplicate of a named test that fails on the same broken behaviour, or a test of wording, source text, wiring, a mock's echo or an incidental default; and the tests it keeps that look similar, with why.
- The worker removes exactly the tests the approved plan lists; none is skipped instead of removed, and no source file changes.
- For every duplicate removed, the outcome names the test that still catches the same behaviour, and shows it failing when that behaviour is broken by hand.
- `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip; the mutate run catches as many as on main before the change.
- The outcome gives the test count and `npm test` time before and after, on this server and in CI.

## Scope

In:
- `packages/*/test/**` and `test/**`: tests removed, and a file emptied by it removed.

Out:
- Making tests faster: AR0671.
- Adding tests, or changing any source file.

## Decisions
- 2026-11-10: AR0685 approved: plan and worker on claude-fable-5-1, or fable 5.2 if it exists when the job starts; after AR0671; the owner: "AR-D623 - 1" (AR-D623)

