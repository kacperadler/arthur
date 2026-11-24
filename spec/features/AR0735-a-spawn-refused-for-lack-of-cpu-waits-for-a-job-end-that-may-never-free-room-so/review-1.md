# AR0735 - Review 1

- Job: 2026-11-24-review-16212b5a
- Branch: arthur/2026-11-24-worker-32983572
- Commit reviewed: 73c8b0ef3b9d7f25da50ef93ebc5a45defd55d9f
- Verdict: PASS

## Final message

No finding blocks the merge. The branch does what AR0735 asks. A spawn or continue refused for room is recorded once per machine, as the file `machines/<name>.refused` and one `room-refused` event. The first `arthur run` check of `local`, or `machines` round, that finds room there sends one `coordinator-message` with the machine's room line. A spawn's own check tells nothing. The refusal wording, `resources.md` and roadmap entry 34 were all updated. No other text still says "spawn again once a job ends" for resources; the copies left belong to orchestration's `maxAgents` refusal, which this branch doesn't change.

Changes outside the ticket's Scope In, each explained in the worker's final message:
- `test/room-placement.test.ts` and `packages/resources/test/disk.test.ts` only follow the new refusal wording.
- `spec/roadmap.md` entry 34's Done means is kept accurate.
- `test/structure.test.ts` raises the `resources` budget from 638 to 661. I measured the package at exactly 661 lines, so the raise is the least it needs. It has to show in the merge's `outcome.md`.

The "none for a refusal on disk or memory" test is not needed: the ticket made it conditional on keeping those refusals apart, and they are not. A memory refusal is tested to start a new episode, as `resources.md` says.

Recording "once" also holds across processes as far as the spawn lock covers it. `resources.md` says spawns take the core's spawn lock in turn, so two `beforeSpawn` checks don't run the exists-then-write at the same time. I took that from the doc and did not read the lock's code.

## Notes
- (minor) `packages/resources/src/room.ts:89-93`: the bare `catch` swallows any `rmSync` error, not only ENOENT. If the record can't be removed (EACCES, EISDIR), the coordinator is silently never told and nothing is logged.
- (minor) `packages/resources/src/room.ts:89-94`: the record is removed before the `coordinator-message` is emitted, so if the emit throws, that episode's message is lost and nothing is left to retry it.
- (minor) `packages/resources/src/room.ts:112-113`: `existsSync` then `writeFileSync` could be one `writeFileSync(..., { flag: "wx" })`, which is atomic even outside the spawn lock.
- (minor) `packages/resources/src/room.ts:85`: a `.refused` file for a machine later removed from the config stays forever, since no round checks that machine again. It does no harm.

## Checks (all on 73c8b0ef)
- `npm run check && npm test`: `tsc` clean; 1926 tests, 1862 pass, 0 fail, 64 skipped.
- `npm run mutate`: 20 mutants (all there are), 20 caught, 0 survived.
- Hand mutations, each tested with `packages/resources/test/room.test.ts` and restored with `git checkout`; every one made at least one test fail:

| Mutation | Pass | Fail |
|---|---|---|
| `if (jobs === 0) return;` → `jobs < 0` | 12 | 1 |
| `existsSync` guard replaced by `true` | 12 | 1 |
| `checkLocal` without `tell` | 12 | 1 |
| `rmSync(..., { force: true })` (tells without a record) | 11 | 2 |
| `writeFileSync` of the record removed | 11 | 2 |
| `round` without `tell` | 12 | 1 |

- Budget: setting `resources` to 600 in `test/structure.test.ts` gave `packages/resources: has 661 source lines`; restored, working tree clean.

PASS