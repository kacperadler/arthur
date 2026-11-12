# AR0696 - Review 1

- Job: 2026-11-12-review-a3449f67
- Branch: arthur/2026-11-12-worker-b445b00d
- Commit reviewed: f4d40d9efc7e3bc4eb48cb1de0385098a1d8e088
- Verdict: PASS

## Final message

I found nothing that blocks the merge. Every Done-means point is met at f4d40d9e, both of my hand mutations of the gate limit were caught, and mutate had no survivors.

- **The gate (`packages/delivery/src/review-command.ts:135`).** `untested` now refuses a run below `Math.min(100, run + unrun)`, and the refusal says `min(100, all)`.
- **The tests (`packages/delivery/test/hand-back.test.ts:298-307`).** 99 of 150 and 25 of 100 are refused; 100 of 150, 40 of 40 and 101 of 175 pass. I changed the limit to 99 and then to 101: each made hand-back.test.ts fail 1 of 10. I restored the file with `git checkout`, and `git status` was clean afterwards.
- **The roles.** Neither role nor any doc said `--max 25`. `packages/core/roles/worker.md:19`, `packages/delivery/roles/reviewer.md:19`, `checks-extension.ts:59`, `review-setup.ts:140` and `hand-back.ts:82` all tell workers to run a bare `npm run mutate`. So the worker raising the default in `test/mutate.ts:48` from 25 to 100 is the change that makes those lines meet the new gate. It is outside the ticket's Scope, but the final message gives that reason, and it does not touch the time limit or resume, which the Scope rules out.
- **Stale text.** I searched for every leftover 25-mutant wording outside `spec/features` and `spec/retro`. Only historical text is left: the AR0689 title in `CHANGELOG.md:25` and `spec/build.json`, `spec/quality/2026-11-06.md` and `decisions.jsonl`. The `--max 25` in `checks.test.ts:248` is just a sample command in a timeout test.
- **Findings file.** The branch has no `findings.md` for this ticket.

## Notes
- (minor) README.md:92: "at most 100, the review gate's minimum" leaves out that the gate's minimum is min(100, all); a branch with fewer mutants needs only all of them.
- (risk) test/mutate.ts:48: here a bare run of only 40 mutants took 1345 s, close to the 1500 s deadline. So reaching 100 will often take several resumed `npm run mutate` calls; the ticket's Goal expects this, and verify.md item 3 says to rerun.

## Checks (on f4d40d9e)
- `npm run mutate`: 40 mutants, 40 caught, 0 survived. Nothing was cut by time; wall time 1345 s.
- `npm run check`: tsc clean.
- `npm test`: one failure, `packages/session/test/session.test.ts:230` (`1 !== 2`). That file is outside the diff. Run alone it passes 14 of 14, so it does not count against the branch. I didn't keep the full suite's totals, so I can't confirm the worker's 1761/1697/0/64.
- `node --import @arthur/core/testing --test packages/delivery/test/hand-back.test.ts packages/delivery/test/checks.test.ts test/mutate.test.ts`: tests 38, pass 38, fail 0.

PASS