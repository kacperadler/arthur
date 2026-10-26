# AR0445 - Doctor's env-file check compares paths as text, so a symlink into a checkout reads ok

```json
{
  "id": "AR0445",
  "title": "Doctor's env-file check compares paths as text, so a symlink into a checkout reads ok",
  "date": "2026-10-26"
}
```

## Description

`arthur doctor`'s `core env` line (`packages/core/src/requirements.ts:91`) decides whether the env file lies inside the config's folder or a project's checkout by comparing paths as text (`relative(...).split(sep)[0] !== ".."`). An env file reached through a symlink into a checkout, or a config folder that is itself a symlink, reads `ok`, so the warning AR0339 added misses the case it exists for. Found by AR0339's reviews 1 to 4 (non-blocking).

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: <!-- feat | fix | security | perf | refactor | test | docs | build | ci | chore | ux -->

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-26: Source: F1 of AR0339
