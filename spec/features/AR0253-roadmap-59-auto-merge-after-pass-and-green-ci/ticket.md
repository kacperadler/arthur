# AR0253 - Roadmap 59: auto-merge after PASS and green CI

```json
{
  "id": "AR0253",
  "title": "Roadmap 59: auto-merge after PASS and green CI",
  "date": "2026-10-21"
}
```

## Description

This ticket builds roadmap entry 59 in `spec/roadmap.md` in the `delivery` plugin.

## Goal

The specification is roadmap entry 59: its Delivers and Done means.

- Kind: feature
- Budget: 10

## Done means

- Everything entry 59's Delivers and Done means list, each refusal and edge case with its test.
- A test for each refusal naming its rule (a PASS on an older commit, CI pending or failed, a held path, `autoMerge: false`, github disabled without `--no-ci`), and for CI passed on the tip after a new commit and a held path renamed; the wake once per CI run end across a restart; a hung run cancelled after 30 minutes, with a held-open gap, never a fixed sleep.
- Only the published host API of `docs/plugin-api.md`; any new host member is recorded there under "Changes since entry 51".
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 59 as built.

## Scope

In:
- `packages/delivery`, its docs and tests, README, `arthur.mmd`, `test/structure.test.ts`.

## Decisions

- 2026-10-21: Started by the coordinator; owner: continue Arthur, at most 10% of the weekly limit today (2% at 12:29).
- 2026-10-21: Worker: CI is asked through two new provided names of github, `github.ci` (the run that built a branch, as `arthur ci` finds it, with `below`) and `github.cancel`; no host member changed; recorded in `docs/plugin-api.md`, "Changes since entry 51".
- 2026-10-21: Worker: `--auto` counts only a PASS review of the tip itself; `arthur review-needed`'s `no review` does not count as one for it.
- 2026-10-21: Worker: a run further below the tip than the commits the branch adds ran on main, so it counts as no run of the branch: `--auto` waits for the branch's own run instead of merging on main's.
- 2026-10-21: Worker: line budgets raised, delivery 212 more (1231) and github 26 more (612), each file's share in `test/structure.test.ts`.
