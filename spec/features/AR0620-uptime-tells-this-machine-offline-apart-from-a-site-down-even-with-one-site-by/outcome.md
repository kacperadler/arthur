# AR0620 - Outcome

- Merged: 2026-11-04, `51c1587d`
- Branch: arthur/2026-11-04-worker-bc992ba7
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $3.97, reviews $0.97; review rounds 2

## What went in

- `packages/uptime/src/uptime.ts`: before a site with no answer goes down, asks the other sites and the probes. Offline only when none of them answers. While offline, asks the probes at each failed check and ends offline when one answers. The offline notice names the probes and says a site or a probe ends it.
- `packages/uptime/src/uptime-options.ts`: the `probes` option (default 1.1.1.1 and dns.google, `[]` for none), in the option table and in `checkOptions`. Refuses non-https URLs, `localhost` names (trailing dots included) and private, loopback or link-local addresses, each by its place. Now holds the shared `PRIVATE` address list.
- `packages/uptime/src/site-check.ts`: takes `PRIVATE` from the options file; adds `probe`, one `fetch` cut after the limit, where any HTTP answer counts.
- `packages/uptime/test/uptime.test.ts`: a fake `fetch` for the probe hosts that can answer, fail or never answer; tests for one site offline or down with probes, `probes: []`, the offline test with and without probes, and the 10 s cut.
- `packages/uptime/test/uptime-options.test.ts`: tests for the `probes` default and accepted values, and every refusal: each range's ends and the addresses just outside them, `localhost` spellings, non-https URLs, a value that is no list, and the place of each refused entry.
- `packages/uptime/docs/uptime.md`: a new "Options" section for `probes`; "This machine offline" rewritten for probes, the 10 s cut and the notice text.
- `arthur.config.example.ts`: the uptime entry shows `probes` and describes it.
- `spec/roadmap.md`: entry 98 says the probes are asked along with the other sites before the machine is taken as offline.
- `spec/features/AR0620-uptime-tells-this-machine-offline-apart-from-a-site-down-even-with-one-site-by/findings.md`: new file, with F1.
- `test/structure.test.ts`: uptime line budget 312 → 344.
- `test/option-tables.test.ts`: uptime is no longer listed among the plugins with an empty option table.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1464/1535 passed.

## Left open

- Deferred (client summary): F1. A probe named by a host name that resolves to loopback or a private address passes the load check and always answers
- Deferred (client summary): F2. a probe given as a host name is not resolved at load, and `probe` uses plain `fetch` without `site-check`'s guarded lookup
