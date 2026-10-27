# AR0469 - The reinstall after a failed check uses the cache the branch's install wrote

```json
{
  "id": "AR0469",
  "title": "The reinstall after a failed check uses the cache the branch's install wrote",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0454 (spec/features/AR0454-the-writable-package-caches-carry-branch-code-out-of-the-sandbox/findings.md).

- Kind: security
- Found by: 2026-10-26-worker-b75a162b (worker), 2026-10-26
- Where: `packages/delivery/src/merge-command.ts` (`merge`, the `reinstall` call inside the merge's cache folder)
- What: a merge's steps and the reinstall of main's own dependencies after a failed check share one cache folder, as the ticket asks ("of that merge"). The branch's install, which ran first, can leave in that cache what main's reinstall then takes (npm checks a tarball's integrity against the lockfile, but other managers' caches, and npm's `_npx`, hold more than tarballs) [INFERENCE: not reproduced with a real package manager]. Before AR0454 the shared caches had the same gap.
- Suggestion: run the reinstall with a step runner of its own over a fresh cache folder, removed after it; the cost is a second sandbox probe and, on a host without a user manager or the sandbox, a second `uncapped:` or `no sandbox:` line, which merge.md would then name.

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F1 of AR0454
