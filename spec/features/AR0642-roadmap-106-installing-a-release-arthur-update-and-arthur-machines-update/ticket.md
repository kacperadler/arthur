# AR0642 - Roadmap 106: installing a release, arthur update and arthur machines update

```json
{
  "id": "AR0642",
  "title": "Roadmap 106: installing a release, arthur update and arthur machines update",
  "date": "2026-11-06"
}
```

## Description

Builds roadmap entry 106 of `spec/roadmap.md` ("## Releases"), from the AR0128 plan the owner approved on 2026-11-06 (AR-D514): Arthur is released as Git tags and GitHub releases, one version for the core and every plugin, first release 0.1.0. The owner reads this ticket's branch as a GitHub pull request before it is merged (AR-D518).

## Goal

Entry 106 as `spec/roadmap.md` writes it: its "Delivers" line and its "Done means" line are this ticket's, word for word; the detail is in `spec/features/AR0128-plan-releases-installing-and-updating-arthur/plan.md`, the Approach sections that entry names.

- Kind: feat

## Done means

- Every point of entry 106's "Delivers" works, each shown by a test that fails when it is removed.
- Every edge case and refusal of entry 106's "Done means" has its test.
- The docs of every command it adds or changes (its `--help` page) say what it does, and `CHANGELOG.md` is left to the merge.
- `npm run check` and `npm test` pass; a line budget raised names the new number in the final message (the owner's decision, AR-D514's plan Risks).

## Scope

In:
- core (`arthur update`); machines (`arthur machines update`, its fix texts); `docs/setup.md` and `docs/deploy.md`.

Out:
- The other entries of "## Releases": their own tickets.
- The owner's VPS stays a checkout of main.

## Decisions

