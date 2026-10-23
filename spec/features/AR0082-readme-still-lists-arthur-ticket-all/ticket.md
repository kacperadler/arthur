# AR0082 - README still lists `arthur ticket all`

```json
{
  "id": "AR0082",
  "title": "README still lists `arthur ticket all`",
  "date": "2026-10-16"
}
```

## Description

the status paragraph says "the ticket board (`arthur ticket new|status|after|all`, `host.board`)". AR0075 removed `all`: `arthur ticket all` now prints the usage line and exits 2. The README was out of the ticket's scope (the report names only `ticket.md`, `board.md` and the tests), so it was left as it is.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: refactor

Evidence:
- `README.md:5`
- Found by: 2026-10-16-ar0075-ar0075-arthur-tic-f4149569 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: change it to `arthur ticket new|status|after`; the same paragraph already names `/board`, which runs in the shell as `arthur board [all]`. Nothing else changes.
- `npm test` and `npm run check` pass.

## Scope

In:
- change it to `arthur ticket new|status|after`; the same paragraph already names `/board`, which runs in the shell as `arthur board [all]`. Nothing else changes.

## Decisions

- 2026-10-16: Source: F1 of AR0075
