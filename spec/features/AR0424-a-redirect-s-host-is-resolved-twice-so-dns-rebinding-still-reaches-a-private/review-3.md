# AR0424 - Review 3

- Job: 2026-10-25-review-d1076f4c
- Branch: arthur/2026-10-25-worker-0eed295e
- Commit reviewed: 25e1968b465425af9f38e00ef7d1fae497a69d6d
- Verdict: PASS

## Final message

No findings. The fix and its tests are complete. Both findings from review 2 are now covered by tests, and every mutation I tried fails at least one test.

**Notes (do not block the merge)**
- **Uptime budget:** `test/structure.test.ts` sets it to 298, and `wc -l packages/uptime/src/*.ts` gives 298 lines. The ticket's own decision AR-D29 only records the raise to 296. The two extra lines are for the bad-port refusal (F1). Review 2 accepted them under AR-D29, which lets the coordinator raise a budget itself, and the comment in the structure test says why.
- **`findings.md`:** F3 is still `open`. It covers the NAT64 prefixes (`64:ff9b::/96` and `64:ff9b:1::/48`) and 6to4 (`2002::/16`), which carry an IPv4 address inside an IPv6 one. It gets settled at the merge.
- **Merge commit:** the only conflict was the `BUDGETS` line. It resolves to main's values plus uptime 298, with delivery at 1321 as on main.
- **Untested path:** no automated test sends a redirect hop over `https`. This is unchanged since review 2.

**Checks run (all in this checkout)**

| Command | Result |
|---|---|
| `npm ci` | added 22 packages |
| `npm run check` | `tsc`, no errors |
| `npm test` | tests 1123, pass 1065, fail 0, skipped 58 |
| `node --test test/structure.test.ts` | pass 16, fail 0 |
| `uptime.test.ts`, no changes | pass 17, fail 0 |
| Both rebind tests (all addresses, one address) with main's (`6da5807e`) `site-check.ts` swapped in | pass 0, fail 2: the "fails on main" requirement holds for both |

**Mutations in `packages/uptime/src/site-check.ts`**, applied one at a time and undone with `git checkout --` after each. `git status` was clean at the end.

| Mutation | `uptime.test.ts` result |
|---|---|
| `typeof address === "string" ? [{ address, family }] : address` → `? [] : address` | fail 1 (the one-address rebind test) |
| `[204, 205, 304]` → `[204, 304]` | fail 1 (the hop test) |
| `lookup: guarded` removed from `get` | fail 3 |
| the check of the `Location`'s host replaced by `if (false)` | fail 5 |
| the `BLOCKED_PORTS` refusal replaced by `if (false)` | fail 1 |

What the worker claimed matches what I saw: the two tests added in round 3, the `/205` hop, the extra wait in the hop test, the merged budget line, and the two mutations being caught.

PASS