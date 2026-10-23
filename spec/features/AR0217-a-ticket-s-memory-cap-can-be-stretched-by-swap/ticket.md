# AR0217 - A ticket's memory cap can be stretched by swap

```json
{
  "id": "AR0217",
  "title": "A ticket's memory cap can be stretched by swap",
  "date": "2026-10-19"
}
```

## Description

A ticket's slice gets `CPUQuota` and `MemoryMax` only, so jobs of a ticket with a per-feature memory cap and no per-job cap may swap past the ticket's cap before the kernel kills one.

## Goal

A ticket's slice with a memory cap also gets `MemorySwapMax=0` (`infinity` without one), as a job's own scope does, so the cap holds.

- Kind: security

## Done means

- A test of `setSlice` shows `MemorySwapMax=0` with a memory cap and `infinity` without; the joint slice is unchanged.

## Scope

- `packages/core/src/job-scope.ts` and its test.

## Decisions

- 2026-10-19: Source: F1 of AR0147. Approved under the owner's word of the same day: findings are built in batches; built together with AR0149 in the resources code.
