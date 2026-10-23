# AR0220 - YouTrack: open issues grouped by state, and full create, edit, delete of issues and articles

```json
{
  "id": "AR0220",
  "title": "YouTrack: open issues grouped by state, and full create, edit, delete of issues and articles",
  "date": "2026-10-20"
}
```

## Description

The owner wants the youtrack plugin to manage issues and articles fully, not only read and write them. `arthur youtrack issue list` shows the unresolved issues grouped under their state, and issues, articles, and attachments can also be deleted.

## Goal

Today `issue list` prints unresolved issues as one flat list (AR0195), and `packages/youtrack/src/youtrack-command.ts:8` says "No verb deletes an issue or an article"; roadmap entry 45 and row Y1 say "no delete". The owner overrode that on 2026-10-20: full create, read, update, delete of issues and articles.

- Kind: feat

## Done means

- `arthur youtrack issue list` prints the unresolved issues grouped by their `State` field, one heading per state in the order the project's State bundle gives, with the count; `--all` adds the resolved states the same way. Test against the fake server: three states, an issue with no State goes under `(no state)`.
- `arthur youtrack issue delete <id>` and `arthur youtrack article delete <id>` delete through YouTrack's REST API. Tests: a missing id gets YouTrack's error in one line; an id outside the project's YouTrack project is refused before any call, as for the other verbs; a job (`ARTHUR_JOB` set) is refused like every other write.
- `arthur youtrack attachment add <id> <file>` and `attachment delete <id> <attachment>` on an issue. Tests: a missing file is refused before any call; the token never appears in an error.
- `docs/commands/youtrack.md`, the usage line, the comment at `youtrack-command.ts:8`, roadmap entry 45 and row Y1 say delete is allowed for the coordinator, never for a job.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/youtrack/src/`: list grouping, delete verbs, attachment add and delete.
- `docs/commands/youtrack.md`, `spec/roadmap.md` entry 45 and row Y1.

Out:
- Deleting comments stays as entry 46 built it (`deleted: true`, restorable).

## Decisions

- 2026-10-20: The owner: `issue list` shows only open issues, grouped by their state; the plugin gives full create, read, update, delete of issues and articles, and their management.
- 2026-10-20: The owner approved it with AR0221 under the 90% usage ceiling.
- 2026-10-20: The owner: merge.
