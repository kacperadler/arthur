# AR0443 - A job's scope marks it only for a home that holds its record, so a config of the job's own is a coordinator's

```json
{
  "id": "AR0443",
  "title": "A job's scope marks it only for a home that holds its record, so a config of the job's own is a coordinator's",
  "date": "2026-10-26"
}
```

## Description

F1 of AR0354 (spec/features/AR0354-the-mark-that-tells-a-job-from-the-coordinator-is-a-variable-the-job-s-shell-clears/findings.md).

- Kind: security
- Found by: 2026-10-26-worker-f7deae1c (worker), 2026-10-26
- Where: `packages/core/src/inside-job.ts:11`
- What: every job's `npm test` runs inside its scope (`/proc/self/cgroup` of this job: `.../arthur-jobs.slice/arthur-job-2026-10-26-worker-f7deae1c.scope`), and the tests run the CLI and the plugins' commands as a coordinator in a home of their own. So `insideJob(home)` takes the scope as the mark only when `<home>/jobs/<id>` exists; else it falls back to `ARTHUR_JOB`. A steered job can do what a test does: write an `arthur.config.ts` in its temporary folder with a home of its own and the real projects, clear `ARTHUR_JOB`, and run `arthur youtrack issue create ...` or `arthur ci <branch> --rerun` with the token of the env file named in that config, which the sandbox leaves readable (docs/deploy.md: "nothing confines reads"). The same holds where no config loads (`home` undefined in cli.ts). File writes stay bound by the sandbox. [INFERENCE] not probed: whether the env guard refuses the write of a config that names the env file; nothing was run against YouTrack or GitHub.
- Suggestion: AR0320 F1's sandbox that keeps a job out of the config folder and its env file, which this ticket's Scope puts out; until then the threat model says it (docs/deploy.md, "Threat model"). Out: refusing the scope's id in any home, which fails every job's own `npm test` (cli.test.ts, decisions.test.ts and the others that run a command as the coordinator).

## Goal

A job cannot use the tokens of Arthur's env file by writing a config with a home of its own and running `arthur` as a coordinator there. Evidence: `packages/core/src/inside-job.ts:11` counts the job's scope as the mark only when `<home>/jobs/<id>` exists, and the sandbox leaves the env file readable (`docs/deploy.md`, threat model: "nothing confines reads").

- Kind: security
- Plan: yes

## Done means

- A plan first, together with AR0440's: both are a job reading what Arthur's processes and files hold, and one choice (jobs as another user, a read rule of the sandbox on the config folder and the env file) may close both. The owner picks before a worker starts.
- Then: a test where a job's command, with a config and home of its own and `ARTHUR_JOB` cleared, cannot read a token of the real env file; `npm test` and `npm run check` pass.

## Scope

In:
- To be set by the plan.

Out:
- Refusing the scope's id in any home, which breaks every job's own `npm test`.

## Decisions

- 2026-10-26: Source: F1 of AR0354
