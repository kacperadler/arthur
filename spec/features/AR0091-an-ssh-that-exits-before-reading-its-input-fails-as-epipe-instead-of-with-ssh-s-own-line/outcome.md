# AR0091 - Outcome

- Merged: 2026-10-17, `531c8e9`
- Branch: h/2026-10-17-ar0091-ssh-epipe-985f8960
- Reviews: review-1.md PASS
- Cost: worker $0.32, reviews $0.49; review rounds 1

## What went in

- `packages/core/src/job-machine.ts`: `ssh()` treats an EPIPE with an exit status as ssh's own failure, so a refused or unreachable machine shows ssh's line instead of `spawnSync ssh EPIPE`.
- `packages/core/test/machine.test.ts`: a refused ssh fed 1 MiB of input says ssh's own line, from both `ssh()` and `sshAsync()`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 330/330 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: F1 dropped (see findings.md).
