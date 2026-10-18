# AR0143 - Findings

## F1. setup.md says planned packages do not exist yet, but @arthur/session does

- Kind: docs
- Found by: 2026-10-18-review-ar0143-151efde6 (review), 2026-10-18
- Where: `docs/setup.md`; `arthur.config.example.ts` lists entries 36-38 options the session plugin refuses as unknown
- What: the example config shows the planned shape on purpose (excluded from tsc, loaded by no test); the sentence in setup.md is slightly stale now that the package exists.
- Status: dropped (entry 36, AR0144, builds those options next and updates the same docs)

## F2. Two timing risks not exercised against real orchestration

- Kind: risk
- Found by: 2026-10-18-ar0143-a99c4103 (worker), confirmed by the review, 2026-10-18
- Where: `packages/session/src/compact-extension.ts` (inbox hand-off race, SETTLE_MS margin)
- What: tested against the fake agent only, by the plugin-boundary rule; a throwaway smoke with orchestration passed.
- Status: dropped (covered by the entry 38 start probe and live use; no test can cross the plugin boundary)
