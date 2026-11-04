# AR0620 - Uptime tells this machine offline apart from a site down even with one site, by probing addresses outside the projects

```json
{
  "id": "AR0620",
  "title": "Uptime tells this machine offline apart from a site down even with one site, by probing addresses outside the projects",
  "date": "2026-11-04"
}
```

## Description

Today the uptime plugin decides "this machine is offline" only by asking the other project sites, and only with 2 or more of them; with one site, a site with no answer is always reported down, whether the site or this machine's own connection failed. With this ticket the plugin also asks a short list of well-known addresses outside the projects, so even with one site a lost connection on this machine is one "this machine looks offline" notice, never a false "site down".

## Goal

The owner, 2026-11-04: "uptime -> we have to fix this bcs the diff is when you on machine do not have access to the internet and the diff is when the site is down". Evidence: `packages/uptime/docs/uptime.md`, "This machine offline": "With one site, or one left that is not down, a site with no answer is down, as nothing tells the two apart." The owner's config watches one site (`projects/kacperadler.pl`), so on 2026-11-04 11:41 Warsaw the notice `https://kacperadler.pl/ (project kacperadler.pl) is down ... no answer within 10 s` could not say which side failed; it answered again 15 min later.

- Kind: fix

## Done means

- An option `probes` of `uptime({ ... })`: a list of `https://` URLs outside the projects, each a public host (a private, loopback or link-local address refused at load, as a site's is), default two independent ones (for example `https://1.1.1.1/` and `https://dns.google/`), `[]` turning the probes off.
- When a site is about to go down for want of an answer, the plugin asks the other sites not down and the probes at once; any HTTP answer from any of them proves the network works, so the site goes down as today. When none answers, this machine is offline: the existing offline notice, naming what was asked, and no site notice; the existing "answers again" notice when one answers.
- With one site and the default probes, a lost connection gives the offline notice and no "site down"; a site that fails while a probe answers is down after its 2 failed checks, as today.
- Tests against the plugin's fake fetch: one site plus probes, each case above, `probes: []` keeping today's behaviour, a private probe refused at load. Each fails when its behaviour is removed.
- `packages/uptime/docs/uptime.md` ("Options", "This machine offline") and `arthur.config.example.ts` say so.

## Scope

In:
- `packages/uptime/src/`, `packages/uptime/test/`, `packages/uptime/docs/uptime.md`, `arthur.config.example.ts`.

Out:
- The coordinator's site-down runbook: AR0607 (it already checks this machine's connection by hand first).
- Ping or DNS-only probes: an HTTP answer is the same proof the sites use.

## Decisions
- 2026-11-04: AR0620 approved with the default probes https://1.1.1.1/ and https://dns.google/; the owner: "AR-D493 - 1" (AR-D493)
