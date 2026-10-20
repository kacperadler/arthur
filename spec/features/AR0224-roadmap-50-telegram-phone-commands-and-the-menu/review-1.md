# AR0224 - Review 1

- Job: 2026-10-20-review-ar0224-roadmap-50-099adea4
- Branch: h/2026-10-20-ar0224-roadmap-50-phone-f10cd1df
- Commit reviewed: dadb2f554feb26a2f1f7d4f3abced88b3a4f5947
- Verdict: FAIL

## Final message

## Findings

**`packages/telegram/test/commands.test.ts:43` and `:77` — new tests race on the wrong signal, fail under load.**

Both tests push several Telegram messages, then do:
```js
await until("...", () => received().length === ...);
assert.deepEqual(api.took().map(...), [...expected replies...]);
```
`received()` is the coordinator's inbox count; `api.took()` is what the fake Bot API actually got. These are decoupled: a phone command's reply is sent via `send()` in `poll.ts`, which calls `enqueue()` then `box.flush()` **without awaiting** the outbox drain (`outbox.ts`'s `flush()` just schedules `sending = sending.then(() => drain())`). A later plain-text message reaches the coordinator (`received()` grows) via a synchronous `host.events.emit(...)` that has no dependency on that still-in-flight HTTP call. So `received().length === N` can become true before an earlier phone-command's `sendMessage` has actually hit the fake server — the assertion on `api.took()` then undercounts.

Every other new test in the same file correctly waits on the state it then asserts (e.g. `await until("both replies", () => api.took().length === 2)`); only these two wait on `received()` while asserting on `api.took()`.

This is not hypothetical — it reproduces:
- A clean, unmodified `npm test` run in this worktree gave `773 pass / 2 fail`, one failure being exactly `commands.test.ts:43` (`actual: ['jobs unknown name', 'jobs one']`, missing `'jobs two'`).
- Running `node --test packages/telegram/test/commands.test.ts` 8× concurrently (mild CPU contention, no fault injection) failed **8/8 times**, always and only on these same two tests (`:43` and `:77`), with the identical missing-tail-entries pattern.
- Each test passes reliably (3/3) run alone with no contention, confirming it is a genuine race, not a logic bug in production code.

This directly contradicts the ticket's own Done means — "Tests wait for the very state they assert, never for a fixed time (2-core CI)" — and the worker's final-message claim "`npm test`: 775 tests, 775 pass, 0 fail," which does not reproduce in this worktree.

## Notes (non-blocking)

- `packages/telegram/test/telegram.test.ts:262` ("one retry per send…") also failed in the same clean `npm test` run. This test is untouched by the diff (pre-existing from AR0212) and passed reliably (3/3) run in isolation; likely a pre-existing timing flake unrelated to this branch, surfaced only by the 246 s full-suite runtime. Not attributable to this diff, but it means "0 fail" doesn't hold here either way.
- `fake-bot-api.ts`'s `ME()` (getMe fixture) omits a few newer optional getMe-only boolean fields Telegram's docs list (`supports_guest_queries`, `allows_users_to_create_topics`, `can_manage_bots`, `supports_join_request_queries`). Code only reads `username`; not functionally significant.
- `route`/`PhoneFrom`, `menu.ts`'s "only when changed, keyed by bot id, never the token," `/name@<bot>` case-insensitive matching with getMe caching, and the structure-test line budgets (core 5668, telegram 641) all check out exactly against the diff and the ticket.
- The `/board`/`/findings` slices-vs-cut question is correctly left open per the task's Focus note; not a blocker.

## Checks run

- `npm ci` — 16 packages added, clean.
- `npm run check` — `tsc` passes, no errors.
- `npm test` (clean, unmodified worktree) — **773 pass, 2 fail** (`commands.test.ts:43`, `telegram.test.ts:262`); does not match the worker's claimed "775 pass, 0 fail."
- `node --test packages/telegram/test/commands.test.ts` × 3 isolated — 7/7 pass each time.
- `node --test packages/telegram/test/commands.test.ts` × 8 concurrent (CPU contention, no code changes) — 8/8 runs fail, always exactly `:43` and `:77`, confirming a reproducible race in the new tests.
- `wc -l` on `packages/core/src` (excl. testing) and `packages/telegram/src` — 5668 and 641, matching the stated budgets exactly.
- Manual trace of `poll.ts`/`outbox.ts` confirms `send()` does not await outbox delivery, explaining the race.

FAIL
