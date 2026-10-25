# AR0424 - A redirect's host is resolved twice, so DNS rebinding still reaches a private address

```json
{
  "id": "AR0424",
  "title": "A redirect's host is resolved twice, so DNS rebinding still reaches a private address",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0367 (spec/features/AR0367-a-site-check-follows-a-redirect-to-any-address-loopback-and-metadata-included/findings.md).

- Kind: security
- Found by: 2026-10-25-worker-f58f2f36 (worker), 2026-10-25
- Where: `packages/uptime/src/site-check.ts:24` (`lookup` of the Location's host), `:20` (the next `fetch` resolves it again)
- What: the check asks `dns.lookup` for a redirect's host, then hands the URL to `fetch`, which resolves the name itself. A host whose DNS answers a public address with a TTL of 0 at the first lookup and `127.0.0.1` or `169.254.169.254` at the second passes the check and is reached. [INFERENCE] from the code: no test exercises it, as it needs a DNS server that answers twice differently.
- Suggestion: connect to the address that was checked: send each hop past the config's own host with `node:http`/`node:https` and a `lookup` option that refuses a private address (one resolution, the one the socket uses), or pin the checked address in the URL with a `host` header and TLS `servername`. Out: the config URL's own host, which the config chose.

## Goal

A site check's redirect reaches only the address it checked, so a host that answers differently on a second lookup never reaches loopback, link-local or private space; tested.

- Kind: security

## Done means

- Each hop to a host other than the config URL's goes through `node:http`/`node:https` with a `lookup` option that refuses a private address (one resolution, the one the socket uses), as the Description suggests; the time limit, the 20-hop cap and the reasons stay as they are.
- Test in `packages/uptime/test/uptime.test.ts`: a `lookup` that answers a public address the first time and `127.0.0.1` the second (replaced as AR0367's mixed-name test does) never reaches the loopback server, and the site is down with the private-address reason; it fails on main.
- The uptime line budget holds, or the worker ends `Blocked: user` asking for a raise.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/uptime/src/site-check.ts`, `packages/uptime/test/uptime.test.ts`, `packages/uptime/docs/uptime.md`.

Out:
- The config URL's own host, which the config chose; the lookup time limit and 303/308 tests (AR0425).

## Decisions

- 2026-10-25: Source: F1 of AR0367
- 2026-10-25: AR0424 approved as written; the owner: "AR0421 to AR0426 - all" (AR-D25)
- 2026-10-25: Raise uptime's line budget 292 to 296 for AR0424; from now on the coordinator raises a package's budget itself when a fix needs it; the owner: "Rise the limit for AR-D29 and in the future if this is necessary or you think we should do that than do it by yourself" (AR-D29)
