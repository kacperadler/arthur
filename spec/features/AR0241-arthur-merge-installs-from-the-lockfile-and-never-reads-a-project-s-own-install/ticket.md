# AR0241 - arthur merge installs from the lockfile and never reads a project's own install

```json
{
  "id": "AR0241",
  "title": "arthur merge installs from the lockfile and never reads a project's own install",
  "date": "2026-10-21"
}
```

## Description

a project whose entry in `arthur.config.ts` sets `install` (a custom command, or `""` for none) gets that command in each new worktree, but `arthur merge` runs the frozen install of the changed lockfile instead (`npm ci` for `package-lock.json`), because the projects plugin exposes its install to no other plugin and delivery may not import it. A project with `install: ""` and a lockfile still gets `npm ci` on main after a merge that changed the lockfile.

## Goal

`arthur merge` installs on main with the project's own install command (custom or none), the same one its worktrees get, via a provided `projects.install`; the merge's own lockfile table goes.

- Kind: bug

Evidence:
- `packages/delivery/src/merge-checks.ts:12` (the lockfile table) and `packages/projects/src/install.ts:19` (`installCommand`, which reads `install` first)
- Found by: 2026-10-20-roadmap-54-arthur-merge-76ffc10e (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: the projects plugin provides `projects.install` (`{ project, commit }` to the command, `""` for none), recorded in `docs/plugin-api.md`, and the merge asks it, dropping its own lockfile table; nothing else of the merge changes.
- `npm test` and `npm run check` pass.

## Scope

In:
- the projects plugin provides `projects.install` (`{ project, commit }` to the command, `""` for none), recorded in `docs/plugin-api.md`, and the merge asks it, dropping its own lockfile table; nothing else of the merge changes.

## Decisions

- 2026-10-21: Source: F1 of AR0239
- 2026-10-21: Approved by the owner (Telegram, morning report).
