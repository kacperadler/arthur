# AR0627 - No client or other project of the owner named in the repository, and a check that refuses a commit naming one

```json
{
  "id": "AR0627",
  "title": "No client or other project of the owner named in the repository, and a check that refuses a commit naming one",
  "date": "2026-11-04"
}
```

## Description
Arthur's repository is public. The vision says no committed file names a client, another project of the owner, its folders or the work done for it, but nothing enforces it: a client project's name is in three tracked files today and the owner's other site in twelve. This ticket removes them and adds a check so it cannot happen again (AR-D498).

## Goal
Evidence: `git grep -il` for the names of the projects in the git-ignored `projects/` folder, other than `arthur`, lists `spec/decisions.jsonl`, `spec/features/AR0604-*/plan.md`, `spec/features/AR0618-*/ticket.md` (client) and twelve files for the owner's other site, `spec/schedule.json` among them (found by the AR0621 worker as F1). The vision rule "What reaches GitHub is about Arthur alone" has no check behind it.

- Kind: security

## Done means
- No tracked file of Arthur names a project of `projects/` other than `arthur` (its name, its folder, its path, its repository); each mention is reworded with a made-up name or moved to the git-ignored side (a schedule entry that needs a project name lives outside the committed files).
- One check, run by `npm test` and by `arthur merge` on main and on every commit Arthur makes in its own repository (the coordinator's spec commits, a merge, a job's commit), refuses a file or commit message that names such a project, and says which file and which project; the names come from `projects/` at run time and never appear in the check's code, tests or messages.
- A test with a made-up project folder fails when the check is removed.
- The project's checks pass.

## Scope
In:
- The tracked files that name such a project: reworded or moved.
- The check and where it runs (the merge gate, the commit path of the coordinator's spec commits, a job's commits), each named in the worker's final message.
- `docs/deploy.md` or the setup doc: one line on the check.

Out:
- Rewriting the published Git history: a separate decision of the owner.
- Other projects' repositories.

## Decisions
- 2026-11-04: Rewrite the published history once no Arthur job runs: the client name replaced in every old commit, main force-pushed, open job branches rebuilt; the owner: "AR-D499 - 1" (AR-D499)
