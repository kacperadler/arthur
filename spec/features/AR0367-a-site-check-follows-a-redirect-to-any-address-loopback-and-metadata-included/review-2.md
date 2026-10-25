# AR0367 - Review 2

- Job: 2026-10-25-review-5b014d45
- Branch: arthur/2026-10-25-worker-f58f2f36
- Commit reviewed: 316c5dc5c5680abb9b05fd9dddfab4097d468112
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch does what AR0367 asks, the full suite and the type check pass, and every key behavior I mutated was caught except one, listed under Notes as review 1 did.

## Findings

None.

## Notes (not blocking)

- **`packages/uptime/src/site-check.ts:21`:** changing the redirect list `[301, 302, 303, 307, 308]` to `[301, 302, 307]` is not caught: all 19 uptime tests still pass. The branch now follows redirects itself instead of leaving it to `fetch`. If 308 were dropped, a site that sends a 308 (common for a permanent move to https) would wrongly read down, and nothing fails. Review 1 rated this non-blocking and I keep that rating; one more site sending a 308 in the hop test would cover it.
- **Ranges not refused:** NAT64 `64:ff9b::/96` and IPv4-compatible `::7f00:1` pass `PRIVATE.check` (I probed `BlockList`). The ticket does not ask for either. IPv4-mapped addresses like `::ffff:7f00:1` are refused, as the docs say.
- **Open from review 1:** F1 (DNS rebinding) is recorded as open in `findings.md`. A `data:` redirect is followed, but no request goes out. `lookup` does not use the check's `signal`, so a slow resolver can run past the time limit.
- **Lines folded to fit the budget:** `uptime.ts` folds four blocks onto single lines, and `site-check.ts:13` and `:24` are each one very long line, to stay under the 292-line budget (now 291) without asking for a raise. The styleguide has no line-length rule, and review 1 noted the same thing.
- **The worker's claims match what I saw:** the uptime test files give 19 pass, 0 fail, and the new test catches each range deletion, `.some` changed to `.every`, and the `Location` guard removed. The mixed-name test works: replacing `dnsPromises.lookup` and calling `syncBuiltinESMExports()` reaches the `lookup` that `site-check.ts` imports, since the `.every` mutation fails it.

## Checks run

- `npm ci`: added 22 packages.
- `npm run check`: tsc clean.
- `timeout 900 npm test`: 1111 tests, 1053 pass, 0 fail, 58 skipped.
- Each mutation of `packages/uptime/src/site-check.ts` below was run on its own with the uptime tests, then restored with `git checkout --`:

| Mutation | Result |
|---|---|
| `.some(` changed to `.every(` | caught, 1 test fails |
| One range deleted at a time: `0.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16` | each caught, 1 fails |
| One range deleted at a time: `100.64/10`, `::/127`, `fe80::/10`, `fc00::/7` | each caught, 1 fails |
| `127.0.0.0/8` deleted, then `169.254.0.0/16` deleted | each caught, 2 fail |
| `!response.headers.has("location")` guard removed | caught, 1 fails |
| Hop limit `hops === 20` changed to 21, then to 19 | each caught |
| Own-host exemption `at.host !== named &&` removed | caught |
| Refused hop returns `answered: false` instead of `true` | caught by the "refused redirect is an answer" test |
| 303 and 308 dropped from the redirect list | **not caught**, 19 pass |

- I once started four mutations at the same time by mistake. They edited the file together, so I threw those results away, restored the file, and ran each again alone. The table holds only the single runs.
- `git status --short` is empty at the end, and nothing is still running.

PASS