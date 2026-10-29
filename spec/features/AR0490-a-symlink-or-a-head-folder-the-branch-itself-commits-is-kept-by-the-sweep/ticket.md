# AR0490 - A symlink or a HEAD folder the branch itself commits is kept by the sweep

```json
{
  "id": "AR0490",
  "title": "A symlink or a HEAD folder the branch itself commits is kept by the sweep",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0466 (spec/features/AR0466-a-step-can-plant-a-repository-under-a-name-other-than-git-or-a-symlink-to-one/findings.md).

- Kind: security
- Found by: 2026-10-27-worker-cae1ba87 (worker), 2026-10-27
- Where: `packages/delivery/src/merge-checks.ts:29` (`const before = repositories(root)`, taken after `git merge`)
- What: the sweep keeps every repository that was there before the first step, and the merge commit is already checked out then. So a branch that commits a symlink (`src/link -> ../../.git/objects/xx`, or to a folder outside the checkout) or a folder holding `HEAD`, `objects/`, `refs/` and a `config` with `core.fsmonitor` gets it kept, as the owner's own. A job's sandbox writes the shared Git folders a commit writes (`docs/deploy.md`, "Threat model"), so whether a job can plant a Git folder in `.git/objects` for such a symlink to point at is [INFERENCE], not tried. Not reproduced.
- Suggestion: take `before` from main's checkout before `git merge` (the owner's state), or have `arthur merge` refuse a branch that adds a symlink leading out of the checkout or into `.git`, or a tracked file named `HEAD` next to an `objects/` folder. Out: the step sweep this ticket made.

## Goal

What the merge sweep counts as the owner's own state is taken after `git merge`, so a branch that commits a symlink leading out of the checkout or into `.git`, or a folder holding a `HEAD`, has it kept (F1 of AR0466, `packages/delivery/src/merge-checks.ts:29`). An owner's unchanged link to a file a step can write lets a step plant a repository behind it (F2), and `escapes` judges a link by its folder's text path (F3, `:79`).

- Kind: security

## Done means

- The snapshot of the owner's state is taken from main's checkout before `git merge`, or `arthur merge` refuses a branch that adds a symlink leading out of the checkout or into `.git`, or a tracked `HEAD` beside `objects/`; the worker picks the smaller one and says why.
- An owner's symlink whose target a step can write (in `.git`, the temporary folder or the merge's cache) is judged by its target too, not kept as unchanged.
- `escapes` resolves the link's folder with `realpathSync`.
- A test for each: a branch committing an outward symlink, a branch committing a `HEAD` folder, an owner link into `.git/objects` whose target a step replaces; each fails before the change.
- The project's checks pass.

## Scope

In:
- `packages/delivery/src/merge-checks.ts`, `packages/delivery/src/merge-command.ts` (the snapshot's moment).
- `packages/delivery/test/merge-checks.test.ts`, `packages/delivery/docs/commands/merge.md`.

Out:
- The step sweep's other rules (AR0463, AR0466).

## Decisions

- 2026-10-27: Source: F2 and F3 of AR0466 too (review notes)

- 2026-10-27: Source: F1 of AR0466
- 2026-10-29: AR0490: delivery line budget 1636 -> 1665; the owner: "Idz z wszystkich rekomendacjow i nie pytaj mnie (AR-D271, voice note)" (AR-D306)
- 2026-10-29: AR0490: delivery line budget 1665 -> 1677; the owner: "Idz z wszystkich rekomendacjow i nie pytaj mnie (AR-D271, voice note)" (AR-D308)
- 2026-10-29: AR0490 review round 3 after the worker also stamps .git and HEAD in each parent of the link end and of each hop inside the write folder; the owner: "Idz z wszystkich rekomendacjow i nie pytaj mnie (AR-D271, voice note)" (AR-D314)
- 2026-10-29: AR0490: delivery line budget 1677 -> 1686; the owner: "Idz z wszystkich rekomendacjow i nie pytaj mnie (AR-D271, voice note)" (AR-D315)
