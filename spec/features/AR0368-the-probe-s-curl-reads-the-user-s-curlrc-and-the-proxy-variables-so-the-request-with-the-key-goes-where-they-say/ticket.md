# AR0368 - The probe's curl reads the user's `.curlrc` and the proxy variables, so the request with the key goes where they say

```json
{
  "id": "AR0368",
  "title": "The probe's curl reads the user's `.curlrc` and the proxy variables, so the request with the key goes where they say",
  "date": "2026-10-23"
}
```

## Description

the provider's key and the request leave the private network for whatever address the file or the variable names; the resolution at `probe.ts:55-60` and the `resolve` pin at `:66` do not see it. The file and the variables are the owner's, or a job's (every job runs as Arthur's user and can write `~/.curlrc`: AR0320 F1), which keeps this low on its own.

## Goal

The model probe's curl ignores `.curlrc` and proxy variables (`-q`, `--noproxy`), so the request with the key goes only to the configured provider; tested.

- Kind: risk

Evidence:
- `packages/models/src/probe.ts:62-70` (`curl --config -`, no `-q`, no `noproxy`); `packages/core/src/job-machine.ts:91` (`spawn` with the inherited environment); `packages/models/docs/models.md:29`
- Found by: 2026-10-23-ar0326-security-check-b12a34be (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: start curl as `["curl", "-q", "--config", "-"]` (`-q` as the first argument disables every curlrc) and add `noproxy = "*"` to the config lines (curl then ignores the proxy variables); say both in `docs/models.md:29`. Test in `packages/models/test/models.test.ts`, beside `:152`: the test process sets `CURL_HOME` to a temporary folder holding a `.curlrc` of `proxy = "http://127.0.0.1:1"` and `http_proxy` the same (the child inherits `process.env`), and a pick on a local Ollama fake still answers its list; without `-q` and `noproxy` the probe answers `unreachable: curl: (7) …`. Out: the agent's own request (F4), and omp's handling of the same variables.
- `npm test` and `npm run check` pass.

## Scope

In:
- start curl as `["curl", "-q", "--config", "-"]` (`-q` as the first argument disables every curlrc) and add `noproxy = "*"` to the config lines (curl then ignores the proxy variables); say both in `docs/models.md:29`. Test in `packages/models/test/models.test.ts`, beside `:152`: the test process sets `CURL_HOME` to a temporary folder holding a `.curlrc` of `proxy = "http://127.0.0.1:1"` and `http_proxy` the same (the child inherits `process.env`), and a pick on a local Ollama fake still answers its list; without `-q` and `noproxy` the probe answers `unreachable: curl: (7) …`. Out: the agent's own request (F4), and omp's handling of the same variables.

## Decisions

- 2026-10-23: Source: F3 of AR0326
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
