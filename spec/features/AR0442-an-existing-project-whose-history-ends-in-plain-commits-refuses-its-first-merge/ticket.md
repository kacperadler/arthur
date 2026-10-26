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

The first `arthur merge` of an existing project whose history ends in plain commits (squash or rebase merges, a solo project), its onboarding's included, no longer stops on a refusal nobody told the coordinator about. Evidence: `packages/delivery/src/merge-command.ts:91` lists from the root when there is no merge; `packages/projects/roles/coordinator/onboarding-ended.md` does not say a take-main step is needed; `onboarding-merge.test.ts` passes only because its project holds no code.

- Kind: ux

## Done means

- `onboarding-ended.md` and `arthur init --help` tell the coordinator to ask the owner for AR0441's "take main as it is" before the onboarding's merge, when main has no merge `arthur merge` made.
- The stray-commit refusal names at most 10 commits and then `and <k> more`. Test in `packages/delivery/test/merge.test.ts` with 12 plain code commits: 10 named, `and 2 more`; fails on main.
- A test where an onboarding of a project with code on main merges after the take; fails on main.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/delivery/src/merge-command.ts`, `packages/delivery/test/merge.test.ts`, `packages/projects/roles/coordinator/onboarding-ended.md`, the `arthur init` doc page, `onboarding-merge.test.ts`.

Out:
- The take command itself (AR0441).

## Decisions

- 2026-10-26: Source: F2 of AR0361
- 2026-10-26: Raise the delivery line budget 1434 to 1436 for AR0442, under the owner standing word on line budgets (AR-D61); the owner: "IF YOU NEED THEN ADD MORE LINES TO THE CORE, TO NOT ASK ME ABOUT THIS" (AR-D78)
- 2026-10-26: Merge a ticket once its review passed, without asking the owner (AR-D73); the owner: "If there is something that you can merge, just merge, do not ask me abut it" (AR-D80)
