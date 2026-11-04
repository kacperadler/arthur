# AR0620 - Review 2

- Job: 2026-11-04-review-9a1270fd
- Branch: arthur/2026-11-04-worker-bc992ba7
- Commit reviewed: c3f995766da2ec7c5be5794394023f8da77f897d
- Verdict: PASS

## Final message

Both findings from review 1 are fixed, and nothing in the range blocks the merge.

## Findings

Review 1's two findings are fixed:
- **Range ends** (`packages/uptime/src/uptime-options.ts:26`): `packages/uptime/test/uptime-options.test.ts` now tries every refused range at its first and last address, plus the address just outside each end. The IPv6 ranges get the same, and `[::ffff:127.0.0.1]` is refused too. If `["127.0.0.0", 8]` moves by one, `127.255.255.254` or `126.255.255.255` lands on the wrong side and the test fails. Mutate caught every mutant it made in this file.
- **`localhost.`** (`packages/uptime/src/uptime-options.ts:30`): trailing dots are stripped before the check. `localhost.`, `localhost..`, `api.localhost.`, `127.0.0.1.` and `LOCALHOST` are refused; `dns.google./` is accepted.

The ticket's Done means are all met:
- The `probes` option has the defaults from decision AR-D493. `[]` turns the probes off.
- Before a site goes down for want of an answer, the other sites and the probes are asked at once.
- When none of them answers, the offline notice names the probes. It is followed by a "site answers again" or "probe answers again" notice.
- One site with a probe answering is down after its 2 failed checks.
- Tests cover each of these cases, and `probes: []` with the old behaviour.
- `docs/uptime.md` ("Options", "This machine offline"), `arthur.config.example.ts` and roadmap entry 98 are updated.

The uptime line budget going from 312 to 344 is the worker's raise, stated in the final message.

## Notes
- (security) `packages/uptime/src/uptime-options.ts:28`: a probe given as a host name is not resolved at load, and `probe` uses plain `fetch` without `site-check`'s guarded lookup. A public-looking name that resolves to loopback, or `[64:ff9b::7f00:1]` (NAT64), passes the check and always answers, so the machine is never taken as offline. The worker filed this as F1 in the ticket's `findings.md`.
- (minor) `packages/uptime/src/site-check.ts:49`: the mutant `limitSeconds * 1001` survived. That moves the 10 s cut by 10 ms, which is inside normal timer delay. The test's 9,995–10,499 ms window catches `* 999`, which the worker reports trying by hand.
- (minor) `arthur.config.example.ts:275,278`: two mutants survived here, one reverting the comment and one deleting the example's `uptime({ probes: [...] })` line. Both are example text, not behaviour.

## Checks (on c3f99576)
- `npm run check && npm test` (timeout 1800): tsc clean. I filtered the output too narrowly the first time, so I ran `npm test` again for the counts: 1531 tests, 1467 pass, 0 fail, 64 skipped, exit 0. No timing test failed, so I did not run `limits.test.ts` alone.
- `npm run mutate`: it stopped at its default `--max 25` with 136 not run. Of the 25 mutants, 22 were caught and 3 survived, all listed in the notes above.

PASS