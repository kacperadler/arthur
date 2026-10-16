# arthur continue

Usage: `arthur continue <id> <instruction> [--budget <usd>]`

Resumes an ended job that has a branch of its own, a worker for example, in place, with one more instruction as one quoted argument, and prints `<id>: continued`. It keeps the id, the record, the branch and the worktree, and the agent continues its last session there: the wrapper starts again (see `arthur spawn --help`) and runs `<agent> --continue ... <instruction>` in place of `@<record>/task`. The instruction is in the record as `continue`, and the log says `arthur continue: <first line>`. `arthur continue` returns once the wrapper wrote its `pid`; `job-ended` comes again at the new end. A wrapper that does not start ends the job `failed` as at a spawn (see `arthur spawn --help`), and `arthur continue` prints `<id>: failed: <reason>` on stderr and exits 1.

- `--budget <usd>`: replaces the job's `budget`, a plain decimal of 0 or more (`0` is no limit). The record's `cost` counts on from the runs before, so a job that ended at its budget is stopped again at once without a higher one.
- The `timeout` stays the job's and counts from the new start.
- `commits` at the end lists the branch's commits since the job's first `base`, every run's together; `result`, `checks`, `tool-calls` and `activity` are the new run's.
- When the job's wrapper is still writing its end, it waits up to 5 seconds for it to exit, since the new one starts in a scope of the same name.

Refused (exit code 1, the reason after `arthur continue: `):

- An id with no record in `<home>/jobs/`: `<id>: no such job in <home>/jobs`.
- A running job, or one whose wrapper has not written its state yet: `<id> is running; a running job is not continued, arthur steer gives it a correction` (`not started yet` in place of `running` for the latter).
- A read-only kind, which has no branch of its own: `<id> is a <kind>, a read-only kind without a branch of its own; only a job with a branch is continued`.
- An empty instruction: `the instruction is empty`.
- A config or a plugin that does not load: `arthur.config.ts did not load:`, then the reasons.

Wrong usage (not one id and one instruction, an unknown flag, `--budget` without a plain decimal or given twice) prints the usage line and exits 2.
