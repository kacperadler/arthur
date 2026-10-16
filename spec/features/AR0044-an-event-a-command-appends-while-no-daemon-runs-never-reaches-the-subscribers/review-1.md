# AR0044 - Review 1

- Job: 2026-10-16-review-ar0044-events-rep-51c86ebe
- Branch: h/2026-10-16-ar0044-events-replay-aft-8791d5a8
- Commit reviewed: fa7c67e814fd3e060c5bf6be80b3573e805c1f84
- Verdict: FAIL

## Final message

## Review: h/2026-10-16-ar0044-events-replay-aft-8791d5a8 (fa7c67e)

### Findings

**1. `packages/core/src/events.ts:50,55,80` — an event emitted by the daemon itself before its first `follow()` tick can be delivered twice across a restart, violating the ticket's "never twice" Done-means and the updated doc's "reaches them at once, and only once."**

`emit()` adds an event's `seq` to the `early` set only when `at === undefined` (line 80), i.e. when it fires before `follow()` has set `read`. `drain()` only writes the kept marker when `read !== undefined` (line 50). So an event delivered via the early path never advances `<home>/events.delivered`, *unless* some later event also goes through `drain()` in the same process lifetime (which happens to push the marker past it). If the process stops/crashes right after delivering an early event with no other event following in that same session, the kept marker is left pointing *before* that event's `seq`. On the next restart, a fresh `early` set (per-process) no longer filters it out of `catchUp`'s replay (line 55), so it is queued and delivered a second time.

Reproduced directly against the shipped `eventBus`:
```
Session A: follow() then emit -> delivered=1 (correct, via keep())
Session B: emit BEFORE follow() (early), then follow(), no further event -> seen=[2], delivered file still "1"
Session C: new process, follow() only, nothing else happens -> seen=[2] AGAIN  (double delivery)
```
This is reachable through the public `Host` API: `plugin.setup(host)` runs for every plugin before `loadPlugins` returns, and `follow()` is only invoked afterward in `run.ts`'s `runPlugins`. Any plugin's `setup` calling `host.events.emit` (or `host.emit`) synchronously hits exactly this path — no mutation needed, just a plausible sequence (an early-emitting plugin plus a crash-loop with no intervening command). The existing "bus that follows again" test (`events.test.ts:209`) only exercises the early-emit case where a *later* followed event (`b`, `c`) happens to push the marker past it — it never tests "early emit, then nothing else, then restart," so the gap is untested. This is the same `Bus`/`follow` engine `run.ts` wires into the daemon; no CLI-level harness is needed to show it's broken.

This directly contradicts:
- Ticket Done means: "Each event is delivered once: never twice across a restart… (the number is written after the handlers ran)" — no carve-out for pre-follow emits.
- `docs/commands/run.md`: "An event emitted inside `arthur run` reaches them at once, and only once." — unconditional, and false for this path.

The "Order" rework (replacing the old `mine` set with `early`) is the core of this branch's replay engine, not an optional add-on, so this isn't a peripheral untested feature — it's a correctness bug in the central mechanism the ticket asked for.

### Notes (non-blocking)

- F1/F2 in the new `findings.md` are reasonable, correctly scoped as follow-up (roadmap wording staleness, and the log-cut-then-grown-past-kept-number case which the worker flagged as `[INFERENCE]`, not claimed as tested).
- The `event-log.ts` split is a real refactor (new `Position`/`readNew`/`logEnd` abstractions), not a byte-for-byte move, but it stays behavior-preserving for the parts it extracts; the new replay logic itself legitimately lives in `events.ts`. Line budgets respected (133 + 116, both ≤ 200; package budget test passes).
- Imports touched outside the named Scope (`testing.ts`, `jobs.test.ts`, `spawn.test.ts`) are a direct, disclosed consequence of the `Event`/`Position` types moving to `event-log.ts`; acceptable collateral of the split.

### Checks run (in this worktree)

- `npm ci` — clean, no output/errors.
- `npm run check` (`tsc`) — passes, no errors.
- `npm test` — 162/162 pass, matching the worker's claim.
- Direct reproduction script against `packages/core/src/events.ts`'s `eventBus` (see transcript above) — confirms the double-delivery across a third session for a pre-follow ("early") emit with no intervening followed event.

The core "never delivered twice across a restart" guarantee — explicitly named in the ticket's Done means and restated unconditionally in the updated doc — is broken for a reachable path in the engine this branch rewrote, and no test catches it.

FAIL
