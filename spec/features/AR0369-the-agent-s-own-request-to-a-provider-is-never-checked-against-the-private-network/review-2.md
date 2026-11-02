# AR0369 - Review 2

- Job: 2026-11-02-review-34d9b0aa
- Branch: arthur/2026-11-02-worker-e17d4c76
- Commit reviewed: 9abdebb64da6eeb1dd830f8343d6c2fe3020b191
- Verdict: PASS

## Final message

I found no blocking findings. Review-1's single finding, the untested "any address" case, is fixed. The prepare at `packages/models/src/models.ts:71-72` looks up the provider's host again and refuses the job on any non-private address. The refusal uses the message the ticket specifies, and the tests catch both mutants I tried.

The branch covers every Done means point:
- **Docs:** `docs/models.md:21` now says the prepare looks the name up again at spawn and at `arthur continue`. It also says the agent's own requests resolve the name again, unchecked, so giving a provider by address is the stricter choice.
- **Code:** the prepare refuses the job with `provider <name>: <host> resolves to <address>, not a private address`, after the pick and before the agent starts.
- **Test:** `packages/models/test/models.test.ts:361`, in the shape of the existing test, covers two cases:
  - the name resolves only to a public address (`8.8.8.8`);
  - it resolves to `127.0.0.1` then `8.8.8.8`.

  In both, the spawn is refused with no record, no worktree and no agent start.
- **Roadmap:** entry 82's "Delivers" (`spec/roadmap.md:400`) now lists the lookup in the prepare.
- **Line budget:** the raise from 534 to 537 in `test/structure.test.ts` is the owner's open decision AR-D455, so I did not judge it.

## Notes
- (risk) `packages/models/src/models.ts:71`: a failed lookup in the prepare is untested. A lookup that fails there (for example `ENOTFOUND`) refuses the job with the raw resolver error, not the provider-named message.
- (minor) `packages/models/test/models.test.ts:361`: the `arthur continue` path through the prepare has no test of its own; only spawn is exercised.
- (minor) `packages/models/docs/models.md:21`: "resolved here once more in the job's prepare": "here" is redundant.
- (minor) `packages/models/src/models.ts:66-67`: the comment is two long lines; it could be shorter.

## Checks
- `npm run check && npm test`, in one call with a 1800-second timeout: tsc passed; 1486 tests, 1422 pass, 0 fail, 64 skipped. This matches the worker's numbers.
- Hand mutant `.slice(0, 1).find(` at `models.ts:71` (check only the first address): `node --test --test-name-pattern="after the pick"` gave pass 0, fail 1, `Missing expected rejection: any address, not only the first`. Restored.
- Hand mutant `if (false) throw` (refusal disabled): pass 0, fail 1. Restored; `git status --short` was empty afterwards.
- I did not run `npm run mutate`, to keep within the small budget.

PASS