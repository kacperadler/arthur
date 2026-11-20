# AR0729 - Mutate tries the newest commit's lines first, so a fix round's new conditions run before the 100-mutant cap

```json
{
  "id": "AR0729",
  "title": "Mutate tries the newest commit's lines first, so a fix round's new conditions run before the 100-mutant cap",
  "date": "2026-11-20"
}
```

## Description

Mutate runs the mutants of the newest commits first, so in a fix round the conditions the fix just added are tried before the run hits its 100-mutant cap. Workers and reviewers see a missing test in the fix itself instead of finding it a round later.

## Goal

each fix round brings new conditions, but mutate's sample spreads over the whole branch, so the newest lines are rarely in it. AR0706 needed 4 rounds and cost $50.33.

Evidence:
- AR0706 review-3.md, finding 1: dropping `"outbox/held"` from the list at `inbox.ts:101`, a line added in the fix commit `46194dc2`, survived. Mutate makes exactly this mutant (an array element dropped), but its run left 361 mutants "not run (--max 100)", so the worker never saw it.
- AR0706 review-2.md, finding 1: the outbox `.json` filter added in fix commit `affd1d77` was not caught by any test. The worker's mutate run left 351 mutants unrun; the reviewer found it by hand. [INFERENCE] I did not confirm that one of mutate's own changes to that line survives.
- AR0706 review-1.md: 335 mutants were not run; the reviewer found the channels swap at `inbox.ts:171` by hand.

- Kind: test

## Done means

- `test/mutate.ts` orders the mutants by the newest commit among each hunk's lines, newest first, round-robin within each group as before.
- A test in `test/mutate.test.ts` builds a branch with two commits, runs the ordering with a cap smaller than the mutants, and asserts that the second commit's mutants come first; it fails with the old ordering.
- `npm run check && npm test` pass.

## Scope

In:
- `test/mutate.ts`, the paragraph that builds `mutants` (lines 56–70)

Before:
> // Round-robin, so a capped run reaches every changed file and as many of its hunks as it can: each file's first mutant, then
> // each one's second; a file's own taken the same way from its hunks, each hunk's revert to the base first, then its lines' in
> // an order their text fixes, not top to bottom, so a capped run's share of a new file (one hunk) spreads over all its lines.
> const spread = (mutant: Mutant) => createHash("sha1").update(`${mutant.line}\0${mutant.what}`).digest("hex");
> const mutants = interleave(
> 	changes.map(({ file, lines, hunks }) =>
> 		interleave(
> 			hunks.map(({ at, size, old }) => [ …the hunk's revert, then its lines' mutants sorted by `spread`… ]),
> 		),
> 	),
> );

After:
> // The newest work first: hunks grouped by the newest commit among their lines (`git blame base..HEAD`; a hunk that only
> // deletes counts as oldest), newest group first, so a fix round's new conditions run before the cap (AR0706 reviews 2 and 3).
> // Within a group, round-robin as before: each file's first mutant, then each one's second; a file's own taken the same way
> // from its hunks, each hunk's revert to the base first, then its lines' in an order their text fixes, not top to bottom.
> const spread = (mutant: Mutant) => createHash("sha1").update(`${mutant.line}\0${mutant.what}`).digest("hex");
> const newest = (file: string, at: number, size: number) => (size === 0 ? 0 : Math.max(0, ...git(root, "blame", "--porcelain", "-L", `${at + 1},+${size}`, `${base}..HEAD`, "--", file).matchAll(/^committer-time (\d+)$/gm).map((m) => Number(m[1]))));
> const all = changes.flatMap(({ file, lines, hunks }) => hunks.map(({ at, size, old }) => ({ file, time: newest(file, at, size), mutants: [ …the hunk's revert, then its lines' mutants sorted by `spread`, unchanged… ] })));
> const groups = Map.groupBy(all, (hunk) => hunk.time);
> const mutants = [...groups.keys()].toSorted((a, b) => b - a).flatMap((time) => interleave([...Map.groupBy(groups.get(time) ?? [], (hunk) => hunk.file).values()].map((file) => interleave(file.map((hunk) => hunk.mutants)))));

Out:
- Any other role, criteria or script change of the retro: its own ticket.

## Decisions

- 2026-11-20: Source: retro spec/retro/2026-11-20.md
