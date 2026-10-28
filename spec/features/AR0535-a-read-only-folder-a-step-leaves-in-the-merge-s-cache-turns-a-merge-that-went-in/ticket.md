# AR0535 - A read-only folder a step leaves in the merge's cache turns a merge that went in into an error

```json
{
  "id": "AR0535",
  "title": "A read-only folder a step leaves in the merge's cache turns a merge that went in into an error",
  "date": "2026-10-28"
}
```

## Description

F1 of AR0470 (spec/features/AR0470-a-merge-killed-during-its-steps-leaves-its-cache-folder-behind/findings.md).

- Kind: fix
- Found by: 2026-10-27-worker-7ccfb33a (worker), 2026-10-27
- Where: `packages/delivery/src/merge-command.ts:168` (`rmSync(cache, { recursive: true, force: true })` in `finally`), and `reinstall` in `packages/delivery/src/merge-checks.ts:73`
- What: `rmSync` with `recursive` and `force` throws `EACCES` on a folder holding a subfolder without write permission (seen: `node -e` making `probe-cache/sub` with a file, `chmod 0500 sub`, then `rmSync("probe-cache", { recursive: true, force: true })` printed `threw EACCES`). A step's code can leave one in the merge's cache folder (a package manager's read-only store, or the branch's script on purpose). The throw in the `finally` replaces `merge`'s return, so `arthur merge` exits with `EACCES` after main was merged, the ticket settled and the changelog written, and `github.push` is never asked [INFERENCE: from the code, not run]. The folder then stays; AR0470's sweep at a later merge's start (`find ... -exec rm -rf`) fails on it too, silently, at every merge.
- Suggestion: before removing a cache folder, give its owner write permission on every folder in it (`chmod -R u+w`, as Go's `go clean -modcache` needs), in the `finally`, in `reinstall`'s and in the sweep; or catch the removal's error and print one line naming the folder left. Out: reusing a cache folder.

## Goal

A merge that went in reports success even when a step left a read-only folder in its cache, and the cache is still removed. Evidence: `rmSync(cache, { recursive: true, force: true })` in the `finally` of `packages/delivery/src/merge-command.ts:168` throws `EACCES` on a folder holding a subfolder without write permission (reproduced with `chmod 0500`), which replaces the merge's result after main was merged, so the push is never asked.

- Kind: fix

## Done means

- Before removing a merge's cache (the `finally`, `reinstall` in `merge-checks.ts`, and the sweep), every folder in it is made writable by its owner; a test leaves a `chmod 0500` folder in the cache from a step and sees the merge succeed, the push asked and the cache gone; the test fails without the fix.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/src/merge-command.ts`, `packages/delivery/src/merge-checks.ts`, `packages/delivery/test/merge.test.ts`.

Out:
- Reusing a cache folder between merges.

## Decisions

- 2026-10-28: Source: F1 of AR0470
