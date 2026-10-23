# AR0344 - A pasted secret of capitals, digits and `_` in a `...Env` option is printed by the refusal

```json
{
  "id": "AR0344",
  "title": "A pasted secret of capitals, digits and `_` in a `...Env` option is printed by the refusal",
  "date": "2026-10-23"
}
```

## Description

the one shape of pasted secret the "not shown" rule misses.

## Goal

A refusal of a `...Env` option never prints its value, so a secret pasted there by mistake stays off the screen and the log; tested.

- Kind: bug

Evidence:
- `packages/core/src/env.ts:24` (`VARIABLE`), `packages/core/src/env.ts:102-103`
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: print the name only when it starts with `ARTHUR_` (then it is a name of the wrong owner, which `env.ts:106` already tells), else `the text given is not shown` as `env.ts:102` does. Test in `packages/core/test/env.test.ts`, "an option that is not a name is refused without showing it": one more option whose value is `DEADBEEF0123` and the assertion that no problem line holds it.
- `npm test` and `npm run check` pass.

## Scope

In:
- print the name only when it starts with `ARTHUR_` (then it is a name of the wrong owner, which `env.ts:106` already tells), else `the text given is not shown` as `env.ts:102` does. Test in `packages/core/test/env.test.ts`, "an option that is not a name is refused without showing it": one more option whose value is `DEADBEEF0123` and the assertion that no problem line holds it.

## Decisions

- 2026-10-23: Source: F8 of AR0319
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
