# AR0343 - Git ignores `.env` only, while `core.envFile` may be any name the guard counts as a secrets file

```json
{
  "id": "AR0343",
  "title": "Git ignores `.env` only, while `core.envFile` may be any name the guard counts as a secrets file",
  "date": "2026-10-23"
}
```

## Description

the env file pushed to origin with the ticket and the board.

## Goal

Whatever name `core.envFile` has, git ignores that file, or the config refuses a name git would not ignore; tested.

- Kind: security

Evidence:
- `.gitignore:2`, `packages/core/src/core-options.ts:33` (any path), `packages/orchestration/roles/coordinator/plan-ended.md:10` (the coordinator commits in the config's folder), `packages/core/src/env-refusal.ts:12` (`.env<suffix>` is a secrets file to the guard)
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: `arthur doctor` (the core's requirements, `packages/core/src/requirements.ts`) warns, critical, when `core.envFile` lies inside a Git checkout and `git check-ignore -q <file>` fails; and `.gitignore` takes `.env.*`. Test in `packages/core/test/doctor.test.ts`: a config folder that is a repository with `envFile: "env"` not ignored gets the line; ignored, `ok`.
- `npm test` and `npm run check` pass.

## Scope

In:
- `arthur doctor` (the core's requirements, `packages/core/src/requirements.ts`) warns, critical, when `core.envFile` lies inside a Git checkout and `git check-ignore -q <file>` fails; and `.gitignore` takes `.env.*`. Test in `packages/core/test/doctor.test.ts`: a config folder that is a repository with `envFile: "env"` not ignored gets the line; ignored, `ok`.

## Decisions

- 2026-10-23: Source: F7 of AR0319
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
- 2026-10-27: Raise the core line budget by what the fix needs, without asking the owner; pre-approved by policy (AR-D63)
- 2026-10-27: AR0343: arthur run refuses to start while the env file lies in a Git checkout that does not ignore it (the coordinator's recommendation, under AR-D98); the owner: "always go with your recommendation" (AR-D116)
- 2026-10-27: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D74)
