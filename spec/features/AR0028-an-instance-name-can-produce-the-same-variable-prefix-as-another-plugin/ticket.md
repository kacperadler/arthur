# AR0028 - An instance name can produce the same variable prefix as another plugin

```json
{
  "id": "AR0028",
  "title": "An instance name can produce the same variable prefix as another plugin",
  "date": "2026-10-16"
}
```

## Description

a `youtrack` instance named `cloud` and a plugin named `youtrack-cloud` both own the prefix `ARTHUR_YOUTRACK_CLOUD_`; each may use `ARTHUR_YOUTRACK_CLOUD_TOKEN`, so one variable feeds two owners. Reproduced: `checkEnv` on those two plugins with the variable in the shell returns no problem and the value under both `youtrack` and `youtrack-cloud`. Likewise instance names `a-b` and `a b` both map to `A_B_` (not run). Not reachable with the example config.

## Goal

Two plugins can never claim the same env variable: an instance name that would make one plugin's prefix equal another's is refused at load, naming both.

- Kind: security

Evidence:
- `packages/core/src/env.ts` (`nameProblem`, `prefix`, `part`)
- Found by: 2026-10-16-ar0006-config-env-names-8aca9224 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: refuse two owners (plugins or instances of one plugin) with the same prefix in `checkEnv`, naming both; leave the naming scheme as it is.
- `npm test` and `npm run check` pass.

## Scope

In:
- refuse two owners (plugins or instances of one plugin) with the same prefix in `checkEnv`, naming both; leave the naming scheme as it is.

## Decisions

- 2026-10-16: Source: F1 of AR0006
