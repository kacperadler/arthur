# AR0444 - Review 1

- Job: 2026-10-26-review-a12d4016
- Branch: arthur/2026-10-26-worker-9b8cb81a
- Commit reviewed: a1155b025bf48692ce086f506e62195ed4642480
- Verdict: PASS

## Final message

No findings. The branch fixes the cause of the CI failure, which turned out not to be the one the ticket guessed. The change is one line plus a one-line comment in `packages/uptime/test/uptime.test.ts:194-195`. The test now asks its site at `site.url("/")` (`http://127.0.0.1:<port>/`) instead of `http://localhost:<port>/`. `site-check.ts` is unchanged, as the ticket's scope requires. The AR0424 check is not weakened: the test still asserts the refusal reason and `inside.seen("/") === 0`.

I confirmed the worker's diagnosis. When `localhost` resolves to `::1` first, the "asked for one address" variant (`setDefaultAutoSelectFamily(false)`) only tries `::1`. The test server listens on 127.0.0.1 only, so the very first request is refused, before any redirect. The fake public address 203.0.113.9 plays no part.

Notes (none block the merge):
- One "Done means" point can only be checked after the merge: "CI on main ends `success`". It runs on GitHub's runner once the branch is pushed. The worker says so, and the reproduction below covers the cause.
- The other tests still use `localhost` (lines 137, 160, 176, 220). They run with Node's default of trying every address, so `::1` first does not break them. The ticket keeps them out of scope.
- One focused commit, `test(AR0444): …`, in the expected format. The worker's claims (17/17, `tsc` clean, the mutation fails both variants) match what I saw.

Checks I ran:
- `npm ci` and `npm run check`: `tsc` passed with no errors.
- `node --import @arthur/core/testing --test packages/uptime/test/uptime.test.ts`: 17 tests, 17 passed, 0 failed.
- **Mutation**: I removed `lookup: guarded,` from `get` in `packages/uptime/src/site-check.ts:19` and ran the tests named "never reaches it". Both variants failed (0 passed, 2 failed, each timing out after about 20 s). The tests catch the missing check, as the ticket's "Done means" asks. Restored with `git checkout --`.
- **Runner reproduction**: I added a temporary `resolving(t, "localhost", () => [::1, 127.0.0.1])` to the test, once on the base and once on HEAD.
  - Base: "asked for one address" failed with `reason: 'connection refused'` against the expected `redirected to rebind.example:…, a private address the config does not name`. This is the same failure as CI run 40250431473. "asked for all addresses" passed.
  - HEAD: both variants passed (2/2).
  - I restored the file, and `git status --short` showed the tree clean.
- I did not run the full `npm test`, as you asked.

PASS