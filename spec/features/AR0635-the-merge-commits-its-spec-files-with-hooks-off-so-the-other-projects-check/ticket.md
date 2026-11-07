# AR0635 - The merge commits its spec files with hooks off, so the other-projects check never sees them before the push

```json
{
  "id": "AR0635",
  "title": "The merge commits its spec files with hooks off, so the other-projects check never sees them before the push",
  "date": "2026-11-06",
  "budget": 4
}
```

## Description

The nightly audit of 2026-11-06 (proposal 1), taking F1 and F7 of AR0627: the one Arthur commit that skips the check that nothing committed names another project of the owner is the merge's own `spec: <id> merged` commit, and it is pushed at once.

## Goal

No file the merge commits reaches GitHub without the project's other-projects check passing on it first.

Evidence:
- `packages/delivery/src/merge-command.ts:89`: every git call of the merge runs with `-c core.hooksPath=/dev/null`.
- `packages/delivery/src/merge-command.ts:165`: that same `git` goes to `settleTicket`, after the checks on main have run.
- `packages/delivery/src/merge-outcome.ts:76-80`: `settleTicket` writes `outcome.md` (the worker's `## What went in` lines), the review notes in `findings.md`, the new tickets' folders, `spec/build.json` and `CHANGELOG.md`, then commits them with hooks off.
- `merge-command.ts:166`: the merge returns main, and `github.push` pushes it, spec commit included.
- `git -C <main checkout> config core.hooksPath` gives `.githooks`, so the coordinator's own commits run `.githooks/commit-msg` and `test/other-projects.ts`; the merge's spec commit is the one that skips it.
- `test/other-projects.ts:6-7`: `npm test` checks the tracked files, but at merge time it runs before `outcome.md` exists, so a name in the spec commit is caught only at the next merge's `npm test`, after it is on GitHub.
- It happened before: AR0621 F1 (the committed decision log named another project), removed by a history rewrite in AR0627 (AR-D499).

- Kind: security

## Done means

- Before the `spec: <id> merged` commit, the merge runs a check the project names on the paths it is about to commit, in the merge steps' sandbox; for Arthur, `node test/other-projects.ts` over those files.
- When the check refuses, the files stay uncommitted, the merge's output says why (as `settleTicket` already does for a config key planted during the checks), and nothing of them is pushed; main's merge commit itself stays.
- A test with real Git: a worker's outcome line that names a listed project leaves the spec files uncommitted and unpushed, and the test fails when the check is removed; a clean outcome still commits and pushes.
- The hooks stay off for every other git call of the merge.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/src/merge-outcome.ts`, `packages/delivery/src/merge-command.ts`, their tests, `packages/delivery/docs/commands/merge.md`.

Out:
- The coordinator's own commits (the hook already covers them) and the check's matching rules.

## Decisions
- 2026-11-06: Source: audit spec/quality/2026-11-06.md
- 2026-11-06: Source: F1 of AR0627
- 2026-11-06: Source: F7 of AR0627
- 2026-11-07: Delivery line budget raised 2195 to 2215 (+20) for AR0635, by approving its PR #12; the owner: "Approve (PR #12)" (AR-D539)
