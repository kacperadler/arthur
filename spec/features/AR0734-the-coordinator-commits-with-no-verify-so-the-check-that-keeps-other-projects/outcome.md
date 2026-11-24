# AR0734 - Outcome

- Merged: 2026-11-24, `f998b219`
- Branch: arthur/2026-11-24-worker-3bbca2dc
- Reviews: review-1.md PASS
- Cost: worker $4.53, reviews $0.38; review rounds 1

## What went in

- packages/orchestration/roles/coordinator.md: beside the line that commits `spec/decisions.jsonl`, says never to commit with `--no-verify` (`-n`) or with hooks turned off, and that a commit a hook refuses is reworded, never forced.
- packages/orchestration/roles/project.md: the same sentence beside the project agent's commit line.
- spec/features/AR0734-the-coordinator-commits-with-no-verify-so-the-check-that-keeps-other-projects/findings.md: F1 (AR0667's T2 needed a ticket from the coordinator, now AR0738), F2 (a refused decision record has no command that rewords it), F3 (no eval holds the rule).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1853/1924 passed.

## Left open

- Deferred (client summary): F1. AR0667's T2 (`arthur commit-board`) still has no ticket: a worker's branch may not add one
- Deferred (client summary): F2. A decision record the hook refuses has no command that rewords it
- Deferred (client summary): F3. No eval holds the rule that a commit never skips the hooks
