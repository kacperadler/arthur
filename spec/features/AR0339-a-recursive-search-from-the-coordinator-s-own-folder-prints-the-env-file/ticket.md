# AR0339 - A recursive search from the coordinator's own folder prints the env file

```json
{
  "id": "AR0339",
  "title": "A recursive search from the coordinator's own folder prints the env file",
  "date": "2026-10-23"
}
```

## Description

the honest mistake the guard exists for, a search for a variable's name, puts its value in the coordinator's transcript, which the model provider keeps.

## Goal

A recursive search from the coordinator's folder never prints the .env file: the guard catches recursive reads that reach it, or the file lives outside that folder; tested.

- Kind: risk

Evidence:
- `packages/core/src/core-options.ts:33` (`.env` beside the config by default), `packages/orchestration/src/coordinator.ts:118` (the coordinator's agent runs in the folder `arthur run` runs in), `packages/core/src/env-refusal.ts:53-66` (a name in the call's text is the only thing looked for)
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: either of two, the first the smaller: default `core.envFile` to a folder no agent works in (`~/.config/arthur/env`, next to `arthur.env` of `docs/setup.md`, step 8), `arthur setup` and `docs/setup.md` saying so, and `arthur doctor` warning when `core.envFile` lies inside a project's checkout or the config's folder; or refuse, in `envRefusal`, a recursive search (`grep -r`/`-R`, `rg`, `find`, `tar`, `zip`, the `grep` tool with a folder `path`) whose folder, resolved from `cwd`, holds a secrets file, naming it. Tests: a `PROJECT` row per command in `packages/core/test/env-guard.test.ts` (refused in a folder with `.env`, allowed in one without), or a doctor test for the warning.
- `npm test` and `npm run check` pass.

## Scope

In:
- either of two, the first the smaller: default `core.envFile` to a folder no agent works in (`~/.config/arthur/env`, next to `arthur.env` of `docs/setup.md`, step 8), `arthur setup` and `docs/setup.md` saying so, and `arthur doctor` warning when `core.envFile` lies inside a project's checkout or the config's folder; or refuse, in `envRefusal`, a recursive search (`grep -r`/`-R`, `rg`, `find`, `tar`, `zip`, the `grep` tool with a folder `path`) whose folder, resolved from `cwd`, holds a secrets file, naming it. Tests: a `PROJECT` row per command in `packages/core/test/env-guard.test.ts` (refused in a folder with `.env`, allowed in one without), or a doctor test for the warning.

## Decisions

- 2026-10-23: Source: F3 of AR0319
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
