# arthur health

Usage: `arthur health`; on a channel `/health`. Comes with the `manage` plugin (roadmap entry 60). Answered without the model, for every project at once (`--project` changes nothing).

One line per thing that should have happened by now and has not, from every plugin that answers `health`, in setup order, manage's own checks among them:

```
AR0012 is in-progress with no job in a run for 3 h: Health checks
arthur: main has 2 commits not pushed to origin/main, the oldest made 5 h ago
arthur: the board has changes not committed for 2 h: spec/build.json and 1 more
the temporary folder /tmp has 6% of its space free: 7.5 GB
/home: 4% of its filesystem's inodes free, 330112 of 8323072
github: health failed: no answer from the API
```

With nothing wrong, one line says so: `All well: nothing that should have happened by now is missing.`

Manage's own checks, each for every project of the project list:

- A stalled ticket: `in-progress` or `review`, no job in a run (working, idle or held) names it on a `Ticket:` line, and an hour has passed since its last move and since the newest of its jobs took its state (a job that ended 20 minutes ago counts from then).
- Main not pushed: the checkout's branch is ahead of its upstream, and the oldest of its own commits (its first-parent line, so a merged branch's older commits count as the merge) was made an hour ago or more. The upstream is the one Git fetched last; nothing is asked of the remote. A detached HEAD, or a branch with no upstream, has nothing to push to and no line.
- A board uncommitted for an hour: `spec/build.json` or a file under `spec/features/` changed, or new and untracked, and the oldest such file was written an hour ago or more. A deletion alone has no time and no line.
- A temporary folder full: the system's temporary folder (`TMPDIR`, else `/tmp`) has under 10% of its space free.
- Low inodes: the filesystem of the temporary folder, of Arthur's home or of a project's folder, each filesystem once, has under 10% of its inodes free; a filesystem that counts none has none to run out of.

A line of another plugin is its answer as given: a line, or a list of lines, each trimmed, blank ones and anything that is not text left out. A plugin whose answer throws costs its own line only: `<plugin>: health failed: <the error's first line>`. One of manage's own checks that throws does the same, naming what it could not check: `manage: the board of <project> could not be checked: git status failed in <folder>`; the other checks still answer. The project list missing costs every project's line: `manage: the projects could not be checked: <why>`.

It reads only: nothing is fixed, moved, committed or written, not even the record of what `health.everyMinutes` sent. More than nothing after the command prints `usage: arthur health` and exits 2; `/health` with any text answers `usage: /health`.

The rounds under `arthur run` (`health.everyMinutes`): `docs/manage.md` of the `manage` plugin.
