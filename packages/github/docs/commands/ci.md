# arthur ci

Usage: `arthur ci <branch> [--rerun] [--project <name>]`. Comes with the `github` plugin, `github({ instances })` in `arthur.config.ts` (`packages/github/docs/github.md`).

Tells the run of the project's `ci.workflow` that built a branch of its checkout, and why it failed; `--rerun` reruns it once. The project is the main one unless `--project` names another; the branch is one of its checkout's, `main` or a job's `arthur/<job id>`.

## The run

The run that built the branch is the one the poll tells as `ci-finished` and `arthur merge --auto` counts (roadmap 59): the newest run, among the workflow's 100 newest, of the nearest commit on the branch's first-parent line that has one, from its tip back at most 1000 commits. A commit that touches no path the workflow watches has no run, so the run before it counts. First line, then the run's page:

`run <id>, attempt <n>, of <workflow> on <commit> (<branch>'s tip | <branch>, <k> commits below its tip): <conclusion or status>`

A run still `queued` or `in_progress`, or one that passed, ends there, exit 0. A run that failed (`failure`, `timed_out`, `startup_failure`) or was `cancelled` goes on with why, read from its attempt's jobs:

- one line per failed job: `job <name>: <conclusion>, step <n>, <step name>, failed`, or `no step failed` when it failed outside a step; `no job of it failed: it ended before one ran` when none did;
- the log of the first failed job, without the time at the start of each line: its last 30 lines up to its last `##[error]` line, or up to its end when it has none, each cut at 300 characters. A longer log says so: `the log of job <name>, its 30 lines up to its last error of <total>:`.

## `--rerun`

Prints the run's line, then asks GitHub to rerun the whole run ("Re-run a workflow"), its failed and cancelled jobs with the rest, and prints `rerun of run <id> asked: its attempt <n + 1> is told as ci-finished when it ends`, exit 0; why it failed is not told. The rerun keeps the run's id, so the poll tells its end as a new attempt. Arthur reruns a run once: the run's id goes into `.arthur/github/reruns`. The token needs Actions: read and write.

## Refused

Exit 1, one line `arthur ci: <why>`, nothing asked of GitHub past the refusal:

- A project without `ci.workflow`: `project <name> has no ci.workflow, so github watches no run of it`.
- A branch the checkout lacks: `no branch <branch> in <folder>`.
- No run built it: `no run built <branch>: none of its last 1000 commits has one among the <n> newest runs of <workflow>`.
- `--rerun` of a run not finished: `run <id> is <status>, not finished; only a run that failed or was cancelled is rerun`; of a run that passed: `run <id> passed; only a run that failed or was cancelled is rerun` (`ended <conclusion>` for one `skipped`, `neutral`, ...).
- A second `--rerun` of a run, or a run rerun by hand (an attempt past the first): `run <id> was rerun before (attempt <n>); arthur ci reruns a run once, and a further rerun is the owner's, on GitHub`.
- GitHub's refusal, in the words of `docs/github.md`, "Failures": a token refused, a 403 naming the permission the token needs, a 404, a rate limit with the time of the next request.

Wrong usage (no branch, two, an unknown flag) prints the usage line and exits 2.

## What the coordinator does with it

The wake of a failed run names what to do for each case. Run `arthur ci <branch>` first: a failure in the branch's own code goes back to its worker (`arthur continue <job> '<the failed step and its lines>'`), or to the owner on main or a branch no job has, which has no worker; one that looks transient (a network error, a runner lost, a timeout in a step that passed before) is what `--rerun` is for, once. A rerun that fails again goes to the owner.
