# AR0442 - An existing project whose history ends in plain commits refuses its first merge, its onboarding's included

```json
{
  "id": "AR0442",
  "title": "An existing project whose history ends in plain commits refuses its first merge, its onboarding's included",
  "date": "2026-10-26"
}
```

## Description

F2 of AR0361 (spec/features/AR0361-a-merge-takes-main-as-it-is-a-commit-that-reached-main-by-another-route-is-merged-on-and-pushed-with-the-next-merge/findings.md).

- Kind: ux
- Found by: 2026-10-25-worker-bb221b5b (worker), 2026-10-25
- Where: `packages/projects/roles/coordinator/onboarding-ended.md:7`, `packages/delivery/src/merge-command.ts:88`
- What: as the ticket decided, a repository with no merge lists from the root, and one whose last code commits are plain ones (squash or rebase merges on GitHub, a solo project) lists them; so the first `arthur merge` of any such project, the onboarding's `--unreviewed` merge included, refuses with `main has <n> commits since its last merge that change code (…)`, listing up to its whole history. `onboarding-merge.test.ts` passes only because its project holds no code. docs/commands/merge.md names the owner's merge that takes main as it is; neither `arthur init --help` nor onboarding-ended.md says it is needed.
- Suggestion: onboarding-ended.md tells the coordinator to ask the owner for that merge before the onboarding's, or `arthur init` makes it on the owner's word when it adds the project; and the refusal names at most 10 commits with `and <k> more`.

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

- 2026-10-26: Source: F2 of AR0361
