# AR0030 - Owner lookup takes the first longer prefix, not the longest

```json
{
  "id": "AR0030",
  "title": "Owner lookup takes the first longer prefix, not the longest",
  "date": "2026-10-16"
}
```

## Description

`nameProblem` in `packages/core/src/env.ts` attributes a variable name to the first longer prefix it finds in `owners` order. It now takes the longest, so a refusal names the right owner at any nesting depth.

## Goal

A variable name is always attributed to the owner with the longest matching prefix, so a refusal names the right plugin or instance at any nesting depth. Found by the AR0028 review (F1): with three or more nested levels the message could name the wrong owner.

- Kind: fix

## Done means

- With three nested owners (e.g. plugin `a`, its instance `b`, plugin `a-b` with instance `c`) a name under the deepest prefix is attributed to the deepest owner; a new test in `packages/core/test/env.test.ts` fails before the change and passes after, whatever order the owners were declared in.
- The existing two-level cases hold; no secret value in any message.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/env.ts` (`nameProblem`), `packages/core/test/env.test.ts`.

Out:
- The N-1 pairwise messages for three owners of one prefix (accepted by the review).

## Decisions

- 2026-10-16: Source: F1 of AR0028
