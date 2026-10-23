# AR0363 - A binary file counts no lines, so a branch of any binary content skips the review on its checks

```json
{
  "id": "AR0363",
  "title": "A binary file counts no lines, so a branch of any binary content skips the review on its checks",
  "date": "2026-10-23"
}
```

## Description

a branch that adds or replaces a binary file of any size (a vendored `.wasm` or `.node` addon the tests load, an executable under `tools/`, an archive) is `no review: 0 lines changed; the job's checks: …` when the job's checks pass; in the probe a 64 KiB file answered so.

## Goal

A binary file counts as changed lines for `review-needed`, so a binary change is reviewed; tested.

- Kind: fix

Evidence:
- `packages/delivery/src/review-needed.ts:66-67` (numstat's `-` counts 0), `packages/delivery/docs/commands/review-needed.md:19`
- Found by: 2026-10-23-ar0324-security-check-87836883 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: a numstat line with `-` for its counts is its own rule before the size: `review: changes a binary file <path>`. Test: a row in `review-needed.test.ts`'s table; `docs/commands/review-needed.md`, "The rules".
- `npm test` and `npm run check` pass.

## Scope

In:
- a numstat line with `-` for its counts is its own rule before the size: `review: changes a binary file <path>`. Test: a row in `review-needed.test.ts`'s table; `docs/commands/review-needed.md`, "The rules".

## Decisions

- 2026-10-23: Source: F7 of AR0324
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
