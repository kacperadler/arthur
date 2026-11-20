# AR0728 - The fake herdr writes its state through one shared temporary name, so npm test sometimes fails a herdr test

```json
{
  "id": "AR0728",
  "title": "The fake herdr writes its state through one shared temporary name, so npm test sometimes fails a herdr test",
  "date": "2026-11-20"
}
```

## Description

The test fake of herdr saves its state through one temporary file name that every writer shares, so two writers at once make one rename fail. That fails a herdr test in about one full `npm test` run of five, and a merge's checks run the same `npm test`. This ticket gives each writer its own temporary name and keeps the first test's late calls from overwriting its seed.

## Goal

A test fixture that fails at random costs a rerun or a FAIL on correct work, and hides a real herdr regression behind "it's the flake again".

- Kind: test

Evidence (audit `spec/quality/2026-11-20.md`, proposal 2):

- `packages/herdr/test/fake-herdr.ts:130-133`: `save` writes every state to `.state.json` in the fake's folder, then renames it to `state.json`. The test process (`seed`, line 39) and each played `herdr` call (`play`) share that name.
- `packages/herdr/test/herdr.test.ts:74`: `box.server.seed([])` runs while the plugin's start pass and attach loop are still calling the fake.
- AR0718's `report.md:30`: one failure in 6 full `npm test` runs at `7a418f2b`, `ENOENT: no such file or directory, rename '.../.state.json' -> '.../state.json'` at `fake-herdr.ts:132`.
- AR0718's `review-1.md:20`: the reviewer's first full `npm test` on `187e41a7`, at `--test-concurrency=3` (the default now, `package.json:16`), failed the same way at `herdr.test.ts:74`; the file passed 3 of 3 runs alone.

## Done means

- `save` in `fake-herdr.ts` writes through a temporary name of the writer's own (`.state.json.<pid>` plus a counter for repeated saves from one process) before the rename.
- The first test of `herdr.test.ts` waits until the second start pass has made its last call before `seed`, so no late call overwrites the seeded state.
- A test that runs many concurrent `save`s from separate processes against one fake folder fails with `ENOENT` on main and passes after the change.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/herdr/test/fake-herdr.ts`: the writer's own temporary name in `save`.
- `packages/herdr/test/herdr.test.ts`: the wait before `seed`, and the concurrent-save test.

Out:
- The fake's API and `packages/herdr/src/herdr.ts` stay as they are.

## Decisions

- 2026-11-20: Source: audit spec/quality/2026-11-20.md
- 2026-11-20: Source: F1 of AR0718
- 2026-11-20: Pre-approved by policy: test from audit spec/quality/2026-11-20.md, 2 Scope files, budget $1 of the $3 cap
- 2026-11-20: The owner approved AR0728 at a budget of $3; the owner: "AR-D700 yes" (AR-D700)
