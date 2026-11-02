# AR0369 - Review 1

- Job: 2026-11-02-review-44e95230
- Branch: arthur/2026-11-02-worker-e17d4c76
- Commit reviewed: 4fda97814f4dd41dd7182315fcbbc2fcde2d5136
- Verdict: FAIL

## Final message

**FAIL.** One part of the ticket's requirement is not tested: the spawn should be refused when *any* address is not private, and nothing checks that.

## Findings

1. **`packages/models/test/models.test.ts:366` / `packages/models/src/models.ts:72`: the "any address" part is not tested.**
   - **What the ticket asks:** the prepare must refuse the spawn "when any address is not private".
   - **What the code does:** `addresses()` asks the lookup for every address (`lookup(host, { all: true })`, `probe.ts:22`), and the prepare checks each one with `.find(...)`.
   - **What the test does:** the fake `dns.lookup` only ever returns one address, `127.0.0.1` or `8.8.8.8`.
   - **The mutation that got through:** I changed `models.ts:72` to `(await addresses(server)).slice(0, 1).find(...)`, which checks only the first address. `node --test test/models.test.ts` still gave `pass 20, fail 0`. I restored the file afterwards with `git checkout`.
   - **Why it matters:** with that change, a name whose first address is private and a later one public gets past the new check, and the agent may then connect to the public one. That is the gap this ticket closes. The review criteria count a mutation of a key behavior that no test catches as a FAIL.
   - **Fix:** a second case in the new test where the lookup returns, for example, `[{127.0.0.1}, {8.8.8.8}]` after the probe, and the spawn must be refused naming `8.8.8.8`.

Everything else matches the ticket. The prepare looks the name up again right before the agent starts and refuses with the exact message the ticket gives. The test leaves no record, no worktree and no started agent. The ticket's text is in `docs/models.md:21`, and the roadmap entry 82 is updated. I did not judge the models line budget raise from 534 to 537, as you told me; it is your open decision AR-D455.

## Notes
- (minor) `packages/models/src/models.ts:66-67`: the comment above the code is two lines. The review guide asks for one line saying why.
- (minor) `packages/models/docs/models.md:21`: "It is resolved here once more in the job's prepare" — "here" reads oddly in a doc page.
- (risk) `packages/models/src/models.ts:72`: a lookup that fails in the prepare (`ENOTFOUND`) refuses the job with the raw resolver error. No test covers this or the `arthur continue` path. The worker said so in their final message.

## Checks
- `npm run check && npm test` (timeout 1800 s): tsc passed; 1486 tests, 1422 pass, 0 fail, 64 skipped. This matches the worker's claim.
- Mutation by hand, `.find(` → `.slice(0, 1).find(` at `models.ts:72`: `node --test test/models.test.ts` gave pass 20, fail 0, so the mutant survived. I restored the file.
- I did not run `npm run mutate`: your budget was small.

FAIL