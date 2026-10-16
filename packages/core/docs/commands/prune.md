# arthur prune

Usage: `arthur prune [<id>...]`

Frees what ended jobs hold: their worktree, their branch and their record `<home>/jobs/<id>/`. Every job without ids, else the jobs named, each by its full or short id; an id that names no job, or a short id that matches two, refuses the whole prune before anything is removed. Prints one line per job, `<id>: ` and what was done or kept, e.g. `<id>: worktree <path> removed; branch arthur/<id> deleted; record deleted`; `no jobs` when there is none.

Git decides what is safe, and what it refuses is kept, with the first line of what Git said:

- The worktree is removed with `git worktree remove`, without `--force`: one with changes or untracked files stays, and so do the branch and the record (`kept its worktree, branch and record: git worktree: fatal: ...`). A worktree already gone is pruned from Git's list.
- The branch is deleted with `git branch -d`: one with commits that HEAD of the repository does not have stays, and so does the record (`kept branch <branch> and the record: git branch: error: the branch '<branch>' is not fully merged`). Its worktree is removed all the same; a later prune, once it is merged, deletes the branch and the record. A read-only kind has no branch.
- A job that has not ended is kept: `kept: it is <state> (<reason>), not ended`, for example `working` or `blocked (user: <question>)`; `arthur stop` a job in a run first, and a blocked one keeps its worktree for `arthur continue`.
- A plugin may keep a record: the core asks every plugin that provides `jobs.keep`, with the job (`id`, `kind`, `project`, `task`, `state`, `reason`, `branch`, `worktree`, `branch` empty for a read-only kind). Each answer that is a text is a reason to keep the record; the worktree and branch are freed all the same, and the line ends `kept the record: <reasons>`. A provider that throws ends the prune there with its error, exit code 1; the job it was asked about keeps its record.

The exit code is 0 whatever was kept. Refused (exit code 1, the reason after `arthur prune: `): an unknown id (`<id>: no such job in <home>/jobs`), a short id that matches two jobs (`<id> matches 2 jobs: <id>, <id>; name one by its full id`), a config or a plugin that does not load. A flag prints the usage line and exits 2.
