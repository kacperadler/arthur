# The manage plugin

Managing Arthur itself. Built so far: roadmap entry 60, health: `arthur health` and `/health`, one line per thing that should have happened by now and has not, and, while `arthur run` runs, the same checks every `health.everyMinutes` with their new lines sent as a `notice`; entry 61, stats: `arthur stats`, how a project's merged tickets went, from their review files, `outcome.md` and board entries (`arthur stats --help`); entry 64, the daily prune of `prune.keepJobsDays`: old ended jobs and Arthur's old temporary folders. The audit and the retro are entries 62 and 63.

```ts
plugins: [
	orchestration({}),
	projects({ list: [{ name: "arthur", prefix: "AR", path: "." }] }),
	schedule({}),
	manage({ health: { everyMinutes: 30 }, prune: { keepJobsDays: 14 } }),
],
```

## Options

- `health.everyMinutes`: a whole number of minutes, 1 or more, between two rounds of the checks under `arthur run`. Left out: no round; `arthur health` and `/health` still answer.
- `prune.keepJobsDays`: a whole number of days, 0 or more: an ended job is kept that long before the daily prune frees it; 0 frees every ended job at the next prune. Left out: no daily prune, and no temporary folder removed.

Refused at load, with the option's path: an unknown option or key, `health` or `prune` not an object, `health.everyMinutes` below 1 or not whole, `prune` without `keepJobsDays`, `prune.keepJobsDays` below 0 or not whole. `prune` with the schedule plugin not loaded (left out of `plugins`, or `enabled: false`) refuses the load too: `plugin manage: setup failed: prune.keepJobsDays needs the schedule plugin, which runs the daily prune; add schedule() to the config's plugins, or leave prune out`.

## The checks

Manage answers `health` (docs/plugin-api.md, "Provided names") with its own checks: a stalled ticket, main not pushed, a board uncommitted for an hour, a temporary folder full, low inodes. What each one looks at, and the words of each line: `arthur health --help`. Every other plugin that answers `health` adds its lines; session's `Restarted.` notice lists the same lines (`arthur restart --help`).

## The rounds

With `health.everyMinutes`, `arthur run` runs the checks at its start and then once that many minutes have passed by the host's clock. A round sends only its new lines, all in one `notice`:

```
Health:
- AR0012 is in-progress with no job in a run for 3 h: Health checks
- github: health failed: no answer from the API
```

A line is new unless the round before saw the same problem: the same line with its numbers left out, so a ticket an hour more stalled, a count that grew or a share that changed is not sent again. A problem gone for one round and back is sent again. A round with no new line sends nothing.

What the last round saw is kept in `.arthur/manage/health.json`, written to a temporary name and renamed after the notice went out, so a problem is never lost to a failed write, and the first round after a restart sends none the last round before it saw. A file that is not what the plugin writes (broken, edited by hand) is taken as nothing seen, so the next round sends every line once. A round that fails prints `manage: the health round failed: <reason>` on stderr, and the next one runs on time.

## The daily prune

With `prune.keepJobsDays`, manage registers one entry with the schedule plugin, `manage.prune`, every day at 03:00 in `core.timeZone`, running manage's own code (`arthur schedule list` shows it). The schedule runs each slot once; a day whose 03:00 passed while `arthur run` was down runs once at its next start, late, never once per missed day (`arthur schedule --help`, "The sweep"). Each run does two things, the second even when the first fails:

1. Every job that ended `keepJobsDays` days ago or longer, by the time of its last state change, is freed as `arthur prune <id>...` frees it: its worktree, its branch and its record, as far as Git finds it safe and no plugin's `jobs.keep` keeps the record (`arthur prune --help`). A job in a run, held, or blocked is never one of them, nor one whose record's time does not read. Each job's line is printed as `manage: prune: <id>: <what was done>`.
2. Every folder right in the system's temporary folder (`TMPDIR`, else `/tmp`) whose name starts with `arthur-`, such as the `arthur-test-*` folders the test kit leaves when a test run is killed, is removed with everything inside when it was last changed more than a day ago. A file or a link of that name is left, and a link is never followed. A folder made since a job's run began, while that run goes on, is kept, however old: the cut moves back by the time each job in a run has spent in its runs, a continued job's earlier runs counted too, which puts it before the start of every run in progress. A folder that another user owns is kept, `manage: kept <path>: user <uid> owns it, not Arthur's user <uid>`; one that cannot be removed whole is kept with the reason, `manage: kept <path>: <reason>`. A run that removed any prints `manage: removed <n> temporary folders of Arthur's from <folder>` first.

A run with nothing to free prints nothing. A part that fails, the jobs unreadable or the temporary folder gone, does not stop the other; the run then fails naming each, `the prune of old jobs: <reason>` or `the temporary folders: <reason>`, which the schedule prints and sends as one `notice` (`schedule: manage.prune: its run failed: ...`), and the next try is the next day.
