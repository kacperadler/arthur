# AR0468 - A second arthur merge during the first one's checks merges on top of the unchecked merge commit

```json
{
  "id": "AR0468",
  "title": "A second arthur merge during the first one's checks merges on top of the unchecked merge commit",
  "date": "2026-10-27"
}
```

## Description

F1 of AR0374 (spec/features/AR0374-the-install-at-a-spawn-and-each-step-of-the-merge-have-no-time-limit/findings.md).

- Kind: security
- Found by: 2026-10-26-worker-5ba085de (worker), 2026-10-26
- Where: `packages/delivery/src/merge-command.ts:59-111`
- What: while one `arthur merge` runs its checks on main (now up to `merge.stepSeconds` per step, an hour by default), its merge commit is already HEAD and `last-merge` not yet written. A second `arthur merge` of another branch passes every refusal by reading those lines: main is on its branch and clean, the stray-commit check starts from main's last merge commit, which is the first merge's own, so nothing counts as a stray. It then merges on top of the unchecked commit, and a failing check of the first resets main under the second (`git reset --keep` to the first's `before`). Not run; read from the code, as the ticket's Description says.
- Suggestion: a lock per project for the whole merge (an exclusive file in delivery's folder, created with `wx` before the first refusal and removed in a `finally`), a second merge refused with `a merge of <job> is in progress on <project>`; nothing else.

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

- 2026-10-27: Source: F1 of AR0374
