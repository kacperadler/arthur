# AR0419 - The workflow test checks neither what the top-level permissions grant nor a .yaml workflow

```json
{
  "id": "AR0419",
  "title": "The workflow test checks neither what the top-level permissions grant nor a .yaml workflow",
  "date": "2026-10-25"
}
```

## Description

F1 and F2 of AR0375 (spec/features/AR0375-the-ci-workflows-set-no-permissions-and-pin-actions-and-the-site-s-runner-by-tag-ar0311-f16-confirmed/findings.md).

The test at `test/structure.test.ts:692-702` checks that each `.github/workflows/*.yml` has a top-level `permissions:` and pins every `uses:` to a commit. Review 2026-10-25-review-ff67b5de found: `contents: read` changed to `contents: write` (or `permissions: write-all`) still passes; a workflow named `*.yaml` is not read at all, so its actions could be unpinned.

## Goal

The workflow test fails on a top-level grant wider than `contents: read` and on any `.yaml` workflow that breaks the rules.

- Kind: test

## Done means

- The test reads `*.yml` and `*.yaml`, and requires the top-level block to be exactly `permissions:` followed by `  contents: read`. Each of the two mutations above fails it.
- `npm test` and `npm run check` pass.

## Scope

In:
- `test/structure.test.ts`: the workflow test.

Out:
- A job's own `permissions:` (deploy's `pages: write`, `id-token: write` stay).

## Decisions

- 2026-10-25: Source: F1 of AR0375
