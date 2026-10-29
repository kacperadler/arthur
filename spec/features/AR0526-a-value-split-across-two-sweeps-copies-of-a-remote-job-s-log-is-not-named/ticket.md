# AR0526 - A value split across two sweeps' copies of a remote job's log is not named

```json
{
  "id": "AR0526",
  "title": "A value split across two sweeps' copies of a remote job's log is not named",
  "date": "2026-10-27"
}
```

## Description

F6 of AR0518 (spec/features/AR0518-a-token-from-the-env-file-never-appears-in-a-job-record-log-error-or-channel/findings.md). The sweep copies a job's log from another machine in pieces; a value cut at a piece's end is named in neither piece (reviews 3, 4 and 5 of AR0518; AR0509's 256 KiB cut makes it more likely). `config.md` states the gap.

## Goal

No env value reaches the local home from a remote log, whatever the copy's cut. Evidence: `packages/core/src/machine-sync.ts:62-63` names each copied piece alone. Review 3's boring fix: copy only up to the last newline, and the rest at the next sweep.

- Kind: security

## Done means

- A test whose remote job writes a value across a sweep's cut finds only its name in the local log; it fails without the fix.
- `config.md` no longer lists the gap.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/machine-sync.ts`, `packages/core/test/machine.test.ts`, `packages/core/docs/commands/config.md`.

Out:
- A value split across two writes to the CLI's own stdout: stays documented.

## Decisions

- 2026-10-27: Source: F6 of AR0518
- 2026-10-29: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
