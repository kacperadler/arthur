# AR0734 - The coordinator commits with --no-verify, so the check that keeps other projects out of the public repository never sees its commits

```json
{
  "id": "AR0734",
  "title": "The coordinator commits with --no-verify, so the check that keeps other projects out of the public repository never sees its commits",
  "date": "2026-11-24"
}
```

## Description

The coordinator and the project agents commit the board and the decision log themselves, and their role files never say not to skip Git's hooks, so they often use `--no-verify`. That skips AR0627's `commit-msg` check, which is what keeps the owner's other projects out of Arthur's public repository; one such commit already pushed three project names to GitHub. This ticket adds the rule to both role files and files the `arthur commit-board` step of AR0667's plan as its own ticket.

## Goal

No commit the coordinator or a project agent makes skips the repository's hooks.

Evidence (audit `spec/quality/2026-11-24.md`, proposal 1):
- `git branch -r --contains 34d2eb9a` lists `origin/main`: the AR-D702 `ask` record naming three other projects is in the public history; 9339d9c4 later reworded the line on main.
- In the coordinator's session log of 2026-11-22/23, 80 of 139 `git commit` commands carry `--no-verify`, among them commits in Arthur's own repository (34d2eb9a included).
- Without `--no-verify` the hook refused a commit that named a project (`Schedule: retry two reviews at 20:45`), and the coordinator reworded it (72d960d3).
- `packages/core/roles/worker.md:44` says "Never commit with `--no-verify`"; `packages/orchestration/roles/coordinator.md:35` and `roles/project.md:30` say only "Commit `spec/decisions.jsonl` with the board".
- AR0667's plan, step T2 (`arthur commit-board`, which runs the project's `commit-msg`), has no ticket on the board.

- Kind: security

## Done means

- `packages/orchestration/roles/coordinator.md` and `packages/orchestration/roles/project.md` each say, beside the commit line: never commit with `--no-verify` or with hooks turned off, and a commit the hook refuses is reworded, never forced.
- A new planning ticket carries AR0667's T2 (`arthur commit-board`), naming the plan as its source; this ticket's final message names its id.
- The question whether to rewrite 34d2eb9a out of the public history is raised for the owner in this ticket's final message; the owner already answered it once (AR-D711: leave the history), so it is only noted, not redone.
- The project's checks pass.

## Scope

In:
- `packages/orchestration/roles/coordinator.md`: one line.
- `packages/orchestration/roles/project.md`: one line.
- The new ticket for AR0667's T2.

Out:
- AR0667's sandbox steps T3 to T5.
- Rewriting Git history.

## Decisions

- 2026-11-24: Source: audit spec/quality/2026-11-24.md
- 2026-11-24: Source: F2 of AR0713
- 2026-11-24: AR0734 approved: the coordinator and project roles never commit with --no-verify, and AR0667 T2 gets its own ticket; the owner: "AR-D716 1, AR-D717 1, another project's decision 1, another project's decision 1, AR-D718 1, AR-D719 1, AR-D720 1, another project's decision 1, another project's decision 1, another project's decision 2, another project's decision 2" (AR-D719)
