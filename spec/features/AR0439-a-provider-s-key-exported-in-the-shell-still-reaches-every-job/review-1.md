# AR0439 - Review 1

- Job: 2026-10-26-review-c85ddcda
- Branch: arthur/2026-10-26-worker-c54d4fe8
- Commit reviewed: 1d812b0022b4a0223b417ea6ee96cd3d6c8c4140
- Verdict: FAIL

## Final message

I'm failing this branch on one blocking problem: it raises the core's line budget without a decision recorded in the ticket. The feature itself works and is well tested.

## Findings

1. **`test/structure.test.ts:709-712`: the core's line budget goes from 6228 to 6238 with no decision in the ticket.**
   - The styleguide says the budget number lives only in that test, and that "a raise is a decision recorded in the ticket". Main's AR0439 ticket has only `- 2026-10-25: Source: F2 of AR0338` under Decisions.
   - Earlier raises were approved by the owner before merge: AR0339 has "Raise the core line budget from 6184 to 6197 … (AR-D48)" and AR0373 has "… 6206 to 6228 … (AR-D57)" on main.
   - With the budget the owner last approved, the branch fails the structure test. I set it back to 6228 and got `packages/core: has 6238 source lines, over its line budget of 6228`.
   - The review criteria count "a line budget exceeded" as a FAIL. The worker says so openly in the final message; the change still lacks the owner's decision.
   - To fix it: record the owner's decision to raise the core budget to 6238 in the ticket, or cut `requirements.ts` back by 10 lines. Trimming the extra comment and blank line saves about 3 lines, not 10.

## Notes (not blocking)

- **Code in `requirements.ts` instead of `doctor.ts`:** the plan lists `doctor.ts`, but the final message explains the change. The core's doctor lines are defined in `requirements.ts`, and `doctor.ts` only runs and formats them. Updating `packages/core/docs/commands/doctor.md` is also needed, because the review criteria require a changed command to update its doc page.
- **Fixed list of 19 keys:** a provider key omp reads that is not on the list gets no warning. The worker names this limit, and the doc page lists the keys exactly.
- **Two of the 19 keys are ones the models plugin sets itself:** `OLLAMA_API_KEY` and `LM_STUDIO_API_KEY`, which it puts in a job's environment from `keyEnv`. Doctor only reads Arthur's own `process.env`, and the env file is not loaded into it (`env.ts` resolves values into `host.env`), so these cause no false warning.
- **Developer machines:** with `ANTHROPIC_API_KEY` exported in my shell, `doctor.test.ts` and `setup.test.ts` still pass (26 pass, 0 fail). Their CLI tests run with a minimal environment.
- **`docs/deploy.md`:** the new threat-model bullet says what the ticket asks: the key belongs in omp's own login or comes through the models plugin's `prepare`, and doctor names the variable, never its value.

## Checks run

- `npm ci`: 22 packages added.
- `npm run check` (tsc): no errors.
- `node --import @arthur/core/testing --test packages/core/test/doctor.test.ts test/structure.test.ts`: 30 tests, 30 pass, 0 fail. This matches the worker's claim.
- `ANTHROPIC_API_KEY=sk-dev-shell node --import @arthur/core/testing --test packages/core/test/doctor.test.ts packages/core/test/setup.test.ts`: 26 pass, 0 fail.
- I did not run the full `npm test`, as instructed.
- Mutations, each run against the provider-key test and then restored with `git checkout --` (the working tree is clean):

| Mutation | Result |
|---|---|
| main's `requirements.ts` (the "fails on main" requirement) | fails |
| empty-value guard changed to `env[key] !== undefined` | fails |
| provider line made `critical: true` | fails |
| key value added to the printed line | fails |
| `structure.test.ts` budget set back to 6228 | fails with the line quoted above |

FAIL