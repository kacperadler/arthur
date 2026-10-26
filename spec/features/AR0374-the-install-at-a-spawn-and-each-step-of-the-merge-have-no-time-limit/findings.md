# AR0374 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A second arthur merge during the first one's checks merges on top of the unchecked merge commit

- Kind: security
- Found by: 2026-10-26-worker-5ba085de (worker), 2026-10-26
- Where: `packages/delivery/src/merge-command.ts:59-111`
- What: while one `arthur merge` runs its checks on main (now up to `merge.stepSeconds` per step, an hour by default), its merge commit is already HEAD and `last-merge` not yet written. A second `arthur merge` of another branch passes every refusal by reading those lines: main is on its branch and clean, the stray-commit check starts from main's last merge commit, which is the first merge's own, so nothing counts as a stray. It then merges on top of the unchecked commit, and a failing check of the first resets main under the second (`git reset --keep` to the first's `before`). Not run; read from the code, as the ticket's Description says.
- Suggestion: a lock per project for the whole merge (an exclusive file in delivery's folder, created with `wx` before the first refusal and removed in a `finally`), a second merge refused with `a merge of <job> is in progress on <project>`; nothing else.
- Status: open
