# AR0035 - Review 1

- Job: 2026-10-16-review-ar0035-command-ev-352f16fc
- Branch: h/2026-10-16-ar0035-command-events-re-21f43133
- Commit reviewed: 9267125fbf7aa5d439701b64d17e0c4ea8cec04a
- Verdict: PASS

## Final message

## Review: AR0035 — command events reach daemon subscribers

### Findings
None that block merge.

### Notes (non-blocking)
- `events.ts:66`: truncation detection (`size < state.offset`) can't catch a cut-and-regrow-past-old-size race within one 500 ms tick (F2, honestly disclosed by worker as open risk; inherent to polling design, not required by the ticket's Done means).
- F1 (events lost while no daemon follows, e.g. during restart) is a real, correctly scoped-out gap, honestly recorded as `Status: open` in `findings.md` with concrete reproduction path and remediation options — matches the review focus's explicit ask.

### Verification performed
- `npm ci` — clean install, 5 packages added.
- `npm run check` (`tsc`) — passes, no errors.
- `npm test` — 158/158 pass, matches worker's claim exactly.
- Read full diff: `events.ts` (`follow`/`tick`/`fromEnd`/`drain`), `run.ts` (`follow` wiring, stop ordering), `host.ts`/`cli.ts` (minimal plumbing, confirms AR0013 scope discipline — `plugin.ts` untouched), docs/roadmap updates, `findings.md`.
- Traced `tick()` logic for byte-offset/seq bookkeeping, own-event dedup via `mine` set, and truncation reset — logic is correct and matches the claimed behavior.
- Read both new tests in `events.test.ts` (mocked timers: delivery order, own-event skip-on-readback, half-line wait, cut/delete/restart, stop) and the new real-process test in `run.test.ts` (daemon picks up command-emitted `pinged`, answers once; after `unfollow()` precedes plugin `stop`, an event emitted during the 1.5 s stop window is never seen by the daemon — exact log compared line-by-line).
- Independently mutated and reran, each failing as claimed:
  - Removed own-event skip (`mine.delete` → unconditional push) → `events.test.ts` duplicate-delivery assertion fails.
  - Removed early `unfollow()` before plugin stop in `run.ts` → `run.test.ts` real-process test fails (daemon spuriously answers the `d` ping during stop).
  - Disabled partial-line wait (`whole = bytes.length`) → `events.test.ts` half-line test fails.
  - Disabled truncation restart (`size < state.offset` branch removed) → `events.test.ts` cut-log test fails.
  - Restored all mutations; `npm test` back to 158/158, `git status` clean.
- Confirmed: no socket/port introduced (grep of diff), no runtime dependency added, all touched files under 200-line budget (`events.ts` 185, `run.ts` 76, `host.ts` 137, `cli.ts` 180), no class/enum, English only, plugin boundaries untouched.

Ticket's Done means and the review's Focus list are all met: cross-process delivery exactly once, own-event immediate delivery without duplication, partial-line wait, truncation/deletion restart from new end, follow stopped before plugin stop and in `finally`, polling only reads on growth, no socket/port, tests wait on real state (the one real 1.5 s sleep is justified and commented — proving a negative with no signal to wait on), F1 honestly recorded.

PASS
