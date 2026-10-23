# AR0281 - Roadmap 96: the decision log

```json
{
  "id": "AR0281",
  "title": "Roadmap 96: the decision log",
  "date": "2026-10-22"
}
```

## Description

This ticket builds roadmap entry 96 in `spec/roadmap.md` in the `orchestration` plugin.

## Goal

The specification is roadmap entry 96: its Delivers and Done means.

- Kind: feat
- Budget: 15

## Done means

- Everything entry 96's Delivers and Done means list, each refusal and edge case with its test: `arthur decision` inside a job refused; empty question, unknown kind, `--ticket` not on the board, `--recommend`/`--picked` with no such option refused; an answer to an unknown id, an empty answer, no `--decided` refused; a hand-edited log line refused, naming the line, file left as it is; two asks at once; a second answer to one id; a crash between the log line and the ticket line repaired by the next `arthur decision`.
- Writes only through `arthur decision`, under `@arthur/core/lock`, whole file to a temporary name and renamed.
- The coordinator's role and the procedures of 27 and 28 name the command; delivery's review-limit procedure names it.
- Budget: 15 (a day and a half).
- Only the published host API of `docs/plugin-api.md`; any new host member is recorded there under "Changes since entry 51".
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 96 as built.

## Scope

In:
- `packages/orchestration`, its roles and procedures, `packages/delivery`'s review-limit procedure, docs, tests, README, `arthur.mmd`, `test/structure.test.ts`.

## Decisions

- 2026-10-22: Started by the coordinator; owner: continue Arthur today up to 20% of the weekly limit (8% at 08:40).
- 2026-10-22: Coordinator (free hand) accepted orchestration's line budget raise 1529 -> 1991 (new decision*.ts files, 441 lines).
