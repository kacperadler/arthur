# arthur remote-job

Usage: `arthur remote-job repo|add|launch|remove|records <home> [args]`

The half of a job on another machine that runs on that machine. The main Arthur runs it there over `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes <ssh>` (see `arthur spawn --help`); a person has no reason to. `<home>` is the machine's `home` as registered, an absolute path: Arthur's home folder there, with the job records in `<home>/jobs/`, the projects' repositories in `<home>/repos/` and the job worktrees in `<home>/repos/.arthur-worktrees/`. It needs no config there.

- `repo <home> <project> <commit>`: creates `<home>/repos/<project>.git`, a bare repository, when it is not one yet, and prints `present` when it holds the commit, else `missing`; the main Arthur then pushes the commit to `refs/arthur/base`. A project name with a `/` or starting with `.` is refused.
- `add <home>`: reads the job as JSON on stdin (`job`, its `root` the repository there; `prompt`; `resumeOnBudget`; `idleMinutes`; `since`), adds its worktree there from its `base`, on its branch or detached, and writes its record as `arthur spawn` does; a record that cannot be written removes the worktree again.
- `launch <home> <id> <agent> <slice> <cpu> <memory>`: starts the job's wrapper there as `arthur spawn` does here, in the scope `arthur-job-<id>.scope` of the slice `<slice>` with `<cpu>` cores and `MemoryMax` `<memory>`, and returns once it wrote its `pid`. When the wrapper did not start, the job there is ended `failed: <why>` and `<why>` is printed.
- `remove <home> <id>`: removes the job's worktree, its branch and its record there.
- `records <home> <id>=<ms>...`: one JSON object, by id, of each named job whose record exists there: its `state`, `reason` and `since`, read first under the record's lock, then `files`, every file of the record modified at `<ms>` (milliseconds since 1970, the machine's clock) or later, and `at`, the newest modification time of any file of the record, which the next copy asks from.

Wrong usage (an unknown step, a home that is not an absolute path) prints the usage line and exits 2; a step that fails prints `arthur remote-job: <why>` and exits 1.
