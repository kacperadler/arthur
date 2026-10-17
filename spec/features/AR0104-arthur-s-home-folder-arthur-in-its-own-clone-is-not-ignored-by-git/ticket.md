# AR0104 - Arthur's home folder `.arthur/` in its own clone is not ignored by Git

```json
{
  "id": "AR0104",
  "title": "Arthur's home folder `.arthur/` in its own clone is not ignored by Git",
  "date": "2026-10-17"
}
```

## Description

`docs/deploy.md` step 2 puts `arthur.config.ts` in the clone, so `core.home` defaults to `.arthur/` inside it. `.gitignore` holds `.h/`, `.env`, `node_modules/` and `arthur.config.ts`, not `.arthur/`. With the README's try config, `arthur projects` alone created `.arthur/projects/checkouts` and `.arthur/orchestration`, and `git status --short` then showed `?? .arthur/`: a `git add --all` in the clone would commit the event log and the job records.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: bug

Evidence:
- `.gitignore`
- Found by: 2026-10-17-ar0103-readme-9e58b7a9 (worker), 2026-10-17

## Done means

- The fix, with a test that proves it: add `.arthur/` to `.gitignore`; nothing else changes.
- `npm test` and `npm run check` pass.

## Scope

In:
- add `.arthur/` to `.gitignore`; nothing else changes.

## Decisions

- 2026-10-17: Source: F1 of AR0103
