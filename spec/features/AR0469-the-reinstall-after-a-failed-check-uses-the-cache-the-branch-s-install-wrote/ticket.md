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

The reinstall of main's dependencies after a failed merge check runs in the cache the branch's own install wrote, so branch content can reach main's install (finding above).

- Kind: security

## Done means

- The reinstall after a failed check runs with a fresh cache folder of its own, removed after it; a test in `packages/delivery/test/merge.test.ts` that fails without the fix.

## Scope

In:
- `packages/delivery/src/merge-command.ts`, `merge-checks.ts`, their test, `merge.md`.

Out:
- A killed merge's leftover cache: AR0470.

## Decisions

- 2026-10-27: Source: F1 of AR0454
- 2026-10-27: AR0469 approved by the owner (morning of 2026-10-27, one list of 18); the owner: "apprvoed: AR0467, AR0466, AR0471-AR0473, AR0464, AR0465, AR0468-AR0470, AR0474-AR0477, AR0402-AR0405" (AR-D132)
- 2026-10-27: AR0469: delivery line budget 1584 -> 1590; the owner: "IF YOU NEED THEN ADD MORE LINES TO THE CORE, TO NOT ASK ME ABOUT THIS" (AR-D158)
- 2026-10-27: AR0469: delivery line budget 1590 -> 1591 on its base; the owner: "IF YOU NEED THEN ADD MORE LINES TO THE CORE, TO NOT ASK ME ABOUT THIS" (AR-D162)
