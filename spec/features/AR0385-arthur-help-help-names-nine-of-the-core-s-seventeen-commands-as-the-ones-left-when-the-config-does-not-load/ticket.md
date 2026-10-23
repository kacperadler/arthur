# AR0385 - `arthur help --help` names nine of the core's seventeen commands as the ones left when the config does not load

```json
{
  "id": "AR0385",
  "title": "`arthur help --help` names nine of the core's seventeen commands as the ones left when the config does not load",
  "date": "2026-10-23"
}
```

## Description

the page says only `config`, `continue`, `help`, `roles`, `run`, `spawn`, `steer`, `stop`, `ticket` exist when `arthur.config.ts` or a plugin does not load; the CLI then lists `config, continue, doctor, help, jobs, prune, remote-job, roles, run, send, setup, spawn, steer, stop, stopall, ticket, version` (the test "when the config does not load, the core's commands still run…" pins that list). `doctor`, `jobs`, `prune`, `remote-job`, `send`, `setup`, `stopall` and `version` are missing from the page, and so are the refusals of those that need the load.

## Goal

`arthur help --help` names exactly the commands left when the config does not load; tested.

- Kind: refactor

Evidence:
- `packages/core/docs/commands/help.md:18`; the list the CLI prints, `packages/core/test/cli.test.ts:9` (`CORE_LIST`)
- Found by: 2026-10-23-ar0353-job-runs-h-comman-77582826 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: the page names the list as the CLI prints it, and which of them refuse without the load; nothing else changes.
- `npm test` and `npm run check` pass.

## Scope

In:
- the page names the list as the CLI prints it, and which of them refuse without the load; nothing else changes.

## Decisions

- 2026-10-23: Source: F1 of AR0353
- 2026-10-23: Coordinator (free hand, finding ticket) approved; runs one at a time after the high-severity security fixes.
