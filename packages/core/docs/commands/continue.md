# arthur continue

Usage: `arthur continue <id> <instruction> [--budget <usd>]`

Resumes an ended job that has a branch of its own, a worker for example, in place, with one more instruction as one quoted argument, and prints `<id>: continued`; the job is named by its full id or its short id, as `arthur jobs` shows it. It keeps the id, the record, the branch and the worktree, and the agent continues its last session there: the wrapper starts again (see `arthur spawn --help`) and runs `<agent> --continue ... <instruction>` in place of `@<record>/task`. The instruction is in the record as `continue`, and the log says `arthur continue: <first line>`. `arthur continue` returns once the wrapper wrote its `pid` and its state says `running`, or the wrapper is gone; `job-ended` comes again at the new end. A wrapper that does not start ends the job `failed` as at a spawn (see `arthur spawn --help`), and `arthur continue` prints `<id>: failed: <reason>` on stderr and exits 1.

- `--budget <usd>`: replaces the job's `budget`, a plain decimal of 0 or more (`0` is no limit). The record's `cost` counts on from the runs before, so a job that ended at its budget is stopped again at once without a higher one.
- The `timeout` stays the job's and counts from the new start.
- Before the wrapper starts, `job-started` is emitted again as at a spawn, with the record's `id`, `kind`, `project`, `root`, `branch`, `worktree` and `tickets`: a worker's tickets in `review` or `done` move back to `in-progress`, one already there is not written, and other kinds move none (see `arthur spawn --help`).
- `commits` at the end lists the branch's commits since the job's first `base`, every run's together; `result`, `tool-calls` and `activity` are the new run's.
- When the job's wrapper is still writing its end, it waits up to 5 seconds for it to exit, since the new one starts in a scope of the same name.

Refused (exit code 1, the reason after `arthur continue: `):

- An id with no record in `<home>/jobs/`: `<id>: no such job in <home>/jobs`.
- A short id that matches two jobs: `<id> matches 2 jobs: <id>, <id>; name one by its full id`.
- A running job, or one whose wrapper has not written its state yet: `<id> is running; a running job is not continued, arthur steer gives it a correction` (`not started yet` in place of `running` for the latter).
- Another `arthur continue` of the same job, from before it reads the job's state until its new wrapper says `running` or the continue fails: `<id>: being continued`. That continue holds the file `<home>/jobs/<id>/continuing`, which names its pid (and, on Linux, its boot) meanwhile; one left by a continue that was killed, whose pid is dead or from an earlier boot, is taken over by the next continue.
- A read-only kind, which has no branch of its own: `<id> is a <kind>, a read-only kind without a branch of its own; only a job with a branch is continued`.
- A job whose worktree is gone, as `arthur prune` leaves one whose branch has commits Git refuses to delete: `<id>: its worktree was pruned; spawn a new job on its branch <branch>`. The branch keeps the work: a new worker starts from HEAD on a branch of its own, so its task names `<branch>` to merge or build on. Nothing in the record is written.
- An empty instruction: `the instruction is empty`.
- A plugin's `beforeSpawn` check, run on the job as its record has it (its `task` and the `Ticket:` files it names, `kind`, `project`, `model`, `thinking`, `timeout`, and the `--budget` or else its `budget`), that gives a reason: `refused by <plugin>: <reason>`; one that throws: `plugin <plugin>: beforeSpawn failed: <message>`. The core's own check refuses a worker whose ticket cannot move to in-progress, a `merged` one for example, as at a spawn (see `arthur spawn --help`). A refused continue starts nothing and leaves the record as it was.
- A config or a plugin that does not load: `arthur.config.ts did not load:`, then the reasons.

Wrong usage (not one id and one instruction, an unknown flag, `--budget` without a plain decimal or given twice) prints the usage line and exits 2.
