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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-25: Source: F1 of AR0367
