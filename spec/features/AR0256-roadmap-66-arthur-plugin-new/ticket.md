# AR0256 - Roadmap 66: arthur plugin new

```json
{
  "id": "AR0256",
  "title": "Roadmap 66: arthur plugin new",
  "date": "2026-10-21"
}
```

## Description

This ticket builds roadmap entry 66 in `spec/roadmap.md` in the `develop` plugin.

## Goal

The specification is roadmap entry 66: its Delivers and Done means.

- Kind: feature
- Budget: 8

## Done means

- Everything entry 66's Delivers and Done means list, each refusal and edge case with its test: an existing name, a name not lowercase letters and dashes, a missing or non-positive-whole `--budget`; a refusal changes no file; the created package passes `npm run check`, `npm test` and the structure test with no hand edit; the structure test still refuses a package without a budget.
- Only the published host API of `docs/plugin-api.md`; any new host member is recorded there under "Changes since entry 51".
- Tests create packages in their own temporary copy, never in the checkout.
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 66 as built.

## Scope

In:
- `packages/develop`, its docs and tests, README, `arthur.mmd`, `test/structure.test.ts`.

## Decisions

- 2026-10-21: Started by the coordinator; owner: continue Arthur, at most 10% of the weekly limit today (3% at 13:2x).
- 2026-10-21: Coordinator (free hand) accepted the worker additions: refusal of a budget under the 25 lines the template writes, of a reserved or clashing function name, and of a checkout that is not Arthur; the command also adds the workspace to package-lock.json.
