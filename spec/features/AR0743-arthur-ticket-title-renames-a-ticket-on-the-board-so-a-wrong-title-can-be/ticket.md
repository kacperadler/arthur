# AR0743 - arthur ticket title renames a ticket on the board, so a wrong title can be corrected in the changelog

```json
{
  "id": "AR0743",
  "title": "arthur ticket title renames a ticket on the board, so a wrong title can be corrected in the changelog",
  "date": "2026-11-26"
}
```

## Description

`CHANGELOG.md` is generated from the titles of merged tickets in `spec/build.json` (`arthur changelog --help`: "a hand edit is overwritten at the next merge"), and no command changes a ticket's title once it is created (`arthur ticket --help` lists `new`, `status`, `after`, `file`). So a merged ticket whose title turned out wrong stays wrong in the changelog for good. The owner asked on 2026-11-26 to fix such a line in one project's changelog: a merged ticket's title states the opposite of what its merged code does.

## Goal

A coordinator can correct a ticket's title through the core's own command, as the board rule asks ("changed only through the core's own command"), and the changelog follows at the next `arthur changelog` or merge.

- Kind: feat

## Done means

1. `arthur ticket title <id> '<title>' [--project <name>]` sets the ticket's `title` in `spec/build.json` and the title in its `ticket.md` (the `# <id> - <title>` heading and the JSON block's `title`), under the board's lock, writing to a temporary name and renaming, and prints `<id> retitled`. The folder name (slug) stays as it is, so paths and links do not change.
2. It refuses, changing nothing: an unknown id; a title the `new` command refuses (empty, spaces around it, several lines, no letter or digit); a `ticket.md` whose heading or JSON block it cannot find (the message names the file). Any status is allowed, merged included.
3. It emits an event like the other ticket commands do (`ticket-retitled` or the existing ticket-updated event if one exists), and `arthur commit-board` commits the change (`spec/build.json` and the ticket's `ticket.md` are already in its list).
4. `arthur ticket --help` documents it. Tests in the core: each refusal, a repeated call, a merged ticket, the changelog showing the new title after `arthur changelog`.
5. The coordinator role's Commands list names it in one line.
6. `npm run check && npm test`; `npm run mutate` on the new code.

## Scope

In:
- `packages/core/src/` the ticket board command and its doc page; `packages/core/test/`.
- The orchestration plugin's coordinator role file: one line.

Out:
- Renaming a ticket's folder.
- Correcting that project's title itself: the coordinator runs the command after the merge.

## Decisions
- 2026-11-26: AR0743 not now: parked until the production T+3 run is proven; the owner: "AR-D736: not now. Park it until the production T+3 run is proven." (AR-D736)
