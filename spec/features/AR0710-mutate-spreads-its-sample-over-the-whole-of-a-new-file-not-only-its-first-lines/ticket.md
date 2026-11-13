# AR0710 - Mutate spreads its sample over the whole of a new file, not only its first lines

```json
{
  "id": "AR0710",
  "title": "Mutate spreads its sample over the whole of a new file, not only its first lines",
  "date": "2026-11-13"
}
```

## Description

A capped `npm run mutate` today takes a new file's mutants top to bottom, so it never reaches the logic below the first lines of a new file. After this, the mutants of each hunk are taken in an order fixed by their text, so a capped run's share of a new file spreads over all its lines and reviewers stop finding by hand what mutate could have found.

## Goal

A new file's diff is one hunk, and `test/mutate.ts` takes a hunk's mutants top to bottom, so a capped run never reaches the logic below a new file's first lines. verify.md item 3 already tells workers to break by hand what mutate does not reach, and 6 FAILs show that rule broken, so the fix belongs in mutate itself. `[INFERENCE]` from `test/mutate.ts:55-66` and `hunks`, not run. A spread sample makes no line certain to be reached, but it gives the lower lines of a new file a chance, where today they have none.

Evidence:
- AR0647 review-1 F1, F2: the reviewer dropped an `||` operand by hand at `docker-sweep.ts:138` and `:116`, near the end of a new 139-line file, and no test failed. Mutate's 25 mutants over 8 files (about 3 per file, the file's revert first) found only survivors near the top of their files (`docker-options.ts:20`, `:22`) or in a test helper and the example config.
- AR0647 review-2 F1, F3: a line deleted at `docker-look.ts:60` and an array element dropped at `docker-sweep.ts:21` survived. Mutate makes both kinds itself; 611 mutants were not run (--max 25).
- AR0652 review-1 F1, F2: an `&&` operand at `spend.ts:66` and a regex alternative at `spend.ts:18` survived, also kinds mutate makes. Its 100 mutants found 9 survivors, all help text, a default and the `inJob` line.
- AR0553 review-1 F1, F2: an `&&` operand at `voice-reply.ts:24` and a deleted line at `say.ts:37`, both in new files, survived. Mutate's 5 survivors were option and example-config lines.
- AR0642 review-1: every survivor mutate found sits in the first 26 lines of a new file (`machine-update.ts:14,24,26`, `update.ts:13`).

- Kind: chore

## Done means

- A test in `test/mutate.test.ts` (or the file that tests `test/mutate.ts` today) builds a branch that adds one new file of at least 40 lines with mutable lines throughout, runs mutate with a cap smaller than its mutants, and asserts that mutants are taken from both the first and the last third of the file; it fails on main, where every mutant taken is from the top.
- The same order on every run of the same branch (the test runs it twice and compares).
- Each hunk's revert to the base still comes first.
- `npm run check`, `npm test` and `npm run mutate` pass.

## Scope

In:
- `test/mutate.ts`: the `mutants` statement and its comment, plus `import { createHash } from "node:crypto";`.
- The test file that tests `test/mutate.ts`: the test of Done means.

Before:
> ```ts
> // Round-robin, so a capped run reaches every changed file and as many of its hunks as it can: each file's first mutant, then
> // each one's second; a file's own taken the same way from its hunks, each hunk's revert to the base first, then its lines'.
> const mutants = interleave(
> 	changes.map(({ file, lines, hunks }) =>
> 		interleave(
> 			hunks.map(({ at, size, old }) => [
> 				...([...lines.slice(at, at + size), ...old].some((line) => !INERT.test(line.trim())) ? [{ file, line: at + 1, what: "hunk reverted to the base", text: [...lines.slice(0, at), ...old, ...lines.slice(at + size)].join("\n") }] : []),
> 				...lines.slice(at, at + size).flatMap((line, index) => lineMutants(line).map((mutated): Mutant => ({ file, line: at + index + 1, what: `${line.trim()} => ${mutated.trim() || "(deleted)"}`, text: [...lines.slice(0, at + index), mutated, ...lines.slice(at + index + 1)].join("\n") }))),
> 			]),
> 		),
> 	),
> );
> ```

After:
> ```ts
> // Round-robin, so a capped run reaches every changed file and as many of its hunks as it can: each file's first mutant, then
> // each one's second; a file's own taken the same way from its hunks, each hunk's revert to the base first, then its lines' in
> // an order their text fixes, not top to bottom, so a capped run's share of a new file (one hunk) spreads over all its lines.
> const spread = (mutant: Mutant) => createHash("sha1").update(`${mutant.line}\0${mutant.what}`).digest("hex");
> const mutants = interleave(
> 	changes.map(({ file, lines, hunks }) =>
> 		interleave(
> 			hunks.map(({ at, size, old }) => [
> 				...([...lines.slice(at, at + size), ...old].some((line) => !INERT.test(line.trim())) ? [{ file, line: at + 1, what: "hunk reverted to the base", text: [...lines.slice(0, at), ...old, ...lines.slice(at + size)].join("\n") }] : []),
> 				...lines.slice(at, at + size).flatMap((line, index) => lineMutants(line).map((mutated): Mutant => ({ file, line: at + index + 1, what: `${line.trim()} => ${mutated.trim() || "(deleted)"}`, text: [...lines.slice(0, at + index), mutated, ...lines.slice(at + index + 1)].join("\n") }))).toSorted((a, b) => spread(a).localeCompare(spread(b))),
> 			]),
> 		),
> 	),
> );
> ```

Out:
- Any other change to mutate's sampling, its cap or its time limit.

## Decisions

- 2026-11-13: Source: retro spec/retro/2026-11-13.md
- 2026-11-13: AR0710 approved; the owner: "AR-D676 1, AR-D677 1" (AR-D676)
