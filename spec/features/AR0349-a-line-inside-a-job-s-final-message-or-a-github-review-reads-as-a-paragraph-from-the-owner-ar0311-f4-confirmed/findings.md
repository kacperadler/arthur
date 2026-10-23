# Findings

## F1. The line-break split is written twice

- Kind: refactor
- Found by: 2026-10-23-review-ar0349-forged-own-22ec74d1 (review), 2026-10-23
- Where: `hand-over.ts` and `handoff-extension.ts`, the same regex
- Status: dropped (two short copies in different packages are cheaper than a shared export, per the styleguide; revisit at a third)
