# AR0339 - Outcome

- Merged: 2026-10-26, `ff75b704`
- Branch: arthur/2026-10-25-worker-4ef1fa04
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md FAIL, review-4.md PASS
- Cost: worker $11.53, reviews n/a; review rounds 4

## What went in

- `packages/core/src/config.ts`, `core-options.ts`: `core.envFile` defaults to `.env` in the user's config folder (`$XDG_CONFIG_HOME/arthur`, else `~/.config/arthur`), outside the config's folder and every project's checkout, so a recursive search there no longer prints its values.
- `packages/core/src/requirements.ts`, `cli.ts`, `host.ts`: `arthur doctor` has a `core env` line that warns when the env file lies inside the config's folder or a project's checkout.
- `packages/core/src/setup.ts`: `arthur setup` names the env file by its new place.
- `docs/setup.md`, `packages/core/docs/commands/config.md`, `doctor.md`, `setup.md`: the new place, why, and how an existing install moves its file.
- Tests: the CLI tests start their children with the test kit's `XDG_CONFIG_HOME`, so no test opens the owner's real env file; the doctor line's rows. Core line budget 6184 to 6197 (AR-D48).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1144/1150 passed.

## Left open

- F1: ticket AR0445 (doctor's env-file check compares paths as text).
- F2: ticket AR0446 (doctor's fix text ignores XDG_CONFIG_HOME).
- F3 to F7: dropped (see findings.md).
