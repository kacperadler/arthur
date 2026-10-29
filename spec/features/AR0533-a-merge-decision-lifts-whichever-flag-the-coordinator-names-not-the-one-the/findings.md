# AR0533 - Findings

Notes from the review of AR0533, settled at the merge.

## F1. A bad `--what` exits with the usage line only

- Kind: ux
- Found by: 2026-10-28-review-ea20f672 (reviewer), 2026-10-28
- Where: `packages/orchestration/src/decision-commands.ts:73`
- What: the check sits in the usage condition to stay within orchestration's 2430-line budget, so a wrong value exits 2 without naming why; the variable `words` no longer describes what it holds.
- Status: deferred (client summary)

## F2. The no-id hint in `decision.md` reads ambiguously

- Kind: docs
- Found by: 2026-10-28-review-ea20f672 (reviewer), 2026-10-28
- Where: `packages/orchestration/docs/commands/decision.md`
- What: `--kind merge --what <flag>|budget` is easy to misread.
- Status: deferred (client summary)

## F3. Merge decisions asked before this change no longer let a flag through

- Kind: fix
- Found by: 2026-10-28-review-ea20f672 (reviewer), 2026-10-28
- What: by design; the coordinator asks again with `--what`. None was pending at the merge.
- Status: dropped (intended)

## F4. Three files outside the Scope list changed

- Kind: docs
- Found by: 2026-10-28-review-ea20f672 (reviewer), 2026-10-28
- What: `merge.md`, the coordinator's role and the onboarding procedure tell the coordinator how to ask, which now needs `--what`.
- Status: dropped (needed by the change)
