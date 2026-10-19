# AR0180 - While an env variable is missing, neither `arthur doctor` nor `arthur setup` checks the plugins' requirements

```json
{
  "id": "AR0180",
  "title": "While an env variable is missing, neither `arthur doctor` nor `arthur setup` checks the plugins' requirements",
  "date": "2026-10-19"
}
```

## Description

roadmap entry 94's example run shows `telegram ffmpeg: missing: ...` under Requirements while `ARTHUR_TELEGRAM_CHAT_ID` is missing. A plugin's requirements come through `collect("doctor")`, which a plugin provides in its `setup`; the load refuses a missing variable before any `setup`, so `arthur doctor` prints only the core's lines and says the plugins' are not checked, and `arthur setup`, which prints the same lines from the same function, shows the core's lines and `the plugins' requirements are not checked until what Config refuses is fixed`. Reproduce: `packages/core/test/setup.test.ts`, the test "a missing variable is a step that refuses the start ...". On a new machine the owner sees the plugins' missing tools only after `.env` is complete.

## Goal

`arthur doctor` and `arthur setup` check the plugins' requirements even while an env variable is missing, so a first setup shows everything that is missing at once instead of one round per fix.

- Kind: improvement

Evidence:
- `packages/core/src/host.ts:37` (`resolveEnv` throws before any plugin's `setup`, so no plugin provides `doctor`)
- Found by: 2026-10-19-ar0179-arthur-setup-9194f26c (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: let a plugin's requirements be read without its env values, for example a `doctor` the plugin's package exports beside its options file (taking the options, not the host), which `arthur doctor` and `arthur setup` call for every enabled plugin before or without `setup`. Out: running a plugin's `setup` with a variable missing.
- `npm test` and `npm run check` pass.

## Scope

In:
- let a plugin's requirements be read without its env values, for example a `doctor` the plugin's package exports beside its options file (taking the options, not the host), which `arthur doctor` and `arthur setup` call for every enabled plugin before or without `setup`. Out: running a plugin's `setup` with a variable missing.

## Decisions

- 2026-10-19: Source: F1 of AR0179
