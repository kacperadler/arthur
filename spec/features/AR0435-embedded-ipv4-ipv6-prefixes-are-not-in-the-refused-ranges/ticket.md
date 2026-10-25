# AR0435 - Embedded-IPv4 IPv6 prefixes are not in the refused ranges

```json
{
  "id": "AR0435",
  "title": "Embedded-IPv4 IPv6 prefixes are not in the refused ranges",
  "date": "2026-10-25"
}
```

## Description

F3 of AR0424 (spec/features/AR0424-a-redirect-s-host-is-resolved-twice-so-dns-rebinding-still-reaches-a-private/findings.md).

- Kind: security
- Found by: 2026-10-25-worker-0eed295e (worker), 2026-10-25
- Where: `packages/uptime/src/site-check.ts:16` (`PRIVATE`)
- What: NAT64 `64:ff9b::/96` (and `64:ff9b:1::/48`) and 6to4 `2002::/16` carry an IPv4 address inside an IPv6 one; `64:ff9b::a9fe:a9fe` is `169.254.169.254` through a NAT64 gateway. `PRIVATE` refuses IPv4-mapped `::ffff:0:0/96` only, so on a host with NAT64 a redirect to such an address passes the check. [INFERENCE] from the ranges: no test, and no NAT64 here.
- Suggestion: add those prefixes to `PRIVATE`, or extract the embedded IPv4 and check it, with a test per prefix as the refused-ranges test does.

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

- 2026-10-25: Source: F3 of AR0424
