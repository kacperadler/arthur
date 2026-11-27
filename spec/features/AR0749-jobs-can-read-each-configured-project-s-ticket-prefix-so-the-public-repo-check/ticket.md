# AR0749 - Jobs can read each configured project's ticket prefix, so the public-repo check works inside a job

```json
{
  "id": "AR0749",
  "title": "Jobs can read each configured project's ticket prefix, so the public-repo check works inside a job",
  "date": "2026-11-27",
  "budget": 8.6
}
```

## Description

A job's sandbox hides every other project's `project.config.ts`, so nothing a job can read holds the other projects' ticket prefixes. After this change the projects plugin publishes one `<name> <prefix>` line per configured project in a home file that the sandbox shows to jobs, so AR0744's check can refuse other projects' ids in a job's own commits too.

## Goal

The owner chose Option 1 of the AR0744 plan (AR-D737): job commits are checked fully, not passed with a warning. That needs the prefixes readable in a job first, merged and restarted before AR0744's worker runs.

Evidence (AR0744 plan.md, "Not available directly"):

- `packages/core/src/job-sandbox.ts:103-120`: `hidden()` hides `projects/<other>/` from jobs; `cat` gave "Permission denied" and `import()` gave `EACCES` for all four other configs.
- `packages/projects/src/projects.ts:54-55`: the only home files a job may read, `<home>/projects/checkouts` and `folders`, hold names and paths only.
- A job's env has only `ARTHUR_JOB`, `ARTHUR_GUARDED` and `ARTHUR_INSTALL`.

- Kind: security
- Plan: yes

## Done means

1. The projects plugin writes `<home>/projects/prefixes`, one `<name> <prefix>` line per configured project, written to a temporary name and renamed, at start and whenever the project list changes; a test in `packages/projects/test/` reads it back and fails on main.
2. A job's sandbox can read that file and still cannot read any other project's `project.config.ts`; a test in `packages/core/test/` fails on main.
3. A prefix that does not match `^[A-Z]+$` is never written; a test row covers it.
4. The plugin's and the core's docs name the file and what a job may read.
5. `npm test` and `npm run check` pass.

## Scope

In:
- `packages/projects/src/`: write the prefixes file.
- `packages/core/src/job-sandbox.ts`: show that file to jobs.
- Their tests and docs; the planner names each file.

Out:
- The check itself and the rewording of tracked files: AR0744, which waits for this ticket.

## Decisions

- 2026-11-27: Source: AR0744 plan, Option 1, chosen by the owner (AR-D737)
