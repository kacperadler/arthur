# AR0705 - Review 2

- Job: 2026-11-13-review-04099ada
- Branch: arthur/2026-11-13-worker-fa1b7778
- Commit reviewed: f520186c0b7f03d9319d75f28cc8410fe7b998be
- Verdict: FAIL

## Final message

I'm failing this branch on one finding. The diagram fix for review 1 went too far: it moves project agents into "First-version plugins", but the roadmap, the vision and the other diagrams all place them in the later work. The code, the tests and the worker's other claims hold up.

## Findings

1. **`arthur.mmd:58-59` and `README.md:71,77`: the diagrams now put project agents in the first version.**
   - The fix commit f520186c moves the `agents` node out of `subgraph LATER[Later plugins]` into the Coordinator subgraph, which sits inside `subgraph FIRST[First-version plugins]` (`arthur.mmd:45`).
   - In the README diagram, it adds "project agents partly built" to the `coord` node inside `FIRST[First-version plugins…]` (`README.md:68,71`), and removes "project agents" from the `later` node.
   - In `arthur.mmd`, the colour shows how much is built and the FIRST/LATER subgraph shows the version. So the diagram now says project agents are a first-version plugin.
   - The repository says otherwise, at the branch's tip:
     - `spec/roadmap.md:1079` puts entries 85 to 88 under `## Later`;
     - `docs/architecture/versions.mmd:15-16` lists "1 project agents" first under "Later, in this order";
     - `docs/architecture/core-and-plugins.mmd:105` keeps `agents` in the `later` class;
     - `spec/vision.md:66` says "Later".
   - The worker's reason, "as docker did (AR0646)", does not carry over: docker was already a first-version node, so only its class changed.
   - Review 1's finding only needed the state to change. Keeping `agents` in LATER with `class agents partial;`, and keeping "project agents partly built" in the README's `later` node, shows partly built without changing the version plan.
   - The new diagram is misleading about scope, and it contradicts three sources the branch leaves unchanged.

## Notes
- (minor) `packages/telegram/src/telegram.ts:105`: changing `has_topics_enabled === true` to `!== false` survives `telegram.test.ts` (23 pass). The fake always sends the field, as its shape test requires, so a `getMe` that leaves the field out is never tested; per the docs it is Optional.
- (minor) `packages/telegram/src/telegram.ts:74`: adds to F2. A chat that names the main bot by name and one that leaves `instance` out also give two doctor lines for the same bot.
- (minor) `packages/orchestration/src/sessions.ts:44`: another way around the spawn guard, beyond review 1's list. `sessionOf` matches the folder exactly, so `ARTHUR_ORCHESTRATION_FOLDER` pointed at the coordinator's folder, or written with a trailing `/`, lets a spawn of another project through. The docs already say the guard catches slips and is not a boundary.
- (minor) `test/mutate.ts` (outside the range): my last `npm run mutate` call left a test job's wrapper and its fake agent running (pids 1464577 and 1464697, about 4 minutes old). The worker reported the same thing. I killed both, and `ps` showed neither afterwards.

## Checks (on f520186c, detached checkout)
- **`npm run check && npm test`**, one call: `tsc` passed. The first test run had 1 failure, in `packages/uptime/test/uptime.test.ts:343` ("waited 20 s for the first checks"), a file the diff does not touch.
  - That file run alone: 25 tests, 25 pass, 0 fail.
  - `npm test` again: 1846 tests, 1782 pass, 0 fail, 64 skipped. This matches the worker's numbers.
- **`npm run mutate`**, three calls on the same commit. The first two stopped on time (59, then 9 `not run (time)`). The last one ended `100 mutants, 98 caught, 2 survived; 357 not run (--max 100)`.
  - The survivors are `context.ts:67` and `stats/src/session-extension.ts:16`. Both reverted hunks leave behaviour unchanged, so neither is a missing test.
- **Hand mutations**, each restored with `git checkout -- <file>`; `git status` was clean at the end. Every one is caught except the telegram one:

| Mutation | Tests run | Result |
|---|---|---|
| Spawn guard disabled (`spawn-rules.ts`) | `project-agents.test.ts` | 12 pass, 1 fail |
| `coordinator stop` ignores the job's project (`coordinator-commands.ts`) | `project-agents` + `coordinator.test.ts` | 17 pass, 1 fail |
| `\|\| undefined` removed from `cli.ts` | `cli.test.ts` | 24 pass, 1 fail |
| Session plugin answers every session (`session.ts`) | `session.test.ts` | 14 pass, 1 fail |
| `--session-dir` given to the coordinator too (`coordinator.ts`) | `project-agents` + `coordinator` | 15 pass, 3 fail |
| `turns(start)` changed to `start()` (`coordinator.ts`) | `project-agents` + `coordinator` | 17 pass, 1 fail |
| Undefined extension answer no longer skipped (`coordinator.ts`) | `project-agents` + `coordinator` | 17 pass, 1 fail |
| Shared-chat refusal disabled (`sessions.ts`) | `project-agents` + `coordinator` | 17 pass, 1 fail |
| Telegram `=== true` changed to `!== false` | `telegram.test.ts` | 23 pass, 0 fail (survives) |

- **File sizes**: every changed source file is green, the largest `coordinator.ts` at 182 lines. The worker named the budget raises that go past the plan: orchestration +152 (plan +130) and telegram +20 (plan +15).

FAIL