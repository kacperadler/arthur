# AR0244 - Findings

## F1. An unreachable unknown-project throw in stats.ts

- Kind: cleanup
- Found by: 2026-10-20-review-ar0244-roadmap-61-165490c7 (reviewer), 2026-10-21
- Where: `packages/manage/src/stats.ts:73-75`
- What: `host.board.list` already refuses an unknown project, so the explicit throw never fires.
- Status: ticket AR0245
