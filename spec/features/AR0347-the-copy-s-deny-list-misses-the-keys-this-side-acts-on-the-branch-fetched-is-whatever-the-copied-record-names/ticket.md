# AR0347 - The copy's deny-list misses the keys this side acts on: the branch fetched is whatever the copied record names

```json
{
  "id": "AR0347",
  "title": "The copy's deny-list misses the keys this side acts on: the branch fetched is whatever the copied record names",
  "date": "2026-10-23"
}
```

## Description

the rule: what comes back lands only in that job's record and branch (`spawn.md:61`: "its branch is fetched into the main checkout, `+refs/heads/arthur/<id>`"). The check missing: `OWN` (`:25`) keeps only `root`, `machine`, `state`, `reason`, `since` and `ran`; `arthur remote-job records` sends every other file of the record there changed since the time asked (`remote-job.ts:100-106`), so `branch`, `project`, `kind`, `task`, `worktree`, `base`, `prompt`, `timeout`, `idle-minutes`, `hold`, `pid` arrive from the machine and overwrite the spawn's values here (`:62`). Then `:68-69` reads `branch` and `project` from that record and builds `git fetch <ssh>:<home>/repos/<project>.git +refs/heads/<branch>:refs/heads/<branch>`: `branch` may name any branch of `root`, and `+` force-updates it from whatever the repository there holds when no worktree has it checked out (git 2.43.0 in a temporary repository: a forced fetch into a free branch moved it; into a branch checked out in a worktree, and `+refs/heads/*:refs/heads/*` with `main` checked out, it refused whole) — an ended worker's `arthur/<id>` waiting for its merge, a branch kept after its prune, any branch of the project no job holds; `project` chooses which repository there. `prune` deletes the `branch` the record names (`job-records.ts:145,159`), `job-state` names the ticket of the copied `task` (`job-state.ts:74`), `job-ended` carries the copied `kind` and `project` (`:79`) to the plugins that act on them. Confirms AR0311's F3 (`:25`, `:69`).

## Goal

The copy back from another machine takes only the files the run writes (an allow-list), and fetches only `arthur/<id>`, never a branch the copied record names; tested.

- Kind: risk

Evidence:
- `packages/core/src/machine-sync.ts:25,62,68-69`, `packages/core/src/job-records.ts:145,159`, `packages/core/src/job-state.ts:74`
- Found by: 2026-10-23-ar0321-security-check-c2599b95 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: turn `OWN` into an allow-list of the run's files, those the wrapper and the steps there write (`pid`, `active`, `log`, `cost`, `tool-calls`, `activity`, `result`, `commits`, `budget`, `continue`; the caps written by `remote-job continue` are written here too by `job-control.ts:97-98`), and copy nothing else; at `:68-69`, fetch `arthur/<id>` only, refusing the copy when the record's `branch` is neither empty nor that. Update `spawn.md:61`, which lists the deny-list. Tests: a `records` answer whose `files` carry a `branch`, `project`, `task` and `kind` that differ from the record's leaves the record's values and fetches `+refs/heads/arthur/<id>` only (the fake `ssh` log shows the refspec); a record whose `branch` names another branch of `root` is refused and that branch's tip is unchanged; the honest end (:81) still brings `result`, `cost`, `commits`.
- `npm test` and `npm run check` pass.

## Scope

In:
- turn `OWN` into an allow-list of the run's files, those the wrapper and the steps there write (`pid`, `active`, `log`, `cost`, `tool-calls`, `activity`, `result`, `commits`, `budget`, `continue`; the caps written by `remote-job continue` are written here too by `job-control.ts:97-98`), and copy nothing else; at `:68-69`, fetch `arthur/<id>` only, refusing the copy when the record's `branch` is neither empty nor that. Update `spawn.md:61`, which lists the deny-list. Tests: a `records` answer whose `files` carry a `branch`, `project`, `task` and `kind` that differ from the record's leaves the record's values and fetches `+refs/heads/arthur/<id>` only (the fake `ssh` log shows the refspec); a record whose `branch` names another branch of `root` is refused and that branch's tip is unchanged; the honest end (:81) still brings `result`, `cost`, `commits`.

## Decisions

- 2026-10-23: Source: F2 of AR0321
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
- 2026-10-23: The owner: weekly cap raised to 40%; fixes one at a time to avoid conflicts, criticals first (AR0329, AR0346), then highs (AR0330, AR0331, AR0347, AR0349, AR0353, AR0370).
