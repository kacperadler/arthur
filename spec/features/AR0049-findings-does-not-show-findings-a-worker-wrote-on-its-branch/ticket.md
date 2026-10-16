# AR0049 - `/findings` does not show findings a worker wrote on its branch

```json
{
  "id": "AR0049",
  "title": "`/findings` does not show findings a worker wrote on its branch",
  "date": "2026-10-16"
}
```

## Description

`/findings <id>` reads `findings.md` from the project's main checkout. A worker writes its findings on its branch, so until the merge `/findings` answers `no findings` while the branch holds some. The harness Arthur replaces showed the newest worker branch's version, marked "not merged".

## Goal

`/findings` shows what a worker found before its merge, as the harness did, so the human sees open findings while the work runs.

- Kind: improvement

Evidence:
- `packages/core/src/board-commands.ts` (`fileReply`)
- Found by: 2026-10-16-ar0021-board-transitions-76954a78 (worker), 2026-10-16

## Done means

- When a job of the ticket has a branch that still exists and its `findings.md` differs from main's, `/findings <id>` answers with the branch's version, headed `findings from branch <branch> (not merged)`; otherwise main's.
- Tests with real Git: a branch with new findings shows them with the heading; after the branch is gone, main's; no job, main's.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/board-commands.ts`, its test.

## Decisions

- 2026-10-16: Source: F3 of AR0021
