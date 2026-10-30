# AR0575 - Review 1

- Job: 2026-10-30-review-59139015
- Branch: arthur/2026-10-30-worker-1d04e9ab
- Commit reviewed: b340577244598e27d00d42333aa04d3fd02a3dbb
- Verdict: PASS

## Final message

No finding blocks the merge: the branch does what AR0575 asks, and the checks pass in my checkout.

## Findings

None that fail the branch.

- **Notices under the `due` slot** (`packages/session/src/restart.ts:121-142`). The plan (P6) says "`settle` treats `due` like `/restart`, not like a night try. The existing path then sends `Restarted.`". The flow follows that: `byNight` is false for `due`, the restart is made, and `Restarted. (arthur run restarted)` follows. The test checks this. The one difference is that two notices now go out only for `/restart` (the `owner` gate): "not done, … run /stopall first" and "restart: not done: <error>". The worker's final message names this change and gives its reason, so under the role it is not a FAIL. The reason holds. Unlike `/restart`, the tick asks for a `due` restart again on its own, so keeping the notices would send the same notice over and over. It would also tell the owner to run `/stopall` for a restart he never asked for.
- **`/restart` refusal text**: `{ "/restart": …, due: "the restart guard" }[pending.slot] ?? \`freshAt …\`` is correct for every slot that is written today. `docs/commands/restart.md` is outside the Scope list, but the worker gives the reason: the command's output changed.

## Notes (non-blocking)

- **Untested cancelled wake** (`packages/github/src/github.ts:100`). If I change `run.conclusion === "success"` to `run.conclusion !== "failure"`, cancelled and timed-out runs stop waking the coordinator, and no test catches it (19/19 pass). This gap already existed on the base: no test checks a cancelled-run wake. The ticket's "no wake on success, a wake on failure" is met. A cancelled case could be added to the new test.
- **Possible loop of handoff turns** `[INFERENCE]`. If the restart throws on every try (it cannot write `restarted.json`, or `coordinator.restart` throws) while a coordinator is up, each 500 ms tick asks the `due` restart again. Each new ask gives the coordinator a handoff turn, with nothing to slow it down. The plan's four conditions produce this; only the case with no coordinator is tested.
- **Findings file**: F1 (git runs every 500 ms while `arthur run` sits idle) is recorded as open, which is right.
- **Line budgets**: session goes from 879 to 887 (+8; the plan estimated +10), and `BUDGETS.session` is 887. `restart.ts` goes from 191 to 199 lines. github stays at 951 (+0). These match the worker's message.
- **Deleted assertion**: the line removed from `context.test.ts:78` only pinned the old wording, so removing it follows the review criteria.

## Checks run

- `npm ci`: exit 0.
- `npm run check`: tsc, exit 0.
- `npm test`, run in the same call with an 1800 s timeout: 1327 tests, 1265 pass, 0 fail, 62 skipped, exit 0. This matches the worker's claim.
- Mutations on `restart.ts`, each run against `packages/session/test/restart.test.ts` (28 tests) and restored with `git checkout`:

  | Mutation | Failing tests |
  |---|---|
  | Drop `!leaving` | 3 |
  | Drop `servicePid(...) === process.pid` | 1 |
  | Drop `host.jobs.running().length === 0` | 2 |
  | Drop `readRequest(...) === undefined` | 4 |
  | Drop `due(host) !== undefined` | 2 |
  | `byNight = !owner` (`due` treated as a night try) | 1 |
  | Job-running notice gated by `true` instead of `owner` | 1 |
  | Throw notice gated by `!byNight` (the base behaviour) | 1 |
  | `run: false` in the tick's request | 4 |

- Mutations on `github.ts`, run against `packages/github/test/github.test.ts`:
  - Dropping `|| run.conclusion === "success"` fails the new test (18 pass, 1 fail).
  - Changing it to `run.conclusion !== "failure"`: nothing fails (19 pass). This is the cancelled-wake note above.
- `git status` is clean after the mutations.

PASS