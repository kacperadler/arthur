# AR0212 - Review 1

- Job: 2026-10-19-review-ar0212-telegram-o-7d9e261e
- Branch: h/2026-10-19-ar0212-telegram-outbox-0e508ec2
- Commit reviewed: 5ae01e0bd596df0fee31bda6957087f94a6025c7
- Verdict: PASS

## Final message

## Review summary

**Scope check.** Diff touches only `packages/telegram/{src,test,docs}`, `README.md`, `arthur.mmd`, `test/structure.test.ts` — matches the ticket's Scope (orchestration and core explicitly Out, untouched).

**Ticket/roadmap coverage.** Roadmap 48's Delivers/Done-means and AR0211's goal are all present and each has a dedicated test:
- one retry after 2 s (`one retry per send...` test)
- failed slice queued, sent first next time, in order (`...slice failing twice waits with the ones after it...`)
- 429 waits `retry_after` (`a 429 on a send waits...`)
- 4xx set aside, told once, doesn't block later slices (`a refused (4xx) slice is set aside...`)
- outbox survives restart, topic (`place`) preserved (`Telegram unreachable: the slices wait...through a restart...`)
- two processes keep order via `@arthur/core/lock` (`two processes sending at once...`)
- AR0211 instance-based reply routing (`every bot polls its own chat; a reply goes by each bot...`)
- malformed/hand-edited outbox files set aside (`a file in the outbox that is no slice...`)

The "text too long cut with a note" reading (applied only to the refused-slice notice) and the 401-line budget raise are both explicitly recorded as accepted in the ticket's own Decisions section (`spec/features/AR0212.../ticket.md`, 2026-10-19 entries) — not unilateral worker calls.

**Line budget.** `wc -l packages/telegram/src/*.ts` → 401 total, matches `test/structure.test.ts`'s updated budget and the ticket's accepted decision. `telegram.ts` diff is 36 in/29 out per `git diff --numstat`, matching the final message's claim exactly.

**Checks run myself (in this worktree, not the main checkout):**
- `npm ci` — clean.
- `npm run check` (tsc) — clean, no errors.
- `npm test` — 702/702 pass, 0 fail (matches claim).
- `node --import @arthur/core/testing --test packages/telegram/test/telegram.test.ts` alone — 20/20 pass.
- `git grep -nE "[0-9]{6,12}:[A-Za-z0-9_-]{20,}"` — empty, no token-shaped literal.

**Mutation testing (own, reverted after each):**
1. Removed the retry (`tries < 2` → `tries < 1` in `attempt`) → "one retry per send..." test fails, plus "Telegram back while nothing new is sent" times out. Caught.
2. Disabled the refusal (`refused` always `false`) → the refused-slice test hangs/fails (4xx now retried forever, blocking the queue). Caught.
3. Removed the cross-process lock from `drain()` → two-process test fails with a duplicated send (`'parent 0'` sent twice), confirming the lock is load-bearing, not incidental. Caught.
4. Disabled AR0211 routing (`through` always `[main]`) → "every bot polls its own chat; a reply goes by each bot..." test times out. Caught.

All four mutations were caught by the existing permanent test suite; none required the worker's (deleted) throwaway script to detect.

**Correctness review of `outbox.ts`'s cross-process protocol:** traced the release→recheck sequence in `drain()`; release (`unlinkSync`) and the subsequent `queued()` recheck are synchronous with no intervening await, so any slice written by another process while this process holds the lock is either seen by the current `each()` loop's next iteration or by the release-adjacent recheck — consistent with the "a live holder...lists the outbox again before it lets go" invariant and with the passing/mutation-failing two-process test.

**Docs/diagram.** `packages/telegram/docs/telegram.md` "Sending"/outbox section matches the implementation (file naming, lock, retry, 429, refusal, cut note). README table and `arthur.mmd` updated to "2 of 4 entries"; the pre-existing structure test asserting README's mermaid block equals `arthur.mmd` passed.

**Commits.** Three Conventional Commits, `AR0212` scope, each signed off (`Signed-off-by: Kacper (agent)...`).

## Notes (non-blocking)
- `through()` re-reads the whole event log (`readEvents` reads the full file) once per reply when >1 bot is configured — worker flags this as `[INFERENCE]`; acceptable for now, not a roadmap-48/AR0211 requirement to bound.
- A send that times out after Telegram actually took it can be retried, causing a possible duplicate to the owner — inherent to "one retry," not a regression this ticket introduces, and not contradicted by any Done-means item.

PASS
