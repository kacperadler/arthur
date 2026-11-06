# AR0640 - Roadmap 104: one release version, arthur version with the hash, and the plugin check

```json
{
  "id": "AR0640",
  "title": "Roadmap 104: one release version, arthur version with the hash, and the plugin check",
  "date": "2026-11-06"
}
```

## Description

Builds roadmap entry 104 of `spec/roadmap.md` ("## Releases"), from the AR0128 plan the owner approved on 2026-11-06 (AR-D514): Arthur is released as Git tags and GitHub releases, one version for the core and every plugin, first release 0.1.0. The owner reads this ticket's branch as a GitHub pull request before it is merged (AR-D518).

## Goal

Entry 104 as `spec/roadmap.md` writes it: its "Delivers" line and its "Done means" line are this ticket's, word for word; the detail is in `spec/features/AR0128-plan-releases-installing-and-updating-arthur/plan.md`, the Approach sections that entry names.

- Kind: feat

## Done means

- Every point of entry 104's "Delivers" works, each shown by a test that fails when it is removed.
- Every edge case and refusal of entry 104's "Done means" has its test.
- The docs of every command it adds or changes (its `--help` page) say what it does, and `CHANGELOG.md` is left to the merge.
- `npm run check` and `npm test` pass; a line budget raised names the new number in the final message (the owner's decision, AR-D514's plan Risks).

## Scope

In:
- core (`arthur version`, the plugin check at load); machines (what it compares, its refusal); every `package.json` and the lockfile (the version, 0.1.0).

Out:
- The other entries of "## Releases": their own tickets.
- A version is set only by a release ticket (105); this ticket sets 0.1.0 once, as the plan says.

## Decisions

