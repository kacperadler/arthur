# AR0371 - The board's lock and temporary files in each project's checkout take the umask too, outside the home's reach

```json
{
  "id": "AR0371",
  "title": "The board's lock and temporary files in each project's checkout take the umask too, outside the home's reach",
  "date": "2026-10-23"
}
```

## Description

the one lock outside the home lies in the project's checkout, so F1's fix, the home's `0700`, does not cover it. Under a mask that leaves group write and a shared group, another user edits `build.json.lock` to a text that names no pid, which `lock.ts:134-144` counts as a dead holder's and takes over, so two writers change the board at once and one change is lost (`arthur ticket`'s one-writer rule, `docs/commands/ticket.md:29`). Read access shows only what the repository holds. Nothing to check in a single-user layout.

## Goal

The board's lock and temporary files in each project's checkout are created for Arthur's user alone; tested.

- Kind: risk

Evidence:
- `packages/core/src/board.ts:43-45`, `:62`, `:167-172` (`spec/.board/` made with `mkdirSync(folder, { recursive: true })`, its `.gitignore` of `*`, `build.json.lock`, `build.json.tmp` and `ticket.md.tmp` written with default modes)
- Found by: 2026-10-23-ar0327-security-check-56de526b (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: at `board.ts:169`, `mkdirSync(folder, { recursive: true, mode: 0o700 })` then `chmodSync(folder, 0o700)`, as F1's `ownHome` does, since every file of the folder is the lock's holder's alone. A test in `packages/core/test/board.test.ts` under `process.umask(0o022)`: `spec/.board/` is `0700` after the first write, also when it was `0755` before. Out: `spec/build.json`, `spec/features/**/ticket.md` and the rest of the checkout, which are committed and the project's own.
- `npm test` and `npm run check` pass.

## Scope

In:
- at `board.ts:169`, `mkdirSync(folder, { recursive: true, mode: 0o700 })` then `chmodSync(folder, 0o700)`, as F1's `ownHome` does, since every file of the folder is the lock's holder's alone. A test in `packages/core/test/board.test.ts` under `process.umask(0o022)`: `spec/.board/` is `0700` after the first write, also when it was `0755` before. Out: `spec/build.json`, `spec/features/**/ticket.md` and the rest of the checkout, which are committed and the project's own.

## Decisions

- 2026-10-23: Source: F2 of AR0327
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
