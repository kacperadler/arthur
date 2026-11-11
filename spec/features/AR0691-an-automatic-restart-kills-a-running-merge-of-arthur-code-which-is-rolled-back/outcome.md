# AR0691 - Outcome

- Merged: 2026-11-11, `11010107`
- Branch: arthur/2026-11-11-worker-32ad867e
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $9.87, reviews $2.29; review rounds 2

## What went in

- arthur.config.example.ts: the `freshAt` and `freshRetryMinutes` comments say a running merge holds the fresh start too
- docs/plugin-api.md: records the provided name `delivery.merging` (AR0691), what it holds (first look at main through the `spec:` commit, not the push and prune) and its row in the provided-names table
- packages/delivery/docs/commands/merge.md: says a live `merge.lock` is named to session through `delivery.merging`, which makes no restart meanwhile
- packages/delivery/src/delivery.ts: provides `delivery.merging`
- packages/delivery/src/merge-recovery.ts: `merging(host)` returns each project whose `merge.lock` names a live process, with its job; holds the shared `alive(pid)`
- packages/delivery/src/pass-forward.ts: uses `alive` from `merge-recovery.ts` instead of its own copy
- packages/delivery/test/merge.test.ts: the lock test also checks `delivery.merging` for an in-process merge, another live process, this process's pid not held, a hand-edited lock and a dead holder
- packages/session/docs/commands/restart.md: steps 1 and 5 say `/restart` is refused or stopped while a merge runs, from its first look at main through its `spec:` commit, with the exact lines
- packages/session/docs/session.md: a paragraph on what a running merge holds and that its push and prune are not covered; the options table, the fresh start's steps 2–4 and the restart guard's steps 3 and 6 name the merge
- packages/session/evals/after-restart-plan/scenario.json: the faked spawn refusal reads "once no job and no merge runs"
- packages/session/evals/unblocked-after-restart/scenario.json: the faked spawn refusal reads "once no job and no merge runs"
- packages/session/src/restart-guard.ts: the spawn refusal and the context line say "once no job and no merge runs"
- packages/session/src/restart.ts: `busy()` counts jobs and the merges delivery names; `/restart`, the settle of a request, the restart due and the fresh start's tries wait for both
- packages/session/src/session-options.ts: the `freshAt` and `freshRetryMinutes` descriptions name the merge
- packages/session/src/session.ts: the header comment says the fresh start waits for no job and no merge
- packages/session/test/restart-guard.test.ts: expects the new refusal and context wording
- packages/session/test/restart.test.ts: three tests of the merge hold, for the fresh start (with a coordinator up, its try asking nothing), `/restart` and the restart due
- spec/features/AR0691-an-automatic-restart-kills-a-running-merge-of-arthur-code-which-is-rolled-back/findings.md: new file, F1 (push and prune not held), F2 (vision line), F3 (boot id), F4 (a leftover fake agent), all open
- spec/roadmap.md: entry 36 and the `arthur update` entry say a running merge holds the restart too
- test/structure.test.ts: delivery's budget 2246 → 2267 (main's raise plus this branch's), session's 953 → 958

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1676/1747 passed.

## Left open

- Deferred (client summary): F1. A restart may still end `arthur merge` during its push and its prune
- Deferred (client summary): F2. The vision still says the fresh start waits only for jobs
- Deferred (client summary): F3. `delivery.merging` ignores the boot id in `merge.lock`
- Deferred (client summary): F4. A session test run once left a fake agent running
