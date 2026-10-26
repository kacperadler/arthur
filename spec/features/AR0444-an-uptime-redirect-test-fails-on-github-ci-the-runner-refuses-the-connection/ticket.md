# AR0444 - An uptime redirect test fails on GitHub CI: the runner refuses the connection before the private-address check

```json
{
  "id": "AR0444",
  "title": "An uptime redirect test fails on GitHub CI: the runner refuses the connection before the private-address check",
  "date": "2026-10-26"
}
```

## Description

CI on main fails since the AR0424 merge: one uptime test passes on the VPS and fails on GitHub's runner. A red main hides every later CI result and makes `--auto` and the plain merge's CI check useless.

## Goal

Evidence: `npx arthur ci main` (2026-10-26): run 40250431473 of ci.yml on a16974e, failure in `npm test`, `packages/uptime/test/uptime.test.ts:184` "a redirect to a name that answers a public address, then loopback, never reaches it": expected reason `redirected to rebind.example:<port>, a private address the config does not name`, actual `connection refused`. The test's fake public address is refused by the runner's network before the connection's own lookup is checked, so the test depends on the host's network. Make the test deterministic (the check of the lookup's answer happens whatever the network does), without weakening the AR0424 behaviour.

- Kind: test

## Done means

- That test passes on GitHub's runner and on the VPS, and still fails when the connection's own lookup check in `packages/uptime/src/site-check.ts` is removed.
- CI on main ends `success`; `npm run check` and `npm test` pass.

## Scope

In:
- `packages/uptime/test/uptime.test.ts`: the rebinding test.
- `packages/uptime/src/site-check.ts`: only if the test cannot be made deterministic otherwise.

Out:
- Any other uptime behaviour.

## Decisions

- 2026-10-26: AR0444 approved; start its worker now despite usage at 60%; the owner: "AR-D50 - 1" (AR-D50)
- 2026-10-26: Merge AR0444 now, then the owner restarts once for AR0339 and AR0444; the owner: "AR-D52 - 1" (AR-D52)
