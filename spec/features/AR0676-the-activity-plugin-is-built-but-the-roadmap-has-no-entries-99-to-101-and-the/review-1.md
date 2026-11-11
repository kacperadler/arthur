# AR0676 - Review 1

- Job: 2026-11-10-review-2b5c1cd4
- Branch: arthur/2026-11-10-worker-a64d878b
- Commit reviewed: 0fe65b66411f7cc7ba32063bc823d77c611d5cd7
- Verdict: PASS

## Final message

No findings. The branch does what AR0676 asks, end to end, and changes nothing outside its Scope.

- **Roadmap.** `spec/roadmap.md:1034-1064` adds a new `## Activity` section with entries 99, 100 and 101. They follow §7 of the AR0527 plan and name AR0528, AR0529 and AR0530 on `- Tickets:` lines. An intro paragraph is added at `:25`. Every file and claim the entries name exists: the core files, `orchestration.ts:91` `provide("actor")`, `schedule/src/sweep.ts`, `activity: 350` in `test/structure.test.ts`, and the `keepDays` 0 to 36500 limit in `packages/activity/docs/activity.md`.
- **Site roadmap page.** It builds and shows "Activity: 2 of 3 built", with 99 and 100 built and 101 planned. That matches `spec/build.json`: AR0528 and AR0529 are merged, AR0530 is planned.
- **Vision.**
  - `spec/vision.md:36` now lists `plan-reviewer` and `pyramid`. Both are real config keys (`arthur.config.example.ts:106,380`) and registered roles.
  - `:77` names dokploy's `create`, `setup` and `env`, matching `packages/dokploy/docs/dokploy.md:3` and AR0654, which is merged.
  - `:87` adds an `activity` row whose defaults (300 characters, 90 days) match the plugin's docs.
- **Diagrams.**
  - `arthur.mmd` has an `activity` node with its class line `partial` in name order, which is right because AR0530 is not built yet.
  - `core-and-plugins.mmd` adds `uptime` and `activity` to their subgraphs and to the `first` class list.
  - `versions.mmd` adds activity to `p3`; uptime was already in `p1`.
- **Worker's claims.** Every claim in the final message reproduced on `0fe65b66`.
- **`findings.md` (new).** F1 (roadmap entries 77 and 79 lack the plan's additions) and F2 (herdr is in no diagram) are both accurate. I confirmed that no `.mmd` file names herdr.

## Notes
- (minor) spec/vision.md:87: the activity row says "`arthur log` and `/log` read it." in the present tense, but AR0530 is still planned. That fits the vision as a statement of scope, and the stats row reads the same way; `arthur.mmd` marks the views as planned.
- (minor) docs/architecture/core-and-plugins.mmd:72: the activity node lists "arthur log, /log" without "planned". This diagram marks first versus later, not what is built, so it is consistent with its other nodes.

## Checks (on 0fe65b66)
- `npm run check`: `tsc` clean.
- `npm test`: 1716 tests, 1652 pass, 0 fail, 64 skipped.
- `npm run mutate`: 0 mutants, 0 caught, 0 survived. The diff changes only `.md` and `.mmd` files.
- `cd site && npm run generate`: the roadmap page builds with entries 99 to 101 and their tickets; the generated files are gitignored, so the working tree stays clean.
- `cd site && npm test`: 36 tests, 36 pass, 0 fail.

PASS