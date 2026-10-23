# AR0369 - The agent's own request to a provider is never checked against the private network

```json
{
  "id": "AR0369",
  "title": "The agent's own request to a provider is never checked against the private network",
  "date": "2026-10-23"
}
```

## Description

a window of seconds on a name the owner chose, under Tailscale's DNS; the only way to it is the resolver of the job's machine, which keeps this low. It is said nowhere: `docs/models.md:21` says a name "is resolved at load ... and again at each probe", which reads as the whole story.

## Goal

The agent's own request to a provider is checked against the private network or the limit is documented where the provider is configured.

- Kind: risk

Evidence:
- `packages/models/src/models.ts:67-74` (the `prepare`: `OLLAMA_BASE_URL`/`LM_STUDIO_BASE_URL` as the url was written), `packages/models/docs/models.md:21,29`
- Found by: 2026-10-23-ar0326-security-check-b12a34be (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: say in `docs/models.md:21` that the agent's own requests resolve the name again, unchecked, so a provider by address is the stricter choice; and in the `prepare` at `models.ts:67`, resolve the name once more right before the job starts and refuse the spawn (`provider <name>: <host> resolves to <address>, not a private address`, as a prepare's refusal) when any address is not private, which closes the gap between the pick and the start. Test in `packages/models/test/models.test.ts:118`'s shape: the `dns.lookup` answer turned public after the pick and before the spawn's prepare refuses the spawn with that message. Out: a pin for the agent (omp's HTTP client is not Arthur's).
- `npm test` and `npm run check` pass.

## Scope

In:
- say in `docs/models.md:21` that the agent's own requests resolve the name again, unchecked, so a provider by address is the stricter choice; and in the `prepare` at `models.ts:67`, resolve the name once more right before the job starts and refuse the spawn (`provider <name>: <host> resolves to <address>, not a private address`, as a prepare's refusal) when any address is not private, which closes the gap between the pick and the start. Test in `packages/models/test/models.test.ts:118`'s shape: the `dns.lookup` answer turned public after the pick and before the spawn's prepare refuses the spawn with that message. Out: a pin for the agent (omp's HTTP client is not Arthur's).

## Decisions

- 2026-10-23: Source: F4 of AR0326
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
