# AR0709 - A merge's checks on main cannot create a new folder at the checkout's top, so a test runner's output folder (Playwright's test-results) fails npm test

```json
{
  "id": "AR0709",
  "title": "A merge's checks on main cannot create a new folder at the checkout's top, so a test runner's output folder (Playwright's test-results) fails npm test",
  "date": "2026-11-13"
}
```

## Description

`arthur merge` runs each check on main in a sandbox that writes "each entry but `.git`" of the main checkout (`arthur merge --help`, "Steps", 2). In practice only the entries that already exist are writable: a step cannot create a new top-level folder, nor remove one it did not make. A project whose tests write an output folder at the top (Playwright's default `test-results/`) passes on its branch, in the worker's and the reviewer's worktrees and in CI, and then fails only in the merge.

## Goal

- Kind: fix

Evidence, 2026-11-13, a project's merge after a PASS and green CI: `npm test: failed.` with `Error: EACCES: permission denied, mkdir '<checkout>/test-results'`, `main reset`. With the folder made beforehand by hand: `Error: EACCES: permission denied, rmdir '<checkout>/test-results'`. The worker's and the reviewer's runs of the same `npm test` passed, so a review cannot see it coming.

## Done means

- A merge check step can create, write and remove a new file or folder at the top of main's checkout (not `.git`, not Arthur's home, `arthur.config.ts` or the env file), as a job's own sandbox allows in its worktree; or, if that is not possible, the merge refuses before its first step with a line that names the rule, and `arthur merge --help` says it.
- A test of the merge sandbox runs a step that makes and removes `test-results/` at the checkout's top and fails before the change.
- `npm run check` and `npm test` pass.

## Scope

In:
- The merge's check sandbox in the delivery plugin, and its test.
- `arthur merge --help`'s "Steps" text, if the rule it states changes.

Out:
- The project's own workaround (its test output under the temporary folder), done in its own ticket.

## Decisions
