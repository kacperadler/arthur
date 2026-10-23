# AR0227 - An uptime plugin: Arthur checks client sites and tells the owner when one is down

```json
{
  "id": "AR0227",
  "title": "Roadmap 98: uptime, each project's sites checked",
  "date": "2026-10-20"
}
```

## Description

The owner, 2026-10-20: a client's site went down and he learnt it only from the client. A small `uptime` plugin checks each listed URL on a schedule and sends the owner a notice when a site goes down and when it is back. It is the first stimulus source of AR0216, built early and on its own, with no reaction chain.

## Goal

The owner hears of a down site before the client calls. The check is plain HTTP in the plugin, with no model call, so it costs no usage. Later AR0216 hangs its chain (triage, fix, review) on the same `uptime` events.

- Kind: improvement
- Budget: 7

## Done means

- Config: per project a list of `{ url, expect?: status or text, everySeconds? }`; the option table (entry 93) lists every option.
- A site is down after 2 failed checks in a row (timeout, connection refused, TLS error, wrong status, missing text); the owner gets one notice with the URL, the reason, and the time; when it answers again, one notice with how long it was down. No notice repeats while the state holds.
- The plugin emits `uptime-down` and `uptime-up` events on the event stream, for AR0216's chains later.
- Edge cases, each with a test against a local HTTP server on an OS-chosen port: a slow answer past the timeout; a redirect; a 500 that recovers on the second check (no notice); this machine offline (every site fails at once: one notice that the checks cannot run, not one per site); quiet hours (the notice waits or goes silent as other notices do); a restart while a site is down (no second down notice).
- `npm test` and `npm run check` pass.

## Scope

In:
- a new package `packages/uptime`, its docs and tests; README, `arthur.mmd`, `spec/roadmap.md` (a new entry).

Out:
- the reaction chain, Sentry, and machine load: AR0216;
- webhooks from outside services.

## Decisions

- 2026-10-20: Source: the owner's question about stimuli after a client's site went down unnoticed.
- 2026-10-20: The owner approved it ("brzmi sensownie") after the coordinator recommended building it now; 88% usage, under the 90% ceiling.
