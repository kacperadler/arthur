# AR0232 - A site on a port that fetch blocks is reported down forever, as `bad port`

```json
{
  "id": "AR0232",
  "title": "A site on a port that fetch blocks is reported down forever, as `bad port`",
  "date": "2026-10-20"
}
```

## Description

Node's `fetch` refuses the ports of the Fetch standard's bad-port list (9, 25, 6000, 6665 to 6669, 10080 and others) without a connection. A site listed with such a port passes the option check, then every check fails with `bad port`: `arthur run` with `uptime({ sites: { acme: [{ url: "http://127.0.0.1:9/" }] } })` sent `uptime: http://127.0.0.1:9/ (project acme) is down since ...: bad port`, and it stays down whatever the site does.

## Goal

A site whose port fetch never reaches is refused when Arthur loads, naming the port, instead of being reported down forever.

- Kind: bug

Evidence:
- `packages/uptime/src/site-check.ts:12`, `packages/uptime/src/uptime-options.ts:18`
- Found by: 2026-10-20-ar0227-uptime-plugin-f319c5fb (worker), 2026-10-20

## Done means

- The fix, with a test that proves it: refuse such a `url` at load, naming the port and that fetch never reaches it. Nothing else of the check changes.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/uptime/src/uptime-options.ts`, its test, `packages/uptime/docs/uptime.md`: refuse such a `url` at load, naming the port and that fetch never reaches it.

## Decisions

- 2026-10-20: Source: F1 of AR0227
- 2026-10-20: The coordinator picked the refusal at load over a second HTTP client: fewer lines, and such ports are almost never a site's.
