# AR0398 - Outcome

- Merged: 2026-11-02, `18e54172`
- Branch: arthur/2026-11-02-worker-6ffaf5c2
- Reviews: review-1.md PASS
- Cost: worker $3.74, reviews $0.32; review rounds 1

## What went in

- packages/core/src/job-machine.ts: `gitOver(root, verb, args)` returns stdout and labels errors `git <verb>:`. It no longer sets `GIT_PROTOCOL_FROM_USER`, and its comment says why `send-pack`/`fetch-pack` are used (AR0398). `reach` pushes the base with `git send-pack`.
- packages/core/src/machine-sync.ts: the sweep fetches an ended job's branch with `git fetch-pack` from the machine's URL, then `git branch --force arthur/<id> <tip>`.
- packages/core/test/machine.test.ts: replaces the AR0393 tests. With a remote named as the machine's URL (`url` set to `evil::x`, `evil://x`, a folder or `ssh://elsewhere/…`; `pushurl` set to `ssh://elsewhere/…` or `gpu:<other>`), the push and fetch reach the machine's repository and run nothing. A branch checked out here is not moved and is fetched at the next sweep. A `pushurl` written right after the config check still sends the push nowhere else.
- packages/core/docs/commands/spawn.md: step 1 names `git send-pack` and that it reads no remote. The sweep paragraph names `git fetch-pack`, `git branch --force`, and the refusal for a branch checked out here.
- docs/deploy.md: in the threat model, `GIT_PROTOCOL_FROM_USER=0` now applies to `github.push` only, plus a sentence on why the push and fetch of a remote job name no remote.
- spec/roadmap.md: entry 21 says the base commit goes by `git send-pack` (AR0398).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1422/1493 passed.

## Left open

- Findings: none; no findings.md on this ticket.
