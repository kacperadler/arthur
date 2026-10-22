# AR0297 - The styleguide and review criteria now live in two folders that will drift

```json
{
  "id": "AR0297",
  "title": "The styleguide and review criteria now live in two folders that will drift",
  "date": "2026-10-22"
}
```

## Description

AR0272 copied the harness's styleguide and review criteria into `.agents/arthur/criteria/`, byte for byte, so Arthur's own roles read them. The harness still reads its own copies, and every job's prompt names `.agents/harness/criteria/styleguide.md`; a later edit of one copy leaves the other behind, and a worker of the harness and a worker of Arthur then judge the same branch by different rules. `cmp .agents/arthur/criteria/styleguide.md .agents/harness/criteria/styleguide.md` prints nothing today.

## Goal

The styleguide and review criteria have one source, or a test fails when the two copies (`.agents/harness/criteria/` and `.agents/arthur/criteria/`) differ, so a rule changed in one place reaches every role.

- Kind: risk

Evidence:
- `.agents/arthur/criteria/styleguide.md`, `.agents/arthur/criteria/review.md`; `.agents/harness/criteria/styleguide.md`, `.agents/harness/criteria/review.md`
- Found by: 2026-10-22-ar0272-7e470561 (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: at the switch to Arthur running itself, remove `.agents/harness/criteria/` (and the harness's other files under `.agents/harness/`) so one copy is left; until then, an edit of either file is made in both. Out: a test pinning the two copies equal, which would outlive the switch.
- `npm test` and `npm run check` pass.

## Scope

In:
- at the switch to Arthur running itself, remove `.agents/harness/criteria/` (and the harness's other files under `.agents/harness/`) so one copy is left; until then, an edit of either file is made in both. Out: a test pinning the two copies equal, which would outlive the switch.

## Decisions

- 2026-10-22: Source: F1 of AR0272
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
- 2026-10-22: Coordinator (free hand): the Goal asks that a test fails when the two copies differ, so add the equality test of `styleguide.md` and `review.md`, run only while `.agents/harness/criteria/` exists; the roadmap's switch step also deletes that test.
