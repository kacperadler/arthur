# AR0424 - Review 4

- Job: 2026-10-25-review-e3ebef68
- Branch: arthur/2026-10-25-worker-0eed295e
- Commit reviewed: bb8fee3222b56b5e2b36903a5f107c442fdab3c5
- Verdict: PASS

## Final message

I found nothing that blocks the merge. A redirect to another host now goes through `node:http`/`node:https` with a guarded `lookup`, so a name that answers a public address first and `127.0.0.1` second never reaches the loopback server. The site is reported down with the private-address reason. Both new rebind tests (all addresses and one address) fail on main and pass here.

## Findings

None. Every mutation I tried breaks at least one test, and every claim in the worker's message matches what I ran.

## Notes (do not block the merge)

- **Budget:** `test/structure.test.ts:655` sets uptime to 298, which matches `wc -l packages/uptime/src/*.ts`. The ticket's AR-D29 only records 292 → 296. The two extra lines refuse the Fetch standard's bad ports (findings F1). They rely on AR-D29's standing rule that budgets may be raised without asking, and reviews 2 and 3 accepted them; the comment says why.
- **Out-of-scope file:** `packages/uptime/src/uptime-options.ts:23` only adds `export` to `BLOCKED_PORTS`. The reason is in findings F1: a hop sent by `node:http(s)` lost fetch's bad-port refusal.
- **Ways around the check:**
  - An IP-literal `Location` skips the socket's lookup, but the earlier `guarded` check refuses it, and a literal can't be re-resolved.
  - Other IPv4 spellings (`2130706433`, `0x7f.1`) are rewritten by `URL` before the check.
  - With `agent: false`, no socket is kept open and reused without its lookup.
  - Family autoselection on and off are both tested.
  - I found no other way around it.
- **Shared error object:** `REFUSED` is one `Error` reused for every refusal. Tests assert its message after several checks, so Node doesn't rewrite it.
- **Still open:** F3 in `findings.md` (the NAT64 and 6to4 prefixes are not refused). It gets settled at the merge.
- **Untested path:** no test sends a redirect hop over `https`. This was already noted in reviews 2 and 3.
- **Unrelated failure:** one test failed in my first full `npm test` run, in `packages/models/test/models.test.ts:170`. The range doesn't touch `packages/models`, and the file passed 3 times in a row on its own (18/18 each), so it looks like a timing flake under load.

## Checks run (in this checkout)

| Check | Result |
|---|---|
| `npm ci` | added 22 packages |
| `npm run check` | `tsc`, no errors |
| `npm test`, first run | the grep for the summary matched nothing (wrong pattern), so no result from this run |
| `npm test`, second run | tests 1124, pass 1065, fail 1 (the models test above), skipped 58 |
| `node --test packages/models/test/models.test.ts`, 3 times | pass 18, fail 0 each time |
| `node --test test/structure.test.ts` | pass 16, fail 0 (matches the worker) |
| `node --test packages/uptime/test/*.test.ts` | tests 22, pass 22 (matches the worker's 22) |
| `uptime.test.ts` alone | pass 17, fail 0 |
| `uptime.test.ts` rebind tests with main's `site-check.ts` swapped in | pass 0, fail 2: the "fails on main" requirement holds |

**Mutations in `packages/uptime/src/site-check.ts`**, applied one at a time and undone with `git checkout --` after each; `git status` was clean at the end.

| Mutation | `uptime.test.ts` result |
|---|---|
| `lookup: guarded` removed from `get` | fail 3 |
| check of the `Location`'s host → `if (false)` | fail 5 |
| `.some(` → `.every(` in `guarded` | fail 1 |
| one-address answer `[{ address, family }]` → `[]` | fail 1 |
| `BLOCKED_PORTS` refusal → `if (false)` | fail 1 |
| `agent: false` removed | fail 1 |
| `if (late)` → the old `DOMException`/`TimeoutError` test | fail 1 |
| `[204, 205, 304]` → `[204, 304]` | fail 1 |
| `error === REFUSED ?` → `false ?` | fail 5 |

PASS