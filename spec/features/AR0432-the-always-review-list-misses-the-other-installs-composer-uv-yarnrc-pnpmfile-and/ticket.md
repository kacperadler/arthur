# AR0432 - The always-review list misses the other installs: composer, uv, yarnrc, pnpmfile and bunfig

```json
{
  "id": "AR0432",
  "title": "The always-review list misses the other installs: composer, uv, yarnrc, pnpmfile and bunfig",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0358 (review 2026-10-25-review-f09761ba, non-blocking note). `packages/projects/src/install.ts:13-14` also installs from `composer.lock` (`composer install` runs `composer.json` scripts) and `uv.lock` (`uv sync` builds from `pyproject.toml`); `.yarnrc.yml` (its `yarnPath`), `.pnpmfile.cjs` and `bunfig.toml` change what an install runs. None is on `ALWAYS_REVIEW`, so a small change to them gets `no review` and runs code at the next spawn or merge.

## Goal

Every file that changes what an install runs is always reviewed, as AR0358 did for npm's; tested.

- Kind: security

## Done means

- `ALWAYS_REVIEW` (`packages/delivery/src/delivery-options.ts`) also holds `**/composer.json`, `**/composer.lock`, `**/uv.lock`, `**/pyproject.toml`, `**/.yarnrc.yml`, `**/.pnpmfile.cjs`, `**/bunfig.toml`; `arthur.config.example.ts` and `docs/commands/review-needed.md` the same. A row per file in `review-needed.test.ts` answers `review: <path> is on the always-review list`.
- `npm test` and `npm run check` pass; delivery's line budget may be raised by the lines needed (AR-D29).

## Scope

In:
- `packages/delivery/src/delivery-options.ts`, `packages/delivery/test/review-needed.test.ts`, `packages/delivery/docs/commands/review-needed.md`, `arthur.config.example.ts`.

Out:
- Files in dot folders (`.config/.npmrc`): the install reads the root's only.

## Decisions

- 2026-10-26: Source: F1 of AR0358
- 2026-10-25: AR0432 approved under AR-D31, after AR0431; the owner: "always go with recommendation till the 8 am morning" (AR-D38)
