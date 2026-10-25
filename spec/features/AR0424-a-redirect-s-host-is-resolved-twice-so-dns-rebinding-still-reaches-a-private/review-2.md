# AR0424 - Review 2

- Job: 2026-10-25-review-e0a6b7d5
- Branch: arthur/2026-10-25-worker-0eed295e
- Commit reviewed: adeec0264b671910e2eca052e823f12a9f3df5bf
- Verdict: FAIL

## Final message

## Review of AR0424 at adeec026

The fix itself holds. Each redirect to a host other than the config URL's now goes through `node:http`/`node:https`, and the socket's own lookup refuses a private address. Both new tests fail on main and pass here, and every check passes. The branch fails only because two mutations of what it changed are not caught by any test. One of them turns off the private-address refusal on the socket.

## Findings

1. **`packages/uptime/src/site-check.ts:18`: the socket's refusal is untested when Node resolves a single address.** `guarded` has two branches: one for a lookup that returns a single address string, one for a list.
   - **Mutation:** `typeof address === "string" ? [{ address, family }] : address` → `typeof address === "string" ? [] : address`. This turns off the refusal for the single-address case. The uptime tests still pass (pass 21, fail 0).
   - **Why it is missed:** with Node 24's defaults the socket always asks for all addresses, so `npm test` only ever runs the list branch.
   - **The branch is reachable:** I ran the rebind test (`uptime.test.ts:183`) under `node --no-network-family-autoselection`. With the mutation, the test fails: the loopback server is reached (pass 0, fail 1). Without it, the test passes (pass 1, fail 0).
   - **Why it matters:** a deployment that turns family autoselection off (a `NODE_OPTIONS` flag, or `net.setDefaultAutoSelectFamily(false)`) could lose the ticket's protection against DNS rebinding, and no test would notice.
   - **Fix:** run the rebind case a second time with `net.setDefaultAutoSelectFamily(false)` (restored in `t.after`).

2. **`packages/uptime/src/site-check.ts:19` and `packages/uptime/test/uptime.test.ts:212`: status 205 on a redirect hop is untested.**
   - **Mutation:** `[204, 205, 304]` → `[204, 304]`. The uptime tests still pass (pass 21, fail 0).
   - **Effect:** I ran `new Response(<async iterable>, { status: 205 })` in Node 24 and it throws `TypeError: Response constructor: Invalid response status code 205`. So with that mutation, a hop answering 205 marks the site down with that text as the reason. On main, `fetch` handled 205 correctly.
   - **Fix:** add a `/205` hop next to `/204` and `/304` in the test at line 197.
   - The worker's mutation "the 204/205/304 check → `false`" is caught, but it does not cover 205 on its own.

## Notes

- The other mutations I ran are all caught:

  | Mutation | Tests that fail |
  |---|---|
  | `lookup: guarded` removed from `get` | both new tests |
  | the pre-check on the `Location` replaced by `if (false)` | 4 tests: the rebind test and the three earlier redirect tests |
  | `error === REFUSED ?` → `false ?` | 4 tests |
  | `if (late)` → `if (false)` | 4 tests, the new hop test among them |
  | the bad-port refusal replaced by `if (false)` | the new hop test |
  | `agent: false` removed | the new hop test |

- The uptime budget of 298 matches `wc -l packages/uptime/src/*.ts` (298 in total). The raise is allowed by AR-D29, and the comment in `test/structure.test.ts` gives its reasons.
- A bad-port hop gives the reason `bad port` with `answered: false`, the same as `fetch` gave on main.
- An IP-literal `Location` skips the socket's lookup, but the pre-check still refuses it, and the existing refused-ranges test covers that.
- F3 in `findings.md` (the NAT64 and 6to4 IPv6 prefixes) is still `open`, so it is settled at the merge.
- The redirect hop over `https` has no automated test; the worker's message says so itself.

## Checks run

| Command | Result |
|---|---|
| `npm ci` | added 22 packages |
| `npm run check` | `tsc`, no errors |
| `timeout 900 npm test` | tests 1117, pass 1059, fail 0, skipped 58 |
| `node --test test/structure.test.ts` | pass 16, fail 0 |
| uptime tests, clean, twice | pass 21, fail 0 both times |
| Both new tests against main's `site-check.ts` | both fail (time out after 20 s): the "fails on main" requirement is met |
| The mutations above, one at a time, `git checkout --` after each | as listed; the tree is clean at the end |

My first attempt at the `late`, bad-port and `agent: false` mutations ran three at once on the same file, so two mutations were applied together. I threw those results away and reran each one alone; the results above are from the reruns.

FAIL