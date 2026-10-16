# AR0006 - Outcome

- Merged: 2026-10-16, `dfa9ef5`
- Branch: h/2026-10-16-ar0006-config-env-names-8aca9224
- Reviews: review-1.md PASS
- Cost: worker $2.61, reviews $0.72; review rounds 1

## What went in

- `packages/core/src/env.ts`: `checkEnv`, `resolveEnv`, `parseEnvFile`: every `...Env` option of an enabled plugin resolved from the shell (wins even when empty), else the env file; names `ARTHUR_<PLUGIN>_[<INSTANCE>_]<WHAT>`, foreign prefixes refused; no value is ever printed.
- `packages/core/src/config-check.ts`: `arthur config check`, one `set`/`missing` line per variable.
- `packages/core/src/cli.ts`: a temporary `arthur` binary with `config check` only, replaced by entry 6.
- Tests for each refusal, the env file's edge cases, and a known secret absent from all output.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 44/44 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0028 (F1), AR0029 (F2).
