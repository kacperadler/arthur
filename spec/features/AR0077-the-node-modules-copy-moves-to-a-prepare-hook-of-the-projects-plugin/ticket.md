# AR0077 - The node_modules copy moves to a prepare hook of the projects plugin

```json
{
  "id": "AR0077",
  "title": "The node_modules copy moves to a prepare hook of the projects plugin",
  "date": "2026-10-16",
  "after": [
    "AR0073"
  ]
}
```

## Description

B1 of the core line review: 17 lines out of the core; roadmap entries 9, 21 and 41 and `spawn.md` edited so the roadmap says where it lives.

## Goal

The core stays small enough to understand, with capability in plugins (vision); the plan is `spec/quality/core-lines-2026-10-16.md`, proposal B1.

- Kind: cleanup

## Done means

- What proposal B1 of `spec/quality/core-lines-2026-10-16.md` names, and no behaviour change: every existing test passes unchanged except where the report names a doc or test edit.
- Until entry 41 exists, the copy lives in the test kit or a minimal prepare step the roadmap names; no spawn loses it silently.
- `npm test` and `npm run check` pass; the core line count drops by at least the lines the report gives, and the final message states the before and after counts.

## Scope

In:
- The files proposal B1 names.

Out:
- Anything the report does not name.

## Decisions

- 2026-10-16: Coordinator: from the core line review (AR0069), accepted.
- 2026-10-16: The human: steps 1 (cuts AR0074 to AR0079) and 2 (entries 16, 21, 22) approved; in parallel only where tickets touch different files, otherwise one after another. Entry 23 starts only after both are merged.
- 2026-10-16: Coordinator: accepted: the node_modules copy test goes with the behaviour; until entry 41 no spawn copies node_modules, a job installs from the lockfile (worker.md says so), spawn --help says the core copies none; roadmap row R2 edit accepted.
