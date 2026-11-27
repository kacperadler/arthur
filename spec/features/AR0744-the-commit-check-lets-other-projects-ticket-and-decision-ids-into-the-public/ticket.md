# AR0744 - The commit check lets other projects' ticket and decision ids into the public repository

```json
{
  "id": "AR0744",
  "title": "The commit check lets other projects' ticket and decision ids into the public repository",
  "date": "2026-11-27",
  "budget": 8.6
}
```

## Description

The check that keeps the owner's other projects out of Arthur's public repository knows only their folder names, so their ticket ids and decision ids pass it in files and in commit subjects. After this change the check refuses those ids too, with each project's prefix read when it runs, and the ids already tracked are reworded.

## Goal

The repository is public, and every `arthur commit-board` and merge now runs this check. The check passes the owner's other work as long as it is written as ids rather than names, and that is already on GitHub. The vision says no committed file names another project of the owner or the work done for it.

Evidence (audit 2026-11-27):

- `test/other-projects.ts:23-27,47-50`: the check only knows the folder names under `projects/`, matched as written or as a slug. It never learns a project's ticket prefix, so ids like `<prefix>0150` or `<prefix>-D156` pass.
- A `git grep` for the four other projects' prefixes followed by `-D<n>` or four digits lists 19 tracked files at 99b36475: 13 under `spec/features/` (the owner's quoted answers in Decisions), plus `spec/decisions.jsonl` (21 lines), `spec/schedule.json` (3 lines), `spec/quality/2026-11-24.md:30` and `spec/retro/2026-11-11.{md,html}`.
- `spec/schedule.json:130` (commit bc7d8002, on `origin/main`) lists another project's pending merges by decision id, its workers by ticket id, a file count and a budget.
- 99b36475 (not pushed yet) adds the `project-daily` entry (`spec/schedule.json:134`), whose procedure path is spelled with another project's prefix.
- 72d960d3: after the hook refused a project's name, the coordinator put that project's ticket id and worker id in its place.
- 2 commit subjects since the last audit name another project's ticket.

- Kind: security
- Plan: yes

## Done means

1. A commit that adds a file holding another project's ticket id (`<prefix>` and 4 or more digits) or decision id (`<prefix>-D<n>`) is refused by the commit-msg check, naming the file and line; a new test in the check's test file commits such a file in a fixture repository and fails on main.
2. A commit subject or body holding such an id is refused the same way, with its own test row.
3. The prefixes are read when the check runs, from the configured projects, never written into the code; Arthur's own prefix and the test fixtures' prefixes (AC, SH, DM, BL) are not refused, with a test row for Arthur's own id.
4. Run in a job's sandbox, where `projects/*/project.config.ts` cannot be read, the check still learns the prefixes or refuses to pass silently; the plan names how, and a test covers that path.
5. The `git grep` of the Goal, with the real prefixes, lists no tracked file at the branch's tip.
6. `npm test` and `npm run check` pass.

## Scope

In:
- `test/other-projects.ts`: refuse each other project's ticket and decision ids in files and commit messages, prefixes read at run time.
- The check's test file: the rows of Done means 1 to 4.
- The tracked files the Goal lists: reword each mention without the id.
- The planner picks how the check learns the prefixes. A job's sandbox refused reads of `projects/*/project.config.ts` in this audit (EACCES), so the current folder-name method does not carry over as is.

Out:
- Rewriting the published history: the owner's call, as in AR-D499.
- Moving the cross-project schedule out of `spec/`: a question for the owner, raised in the plan.

## Decisions

- 2026-11-27: Source: audit spec/quality/2026-11-27.md
- 2026-11-27: Plan the ticket again: Option 1, a separate ticket first lets jobs read the other projects prefixes, and AR0744 checks job commits fully against them; the owner: "AR-D737 option 1" (AR-D737)
- 2026-11-27: Plan approved by the owner: plan.md at 5b673802; the owner: "AR-D738 yes" (AR-D738)
