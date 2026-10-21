# arthur changelog

Usage: `arthur changelog [--project <name>]`. Comes with the `delivery` plugin (roadmap entry 56). Answered without the model, for one project, the main one unless `--project` names another.

Writes `CHANGELOG.md` at the project's root from its merged tickets, and prints `wrote CHANGELOG.md: <n> merged tickets`. `arthur merge` writes it the same way after every merge that went in (`arthur merge --help`, "Steps"); neither commits it: the commit after a merge does. The file is rebuilt whole each time, so a hand edit is overwritten at the next merge.

```
# Changelog

Generated from the merged tickets of `spec/build.json` by `arthur changelog`; a hand edit is overwritten at the next merge.

## 2026-10-21

### Added

- AC0003 Pay (4f2a9c1)

### Other

- AC0004 Plan the cart

## 2026-10-20

### Fixed

- AC0001 The total is off by a cent (9b0e7d2)
```

- One `## <date>` per day a ticket was merged, newest first. The day and the short hash come from the `- Merged: <date>, <hash>` line of the ticket's `outcome.md`; a ticket without one (merged before `arthur merge` wrote outcomes) takes the day of its last move on the board, in `core.timeZone`, and no hash.
- Under each day, one heading per kind, in this order, a heading with no ticket left out: `Added` (kind `feature` or `improvement`), `Fixed` (`bug` or `risk`), `Changed` (`cleanup`), `Other` (any other kind, or none). The kind is the `- Kind:` line under the ticket's `## Goal`; a ticket without one, or whose `ticket.md` is gone, goes under `Other`.
- Each line is `- <id> <title>`, the title as the board has it; within a heading the ids in order, `AC9999` before `AC10000`.
- With no merged ticket, the file is the head and the one line `No merged ticket yet.`

The same board and files give the same file byte for byte: nothing in it depends on when it was written or the order the files are read in.

Refused: any word but `--project <name>` prints the usage line and exits 2; an unknown project is the core's refusal, naming the known ones.
