# AR0367 - A site check follows a redirect to any address, loopback and metadata included

```json
{
  "id": "AR0367",
  "title": "A site check follows a redirect to any address, loopback and metadata included",
  "date": "2026-10-23"
}
```

## Description

a GET from Arthur's host, with `user-agent: arthur-uptime` and no credential, to an address the config never named, once per `everySeconds`; and one bit of its answer (the status, or whether the page holds `expect`) in the down and up notices to the owner. The site's operator sees none of the notices, which keeps the severity low.

## Goal

A site check follows a redirect only to an address the config allows, never loopback, link-local or metadata; tested.

- Kind: security

Evidence:
- `packages/uptime/src/site-check.ts:12` (`fetch` with its default `redirect: "follow"`), `:16-26` (the landing page judged); `packages/uptime/docs/uptime.md:24`; `packages/uptime/src/uptime-options.ts:25`
- Found by: 2026-10-23-ar0326-security-check-b12a34be (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: in `site-check.ts`, `redirect: "manual"` and a loop of at most 20 hops that follows a `Location` only when its host is the config URL's host, or resolves (`dns.lookup`, all addresses) to nothing that is loopback, link-local (`169.254.0.0/16`, `fe80::/10`) or private (the ranges of `model-options.ts:27-30`); a refused hop is `redirected to <host>, a private address the config does not name` with `answered: true`, so the site counts as down with that reason. Say it in `docs/uptime.md:24` and `uptime-options.ts:25`. Test in `packages/uptime/test/uptime.test.ts:108`: a site at `http://localhost:<a>/` redirected to `http://127.0.0.1:<b>/` is down with that reason and `<b>` sees no request; one redirected to another path of its own host is followed as now. Out: a check of the first URL (the config's own choice).
- `npm test` and `npm run check` pass.

## Scope

In:
- in `site-check.ts`, `redirect: "manual"` and a loop of at most 20 hops that follows a `Location` only when its host is the config URL's host, or resolves (`dns.lookup`, all addresses) to nothing that is loopback, link-local (`169.254.0.0/16`, `fe80::/10`) or private (the ranges of `model-options.ts:27-30`); a refused hop is `redirected to <host>, a private address the config does not name` with `answered: true`, so the site counts as down with that reason. Say it in `docs/uptime.md:24` and `uptime-options.ts:25`. Test in `packages/uptime/test/uptime.test.ts:108`: a site at `http://localhost:<a>/` redirected to `http://127.0.0.1:<b>/` is down with that reason and `<b>` sees no request; one redirected to another path of its own host is followed as now. Out: a check of the first URL (the config's own choice).

## Decisions

- 2026-10-23: Source: F2 of AR0326
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
