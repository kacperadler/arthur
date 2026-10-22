# AR0284 - Roadmap 97: decision classes

```json
{
  "id": "AR0284",
  "title": "Roadmap 97: decision classes",
  "date": "2026-10-22"
}
```

## Description

This ticket builds roadmap entry 97 in `spec/roadmap.md` in the `orchestration` plugin.

## Goal

The specification is roadmap entry 97: its Delivers and Done means.

- Kind: feature
- Budget: 10

## Done means

- Everything entry 97's Delivers and Done means list, each refusal and edge case with its test: `arthur decision class` inside a job refused; a proposal backed by no decision, an unknown id, an unanswered one, or one whose decision differs refused; a proposal for a class's own kind refused; an approval given by policy refused; a `revoke` of a non-class or an already revoked class refused; a refused class still sends its questions to the owner; a question matching two approved classes goes to the owner naming both; a question after a revoke goes to the owner.
- Builds on the decision log of AR0281 (`spec/decisions.jsonl`, `arthur decision`) and the evals' agreement rate of AR0276; no second log or lock.
- A class is pre-approved only on the owner's word, recorded in the log.
- Only the published host API of `docs/plugin-api.md`; any new host member is recorded there under "Changes since entry 51".
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 97 as built.

## Scope

In:
- `packages/orchestration`, its roles and docs, tests, README, `arthur.mmd`, `test/structure.test.ts`.

## Decisions

- 2026-10-22: Started by the coordinator; owner: continue Arthur today up to 20% of the weekly limit (8% at 08:40).
- 2026-10-22: Coordinator (free hand) accepted orchestration budget 1991 -> 2194 and the worker picks: agreement rate computed in orchestration from the log (unscored when no recommendation or pick); ticket kind taken only when every backing ticket shares it; proposal answered --picked 1 approve, 2 refuse.
