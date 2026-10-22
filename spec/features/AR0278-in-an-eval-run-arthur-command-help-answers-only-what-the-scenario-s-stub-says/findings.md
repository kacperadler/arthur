# AR0278 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The scenarios' `(?!.*--help)` guards are dead weight once the stub prints help itself

- Kind: cleanup
- Found by: 2026-10-22-ar0278-c88bc117 (worker), 2026-10-22
- Where: `packages/*/evals/*/scenario.json` (94 `match` and `never` regexes in 19 files, `git grep -c -F '(?!.*--help)' -- 'packages/*/evals'`), `packages/develop/test/scenarios.test.ts:118` and the other `fails` lines quoting them
- What: every scenario writes `^arthur (?!.*--help)<command>` so a help call neither takes an answer nor trips a `never`. Since AR0278 the stub answers `--help` and `arthur help <command>` of a registered command itself, notes them `help: true`, and the scoring leaves them out, so in a load where the command's plugin is enabled the guard never matters. It still matters for a command the load does not register (orchestration's `night-one-line` guards `arthur merge`, delivery's), which the stub sends to the answers as the live CLI calls it unknown.
- Suggestion: drop the guard from the regexes of commands the scenario's own package or the core registers, keep it where the command belongs to another plugin, and update the `fails` lines of scenarios.test.ts; re-run `arthur eval --save-baseline` only if a rate moves. Left out here: it changes what 19 scenarios match and is not what this ticket asked.
- Status: ticket AR0291
