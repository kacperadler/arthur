# AR0389 - `test/ticket-kinds.test.ts` fails on main: AR0387's ticket keeps the template's Kind line

```json
{
  "id": "AR0389",
  "title": "`test/ticket-kinds.test.ts` fails on main: AR0387's ticket keeps the template's Kind line",
  "date": "2026-10-25"
}
```

## Description

at base `8940bb85` the ticket's line 19 is `- Kind: feat | fix | security | perf | refactor | test | docs | build | ci | chore | ux` (`git show 8940bb85:<path> | grep -n 'Kind:'`), so `npm test` fails "every ticket's Kind under its Goal is one of the template's" on every branch cut from main.

## Goal

`npm test` passes on main again: AR0387's ticket has one Kind (already done on main in d1877289).

- Kind: test

## Done means

- The fix, with a test that proves it: give AR0387 its one Kind (its Goal reads as `fix` or `chore`), the test unchanged.
- `npm test` and `npm run check` pass.

## Scope

In:
- give AR0387 its one Kind (its Goal reads as `fix` or `chore`), the test unchanged.

## Decisions

- 2026-10-25: Source: F2 of AR0377
