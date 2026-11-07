# AR0658 - `npm run mutate` ends by itself before the call's 1800 s, with its summary

```json
{
  "id": "AR0658",
  "title": "`npm run mutate` ends by itself before the call's 1800 s, with its summary",
  "date": "2026-11-06"
}
```

## Description

`npm run mutate` starts no mutant after 1500 s and counts the ones it could not run, so it always prints its summary before the checks extension's 1800 s limit kills it.

## Goal

a killed run leaves no summary. The worker or reviewer either loses the job's time or skips mutate and mutates by hand: AR0369, AR0584, AR0606, AR0622 and AR0649 skipped it, and their hand mutations then found survivors anyway. AR0637 puts speed out of its scope; a deadline is not speed: it guarantees a result.

Evidence:
- AR0599 F1: inside a job, mutate "printed four `survived:` lines and then `mutate exit=143` after 1895 s".
- AR0602 review-1.md Checks: "the 1800 s timeout cut the run off before it finished, so it gave no complete result".
- AR0629 review-1.md Checks: "`npm run mutate`: no result. The 1800 s bash timeout killed it".
- AR0629 review-2.md Checks: the same again.
- Correction: "You ran past the 120-minute limit while mutate ran; your two commits (df5e860f, 8479abd7) are kept".
- Correction: "You ran past the 120-minute limit; your commits ff6983fb and 36a4dce9 are kept" (AR0599).
- Correction: "its run then hit the time limit while running npm run mutate" (AR0649, 5c12398a).

- Kind: chore

## Done means

- With a deadline that has passed, mutate starts no mutant and prints its summary with the mutants left counted as `not run (time)`; a test shows it and fails when the deadline is removed.
- A mutant whose tests the deadline cuts is counted as not run, never as caught; a test shows it.
- `npm run check` and `npm test` pass.

## Scope

In:
`test/mutate.ts`, the main loop (lines 58–66) and `killed`'s signature. After AR0637, which rewrites the same lines.

Before:
> ```ts
> const run = mutants.slice(0, max);
> let survived = 0;
> for (const mutant of run) {
> 	if (await killed(mutant)) continue;
> 	survived++;
> 	console.log(`survived: ${mutant.file}:${mutant.line}: ${mutant.what}`);
> }
> console.log(`mutate: ${run.length} mutants, ${run.length - survived} caught, ${survived} survived${mutants.length > max ? `; ${mutants.length - max} not run (--max ${max})` : ""}`);
> process.exitCode = survived > 0 ? 1 : 0;
> ```

After:
> ```ts
> const run = mutants.slice(0, max);
> // The checks extension gives the call 1800 s (AR0569) and omp kills it there, summary and all (AR0599 F1): no mutant starts
> // past 1500 s, and one whose tests the deadline cuts (killed answers undefined) is not run, not caught.
> const deadline = Date.now() + 1_500_000;
> let [survived, tried] = [0, 0];
> for (const mutant of run) {
> 	const caught = Date.now() < deadline ? await killed(mutant, deadline) : undefined;
> 	if (caught === undefined) break;
> 	tried++;
> 	if (caught) continue;
> 	survived++;
> 	console.log(`survived: ${mutant.file}:${mutant.line}: ${mutant.what}`);
> }
> const late = run.length - tried;
> console.log(`mutate: ${tried} mutants, ${tried - survived} caught, ${survived} survived${late > 0 ? `; ${late} not run (time)` : ""}${mutants.length > max ? `; ${mutants.length - max} not run (--max ${max})` : ""}`);
> process.exitCode = survived > 0 ? 1 : 0;
> ```

Out:
- Anything past the file this proposal names; a larger change is a new ticket.

## Decisions

- 2026-11-06: Source: retro spec/retro/2026-11-06.md
