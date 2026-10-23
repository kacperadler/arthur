# K0000 - Short title

```json
{
  "id": "K0000",
  "title": "Short title",
  "date": "YYYY-MM-DD"
}
```

## Description

Two or three sentences: what changes, and for whom.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: feat | fix | security | perf | refactor | test | docs | build | ci | chore | ux

## Done means

- Observable result, and the test that proves it.
- `npm test` and `npm run check` pass.

## Scope

In:
- `path/to/file.ts`: what changes there.

Out:
- What this ticket does not do, and which ticket does.

## Decisions

- YYYY-MM-DD: one decision the human made, in one line.
