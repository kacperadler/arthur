# arthur stop

Usage: `arthur stop <id>`

Stops a running job, named by its full id (`2026-10-16-worker-b046ca2a`), and prints `<id>: stopped` once its `state` is final. It sends SIGTERM to the job's wrapper, whose `pid` the record holds; the wrapper runs the stop, the same one a job at its time or budget limit gets:

1. SIGTERM to the agent's process group: the agent and every process it started (a bash call's `npm test`, a server).
2. When any of them is still alive after a grace of 5 seconds, SIGKILL to the group. The log says `the agent's process group is still alive 5 seconds after SIGTERM: SIGKILL`.
3. SIGKILL to each process below the agent that had left its group (a daemon that called `setsid`), as seen before each signal. The log says `SIGKILL to <pid>, which had left the agent's process group: <command>` for each.
4. SIGKILL to every other process left in the job's systemd scope, which also takes one that left before it could be seen (a job that runs bare has no scope).

Then the wrapper writes the end as usual (see `arthur spawn --help`), `state` last: `stopped`, reason `the job was stopped by arthur stop`, the log saying `arthur stop: stopping the agent` first; then `job-ended`. A job stopped this way is not resumed at its budget. When a limit stopped the job first, its state stays that limit and `arthur stop` prints `<id>: ended <state> before the stop`; so it does when the agent ended on its own as the stop came (the log says `arthur stop: the agent had ended already`).

Refused (exit code 1, the reason after `arthur stop: `):

- An id with no record in `<home>/jobs/`: `<id>: no such job in <home>/jobs`.
- A job that is not running: `<id> is <state>, not running; nothing to stop`, `<state>` being `done`, `failed`, `stopped`, `limit: time`, `limit: budget`, or `not started yet` for a record without a state.
- A job whose state says running but whose wrapper is gone, or whose pid another process took since: `<id>: its wrapper <pid> is gone though its state says running; nothing to stop`. No signal is sent.
- A wrapper that has not written the end 15 seconds after SIGTERM: `<id>: its wrapper <pid> did not end the job within 15 seconds of SIGTERM`.
- A config or a plugin that does not load: the record's home folder is the config's, so `arthur.config.ts did not load:`, then the reasons.

Wrong usage (no id, more than one, a flag) prints the usage line and exits 2.
