# AR0510 - The GitHub, Telegram and YouTrack API addresses take `http://` for any host, sending the token in the clear

```json
{
  "id": "AR0510",
  "title": "The GitHub, Telegram and YouTrack API addresses take `http://` for any host, sending the token in the clear",
  "date": "2026-10-27"
}
```

## Description

F3 of AR0405 (spec/features/AR0405-security-review-of-our-own-code-part-4-other-machines-network-and-dependencies/findings.md).

- Kind: security
- Severity: low
- Found by: 2026-10-27-worker-03ddbe1b (worker), 2026-10-27
- Where: `packages/github/src/github-options.ts:31` (`apiUrl`), `packages/telegram/src/telegram-options.ts:21` (`apiUrl`; the token is in each request's path, `packages/telegram/src/bot-api.ts:43`, `:57`), `packages/youtrack/src/youtrack.ts:58` (the URL in `urlEnv`)
- Input: `arthur.config.ts` and the env file, both the owner's: a typo (`http://api.github.com`) or a self-hosted server given without TLS.
- Why the check misses it: each check accepts `http:` and `https:` alike, for any host; `http` is kept so tests reach their fake on loopback. Probe: `checkOptions` of github and telegram with `http://api.github.com` and `http://api.telegram.org` returned `[]`.
- What: the first request carries the bearer token or the bot token over the internet in plain text, before any redirect to https.
- Suggestion: accept `http:` only for a loopback host (`localhost`, `127.0.0.0/8`, `::1`), as a test's fake needs; refuse it otherwise with the option's path, as the youtrack refusal already words it. Out: a private-network GitHub Enterprise Server without TLS, which would need its own option.

## Goal

Refuse an `http://` API address for GitHub, Telegram and YouTrack unless its host is loopback, so a typo or a server without TLS never sends a token in plain text over the internet. Evidence: F3 of AR0405 above: `checkOptions` of github and telegram returned `[]` for `http://api.github.com` and `http://api.telegram.org` (`packages/github/src/github-options.ts:31`, `packages/telegram/src/telegram-options.ts:21`, `packages/youtrack/src/youtrack.ts:58`).

- Kind: security

## Done means

- `http:` is accepted only for `localhost`, `127.0.0.0/8` and `::1`; any other host with `http:` is refused, naming the option's path, as youtrack's refusal words it. Tests in each plugin: `http://api.github.com`, `http://api.telegram.org` and a YouTrack `http://` URL on a public host refused; `http://127.0.0.1:<port>` accepted; each fails before the change.
- The plugins' existing tests on their loopback fakes pass; `npm run check` and `npm test` pass.

## Scope

In:
- `packages/github/src/github-options.ts`, `packages/github/test/github-options.test.ts`.
- `packages/telegram/src/telegram-options.ts`, `packages/telegram/test/telegram.test.ts`.
- `packages/youtrack/src/youtrack.ts`, `packages/youtrack/test/youtrack.test.ts`.

Out:
- A private-network GitHub Enterprise Server without TLS: it would need its own option, a separate decision.

## Decisions

- 2026-10-27: Source: F3 of AR0405
- 2026-10-29: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
