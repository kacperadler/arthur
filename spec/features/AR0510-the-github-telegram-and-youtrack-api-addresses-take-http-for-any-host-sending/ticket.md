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

- 2026-10-27: Source: F3 of AR0405
