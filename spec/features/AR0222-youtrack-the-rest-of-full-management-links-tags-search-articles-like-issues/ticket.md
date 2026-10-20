# AR0222 - YouTrack: the rest of full management, links, tags, search, articles like issues

```json
{
  "id": "AR0222",
  "title": "YouTrack: the rest of full management, links, tags, search, articles like issues",
  "date": "2026-10-20"
}
```

## Description

The owner wants the youtrack plugin to manage issues and articles to YouTrack's full extent. After AR0220, issues have create, read, update, delete, fields, work items, comments, and attachments; articles have only create, read, update, delete. This ticket adds what is still missing.

## Goal

Close the gap between `arthur youtrack` and what YouTrack's REST API lets a user do with issues and articles, so the coordinator never has to tell the owner "do it in the browser".

- Kind: improvement
- Budget: 8

## Done means

- `issue list --query '<YouTrack query>'` and `article list --query` search with YouTrack's own query language, grouped as `issue list` already is.
- Issue links: `issue link <id> <type> <other>` and `issue unlink`, `issue links <id>` (subtask, depends on, duplicates, relates, as the instance's link types name them).
- Tags: `issue tag <id> <tag>` and `issue untag`.
- `issue move <id> <project>` to another YouTrack project of the same instance.
- Work items: `issue work list|edit|delete`.
- Articles like issues: comments (list, add, edit, delete as entry 46 deletes them), attachments (list, add, delete), a sub-article (`article create <file> --parent <id>`), and `article move <id> --parent <id>`.
- Each verb: an id outside the project's YouTrack project refused before any call; a job refused for every write; YouTrack's error in one line; the token never in an error. Tests against the fake server.
- `packages/youtrack/docs/commands/youtrack.md`, the usage line, roadmap entry 45 and row Y1 updated.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/youtrack/src/`, its docs and tests; `spec/roadmap.md` entry 45 and row Y1.

Out:
- Project, board (agile), sprint, and user administration.

## Decisions

- 2026-10-20: Source: the owner asked for full create, read, update, delete and management of issues and articles; AR0220 covered delete, this covers the rest.
- 2026-10-20: The owner approved it, without boards and sprints, under the 90% usage ceiling (86% used).
- 2026-10-20: The coordinator accepts the youtrack line budget raise 518 -> 659 (+141) after the cuts the worker named. Open to the owner: article comment delete is permanent (YouTrack has no restorable mark there); issue tag creates an unknown tag.
