# AR0410 - setup.md step 5 does not say `ci.workflow` needs an `origin` remote

```json
{
  "id": "AR0410",
  "title": "setup.md step 5 does not say `ci.workflow` needs an `origin` remote",
  "date": "2026-10-25"
}
```

## Description

F3 of AR0307 (spec/features/AR0307-the-switch-arthur-runs-on-the-vps-and-takes-its-own-tickets/findings.md): someone following the VPS setup sets a project's `ci: { workflow }` in step 5 without being told the github plugin reads the repository from the checkout's `origin` remote.

## Goal

A reader of docs/setup.md step 5 learns that `ci.workflow` needs an `origin` remote on GitHub. Evidence: the first review of AR0307 (2026-10-25-review-fce9638a, pruned) noted step 5 does not say it.

- Kind: docs

## Done means

- docs/setup.md step 5 names the `origin` remote `ci.workflow` needs, as packages/github/docs/github.md says it; the project's checks pass.

## Scope

In:
- `docs/setup.md`: one sentence in step 5.

Out:
- Any change to how the github plugin finds the repository.

## Decisions

- 2026-10-25: Source: F3 of AR0307
