# AR0336 - A writing command after a `cd` into a guarded place with an operand built at run time passes

```json
{
  "id": "AR0336",
  "title": "A writing command after a `cd` into a guarded place with an operand built at run time passes",
  "date": "2026-10-23"
}
```

## Description

`cd <main>` then `for f in *; do rm $f; done` passes: the guard knows the shell is in the main checkout, but `rm $f` has no operand it can see, so it checks none. The same for `rm "$file"` and `mv $a $b` after any `cd` into a guarded place.

## Goal

In a guarded folder, a writing command whose operand is built at run time (a loop, a glob, a variable) is refused rather than passed; tested.

- Kind: improvement

Evidence:
- `packages/core/src/worktree-guard.ts:104` (`theirs(args)` on a list that holds no path once `$f` became nothing)
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: when `cwd` is in a guarded place, a command in `WRITES`, `COPIES`, `dd`, `ln`, `sed -i`/`perl -i`, or a redirect, is refused whatever its operands, naming the folder (`refusal(place, cwd, verb)`). Tests: the loop refused naming the main checkout; `cd <main> && ls` and `cd <main> && git log` passing (already rows 144-148 of the main test).
- `npm test` and `npm run check` pass.

## Scope

In:
- when `cwd` is in a guarded place, a command in `WRITES`, `COPIES`, `dd`, `ln`, `sed -i`/`perl -i`, or a redirect, is refused whatever its operands, naming the folder (`refusal(place, cwd, verb)`). Tests: the loop refused naming the main checkout; `cd <main> && ls` and `cd <main> && git log` passing (already rows 144-148 of the main test).

## Decisions

- 2026-10-23: Source: F8 of AR0320
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
