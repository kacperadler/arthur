# AR0608 - Review 2

- Job: 2026-11-04-review-f42a6f5a
- Branch: arthur/2026-11-04-worker-3c83b683
- Commit reviewed: 11617cbe367dab9fabffefe1c79fee2b7a22b702
- Verdict: PASS

## Final message

**Review of AR0608 at `11617cbe`: PASS, no blocking findings**

The previous finding is fixed: `+ Plan: yes` now has its own refused row (`packages/orchestration/test/plans.test.ts:196`). The broader `MARK` pattern (`packages/orchestration/src/plans.ts:17`) has a refused row for each form it reads: `-`, `*`, `+` and `–` bullets, `1.` and `2)`, bold, any case, extra spacing, indentation, `tak`, `Yes`, `no` and an empty value. The refusal names the ticket, the line and the one accepted form, as the Done means asks. A ticket with no Plan line still starts a worker, and so does a Plan line outside the Goal (existing test at `plans.test.ts:185`). The doc page `packages/orchestration/docs/commands/plan.md:32-33` lists the forms the guard reads and the new refusal. The other docs that mention `- Plan: yes` still describe the accepted mark correctly. `plans.ts` is 103 lines, in the green zone.

## Notes
- (risk) `packages/orchestration/src/plans.ts:17`: some Goal lines still get past the guard and read as no plan. A line with no bullet (`Plan: tak`), `- _Plan_: yes`, `` - `Plan`: yes ``, `• Plan: yes`, `> - Plan: tak`, `- Plan - yes` and a full-width colon all count as "no plan line".
- (minor) `packages/orchestration/src/plans.ts:17`: a numbered Goal step that starts with "Plan:" (`1. Plan: migrate the API first`) is now refused as a misspelt Plan line. That is safe, and the message names the line.
- (minor) `packages/orchestration/src/plans.ts:70`: `marks: string[]` could be `readonly string[]`. The worker gives the line budget as the reason.

## Checks (on `11617cbe`)
- `npm run check`: tsc clean.
- `npm test` (exit 0): 1549 tests, 1485 pass, 0 fail, 64 skipped. All 64 skips are for the sandbox (no Unix socket, no systemd user manager). No timing test failed, so `limits.test.ts` alone was not needed.
- `npm run mutate`: 20 mutants, 20 caught, 0 survived.
- I also mutated the guard by hand and ran `node --import @arthur/core/testing --test packages/orchestration/test/plans.test.ts` after each change. All 11 mutations were caught:
  - `+` dropped from the bullet class
  - `–` dropped from the bullet class
  - numbered alternative removed
  - `)` dropped from the number form
  - both bold markers removed
  - trailing bold marker removed
  - space before `:` removed
  - `i` flag removed
  - leading `\s*` removed
  - exact-form comparison replaced by `false`
  - `marks.length > 0` changed to `> 1`
  
  Each change was restored with `git checkout -- packages/orchestration/src/plans.ts`; `git status --short` is empty.

PASS