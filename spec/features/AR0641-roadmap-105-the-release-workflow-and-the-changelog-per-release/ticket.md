# AR0641 - Roadmap 105: the release workflow and the changelog per release

```json
{
  "id": "AR0641",
  "title": "Roadmap 105: the release workflow and the changelog per release",
  "date": "2026-11-06"
}
```

## Description

Builds roadmap entry 105 of `spec/roadmap.md` ("## Releases"), from the AR0128 plan the owner approved on 2026-11-06 (AR-D514): Arthur is released as Git tags and GitHub releases, one version for the core and every plugin, first release 0.1.0. The owner reads this ticket's branch as a GitHub pull request before it is merged (AR-D518).

## Goal

Entry 105 as `spec/roadmap.md` writes it: its "Delivers" line and its "Done means" line are this ticket's, word for word; the detail is in `spec/features/AR0128-plan-releases-installing-and-updating-arthur/plan.md`, the Approach sections that entry names.

- Kind: ci

## Done means

- Every point of entry 105's "Delivers" works, each shown by a test that fails when it is removed.
- Every edge case and refusal of entry 105's "Done means" has its test.
- The docs of every command it adds or changes (its `--help` page) say what it does, and `CHANGELOG.md` is left to the merge.
- `npm run check` and `npm test` pass; a line budget raised names the new number in the final message (the owner's decision, AR-D514's plan Risks).

## Scope

In:
- `.github/workflows/release.yml`; delivery (`arthur changelog`).

Out:
- The other entries of "## Releases": their own tickets.
- The first release itself (a `Release 0.1.0` ticket) comes after this one, asked of the owner.

## Decisions

