# AR0288 - The eval stub answers a command's --help with that command's scripted result

```json
{
  "id": "AR0288",
  "title": "The eval stub answers a command's --help with that command's scripted result",
  "date": "2026-10-22",
  "after": [
    "AR0278"
  ]
}
```

## Description

in the real run of `delivery/check-failed`, the coordinator ran `arthur merge --help` and the stub's `^arthur merge ` answer printed the failed merge, so it never ran the merge itself (3 of 3 runs). This branch keeps every shipped answer off `--help` (`^arthur (?!.*--help)…`), but a new scenario can fall into it again.

## Goal

The eval stub never answers a `--help` call with a command's scripted result, in the stub itself, so scenarios no longer need a per-regex workaround.

- Kind: bug

Evidence:
- `packages/develop/src/eval-stub.ts`
- Found by: 2026-10-22-ar0280-eval-scenarios-4e8abbcc (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: the stub never answers a call with `--help` or `help <command>` from the scenario's answers; with AR0278 it prints the command's page.
- `npm test` and `npm run check` pass.

## Scope

In:
- the stub never answers a call with `--help` or `help <command>` from the scenario's answers; with AR0278 it prints the command's page.

## Decisions

- 2026-10-22: Source: F3 of AR0280
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
- 2026-10-22: Coordinator (free hand): line budget raise accepted, develop 628 to 633, for help answers of unregistered commands.
