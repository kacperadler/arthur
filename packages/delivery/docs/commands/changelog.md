# arthur changelog

Usage: `arthur changelog [--project <name>]`. Comes with the `delivery` plugin (roadmap entries 56 and 105). Answered without the model, for one project, the main one unless `--project` names another.

Writes `CHANGELOG.md` at the project's root from its merged tickets, and prints `wrote CHANGELOG.md: <n> merged tickets`. `arthur merge` writes it the same way after every merge that went in and commits it in its `spec: <id> merged` commit (`arthur merge --help`, "Steps"); `arthur changelog` commits nothing. The file is rebuilt whole each time, so a hand edit is overwritten at the next merge.

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
- Under each day, one heading per kind, in this order, a heading with no ticket left out: `Added` (kind `feat`), `Fixed` (`fix` or `security`), `Changed` (any other kind of the ticket template, `arthur ticket --help`), `Other` (a kind the template does not list, or none). The kind is the `- Kind:` line under the ticket's `## Goal`; a ticket without one, or whose `ticket.md` is gone, goes under `Other`.
- Each line is `- <id> <title>`, the title as the board has it; within a heading the ids in order, `AC9999` before `AC10000`.
- With no merged ticket, the file is the head and the one line `No merged ticket yet.`

## Releases

A release is a commit of the first-parent line of the project's checked-out branch, `main` where `arthur merge` writes the file, whose root `package.json` has a `version` that differs from its first parent's. A version that appears where there was none (a project's first `package.json`, or a version added to it) is no release, nor is a commit whose own or parent `package.json` is missing or not JSON. Outside a Git checkout there is none. A project with no release gets the file above, byte for byte; once it has one, the days go under releases, newest first:

```
## Unreleased

### 2026-10-23

#### Added

- AC0006 Refunds (5d1e8a0)

## 0.2.0 (2026-10-22)

### 2026-10-22

#### Other

- AC0005 Release 0.2.0 (c3a7f12)

### 2026-10-21

#### Added

- AC0003 Pay (4f2a9c1)
```

- `## <version> (<date>)` per release, its date the day of its commit in `core.timeZone`; under it `###` per day and `####` per kind, as above. A release with no ticket says `No merged ticket in this release.`
- A ticket belongs to the first release at or after its merge commit (the hash of its `- Merged:` line) on that line, so a release ticket's own merge, `Release <version>` (`arthur version --help`), writes its release's section, its ticket in it. A ticket without a hash, or whose hash is not on the line, belongs to the first release made on its day or later.
- `## Unreleased` holds the tickets after the newest release, and is left out when there is none.
- `.github/workflows/release.yml` takes a release's section, up to the next `## ` heading, as the notes of its GitHub release.

The same board, files and history give the same file byte for byte: nothing in it depends on when it was written or the order the files are read in.

Refused: any word but `--project <name>` prints the usage line and exits 2; an unknown project is the core's refusal, naming the known ones.
