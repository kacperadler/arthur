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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-26: Source: F1 of AR0354
