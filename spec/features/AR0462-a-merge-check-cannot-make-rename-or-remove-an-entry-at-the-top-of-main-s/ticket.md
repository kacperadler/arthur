# AR0462 - A merge check cannot make, rename or remove an entry at the top of main's checkout

```json
{
  "id": "AR0462",
  "title": "A merge check cannot make, rename or remove an entry at the top of main's checkout",
  "date": "2026-10-26"
}
```

## Description

F1 of AR0457 (spec/features/AR0457-a-merge-check-can-leave-a-git-hook-or-config-in-main-s-checkout-which-runs/findings.md).

- Kind: ux
- Found by: 2026-10-26-worker-c3335bc0 (worker), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts` (`checkout`, called by `stepSandbox`)
- What: Landlock only grants, and a right on a folder holds for all beneath it, so a step that may make an entry in the checkout's own folder may also make `.git/hooks/post-commit`. AR0457 therefore grants each top-level entry but `.git` (and Arthur's home, config and env file), not the checkout's folder itself: a check that makes a new top-level folder or file (`dist/`, `coverage/`, `tsconfig.tsbuildinfo`), or removes or renames one, fails with `Permission denied` (seen in a throwaway run: `mkdir dist` and `rm -r src` refused in a step, a write into `src/` passed). The list is read once per merge, so after a failed check's `git reset --keep` the reinstall cannot write a top-level folder the reset brought back. `docs/commands/merge.md` says so and names the remedy (`mkdir dist` once outside a step).
- Suggestion: if a project needs it, run each step in a mount namespace with `.git/config`, `.git/hooks`, `.git/info`, the home and the config bind-mounted read-only (needs unprivileged user namespaces, which some hosts turn off), or let a project's config name the top-level folders the checks make, which `arthur merge` creates before the first step. Out: changing Landlock's model.

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: ux

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-26: Source: F1 of AR0457
