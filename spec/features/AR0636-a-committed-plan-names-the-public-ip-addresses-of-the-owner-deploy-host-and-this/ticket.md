# AR0636 - A committed plan names the public IP addresses of the owner deploy host and this VPS

```json
{
  "id": "AR0636",
  "title": "A committed plan names the public IP addresses of the owner deploy host and this VPS",
  "date": "2026-11-06"
}
```

## Description

The nightly audit of 2026-11-06 (proposal 2), taking F5 of AR0627: a committed plan names two public IPv4 addresses, the owner's deploy host and this VPS, in the public repository.

## Goal

No tracked file names the public address of one of the owner's servers.

Evidence:
- `spec/features/AR0604-plan-the-docker-plugin-and-the-core-cleanup-hook-roadmap-70-to-72/plan.md:43`: two public IPv4 addresses; AR0627 F5 says they are the owner's deploy host and this VPS.
- `git grep` for public IPv4 addresses over all tracked files: every other hit is a well-known resolver, a cloud metadata address or a test range; this line is the only real server.
- `spec/vision.md`: the repository is public, and what reaches GitHub is about Arthur alone.

- Kind: security

## Done means

- Both addresses in that plan line are replaced with `<deploy host>` and `<this VPS>`; the sentence still reads.
- `git grep -nE` for public IPv4 addresses over the tracked files finds no address of a real server of the owner (resolvers, metadata and test ranges stay).
- Whether to rewrite history to remove the old line, as AR-D499 did for AR0627, is the owner's decision, asked before any rewrite; this ticket does not rewrite history.
- `npm run check` and `npm test` pass.

## Scope

In:
- `spec/features/AR0604-plan-the-docker-plugin-and-the-core-cleanup-hook-roadmap-70-to-72/plan.md`.

Out:
- A general address check; a history rewrite (the owner's call).

## Decisions
- 2026-11-06: Source: audit spec/quality/2026-11-06.md
- 2026-11-06: Source: F5 of AR0627
