# AR0278 - Outcome

- Merged: 2026-10-22, `7732a3d`
- Branch: h/2026-10-22-ar0278-c88bc117
- Reviews: review-1.md PASS
- Cost: worker $3.85, reviews $1.26; review rounds 1

## What went in

- `packages/core/src/commands.ts`, `plugin-host.ts`: `host.commands.docs()` lists every registered command, the core's and each plugin's, with its doc page; `docs/plugin-api.md` records it.
- `packages/develop/src/eval-command.ts`, `eval-run.ts`: `arthur eval` reads every page once and hands them to the stub; help calls are left out of `calls` and `never` scoring.
- `packages/develop/src/eval-stub.ts`: `arthur <command> --help` and `arthur help <command>` for a loaded command print the live CLI's page, never a scripted answer.
- `test/structure.test.ts`: budgets core 5751, develop 628.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1015/1015 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0291 (F1).
