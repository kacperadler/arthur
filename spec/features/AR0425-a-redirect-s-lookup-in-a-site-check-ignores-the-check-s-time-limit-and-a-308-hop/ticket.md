# AR0425 - A redirect's lookup in a site check ignores the check's time limit, and a 308 hop has no test

```json
{
  "id": "AR0425",
  "title": "A redirect's lookup in a site check ignores the check's time limit, and a 308 hop has no test",
  "date": "2026-10-25"
}
```

## Description

F2 and F3 of AR0367 (spec/features/AR0367-a-site-check-follows-a-redirect-to-any-address-loopback-and-metadata-included/findings.md), from its reviews:

- `packages/uptime/src/site-check.ts:24`: the `lookup` of a redirect's host does not use the check's `signal`, so a slow resolver keeps a check running past `limitSeconds` (review 2026-10-25-review-126f54b1).
- `site-check.ts:21`: the redirect statuses `[301, 302, 303, 307, 308]` have no test beyond 302; dropping 303 and 308 fails nothing. A site that moves to https with a 308 would read down unnoticed (reviews 2026-10-25-review-126f54b1 and 2026-10-25-review-5b014d45).

## Goal

A site check ends within its time limit whatever the resolver does, and every redirect status it follows is tested.

- Kind: fix

## Done means

- The redirect's lookup is bounded by the check's limit (raced against the check's `signal`); a test with a `lookup` that never answers ends at the limit with the time-limit reason.
- The hop test has a site answering 303 and one answering 308 (and 301, 307), each followed; dropping any status from the list fails it.
- `npm test` and `npm run check` pass; the uptime line budget holds.

## Scope

In:
- `packages/uptime/src/site-check.ts`, `packages/uptime/test/uptime.test.ts`.

Out:
- DNS rebinding: AR0424.

## Decisions

- 2026-10-25: Source: F2 of AR0367
