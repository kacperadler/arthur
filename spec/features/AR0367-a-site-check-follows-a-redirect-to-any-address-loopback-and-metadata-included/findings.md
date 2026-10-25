# AR0367 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A redirect's host is resolved twice, so DNS rebinding still reaches a private address

- Kind: security
- Found by: 2026-10-25-worker-f58f2f36 (worker), 2026-10-25
- Where: `packages/uptime/src/site-check.ts:24` (`lookup` of the Location's host), `:20` (the next `fetch` resolves it again)
- What: the check asks `dns.lookup` for a redirect's host, then hands the URL to `fetch`, which resolves the name itself. A host whose DNS answers a public address with a TTL of 0 at the first lookup and `127.0.0.1` or `169.254.169.254` at the second passes the check and is reached. [INFERENCE] from the code: no test exercises it, as it needs a DNS server that answers twice differently.
- Suggestion: connect to the address that was checked: send each hop past the config's own host with `node:http`/`node:https` and a `lookup` option that refuses a private address (one resolution, the one the socket uses), or pin the checked address in the URL with a `host` header and TLS `servername`. Out: the config URL's own host, which the config chose.
- Status: ticket AR0424

## F2. A redirect's lookup ignores the check's time limit

- Kind: fix
- Found by: 2026-10-25-review-126f54b1 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/uptime/src/site-check.ts:24`
- What: `lookup` does not use the check's `signal`; a slow resolver runs past `limitSeconds`.
- Status: ticket AR0425

## F3. Redirect statuses 303 and 308 have no test

- Kind: test
- Found by: 2026-10-25-review-126f54b1, 2026-10-25-review-5b014d45 (reviewer, non-blocking notes), 2026-10-25
- Where: `packages/uptime/src/site-check.ts:21`
- What: dropping 303 or 308 fails no test; a 308 to https would read down.
- Status: ticket AR0425

## F4. NAT64 and IPv4-compatible addresses are not refused

- Kind: security
- Found by: 2026-10-25-review-5b014d45 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/uptime/src/site-check.ts:14`
- What: `64:ff9b::/96` and `::7f00:1` pass `PRIVATE.check`.
- Status: dropped (the ticket did not ask; reaching loopback through them needs a NAT64 gateway on this machine's network, which Arthur's VPS has none of)

## F5. A `data:` redirect is followed

- Kind: fix
- Found by: 2026-10-25-review-126f54b1 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/uptime/src/site-check.ts`
- What: its host is empty, so `lookup("")` gives `[]`; no request goes out.
- Status: dropped (nothing is reached)

## F6. Lines folded to fit the budget

- Kind: refactor
- Found by: 2026-10-25-review-126f54b1, 2026-10-25-review-5b014d45 (reviewer, non-blocking notes), 2026-10-25
- Where: `packages/uptime/src/uptime.ts`, `site-check.ts:13`, `:24`
- What: long lines to stay under 292.
- Status: dropped (style only)
