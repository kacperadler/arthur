# AR0162 - A registered entry's procedure will be a path the entry check refuses

```json
{
  "id": "AR0162",
  "title": "A registered entry's procedure will be a path the entry check refuses",
  "date": "2026-10-19"
}
```

## Description

an action's `procedure` must be a relative `.md` path inside the folder `arthur run` runs in, so a job's edit of `spec/schedule.json` cannot make the coordinator's message carry `.env` or a file outside the checkout. Roadmap entry 40 lets a plugin register entries (orchestration's morning report, whose procedure would sit in its own package, e.g. `packages/orchestration/roles/coordinator/morning-report.md` reached through `import.meta.url`): such a path is absolute and outside the checkout once Arthur is installed, so running registered entries through `entryProblems` as it is refuses them.

## Goal

A procedure registered by a plugin (entry 40) is accepted by the same check that guards hand-written entries, without opening that check to arbitrary paths.

- Kind: security

Evidence:
- `packages/schedule/src/entry.ts:38-40`
- Found by: 2026-10-18-ar0158-f5a05899 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: in entry 40, check a registered entry's procedure apart from the file's (an absolute `.md` path the registering plugin hands over, which the styleguide lets schedule read), and keep the relative-path rule for the config and the file. Nothing to change before entry 40.
- `npm test` and `npm run check` pass.

## Scope

In:
- in entry 40, check a registered entry's procedure apart from the file's (an absolute `.md` path the registering plugin hands over, which the styleguide lets schedule read), and keep the relative-path rule for the config and the file. Nothing to change before entry 40.

## Decisions

- 2026-10-19: Source: F1 of AR0158
- 2026-10-19: Coordinator: fixed by AR0163 (registered procedures checked against the plugin's package folder); dropped.
