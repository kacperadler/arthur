# AR0278 - In an eval run, `arthur <command> --help` answers only what the scenario's stub says

```json
{
  "id": "AR0278",
  "title": "In an eval run, `arthur <command> --help` answers only what the scenario's stub says",
  "date": "2026-10-22",
  "after": [
    "AR0277"
  ]
}
```

## Description

the coordinator reads a command's page with `arthur <command> --help` before it acts; in a run the stub prints nothing for it unless the scenario's `stub` has an answer for that line, so a turn that reads the help sees an empty page where the live coordinator sees the doc. No member of the published host API lists the registered commands with their doc pages (`commands.phone()` lists only phone commands), so develop cannot print them.

## Goal

A coordinator turn in an eval sees the same command help pages as the live one, so a scenario that reads `arthur <command> --help` before acting is replayed faithfully.

- Kind: improvement

Evidence:
- `packages/develop/src/eval-stub.ts`
- Found by: 2026-10-22-ar0276-evals-runner-eda48620 (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: a host member (or provided name) that lists every registered command with its doc URL, recorded in docs/plugin-api.md; the stub prints the page for `--help` and `arthur help <command>`, noting the call as help so no expectation counts it.
- `npm test` and `npm run check` pass.

## Scope

In:
- a host member (or provided name) that lists every registered command with its doc URL, recorded in docs/plugin-api.md; the stub prints the page for `--help` and `arthur help <command>`, noting the call as help so no expectation counts it.

## Decisions

- 2026-10-22: Source: F2 of AR0276
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
