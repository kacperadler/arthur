# AR0366 - The models plugin's private network holds two cloud metadata addresses (AR0311 F18, confirmed)

```json
{
  "id": "AR0366",
  "title": "The models plugin's private network holds two cloud metadata addresses (AR0311 F18, confirmed)",
  "date": "2026-10-23"
}
```

## Description

the probe (`probe.ts:70`), with the provider's key as a `Bearer` header, and then the job's agent (`models.ts:73`) talk to the metadata service of the cloud the job's machine runs in; the answer is never shown (`its model list answered something that is not a model list`), so what the owner's config can reach this way is the request itself. The input is the owner's config file, which keeps the severity low; a job that can rewrite `arthur.config.ts` is AR0320 F1.

## Goal

The models plugin's private network excludes the cloud metadata addresses (`fd00:ec2::254`, `100.100.100.200`), so no provider can point there; tested.

- Kind: security

Evidence:
- `packages/models/src/model-options.ts:27-30` (`PRIVATE`), `:32` (`isPrivate`); `packages/machines/src/machine-check.ts:35` (the same 100.64.0.0/10 for an `ssh` address); `packages/models/docs/models.md:21`
- Found by: 2026-10-23-ar0326-security-check-b12a34be (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: in `model-options.ts`, a second `BlockList` of the metadata addresses inside the private ranges, `100.100.100.200/32` and `fd00:ec2::254/128`, checked first by `isPrivate` (`false` when it matches), and the same two in `machine-check.ts:34-37` (or one list exported by the core, since both plugins may import only `@arthur/core`); `docs/models.md:21` names the two exceptions. Tests: `packages/models/test/models.test.ts:104`, the refused list gets `http://100.100.100.200/` and `http://[fd00:ec2::254]/`, and `:118` a name resolving to `100.100.100.200` refuses the load; `packages/machines/test/machines.test.ts:303`, a `hostname` of `100.100.100.200` refused. Out: a deny-list of every cloud's addresses outside the private ranges (already refused as public).
- `npm test` and `npm run check` pass.

## Scope

In:
- in `model-options.ts`, a second `BlockList` of the metadata addresses inside the private ranges, `100.100.100.200/32` and `fd00:ec2::254/128`, checked first by `isPrivate` (`false` when it matches), and the same two in `machine-check.ts:34-37` (or one list exported by the core, since both plugins may import only `@arthur/core`); `docs/models.md:21` names the two exceptions. Tests: `packages/models/test/models.test.ts:104`, the refused list gets `http://100.100.100.200/` and `http://[fd00:ec2::254]/`, and `:118` a name resolving to `100.100.100.200` refuses the load; `packages/machines/test/machines.test.ts:303`, a `hostname` of `100.100.100.200` refused. Out: a deny-list of every cloud's addresses outside the private ranges (already refused as public).

## Decisions

- 2026-10-23: Source: F1 of AR0326
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
