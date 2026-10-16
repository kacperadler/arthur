
## F2. The lock's dead-holder takeover race has no test

- Status: open
- Source: review-1.md of AR0008
- `packages/core/src/lock.ts`: concurrent takers of a dead holder's lock and a stuck `.takeover` guard from a crashed taker were checked by a throwaway script only. Pin both with a test of real concurrent processes before entry 17 (the board lock) relies on it.
