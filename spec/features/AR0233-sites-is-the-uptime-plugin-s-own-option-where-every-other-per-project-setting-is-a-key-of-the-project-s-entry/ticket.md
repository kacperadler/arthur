# AR0233 - `sites` is the uptime plugin's own option, where every other per-project setting is a key of the project's entry

```json
{
  "id": "AR0233",
  "title": "`sites` is the uptime plugin's own option, where every other per-project setting is a key of the project's entry",
  "date": "2026-10-20"
}
```

## Description

a project's `tracker`, `ci`, `commitRules`, `autoMerge`, `requires` and `docker` live on its entry in the projects list, checked there for their shape and read by their plugin through `collect("projects")`. AR0227's Scope names only `packages/uptime`, so its sites are `uptime({ sites: { <project>: [...] } })`, each key checked against the project list at setup. Two places now say what belongs to a project.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: improvement

Evidence:
- `packages/uptime/src/uptime-options.ts:38`, `packages/projects/src/project-options.ts:38`
- Found by: 2026-10-20-ar0227-uptime-plugin-f319c5fb (worker), 2026-10-20

## Done means

- The fix, with a test that proves it: decide whether a project's sites move to an `uptime` key of its entry (a line in projects' `FIELDS`, the uptime plugin reading it as commit-rules reads `commitRules`, `sites` removed), or stay a plugin option as AR0216's other stimulus plugins would then follow.
- `npm test` and `npm run check` pass.

## Scope

In:
- decide whether a project's sites move to an `uptime` key of its entry (a line in projects' `FIELDS`, the uptime plugin reading it as commit-rules reads `commitRules`, `sites` removed), or stay a plugin option as AR0216's other stimulus plugins would then follow.

## Decisions

- 2026-10-20: Source: F2 of AR0227
- 2026-10-20: Dropped: the coordinator accepted `sites` as the uptime plugin's own option during AR0227 (the projects package stays untouched).
