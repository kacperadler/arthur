# AR0623 - Uptime: this machine offline sends no notice and checks no site, only the probes, until one answers

```json
{
  "id": "AR0623",
  "title": "Uptime: this machine offline sends no notice and checks no site, only the probes, until one answers",
  "date": "2026-11-04"
}
```

## Description

When this machine looks offline, the uptime plugin sends the owner nothing (no offline notice, no "answers again" notice) and stops checking the project sites; it asks only the probes until one answers, then checks the sites again as before, silently.

## Goal

The owner, 2026-11-04: "do not send me any message if machine is offline - if machine is offline then do not check the uptime pages". Today (`packages/uptime/docs/uptime.md`, "This machine offline", after AR0620) the plugin sends `uptime: none of the <n> sites answers ..., so this machine looks offline ...` and later `uptime: a site answers again ...` or `uptime: a probe answers again ...`, and keeps checking the sites while offline.

- Kind: fix

## Done means

- When the sites and the probes all fail to answer, no notice is sent and no `uptime-down` event for any site; one log line on `arthur run`'s output says this machine looks offline.
- While offline, no project site is requested: each check interval asks only the probes (a test counts the fake sites' requests: 0 while offline).
- When a probe answers, the site checks resume with no notice; a site still failing then needs 2 failed checks in a row and is down as before (its notice is the only one the owner gets). One log line says the checks run again.
- With `probes: []` there is nothing to tell offline apart: behaviour as before AR0620's probes (documented).
- Across a restart, a stored offline state sends nothing.
- `docs/uptime.md` "This machine offline" and the notices listed there match; each test fails when its behaviour is removed; `npm run check && npm test` pass.

## Scope

In:
- `packages/uptime/src/`: the offline branch (no notice, no site checks, probes only, silent resume).
- `packages/uptime/test/`, `packages/uptime/docs/uptime.md`.

Out:
- The site down and up notices, unchanged.
- AR0620 F1/F2 (probe host names resolving to private addresses).

## Decisions
- 2026-11-04: AR0623 approved: offline sends no notice and checks no site, only the probes until one answers; next Arthur slot; the owner: "do not send me any message if machine is offline - if machine is offline then do not check the updatime pages" (AR-D496)

