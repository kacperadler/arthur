
## F1: the core-and-plugins diagram labels session and schedule as always on

- Status: fixed in a847863 (AR0002: only `orchestration` sits under "Coordinator - always on, required"; `session` and `schedule` moved to "Conversation and timers")
- Source: review-1.md of AR0001
- `docs/architecture/core-and-plugins.mmd` groups `orchestration`, `session`, `schedule` under "Coordinator - always on"; only `orchestration` is required. Fold into AR0002, which edits that diagram.
