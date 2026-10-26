# AR0440 - A job can read the running Arthur process's secrets from /proc/<pid>/environ

```json
{
  "id": "AR0440",
  "title": "A job can read the running Arthur process's secrets from /proc/<pid>/environ",
  "date": "2026-10-25"
}
```

## Description

From AR0338's review (2026-10-25-review-88629edb, a note outside its range): a job runs as the same user as `arthur run` and the coordinator, so it can read `/proc/<pid>/environ` of those processes, and so every `ARTHUR_` secret they hold, whatever its own environment is. The reviewer saw a process with an empty environment read another same-user process's `/proc/<pid>/environ`, a test token included. The sandbox (`packages/core/src/job-sandbox.ts`, Landlock) limits writes only. AR0337 and AR0338 keep secrets out of a job's own environment and records; this path goes around both.

## Goal

A job cannot read the environment of Arthur's own processes.

- Kind: security
- Plan: yes

## Done means

- A plan first: the ways to close it (a `hidepid` mount of `/proc`, which is system config the owner sets; jobs as another user; Arthur's processes clearing secrets from their environment once loaded and holding them in memory only; a Landlock read rule on `/proc/<pid>` where the kernel allows it), what each costs, and a recommendation. The owner picks one before a worker starts.
- Then: a test where a job's command reads `/proc/<arthur run's pid>/environ` and gets no secret.

## Scope

In:
- To be set by the plan.

Out:
- Secrets in the env file on disk, which the env guard covers.

## Decisions

- 2026-10-26: Source: AR0338's review note (outside its range)
