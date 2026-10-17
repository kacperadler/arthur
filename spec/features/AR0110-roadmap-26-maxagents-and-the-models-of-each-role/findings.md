# AR0110 - Findings

## F1 - continue.md lists the fields a beforeSpawn check sees without `quick`

- Kind: cleanup
- Found by: 2026-10-17-review-ar0110-maxagents-c16142a8 (review), 2026-10-17
- Where: `packages/core/docs/commands/continue.md:25`
- Status: dropped (no check reads `quick`; the behaviour the page describes is right)

## F2 - README's orchestration row is stale

- Kind: cleanup
- Found by: 2026-10-17-review-ar0110-maxagents-c16142a8 (review), 2026-10-17
- Where: `README.md`, orchestration row ("1 of 8 entries", "24 to 29, 65")
- Status: ticket AR0114
