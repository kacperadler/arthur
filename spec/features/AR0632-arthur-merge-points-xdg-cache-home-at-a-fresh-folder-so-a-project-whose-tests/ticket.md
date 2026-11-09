# AR0632 - arthur merge points XDG_CACHE_HOME at a fresh folder, so a project whose tests run Playwright finds no browser and every browser test fails

```json
{
  "id": "AR0632",
  "title": "arthur merge points XDG_CACHE_HOME at a fresh folder, so a project whose tests run Playwright finds no browser and every browser test fails",
  "date": "2026-11-05"
}
```

## Description

`cached` in `packages/core/src/job-sandbox.ts:153` gives each merge step `XDG_CACHE_HOME=<delivery folder>/cache_<random>` (AR0454), a fresh empty folder. Playwright looks for its browsers in `$XDG_CACHE_HOME/ms-playwright` on Linux, so in the merge's `npm test` of a project with Playwright e2e specs every browser test fails with `browserType.launch: Executable doesn't exist at <delivery folder>/cache_<random>/ms-playwright/chromium_headless_shell-1248/...`, while the same specs pass in the job's worktree (where the cache is the user's `~/.cache`) and in CI. Seen 2026-11-05 on a client project: three merges of a branch whose job ran 248 tests green failed with 1, 6 and 189 browser tests; the merge went in only with `PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright` set by hand in the merge's environment.

## Goal

A merge's steps find the browsers Playwright already installed for Arthur's user, read-only, without the step being able to write into that shared folder (AR0454's reason for the fresh cache stays: a step writes no shared cache another process runs later).

- Kind: fix

## Done means

- Each merge step gets `PLAYWRIGHT_BROWSERS_PATH` pointing at the user's existing browser folder (`$XDG_CACHE_HOME/ms-playwright` of Arthur's own environment, else `~/.cache/ms-playwright`) when no `PLAYWRIGHT_BROWSERS_PATH` is set already, and that folder stays read-only in the step's sandbox.
- A test in the core or delivery suite, with a fake `npx playwright`-like script that reads `PLAYWRIGHT_BROWSERS_PATH`, fails before the change and passes after it; a step's write into that folder is refused.
- `packages/delivery/docs/commands/merge.md` says it, beside the caches paragraph.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/job-sandbox.ts`: the variable.
- Its test, and `packages/delivery/docs/commands/merge.md`.

Out:
- Installing browsers: the user's own `npx playwright install`.

## Decisions
- 2026-11-09: Merge it, in the order of the night summary (AR0659 before AR0499); the owner: "Merge all 11 in order above." (AR-D573)
