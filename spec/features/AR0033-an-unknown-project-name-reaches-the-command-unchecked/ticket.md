# AR0033 - An unknown `--project` name reaches the command unchecked

```json
{
  "id": "AR0033",
  "title": "An unknown `--project` name reaches the command unchecked",
  "date": "2026-10-16"
}
```

## Description

`arthur <cmd> --project <name>` hands the name to the command as `project`; nothing yet knows the project list (entry 41 adds `host.projects()`), so `--project typo` is not refused by the binary and each command would have to check it.

## Goal

A command never runs for a project Arthur does not know: `--project` is checked against the project list (entry 41) and an unknown name is refused naming the known ones.

- Kind: improvement

Evidence:
- `packages/core/src/cli.ts` (`main`)
- Found by: 2026-10-16-ar0009-command-registry-daf148e5 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: with entry 41, the binary refuses a `--project` name that `host.projects()` does not list, naming the known projects, before the command runs.
- `npm test` and `npm run check` pass.

## Scope

In:
- with entry 41, the binary refuses a `--project` name that `host.projects()` does not list, naming the known projects, before the command runs.

## Decisions

- 2026-10-16: Source: F2 of AR0009
