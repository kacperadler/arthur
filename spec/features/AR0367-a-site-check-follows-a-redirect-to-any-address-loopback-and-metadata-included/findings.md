# AR0367 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A redirect's host is resolved twice, so DNS rebinding still reaches a private address

- Kind: security
- Found by: 2026-10-25-worker-f58f2f36 (worker), 2026-10-25
- Where: `packages/uptime/src/site-check.ts:24` (`lookup` of the Location's host), `:20` (the next `fetch` resolves it again)
- What: the check asks `dns.lookup` for a redirect's host, then hands the URL to `fetch`, which resolves the name itself. A host whose DNS answers a public address with a TTL of 0 at the first lookup and `127.0.0.1` or `169.254.169.254` at the second passes the check and is reached. [INFERENCE] from the code: no test exercises it, as it needs a DNS server that answers twice differently.
- Suggestion: connect to the address that was checked: send each hop past the config's own host with `node:http`/`node:https` and a `lookup` option that refuses a private address (one resolution, the one the socket uses), or pin the checked address in the URL with a `host` header and TLS `servername`. Out: the config URL's own host, which the config chose.
- Status: open
