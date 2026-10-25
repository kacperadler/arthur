# AR0436 - A bash call that changes the tree after its checks, before it ends, is recorded on the tree it ends on

```json
{
  "id": "AR0436",
  "title": "A bash call that changes the tree after its checks, before it ends, is recorded on the tree it ends on",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0360 (spec/features/AR0360-the-job-s-record-of-its-checks-is-its-own-word-written-from-inside-the-agent-not-tied-to-the-tip-s-tree-not-stale-after-a-change-by-bash/findings.md).

- Kind: security
- Found by: 2026-10-25-worker-009bdb40 (worker), 2026-10-25
- Where: `packages/delivery/src/checks-extension.ts:22-27`
- What: the commit and `clean`/`dirty` are read once, as the bash call ends (the ticket's "at the run's end"). A call that runs the checks on one tree and leaves another behind gets the second: `npm test; git stash` (tests run with uncommitted changes, the line says `clean`), `git checkout <old> -- . && npm test && git checkout HEAD -- .` (tests run on an older tree, the line names the tip, `clean`). A call that dirties the tree after its checks (`npm test && sed -i ...`) errs the safe way (`dirty`).
- Suggestion: read the same two facts in a `tool_call` handler too, kept by `toolCallId`, and write `clean` only when both reads name the same commit and a clean tree, else `dirty`. Out: anything against a job that writes the file itself, which the ticket leaves to the sandbox (AR0329).

Also from AR0360's review (2026-10-25-review-848c9299): `git update-index --assume-unchanged`/`--skip-worktree` hides an edited tracked file from `status`; the extension's `git status` (`checks-extension.ts:23-24`) runs without the `core.fsmonitor=false`/`core.hooksPath`/`--no-replace-objects` guard `review-needed` uses. All of these matter only once the job cannot write `<home>/delivery/<job>/` itself, which the sandbox still allows (`docs/commands/review-needed.md`).

## Goal

The checks line names the tree the checks ran on, not the one the bash call left, and the extension's git calls carry the same guard as `review-needed`'s; tested.

- Kind: security

## Done means

- The commit and tree state are read before the checks command runs as well as after; a line is `clean` only when both readings name the tip with no tracked change, `assume-unchanged` and `skip-worktree` files counted as changes (`git ls-files -v`). The extension's git calls use `-c core.fsmonitor=false -c core.hooksPath=/dev/null --no-replace-objects`. Tests in `checks.test.ts`: `npm test; git stash` and an older tree checked out, tested and put back are each `dirty` or name the older commit; it fails on main.
- `npm test` and `npm run check` pass; delivery's budget may be raised by the lines needed (AR-D29).

## Scope

In:
- `packages/delivery/src/checks-extension.ts`, `packages/delivery/test/checks.test.ts`.

Out:
- Making `<home>/delivery/<job>/` unwritable to the job (a sandbox change).

## Decisions

- 2026-10-25: Source: F1 of AR0360
- 2026-10-25: AR0436 approved under AR-D31, group 2; the owner: "always go with recommendation till the 8 am morning" (AR-D41)
