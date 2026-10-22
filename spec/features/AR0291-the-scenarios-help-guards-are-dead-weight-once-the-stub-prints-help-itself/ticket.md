# AR0291 - The scenarios' `(?!.*--help)` guards are dead weight once the stub prints help itself

```json
{
  "id": "AR0291",
  "title": "The scenarios' `(?!.*--help)` guards are dead weight once the stub prints help itself",
  "date": "2026-10-22",
  "after": [
    "AR0288"
  ]
}
```

## Description

every scenario writes `^arthur (?!.*--help)<command>` so a help call neither takes an answer nor trips a `never`. Since AR0278 the stub answers `--help` and `arthur help <command>` of a registered command itself, notes them `help: true`, and the scoring leaves them out, so in a load where the command's plugin is enabled the guard never matters. It still matters for a command the load does not register (orchestration's `night-one-line` guards `arthur merge`, delivery's), which the stub sends to the answers as the live CLI calls it unknown.

## Goal

The scenarios drop their `(?!.*--help)` regex guards once the stub prints help itself, so each scenario's expected calls read as what the coordinator should do.

- Kind: cleanup

Evidence:
- `packages/*/evals/*/scenario.json` (94 `match` and `never` regexes in 19 files, `git grep -c -F '(?!.*--help)' -- 'packages/*/evals'`), `packages/develop/test/scenarios.test.ts:118` and the other `fails` lines quoting them
- Found by: 2026-10-22-ar0278-c88bc117 (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: drop the guard from the regexes of commands the scenario's own package or the core registers, keep it where the command belongs to another plugin, and update the `fails` lines of scenarios.test.ts; re-run `arthur eval --save-baseline` only if a rate moves. Left out here: it changes what 19 scenarios match and is not what this ticket asked.
- `npm test` and `npm run check` pass.

## Scope

In:
- drop the guard from the regexes of commands the scenario's own package or the core registers, keep it where the command belongs to another plugin, and update the `fails` lines of scenarios.test.ts; re-run `arthur eval --save-baseline` only if a rate moves. Left out here: it changes what 19 scenarios match and is not what this ticket asked.

## Decisions

- 2026-10-22: Source: F1 of AR0278
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
