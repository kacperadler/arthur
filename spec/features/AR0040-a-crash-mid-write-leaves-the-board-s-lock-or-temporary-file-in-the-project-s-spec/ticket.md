# AR0040 - A crash mid-write leaves the board's lock or temporary file in the project's `spec/`

```json
{
  "id": "AR0040",
  "title": "A crash mid-write leaves the board's lock or temporary file in the project's `spec/`",
  "date": "2026-10-16"
}
```

## Description

the lock `spec/build.json.lock` (and `spec/build.json.lock.<pid>` while it is taken) and the temporary `spec/build.json.<pid>.tmp` live next to the board, in the project's repository. They exist only for the moment of a write, and a dead holder's lock is taken over, but a process killed in that moment leaves an untracked file that `git add spec` would commit.

## Goal

No crash can put a board's lock or temporary file into a project's commit: the board's transient files never sit in a tracked folder.

- Kind: risk

Evidence:
- `packages/core/src/board.ts` (`withLock(`${file}.lock`)`), `packages/core/src/board-file.ts` (`writeBoard`)
- Found by: 2026-10-16-ar0020-ticket-board-ee737520 (worker), 2026-10-16

## Done means

- The board lock and its temporary file live outside the project's tracked tree: under Arthur's home (`<home>/boards/<project>/`), or the temporary file in the same folder but ignored by the project's `.gitignore` written by the board on first write; the worker picks the one that keeps the rename atomic (same filesystem) and says why.
- A test kills a real process mid-write (lock taken, temp written) and asserts `git status --porcelain` in the project shows nothing but `spec/build.json` changes, and the next write takes the dead lock over.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/board.ts`, `board-file.ts`, their tests.

## Decisions

- 2026-10-16: Source: F2 of AR0020
- 2026-10-16: Coordinator: OK on `spec/.board/` with its own `.gitignore` of `*` (same filesystem, so the rename stays atomic; no human-owned file is touched).
